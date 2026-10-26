const assert=require('node:assert/strict'),fs=require('node:fs');
const {csv,number,date,normalize}=require('../scripts/health-normalize');
assert.deepEqual(csv('\ufeffa,b\r\n"x,y","z""q"\r\n'),[{a:'x,y',b:'z"q'}]);
for(const v of ['',null,'NA','-'])assert.equal(number(v),null);
for(const value of ['broken','<1','<html>',-1])assert.throws(()=>number(value));
assert.equal(number('0'),0);assert.throws(()=>date('2026-02-30'));assert.throws(()=>normalize('aed','bad\n1'));
const sources=['surge','flu','aed'].map(s=>JSON.parse(fs.readFileSync(`data/health/${s}.json`)));
for(const d of sources){assert(d.rows.length);assert.equal(d.rows.at(-1).date,d.latest);assert(d.rows.every(r=>r.date<=d.latest));}
const surge=sources[0];assert(surge.rows.some(r=>r.med_bed_occ_rate>100));assert(surge.rows.some(r=>r.ped_bed_occ_rate===null));
const latestOverall=surge.rows.find(r=>r.date===surge.latest&&r.cluster==='HA Overall'&&!r.hospital);assert(latestOverall);
const def=new Function(fs.readFileSync('dashboards/health-surveillance.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace('export default','return'))();
const c={...def.data(),now:Date.parse('2026-10-26T12:00:00+08:00')};for(const [k,f]of Object.entries(def.methods))c[k]=f.bind(c);for(const [k,f]of Object.entries(def.computed))Object.defineProperty(c,k,{get:f.bind(c)});
def.watch.msg.handler.call(c,{topic:'ha-health-data',payload:sources});assert.equal(c.overall.ae_first_attend,latestOverall.ae_first_attend);assert(c.old('surge'));assert(!c.old('flu'));assert.equal(c.fluLatest.AandB_proportion,0.1004);assert(Math.abs(c.fluTrend.at(-1).positivity-10.04)<1e-10);assert.equal(c.fmt(null),'—');assert.equal(c.fmt(0),'0');assert.equal(c.change(110,100,'%'),'+10 pp');assert.equal(c.change(null,0),'—');
const path=c.chart([{date:'2026-01-01',v:0},{date:'2026-01-02',v:null},{date:'2026-01-03',v:2},{date:'2026-01-09',v:3}],'v').path;assert.equal((path.match(/M/g)||[]).length,3);assert(!path.includes('NaN'));assert(c.hospitals.length>10);assert.equal(c.rankMax,Math.max(120,...c.hospitals.map(r=>r.med_bed_occ_rate||0)));
const seed=sources;const cache=new Map(),flow={get:k=>cache.get(k),set:(k,v)=>cache.set(k,v)};const restoreBody=new Function('msg','seed','flow',fs.readFileSync('scripts/health-dashboard-result.js','utf8'));const restore=(msg,seed)=>restoreBody(msg,seed,flow);assert.equal(restore({payload:[]},seed).payload.length,3);
const old={...sources[1],latest:'2020-01-01'};assert.equal(restore({payload:[old]},seed).payload.find(d=>d.source==='flu').latest,sources[1].latest);
const updated={...sources[1],fetchedAt:'2099-01-01T00:00:00Z'};assert.equal(restore({payload:[updated]},seed).payload.find(d=>d.source==='flu').fetchedAt,updated.fetchedAt);
const nodes=JSON.parse(fs.readFileSync('flows/hospital-starter.dashboard2.json'));const byId=new Map(nodes.map(n=>[n.id,n]));for(const n of nodes){for(const w of n.wires||[])for(const id of w)assert(byId.has(id));if(n.type==='function')new Function('msg','node','flow',n.func);}
for(const source of ['surge','flu','aed']){assert.equal(byId.get(`ha-health-${source}-tick`).repeat,'86400');assert.equal(byId.get(`ha-health-${source}-save`).collection,'ha_health_sources')}
console.log('PASS: official snapshots, CSV/null validation, units, source dates, gap charts, independent source restoration and generated flow syntax');

// Other sources and database restores must not clear a source-specific failure.
def.watch.msg.handler.call(c,{topic:'ha-health-error',errors:{surge:'surge failed'}});
def.watch.msg.handler.call(c,{topic:'ha-health-data',payload:[sources[1]]});assert.equal(c.error,'surge failed');
cache.set('haHealthErrors',{surge:'surge failed',flu:'flu failed',database:'read failed'});
const restored=restore({payload:[]},seed);assert.deepEqual(restored.errors,{surge:'surge failed',flu:'flu failed'});
const saved=new Function('msg','flow','node',fs.readFileSync('scripts/health-source-saved.js','utf8'));
const messages=[],node={error:m=>messages.push(m)};
assert.equal(saved({healthSource:'surge',payload:{acknowledged:true,modifiedCount:0,upsertedCount:0}},flow,node),null);assert.equal(messages.length,1);assert(cache.get('haHealthErrors').surge);
saved({healthSource:'flu',payload:{acknowledged:true,modifiedCount:1,upsertedCount:0}},flow,node);assert.deepEqual(cache.get('haHealthErrors'),{surge:'surge failed'});
const prepare=new Function('msg','node','normalize','source','url',fs.readFileSync('scripts/health-source-prepare.js','utf8'));
const prepared=prepare({statusCode:200,payload:'input'},node,()=>sources[0],'surge','official');
assert.deepEqual(prepared.payload[1][0].$replaceWith.$cond[0].$or[1],{$lte:['$latest',{$literal:sources[0].latest}]});
assert.equal(prepared.payload[1][0].$replaceWith.$cond[2],'$$ROOT');
assert.throws(()=>csv('a,b\n1,2,3'));assert.throws(()=>csv('a,a\n1,2'));
const header='year,week,start_date,end_date,ili_weekly_average_rate,hfmd_weekly_average_rate,age_weekly_average_rate,acj_weekly_average_rate';
assert.throws(()=>normalize('aed',header+'\n2026,1,2026-01-01,2026-01-07,broken,0,1,2'));
console.log('PASS: source-scoped error recovery, rejected stale writes and strict malformed data validation');
// Latest-week composition uses only listed typed detections as its denominator.
assert.equal(c.virusMix.total,885);assert.equal(c.virusMix.complete,true);
assert(Math.abs(c.virusMix.parts.reduce((sum,p)=>sum+p.share,0)-100)<1e-10);
assert.equal(c.virusMix.parts[0].label,'A(H1)');assert(c.virusMixLabel.includes('2026-10-17'));
const originalFlu=c.documents.flu;
function setMix(values){c.documents.flu={...originalFlu,rows:[{date:'2026-10-17',start:'2026-10-11',...values}]}}
setMix({H1:10,H3:null,B:2});assert.equal(c.virusMix.complete,false);assert.equal(c.virusMix.total,null);assert(c.virusMix.parts.every(p=>p.share===null));
setMix({H1:0,H3:0,B:0});assert.equal(c.virusMix.total,0);assert(c.virusMix.parts.every(p=>p.share===null));
setMix({H1:0,H3:10,B:0});assert.equal(c.virusMix.parts[1].share,100);assert.equal(c.virusMix.parts[1].offset,0);
setMix({H1:1,H3:1,B:1});assert(Math.abs(c.virusMix.parts[2].offset-200/3)<1e-10);
c.documents.flu=originalFlu;
console.log('PASS: donut denominator, percentage sum, null/zero/single-subtype states and reporting week');
