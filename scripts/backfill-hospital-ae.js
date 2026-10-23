// One-time, idempotent backfill of the latest 28 days of official A&E snapshots.
const AdmZip = require('/usr/src/node-red/node_modules/adm-zip')
const {MongoClient} = require('/usr/src/node-red/node_modules/mongodb')

const resourceUrl = 'https://www.ha.org.hk/opendata/aed/aedwtdata2-en.json'
const api = 'https://app.data.gov.hk/v1/historical-archive'
const now = new Date()
const start = new Date(now.getTime() - 28 * 86400000)
const hkDate = d => new Date(d.getTime() + 8 * 3600000)
const dateStamp = d => `${hkDate(d).getUTCFullYear()}${String(hkDate(d).getUTCMonth()+1).padStart(2,'0')}${String(hkDate(d).getUTCDate()).padStart(2,'0')}`
const startDate = dateStamp(start)
const hkNow = hkDate(now)
const endDate = dateStamp(new Date(Date.UTC(hkNow.getUTCFullYear(),hkNow.getUTCMonth(),hkNow.getUTCDate()-1)))
const jobId = 'ae-last28-first-run'

function sourceTime(value) {
  const m = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  const hour = Number(m[4]) % 12 + (m[6].toUpperCase() === 'PM' ? 12 : 0)
  const time = new Date(`${m[3]}-${m[2]}-${m[1]}T${String(hour).padStart(2,'0')}:${m[5]}:00+08:00`)
  return Number.isFinite(+time) ? time : null
}

async function request(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(120000),redirect:'follow'})
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`)
  return response
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured')
  const client = new MongoClient(process.env.MONGODB_URI, {serverSelectionTimeoutMS:30000})
  await client.connect()
  try {
    const db = client.db('comp7503')
    const jobs = db.collection('ha_ae_backfill_jobs')
    const job = await jobs.findOne({_id:jobId})
    if (job?.status === 'complete') {
      console.log(JSON.stringify({skipped:true,reason:'28-day archive already loaded',startDate,completeAt:job.completedAt}))
      return
    }
    if (job?.status === 'running' && Date.now() - new Date(job.startedAt).getTime() < 6*60*60*1000) {
      console.log(JSON.stringify({skipped:true,reason:'backfill already running',startDate}))
      return
    }
    await jobs.updateOne({_id:jobId}, {$set:{status:'running',startedAt:new Date(),rangeStart:start,rangeEnd:endDate}}, {upsert:true})

    const listUrl = new URL(`${api}/list-file-versions`)
    listUrl.searchParams.set('url',resourceUrl)
    listUrl.searchParams.set('start',startDate)
    listUrl.searchParams.set('end',endDate)
    const archiveList = await (await request(listUrl)).json()
    if (!Array.isArray(archiveList['data-files'])) throw new Error('Archive API did not return packaged files')

    // Monthly packages are timestamped on day 1; include them when their month
    // intersects the requested window, then filter individual snapshots below.
    const packages = archiveList['data-files'].filter(file => {
      if (file.period === 'M') {
        const monthStart = new Date(`${file.timestamp.slice(0,4)}-${file.timestamp.slice(4,6)}-01T00:00:00+08:00`)
        const nextMonth = new Date(monthStart.getFullYear(),monthStart.getMonth()+1,1)
        return nextMonth > start && monthStart <= new Date(`${endDate.slice(0,4)}-${endDate.slice(4,6)}-${endDate.slice(6,8)}T23:59:59+08:00`)
      }
      return file.timestamp >= startDate && file.timestamp <= endDate
    }).sort((a,b) => a.timestamp.localeCompare(b.timestamp))

    let snapshotFiles = 0
    let upsertOperations = 0
    const startTime = +start
    const endTime = +now
    const snapshots = db.collection('ha_ae_snapshots')
    for (const file of packages) {
      const downloadUrl = new URL(`${api}/get-file`)
      downloadUrl.searchParams.set('url',resourceUrl)
      downloadUrl.searchParams.set('time',file.timestamp)
      const zip = new AdmZip(Buffer.from(await (await request(downloadUrl)).arrayBuffer()))
      let operations = []
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory || !entry.entryName.endsWith('aedwtdata2-en.json')) continue
        let data
        try { data = JSON.parse(entry.getData().toString('utf8')) } catch { continue }
        const timestamp = sourceTime(data.updateTime)
        if (!timestamp || +timestamp < startTime || +timestamp > endTime || !Array.isArray(data.waitTime)) continue
        const id = `ae:${timestamp.toISOString()}`
        const doc = {_id:id,sourceTime:timestamp,fetchedAt:now,sourceUrl:resourceUrl,raw:data}
        operations.push({updateOne:{filter:{_id:id},update:{$setOnInsert:doc,$set:{lastSeenAt:now}},upsert:true}})
        snapshotFiles++
        if (operations.length === 250) {
          await snapshots.bulkWrite(operations,{ordered:false})
          upsertOperations += operations.length
          operations = []
        }
      }
      if (operations.length) {
        await snapshots.bulkWrite(operations,{ordered:false})
        upsertOperations += operations.length
      }
      console.error(`A&E archive ${file.timestamp}: processed`)
    }
    await jobs.updateOne({_id:jobId}, {$set:{status:'complete',completedAt:new Date(),rangeStart:start,rangeEnd:endDate,archivesProcessed:packages.length,snapshotFiles,upsertOperations}})
    console.log(JSON.stringify({start:start.toISOString(),end:now.toISOString(),archivesProcessed:packages.length,snapshotFiles,upsertOperations}))
  } catch (error) {
    await client.db('comp7503').collection('ha_ae_backfill_jobs').updateOne({_id:jobId}, {$set:{status:'failed',error:String(error.message || error),updatedAt:new Date()}}, {upsert:true}).catch(()=>{})
    throw error
  } finally {
    await client.close()
  }
}

run().catch(error => { console.error(error.stack || error); process.exitCode = 1 })
