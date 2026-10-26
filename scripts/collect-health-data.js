// Run locally: node scripts/collect-health-data.js [directory containing downloaded source files]
const fs=require('node:fs/promises'),path=require('node:path');
const {normalize}=require('./health-normalize');
const urls={surge:'https://www.ha.org.hk/opendata/pas_report/Daily_Services_Statistics/Daily_Services_Statistics_EN.json',flu:'https://www.chp.gov.hk/files/misc/flux_data.csv',aed:'https://www.chp.gov.hk/files/misc/aed_weekly.csv'};
async function main(){
 const directory=path.resolve(__dirname,'../data/health');await fs.mkdir(directory,{recursive:true});let failures=0;
 for(const [source,url]of Object.entries(urls)){try{
 const input=process.argv[2]?await fs.readFile(path.join(process.argv[2],`ha-${source==='aed'?'aed.csv':source==='flu'?'flu.csv':'surge.json'}`),'utf8'):await (async()=>{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.text()})();
 const document={...normalize(source,input),url,fetchedAt:new Date().toISOString()};
 const target=path.join(directory,`${source}.json`);await fs.writeFile(target+'.tmp',JSON.stringify(document)+'\n');await fs.rename(target+'.tmp',target);
 console.log(`${source}: ${document.rows.length} rows; reporting through ${document.latest}`);
 }catch(e){failures++;console.error(`${source}: ${e.message}`)}}process.exitCode=failures?1:0;
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
