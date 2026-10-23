const fs=require('node:fs');
const assert=require('node:assert/strict');
const query=new Function('msg',fs.readFileSync('scripts/hospital-history-query.js','utf8'))({});
assert.equal(query.historyWindow.end,new Date(query.payload[0][0].$match.sourceTime.$lte).toISOString());
assert.equal(Date.parse(query.historyWindow.end)-Date.parse(query.historyWindow.start),7*86400000);
const script=fs.readFileSync('dashboards/hospital-regional-comparison.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const c=new Function(script.replace('export default','return'))();
const ctx={...c.data(),selectedRegion:'Kowloon · 九龍'};
for(const [k,f] of Object.entries(c.methods))ctx[k]=f.bind(ctx);
for(const [k,f] of Object.entries(c.computed))Object.defineProperty(ctx,k,{get:f.bind(ctx)});
const start=Date.parse('2026-10-22T00:00:00Z');
const snapshot=(minutes,p50,p95)=>({time:new Date(start+minutes*60000).toISOString(),hospitals:[{hospName:'Queen Elizabeth Hospital',t45p50:p50,t45p95:p95,t3p50:'5 minutes',t3p95:'10 minutes'},{hospName:'Kwong Wah Hospital',t45p50:'2 hours',t45p95:'4 hours',t3p50:'12 minutes'},{hospName:'Queen Mary Hospital',t45p50:'9 hours'}]});
const payload={snapshots:[snapshot(0,'0 minutes','1 hour'),snapshot(15,'15 minutes','2 hours'),snapshot(30,'Not available','3 hours'),snapshot(45,'30 minutes','2 hours'),snapshot(120,'45 minutes','3 hours')],windowEnd:new Date(start+120*60000).toISOString()};
c.watch.msg.handler.call(ctx,{topic:'ha-history',payload});
assert.equal(ctx.historyRows.length,5);
assert.equal(ctx.lineSeries[1].paths.length,3); // Missing estimate and long time gap both break lines.
assert.equal(ctx.lineSeries[1].points[0].value,0);
assert.equal(ctx.lineSeries.length,2);
assert(ctx.lineSeries.every(s=>s.key!=='Queen Mary Hospital'));
assert.equal(ctx.lineSeries[1].upperPaths.length,2);
assert(ctx.lineSeries[1].bands.length>0);
assert.equal(ctx.historyMaximum,240);
assert.equal(ctx.inHours(90),'1.5');assert.equal(ctx.inHours(15),'0.25');
ctx.category='t3';assert.equal(ctx.lineSeries[1].points[0].value,5);
ctx.selectedRegion='Region unassigned · 地區待確認';assert.equal(ctx.validCount,0);
ctx.selectedRegion='Kowloon · 九龍';ctx.history={...payload,windowEnd:new Date(start+2*86400000).toISOString()};assert.equal(ctx.validCount,0);
ctx.hours=168;assert.equal(ctx.validCount,15);
c.watch.msg.handler.call(ctx,{raw:{waitTime:[{hospName:'A'}]}});assert.equal(ctx.history.snapshots.length,5);
const nodes=JSON.parse(fs.readFileSync('flows/hospital-starter.dashboard2.json'));
for(const n of nodes.filter(n=>n.type==='function'))new Function('msg','flow','node',n.func);
for(const n of nodes)for(const output of n.wires||[])for(const id of output)assert(nodes.some(v=>v.id===id),id);
assert(nodes.find(n=>n.id==='ae-view').wires[0].includes('ha-history-query'));
assert(nodes.find(n=>n.id==='ha-chart').wires[0].includes('ha-history-query'));
assert(!script.includes("hospital:'"));
console.log('PASS: region-wide hospital series, percentile/window filters, hours display, missing/zero values, gap breaks, retained state and flow wiring');
const locations=JSON.parse(fs.readFileSync('data/hospital-locations.json')).hospitals;
const counts={};for(const name of Object.keys(locations)){const region=ctx.region(name);counts[region]=(counts[region]||0)+1;}
assert.equal(counts['New Territories East · 新界東'],3);
assert.equal(counts['New Territories West · 新界西'],3);
assert.equal(counts['Tsuen Wan & Kwai Tsing · 荃灣／葵青'],2);
assert.equal(counts['Tseung Kwan O · 將軍澳'],1);
assert.equal(counts['Islands · 離島'],2);
const urgent=nodes.find(n=>n.id==='ha-chart-urgent'),nonUrgent=nodes.find(n=>n.id==='ha-chart');
assert(urgent.format.includes("category:'t3'"));assert(nonUrgent.format.includes("category:'t45'"));
assert(!urgent.format.includes('v-model="category"'));assert(!nonUrgent.format.includes('v-model="category"'));
for(const id of ['ha-comparison-view','ha-history-result','ha-history-error'])assert.deepEqual(nodes.find(n=>n.id===id).wires[0],['ha-chart-urgent','ha-chart']);
assert(urgent.order<nonUrgent.order);assert(nonUrgent.order<nodes.find(n=>n.id==='ha-heatmap-panel').order);
console.log('PASS: five smaller geographic groups, two fixed-category cards, both cards receive live/history/error updates');
ctx.category='t45';ctx.hours=168;ctx.selectedRegion='Kowloon · 九龍';
const sample=(time,value)=>({time,hospitals:[{hospName:'Queen Elizabeth Hospital',t45p50:value,t45p95:value==='Not available'?value:'120 minutes'}]});
ctx.history={windowEnd:'2026-10-23T02:00:00Z',snapshots:[
 sample('2026-10-22T16:00:00Z','0 minutes'),sample('2026-10-22T16:15:00Z','10 minutes'),sample('2026-10-22T16:30:00Z','100 minutes'),
 sample('2026-10-22T19:00:00Z','20 minutes'),sample('2026-10-22T19:15:00Z','40 minutes'),
 sample('2026-10-22T22:00:00Z','Not available'),sample('2026-10-23T01:00:00Z','60 minutes')
]};
let series=ctx.lineSeries[0];
assert.deepEqual(series.points.map(p=>p.value),[10,30,60]); // Odd/even median, not mean, preserves zero in input.
assert.equal(series.paths.length,2);assert.equal(ctx.validCount,12);assert.equal(ctx.plottedCount,3);
assert.equal(new Date(series.points[0].start).toISOString(),'2026-10-22T16:00:00.000Z'); // HK midnight.
assert.equal(series.points[0].samples,3);assert(ctx.pointDescription(series,series.points[0]).includes('3-hour median'));
assert(series.points.every(p=>p.time>=ctx.windowStart&&p.time<=ctx.windowEnd));
assert.deepEqual(ctx.lineSeries[0].points.map(p=>p.p95),[120,120,120]);
assert.equal(ctx.lineSeries[0].bands.length,1);
assert(ctx.pointDescription(series,series.points[0]).includes('gap:'));
assert(!script.includes('percentile:'));
assert(!urgent.format.includes('v-model="percentile"'));
ctx.hours=24;assert.equal(ctx.lineSeries[0].points.length,6);assert.equal(ctx.lineSeries[0].points[0].value,0);
console.log('PASS: seven-day HK-aligned 3-hour buckets, odd/even medians, sample counts, empty-bucket gaps, paired percentiles, 24-hour raw resolution');
ctx.history.snapshots.push(sample('2026-10-22T12:00:00Z','180 minutes'),sample('2026-10-21T01:00:00Z','600 minutes'));
for(const [hours,expected,count] of [[3,60,1],[12,230/6,6],[24,410/7,7],[168,1010/8,8]]){
 ctx.hours=hours;const row=ctx.rows.find(r=>r.hospName==='Queen Elizabeth Hospital');
 assert(Math.abs(row.p50-expected)<1e-9);assert.equal(row.count50,count);assert.equal(row.p95,120);
}
ctx.selectedRegion='Region unassigned · 地區待確認';assert(ctx.rows.every(r=>r.p50===null&&r.p95===null&&r.count50===0));
assert(urgent.format.includes('<v-select v-model="hours"'));
for(const hours of [3,12,24,168])assert(urgent.format.includes('value:'+hours+'}'));
assert(!urgent.format.includes('ha-history-controls'));
console.log('PASS: 3h/12h/24h/7-day shared windows, raw-observation means (not bucket means), missing exclusion and sample counts');
ctx.toggleHospital('Queen Elizabeth Hospital');assert.equal(ctx.highlightedHospital,'Queen Elizabeth Hospital');assert(ctx.isGhost('Kwong Wah Hospital'));assert(!ctx.isGhost('Queen Elizabeth Hospital'));
ctx.toggleHospital('Kwong Wah Hospital');assert.equal(ctx.highlightedHospital,'Kwong Wah Hospital');
ctx.toggleHospital('Kwong Wah Hospital');assert.equal(ctx.highlightedHospital,null);assert(!ctx.isGhost('Queen Elizabeth Hospital'));
ctx.toggleHospital('Queen Elizabeth Hospital');c.watch.selectedRegion.call(ctx);assert.equal(ctx.highlightedHospital,null);
console.log('PASS: hospital focus, ghosting, switching, deselection and region reset');
