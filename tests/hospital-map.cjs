// Dependency-free checks for map/data integration; no browser required.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const template = fs.readFileSync('dashboards/hospital-overview.vue', 'utf8');
const script = template.match(/<script>([\s\S]*?)<\/script>/)[1];
const component = new Function(script.replace('export default', 'return'))();
const locations = JSON.parse(fs.readFileSync('data/hospital-locations.json')).hospitals;
assert.equal(Object.keys(locations).length, 18);
for (const location of Object.values(locations)) {
  assert(location.lat > 22 && location.lat < 23);
  assert(location.lon > 113 && location.lon < 115);
}
const name = Object.keys(locations)[0];
const c = {...component.data(), msg:{payload:{locations,waitTime:[
  {hospName:name,t45p50:'2.5 hours',t3p50:'45 minutes'},
  {hospName:'Unmatched hospital',t45p50:'Unknown',t3p50:'0 minute'}
]}}};
for(const [key,fn] of Object.entries(component.methods))c[key]=fn.bind(c);
component.watch.msg.handler.call(c,c.msg);
for(const [key,fn] of Object.entries(component.computed))Object.defineProperty(c,key,{get:fn.bind(c)});
assert.equal(c.hospitalLocation('St John Hospital'),locations['St. John Hospital']);
assert.equal(c.mappedHospitals.length,1);
assert.deepEqual(c.unmappedHospitals,['Unmatched hospital']);
c.selectedName=name;
assert.equal(c.selectedHospital.location.address,locations[name].address);
assert.equal(c.markerColor('0 minute'),'#087e8b');
assert.equal(c.markerColor('1 hour'),'#4e9da5');
assert.equal(c.markerColor('3 hours'),'#df7025');
assert.equal(c.markerColor('6 hours'),'#bd3245');
assert.equal(c.markerColor('less than 15 minutes'),'#7d8792');
assert.equal(c.minutes('2.5 hours'),150);
assert.equal(c.ranked[0].hospName,name);
assert(!template.includes('Compare waiting times'));
assert(!template.includes('notifyChartMetric'));
assert(!('metric' in component.data()));
// Exercise marker creation, text-only labels, selection and initial bounds.
let markerCount=0, fitCount=0;
global.document={createElement:()=>({textContent:''})};
global.window={L:{circleMarker:(coords,options)=>{assert.equal(options.fillColor,c.markerColor('45 minutes'));markerCount++;return {bindTooltip(label){assert(label.textContent.includes(name));assert(label.textContent.includes('III · Urgent · P50: 45 minutes'));return this},on(){return this},addTo(){return this}}}}};
c._markers={clearLayers(){}};c._map={fitBounds(points){fitCount++;assert.equal(points.length,1)}};
c.refreshMarkers();assert.equal(markerCount,1);c.resetMap();assert.equal(fitCount,1);
const flow=JSON.parse(fs.readFileSync('flows/hospital-starter.dashboard2.json'));
const ids=new Set(flow.map(n=>n.id));assert.equal(ids.size,flow.length);
for(const n of flow){if(n.type==='function')new Function(n.func);for(const ports of n.wires||[])for(const target of ports)assert(ids.has(target))}
console.log('PASS: official coordinates, matching, unknowns, colour bands, removed global selector, markers, bounds and flow syntax');
