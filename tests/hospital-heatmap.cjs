const fs=require('node:fs');
const assert=require('node:assert/strict');
const query=new Function('msg',fs.readFileSync('scripts/hospital-heatmap-query.js','utf8'))({});
assert(query.payload[0][0].$match.sourceTime.$gte instanceof Date);
const regexStage=query.payload[0].find(stage=>stage.$set?.parsed);
const pattern=new RegExp(regexStage.$set.parsed.$regexFind.regex,'i');
assert.equal(pattern.exec('2.5 hours')[1],'2.5');
assert.equal(pattern.exec('0 minute')[1],'0');
assert.equal(pattern.exec('less than 15 minutes'),null);
const aggregate=query.payload[0].find(stage=>stage.$group).$group;
assert.equal(aggregate._id.day.$isoDayOfWeek.timezone,'Asia/Hong_Kong');
assert.equal(aggregate.minutes.$median.method,'approximate');
const result=new Function('msg',fs.readFileSync('scripts/hospital-heatmap-result.js','utf8'))({
 heatmapWindow:{start:'2026-09-25T08:07:00.000Z',end:'2026-10-23T08:07:00.000Z'},
 payload:[{hospital:'A',metric:'t45p50',day:5,hour:16,minutes:0,samples:2},{hospital:'A',metric:'t3p50',day:5,hour:16,minutes:15,samples:2}]
}).payload;
assert.equal(Object.keys(result.expected).length,168);
assert.equal(Object.values(result.expected).reduce((a,b)=>a+b,0),2688);
assert(Object.values(result.expected).every(n=>n===16));
const script=fs.readFileSync('dashboards/hospital-heatmap.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const component=new Function(script.replace('export default','return'))();
const c={...component.data(),msg:{payload:result},hospital:'A'};
for(const [k,f]of Object.entries(component.methods))c[k]=f.bind(c);
for(const [k,f]of Object.entries(component.computed))Object.defineProperty(c,k,{get:f.bind(c)});
assert.equal(c.cell(5,16).minutes,0);
assert.equal(c.color(c.cell(5,16)),'#d2eeed');
assert.equal(c.color(c.cell(1,0)),'#edf1f4');
assert(c.describe(5,16).includes('2 samples / 16 expected slots (13% coverage)'));
assert(c.describe(1,0).includes('no valid observations'));
c.metric='t3p50';assert.equal(c.cell(5,16).minutes,15);
c.hospital='B';assert.equal(c.sampleCount,0);
console.log('PASS: numeric bounds, HK timezone, aggregation, 28-day expected slots, missing/zero cells and metric filters');
