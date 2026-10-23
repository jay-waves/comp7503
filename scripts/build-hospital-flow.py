"""Generate an importable Dashboard 2 starter without credentials."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
example=json.loads((root/'docs/HKO.Flow.dashboard2.json').read_text())
nodes=[{'id':'ha-tab','type':'tab','label':'HK Healthcare starter','disabled':False,'info':'A&E every 15 minutes; SOP checked daily. Import and deploy.'}]
def node(id,type,name,wires=None,**kw):
    n=dict(id=id,type=type,z='ha-tab',name=name,x=kw.pop('x',400),y=kw.pop('y',100+len(nodes)*35),wires=wires or [],**kw);nodes.append(n);return n
client=next(n.copy() for n in example if n['type']=='mongodb4-client');client.update(id='ha-mongo',name='HA / Compose MongoDB',uriTabActive='tab-uri-advanced');nodes.append(client)
for typ,id in [('ui-base','ha-ui'),('ui-page','ha-page'),('ui-group','ha-group'),('ui-theme','ha-theme')]:
 n=next(n.copy() for n in example if n['type']==typ);n['id']=id
 if typ=='ui-base': n.update(name='HK Healthcare',path='/dashboard/healthcare')
 if typ=='ui-page': n.update(name='Hospital waiting times',ui='ha-ui',path='/overview',theme='ha-theme')
 if typ=='ui-group': n.update(name='Hospital waiting times',page='ha-page',showTitle=False)
 if typ=='ui-theme': n.update(name='Healthcare',colors=dict(surface='#ffffff',primary='#087e8b',bgPage='#f3f6f8',groupBg='#ffffff',groupOutline='#e1e8ec'),sizes=dict(density='default',pagePadding='20px',groupGap='20px',groupBorderRadius='12px',widgetGap='0px'))
 nodes.append(n)
for tag,period,url in [('ae','900','https://www.ha.org.hk/opendata/aed/aedwtdata2-en.json'),('sop','86400','https://www.ha.org.hk/opendata/sop/sop-waiting-time-en.json')]:
 node(tag+'-tick','inject',tag+' scheduled collection',[[tag+'-http']],repeat=period,once=True,onceDelay='5' if tag=='ae' else '15',props=[{'p':'payload'}],payloadType='date')
 node(tag+'-http','http request',tag+' official JSON',[[tag+'-prepare']],method='GET',ret='obj',url=url,requestTimeout='20000',paytoqs=False,persist=False)
 func="""if (msg.statusCode !== 200) { node.error('HTTP '+msg.statusCode,msg); return null; }
const data=msg.payload;
const now=new Date();
"""
 if tag=='ae':
  func+="""if (!data || !Array.isArray(data.waitTime) || !data.waitTime.length || !data.updateTime || data.waitTime.some(r=>!r.hospName || !('t45p50' in r))) { node.error('AE schema changed',msg); return null; }
// updateTime is Hong Kong local time; never parse dd/mm via new Date(string).
const m=data.updateTime.match(/^(\\d{2})\\/(\\d{2})\\/(\\d{4})\\s+(\\d{1,2}):(\\d{2})\\s*(AM|PM)$/i);
if (!m) { node.error('Unknown source timestamp',msg); return null; }
let h=Number(m[4])%12+(m[6].toUpperCase()==='PM'?12:0);
const sourceTime=new Date(`${m[3]}-${m[2]}-${m[1]}T${String(h).padStart(2,'0')}:${m[5]}:00+08:00`);
if (!Number.isFinite(+sourceTime)) { node.error('Invalid source timestamp',msg); return null; }
const doc={_id:'ae:'+sourceTime.toISOString(), sourceTime, fetchedAt:now, sourceUrl:'https://www.ha.org.hk/opendata/aed/aedwtdata2-en.json', raw:data};
msg.view={...data,sourceISO:sourceTime.toISOString(),fetchedAt:now.toISOString()};
"""
 else:
  func+="""if (!Array.isArray(data) || !data.length || data.some(r=>!r.date_id_from || !r.date_id_to || !r.cluster || !r.specialty || !r.Category)) { node.error('SOP schema changed',msg); return null; }
// Row-level revision ID preserves corrections without treating daily polls as history.
msg.payload=[data.map(r=>{
 const id=JSON.stringify([r.date_id_from,r.date_id_to,r.cluster,r.specialty,r.Category,r.Description,r.Value]);
 return {updateOne:{filter:{_id:id},update:{$setOnInsert:{raw:r,fetchedAt:now,sourceUrl:'https://www.ha.org.hk/opendata/sop/sop-waiting-time-en.json'},$set:{lastSeenAt:now}},upsert:true}};
}),{ordered:false}];
return msg;
"""
 if tag=='ae': func+="""msg.payload=[{_id:doc._id},{$setOnInsert:doc,$set:{lastSeenAt:now}},{upsert:true}];
return msg;"""
 node(tag+'-prepare','function','Validate and prepare idempotent write',[[tag+'-save']],func=func,outputs=1,noerr=0)
 node(tag+'-save','mongodb4','Upsert source records',[[tag+'-view']] if tag=='ae' else [['ha-debug']],collection='ha_'+tag+'_snapshots',operation='updateOne' if tag=='ae' else 'bulkWrite',clientNode='ha-mongo',mode='collection',output='toArray',handleDocId=False)
seed=json.loads((root/'data/hospital-locations.json').read_text())
node('ae-view','function','Attach hospital locations and update dashboard',[['ha-panel','ha-heatmap-query','ha-comparison-view','ha-history-query']],func='const seed='+json.dumps(seed)+'; flow.set("haLastView",msg.view); msg.payload={...msg.view,locations:flow.get("haLocations") || seed.hospitals}; return msg;',outputs=1,noerr=0)
node('ha-location-tick','inject','Refresh official hospital locations weekly',[['ha-location-http']],repeat='604800',once=True,onceDelay='2',props=[{'p':'payload'}],payloadType='date')
node('ha-location-http','http request','Official hospital directory',[['ha-location-prepare']],method='GET',ret='obj',url=seed['sourceUrl'],requestTimeout='20000',paytoqs=False,persist=False)
node('ha-location-prepare','function','Validate and cache official coordinates',[['ha-panel','ha-comparison-view']],func='''if(msg.statusCode!==200 || !Array.isArray(msg.payload)){node.error('Invalid hospital directory',msg);return null;}
const hospitals={};
for(const r of msg.payload){
 if(r.with_AE_service_eng!=='Yes') continue;
 const lat=Number(r.latitude),lon=Number(r.longitude);
 if(typeof r.institution_eng!=='string' || !Number.isFinite(lat)||!Number.isFinite(lon)||lat<22||lat>23||lon<113||lon>115){node.error('Invalid hospital coordinates',msg);return null;}
 hospitals[r.institution_eng]={lat,lon,cluster:r.cluster_eng,address:r.address_eng};
}
if(Object.keys(hospitals).length===0){node.error('Empty hospital directory',msg);return null;}
flow.set('haLocations',hospitals);
const view=flow.get('haLastView');if(!view)return null;
msg.payload={...view,locations:hospitals};return msg;''',outputs=1,noerr=0)
node('ha-comparison-view','function','Publish current hospital data to independent cards',[['ha-chart-urgent','ha-chart']],func="if (!Array.isArray(msg.payload?.waitTime)) return null; flow.set('haChartView',msg.payload); return {raw:msg.payload};",outputs=1,noerr=0)
shared_style=(root/'dashboards/hospital-shared.css').read_text()
def styled_template(name):
 return (root/'dashboards'/name).read_text().replace('<style>', '<style>\n'+shared_style+'\n', 1)
comparison_template=styled_template('hospital-regional-comparison.vue')
for chart_id,category,title,order in [('ha-chart-urgent','t3','III urgent comparison and history',2),('ha-chart','t45','IV/V comparison and history',3)]:
 node(chart_id,'ui-template','Dashboard: '+title,[['ha-history-query']],group='ha-group',page='',ui='',order=order,width=12,height=0,head='',format=comparison_template.replace("category:'t45'",f"category:'{category}'"),storeOutMessages=False,passthru=False,resendOnRefresh=True,templateScope='local')
node('ha-panel','ui-template','Dashboard: Hospital overview',[['ha-live-query']],info='Receives live A&E data and renders the hospital overview.\n\n[Open Hospital Dashboard](/dashboard/healthcare/overview)',group='ha-group',page='',ui='',order=1,width=12,height=0,head='',format=styled_template('hospital-overview.vue'),storeOutMessages=False,passthru=False,resendOnRefresh=True,templateScope='local')
node('ha-heatmap-start','inject','Load historical heatmap at startup',[['ha-heatmap-query','ha-history-query']],repeat='',once=True,onceDelay='10',props=[{'p':'payload'}],payloadType='date')
node('ha-heatmap-query','function','Query 28-day weekday and hour medians',[['ha-heatmap-db']],func=(root/'scripts/hospital-heatmap-query.js').read_text(),outputs=1,noerr=0)
node('ha-heatmap-db','mongodb4','Aggregate historical A&E snapshots',[['ha-heatmap-result']],collection='ha_ae_snapshots',operation='aggregate',clientNode='ha-mongo',mode='collection',output='toArray',handleDocId=False)
node('ha-heatmap-result','function','Attach expected sample coverage',[['ha-heatmap-panel']],func=(root/'scripts/hospital-heatmap-result.js').read_text(),outputs=1,noerr=0)
node('ha-heatmap-panel','ui-template','Dashboard: Waiting-time heatmap',[],info='Receives the historical aggregation and renders the weekday-by-hour heatmap.\n\n[Open Hospital Dashboard](/dashboard/healthcare/overview)',group='ha-group',page='',ui='',order=5,width=12,height=0,head='',format=styled_template('hospital-heatmap.vue'),storeOutMessages=False,passthru=False,resendOnRefresh=True,templateScope='local')
node('ha-backfill-tick','inject','Backfill last 28 days of A&E history',[['ha-backfill-exec']],repeat='',once=True,onceDelay='30',props=[{'p':'payload'}],payloadType='date')
node('ha-backfill-exec','exec','Download archives and upsert history',[['ha-backfill-refresh'],['ha-debug'],['ha-debug']],command='node /opt/comp7503/scripts/backfill-hospital-ae.js',addpay=False,append='',useSpawn='false',timer='0',winHide=False,oldrc=False)
node('ha-backfill-refresh','function','Refresh charts after backfill',[['ha-heatmap-query','ha-history-query']],func="try{msg.backfill=JSON.parse(msg.payload)}catch(error){node.error('A&E archive backfill failed',msg);return null;} msg.payload=new Date(); return msg;",outputs=1,noerr=0)
node('ha-live-start','inject','Restore latest hospital snapshot at startup',[['ha-live-query']],repeat='',once=True,onceDelay='1',props=[{'p':'payload'}],payloadType='date')
node('ha-live-query','function','Read latest hospital snapshot',[['ha-live-db']],func=(root/'scripts/hospital-live-query.js').read_text(),outputs=1,noerr=0)
node('ha-live-db','mongodb4','Restore current hospital data',[['ha-live-result']],collection='ha_ae_snapshots',operation='aggregate',clientNode='ha-mongo',mode='collection',output='toArray',handleDocId=False)
node('ha-live-result','function','Restore dashboard view from persisted snapshot',[['ae-view']],func=(root/'scripts/hospital-live-result.js').read_text(),outputs=1,noerr=0)
node('ha-history-query','function','Query seven days of chronological snapshots',[['ha-history-db']],func=(root/'scripts/hospital-history-query.js').read_text(),outputs=1,noerr=0)
node('ha-history-db','mongodb4','Read historical line chart snapshots',[['ha-history-result']],collection='ha_ae_snapshots',operation='aggregate',clientNode='ha-mongo',mode='collection',output='toArray',handleDocId=False)
node('ha-history-result','function','Format chronological history',[['ha-chart-urgent','ha-chart']],func=(root/'scripts/hospital-history-result.js').read_text(),outputs=1,noerr=0)
node('ha-history-catch','catch','History query errors',[['ha-history-error']],scope=['ha-history-query','ha-history-db','ha-history-result'],uncaught=False)
node('ha-history-error','function','Report history unavailable',[['ha-chart-urgent','ha-chart']],func="return {topic:'ha-history-error',payload:'Historical data could not be loaded. Check the database connection.'};",outputs=1,noerr=0)
node('ha-catch','catch','Collection and database errors',[['ha-error']],scope=None,uncaught=False)
node('ha-error','function','Summarize errors',[['ha-debug']],func="msg.payload={message:msg.error?.message || 'Unknown error',source:msg.error?.source?.id,statusCode:msg.statusCode,at:new Date().toISOString()};return msg;",outputs=1,noerr=0)
node('ha-debug','debug','HA status and errors',[],active=True,tosidebar=True,console=False,tostatus=False,complete='payload',targetType='msg')
# This is the clean seed for first startup. Never write to node-red/data/flows.json;
# that persistent runtime copy belongs to edits made in the Node-RED Editor.
(root/'flows/hospital-starter.dashboard2.json').write_text(json.dumps(nodes,ensure_ascii=False,indent=2)+'\n')
