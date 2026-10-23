<template>
<section class="ha-panel ha-comparison">
  <h2 class="ha-card-title">{{ categoryLabel }} · {{ category==='t3'?'緊急':'次緊急及非緊急' }}</h2>
  <div class="ha-comparison-layout"><div class="ha-regional">
    <header><h3>Window means · P50 / P95</h3></header>
    <p class="ha-range-note">{{ categoryLabel }} · ● P50 <span class="ha-p95-key">◆ P95</span> · hours (h)</p>
    <h3 class="ha-region-title">{{ selectedRegion }} <small>{{ rows.length }} hospitals</small></h3>
    <p v-if="!rows.length" role="status">No hospital observations for this region.</p>
    <p v-if="!history" role="status">Loading window averages…</p>
    <p v-else-if="!rows.some(r=>r.p50!==null||r.p95!==null)" role="status">No numeric observations in this time window.</p>
    <template v-if="history && rows.length">
      <div class="ha-range-axis"><span></span><div><span v-for="tick in ticks" :key="tick" :style="{left:position(tick)+'%'}">{{ inHours(tick) }}</span></div><span>P50 / P95 · h</span></div>
      <button type="button" v-for="r in rows" :key="r.hospName" class="ha-range-row" :aria-pressed="highlightedHospital===r.hospName" @click="toggleHospital(r.hospName)" :class="{'is-ghost':isGhost(r.hospName),'is-selected':highlightedHospital===r.hospName}">
        <span class="ha-range-name">{{ r.hospName }}</span>
        <span class="ha-range-track" :aria-label="r.hospName + ': Mean P50 ' + r.raw50 + ', mean P95 ' + r.raw95" role="img">
          <i v-for="tick in ticks" :key="tick" class="ha-range-grid" :style="{left:position(tick)+'%'}"></i>
          <span v-if="r.p50!==null && r.p95!==null && r.p95>=r.p50" class="ha-range-band" :style="{left:position(r.p50)+'%',width:position(r.p95-r.p50)+'%'}"></span>
          <span v-if="r.p50!==null" class="ha-range-dot" :style="{left:position(r.p50)+'%'}" :title="'Mean P50: '+r.raw50"></span>
          <span v-if="r.p95!==null" class="ha-range-diamond" :style="{left:position(r.p95)+'%'}" :title="'Mean P95: '+r.raw95"></span>
        </span>
        <span class="ha-range-values" :title="'Numeric samples: P50 '+r.count50+' / P95 '+r.count95">{{ r.p50===null?r.raw50:inHours(r.p50) }} / {{ r.p95===null?r.raw95:inHours(r.p95) }}<small v-if="r.p50!==null && r.p95!==null && r.p95<r.p50">Source percentile order inconsistent</small></span>
      </button>
    </template>

  <div class="ha-filters">
    <v-select v-model="selectedRegion" :items="regionNames" label="Region · 地區" variant="outlined" density="compact" hide-details></v-select>
    <v-select v-model="hours" :items="[{title:'3 hours',value:3},{title:'12 hours',value:12},{title:'24 hours',value:24},{title:'7 days',value:168}]" label="Time window · 時間範圍" variant="outlined" density="compact" hide-details></v-select>
  </div>
  </div>
  <aside class="ha-history">
    <h3>Historical trend</h3>
    <p class="ha-range-note">{{ selectedRegion }} · {{ categoryLabel }} · hours (h) · Hong Kong time (UTC+8)</p>
    <p v-if="historyError" role="status">{{ historyError }}</p>
    <p v-else-if="!history" role="status">Loading historical snapshots…</p>
    <p v-else-if="!validCount" role="status">No numeric historical estimates for this region in the selected window.</p>
    <template v-else>
      <svg class="ha-history-svg" viewBox="0 0 600 350" role="img" :aria-label="selectedRegion+' hospitals P50–P95 history in hours'">
        <text x="55" y="14">hours (h)</text>
        <g v-for="tick in historyTicks" :key="tick"><line x1="55" x2="575" :y1="historyY(tick)" :y2="historyY(tick)" stroke="#dde6eb"/><text x="46" :y="historyY(tick)+4" text-anchor="end">{{ inHours(tick) }}</text></g>
        <g v-for="tick in timeTicks" :key="tick"><text :x="historyX(tick)" y="320" text-anchor="middle">{{ timeLabel(tick) }}</text></g>
        <g v-for="series in lineSeries" :key="'band-'+series.key" class="ha-history-bands" :opacity="isGhost(series.key)?0.15:1"><path v-for="(band,i) in series.bands" :key="i" :d="band" :fill="series.color" fill-opacity="0.12" stroke="none"/></g>
        <g v-for="series in lineSeries" :key="series.key" :opacity="isGhost(series.key)?0.15:1">
          <path v-for="(path,i) in series.upperPaths" :key="'upper-'+i" :d="path" fill="none" :stroke="series.color" stroke-dasharray="4 3" stroke-width="1" stroke-opacity="0.65"/>
          <path v-for="(path,i) in series.paths" :key="i" :d="path" fill="none" :stroke="series.color" :stroke-dasharray="series.dash" stroke-width="2"/>
          <g v-for="point in series.points" :key="point.time"><circle v-if="point.value!==null" :cx="historyX(point.time)" :cy="historyY(point.value)" r="2.5" :fill="series.color"><title>{{ pointDescription(series,point) }}</title></circle><circle v-if="point.p95!==null" :cx="historyX(point.time)" :cy="historyY(point.p95)" r="2" fill="white" :stroke="series.color"><title>{{ pointDescription(series,point) }}</title></circle></g>
        </g>
      </svg>
    </template>
    <div class="ha-hospital-legend" aria-label="Click a hospital to highlight its data"><button type="button" v-for="series in lineSeries" :key="series.key" class="ha-hospital-focus" :class="{'is-ghost':isGhost(series.key),'is-selected':highlightedHospital===series.key}" :aria-pressed="highlightedHospital===series.key" @click="toggleHospital(series.key)"><svg width="25" height="10" aria-hidden="true"><line x1="0" x2="25" y1="5" y2="5" :stroke="series.color" :stroke-dasharray="series.dash" stroke-width="2"/></svg>{{ series.key }}<small v-if="!series.points.length"> · no numeric data</small></button></div>
  </aside></div>
  <footer class="ha-chart-footer">
    <span v-if="history">{{ lineSeries.length }} hospitals · {{ plottedCount }} time points · {{ hours===168?'3-hour medians':'Source resolution' }}</span>
    <details><summary>How to read these charts</summary><div>
      <p>Click a hospital row or legend to focus; click again to reset. All values are hours. Missing or text-only values are not plotted. Source: Hospital Authority.</p><p>Left: arithmetic means of published P50 and P95 estimates in the selected window, not patient-level averages or pooled percentiles.</p>
      <p>Right: solid P50 line, shaded P50–P95 band and dashed P95 upper edge. The band is not a confidence interval. Hover a point for values and samples.</p>
      <p>{{ hours===168 ? '7 days: separate 3-hour medians of published P50/P95 estimates in Hong Kong time; empty intervals break lines.' : 'Source observations: missing values and gaps over 30 minutes break lines.' }} <template v-if="history">{{ validCount }} numeric estimates used.</template></p>
    </div></details>
  </footer>
</section>
</template>
<script>
export default {
  data(){return {category:'t45',highlightedHospital:null,selectedRegion:'Hong Kong Island · 港島',hours:24,liveView:null,history:null,historyError:'',regionNames:['Hong Kong Island · 港島','Kowloon · 九龍','New Territories East · 新界東','New Territories West · 新界西','Tsuen Wan & Kwai Tsing · 荃灣／葵青','Tseung Kwan O · 將軍澳','Islands · 離島','Region unassigned · 地區待確認']}},
  mounted(){this.send({topic:'ha-history-request'})},
  watch:{selectedRegion(){this.highlightedHospital=null},msg:{immediate:true,handler(value){
    if(value?.raw?.waitTime)this.liveView=value.raw;
    if(value?.topic==='ha-history'){this.history=value.payload;this.historyError=''}
    if(value?.topic==='ha-history-error')this.historyError=value.payload;
  }}},
  methods:{
    toggleHospital(name){this.highlightedHospital=this.highlightedHospital===name?null:name},
    isGhost(name){return this.highlightedHospital!==null&&this.highlightedHospital!==name},
    pointDescription(series,point){
      const interval=this.hours===168?this.timeLabel(point.start,true)+' – '+this.timeLabel(point.end,true)+' · 3-hour medians · P50 '+point.samples+' / P95 '+point.samples95+' numeric samples':this.timeLabel(point.time,true);
      const format=value=>value===null?'Not available':this.inHours(value)+' h';
      const gap=point.value!==null&&point.p95!==null?(point.p95>=point.value?this.inHours(point.p95-point.value)+' h':'source percentile order inconsistent'):'Not available';
      return series.key+' · '+interval+' · P50: '+format(point.value)+' / P95: '+format(point.p95)+' / gap: '+gap;
    },
    segments(points,predicate){
      const segments=[];let segment=[],previous=null;const maxGap=this.hours===168?3*3600000:30*60000;
      for(const point of points){
        if(!predicate(point)){if(segment.length)segments.push(segment);segment=[];previous=null;continue}
        if(previous!==null&&point.time-previous>maxGap){if(segment.length)segments.push(segment);segment=[]}
        segment.push(point);previous=point.time;
      }
      if(segment.length)segments.push(segment);return segments;
    },
    median(values){if(!values.length)return null;values.sort((a,b)=>a-b);const i=Math.floor(values.length/2);return values.length%2?values[i]:(values[i-1]+values[i])/2},
    inHours(value){return Number((value/60).toFixed(2)).toString()},
    historyX(time){return 55+(time-this.windowStart)/(this.windowEnd-this.windowStart)*520},
    historyY(value){return 285-value/this.historyMaximum*260},
    timeLabel(time,full=false){return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',...(full||this.hours>24?{day:'2-digit',month:'2-digit'}:{}),hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(time))},
    minutes(value){const m=String(value??'').match(/^(\d+(?:\.\d+)?)\s*(minute|hour)s?$/i);return m?Number(m[1])*(m[2].toLowerCase()==='hour'?60:1):null},
    position(value){return value/this.maximum*100},
    region(name){
      if(['Pamela Youde Nethersole Eastern Hospital','Queen Mary Hospital','Ruttonjee Hospital'].includes(name))return 'Hong Kong Island · 港島';
      if(['Kwong Wah Hospital','Queen Elizabeth Hospital','United Christian Hospital','Caritas Medical Centre'].includes(name))return 'Kowloon · 九龍';
      if(['Alice Ho Miu Ling Nethersole Hospital','North District Hospital','Prince of Wales Hospital'].includes(name))return 'New Territories East · 新界東';
      if(['Pok Oi Hospital','Tin Shui Wai Hospital','Tuen Mun Hospital'].includes(name))return 'New Territories West · 新界西';
      if(['Princess Margaret Hospital','Yan Chai Hospital'].includes(name))return 'Tsuen Wan & Kwai Tsing · 荃灣／葵青';
      if(name==='Tseung Kwan O Hospital')return 'Tseung Kwan O · 將軍澳';
      if(['North Lantau Hospital','St John Hospital','St. John Hospital'].includes(name))return 'Islands · 離島';
      return 'Region unassigned · 地區待確認'
    }
  },
  computed:{
    categoryLabel(){return this.category==='t3'?'III · Urgent':'IV/V · Semi-urgent & non-urgent'},
    hospitalNames(){return [...new Set([...(this.liveView?.waitTime||[]).map(r=>r.hospName),...(this.history?.snapshots||[]).flatMap(s=>(s.hospitals||[]).map(r=>r.hospName))])].filter(name=>this.region(name)===this.selectedRegion).sort()},
    windowEnd(){return Date.parse(this.history?.windowEnd)||Date.now()},
    windowStart(){return this.windowEnd-this.hours*3600000},
    historyRows(){return (this.history?.snapshots||[]).map(s=>({time:Date.parse(s.time),hospitals:s.hospitals||[]})).filter(s=>Number.isFinite(s.time)&&s.time>=this.windowStart&&s.time<=this.windowEnd).sort((a,b)=>a.time-b.time)},
    historySamples(){return this.hospitalNames.map(name=>{
      const raw=this.historyRows.map(s=>{const row=s.hospitals.find(r=>r.hospName===name);const value=this.minutes(row?.[this.category+'p50']),p95=this.minutes(row?.[this.category+'p95']);return {time:s.time,value,p95,samples:value===null?0:1,samples95:p95===null?0:1}});
      if(this.hours!==168)return {name,points:raw};
      const step=3*3600000,offset=8*3600000;
      const floor=time=>Math.floor((time+offset)/step)*step-offset;
      const buckets=new Map();
      for(const point of raw){const key=floor(point.time);if(!buckets.has(key))buckets.set(key,{p50:[],p95:[]});const bucket=buckets.get(key);if(point.value!==null)bucket.p50.push(point.value);if(point.p95!==null)bucket.p95.push(point.p95)}
      const points=[];
      for(let start=floor(this.windowStart);start<=this.windowEnd;start+=step){
        const bucket=buckets.get(start)||{p50:[],p95:[]};
        const value=this.median(bucket.p50),p95=this.median(bucket.p95);
        const left=Math.max(start,this.windowStart),right=Math.min(start+step,this.windowEnd);
        points.push({time:(left+right)/2,start,end:start+step,value,p95,samples:bucket.p50.length,samples95:bucket.p95.length});
      }
      return {name,points};
    })},
    historyMaximum(){return Math.ceil(Math.max(60,...this.historySamples.flatMap(s=>s.points.flatMap(p=>[p.value||0,p.p95||0])))/60)*60},
    historyTicks(){return Array.from({length:5},(_,i)=>i*this.historyMaximum/4)},
    timeTicks(){return Array.from({length:4},(_,i)=>this.windowStart+(this.windowEnd-this.windowStart)*i/3)},
    validCount(){return this.lineSeries.reduce((sum,s)=>sum+s.points.reduce((n,p)=>n+p.samples+p.samples95,0),0)},
    plottedCount(){return this.lineSeries.reduce((sum,s)=>sum+s.points.length,0)},
    lineSeries(){const colors=['#087e8b','#b45309','#7c3aed','#be185d','#2563eb','#15803d','#b91c1c','#0e7490','#6d28d9','#4d7c0f','#a16207'];return this.historySamples.map((sample,index)=>{
      const coordinate=(p,key)=>this.historyX(p.time)+' '+this.historyY(p[key]);
      const paths=this.segments(sample.points,p=>p.value!==null).map(segment=>segment.map((p,i)=>(i?'L':'M')+coordinate(p,'value')).join(' '));
      const upperPaths=this.segments(sample.points,p=>p.p95!==null).map(segment=>segment.map((p,i)=>(i?'L':'M')+coordinate(p,'p95')).join(' '));
      const bands=this.segments(sample.points,p=>p.value!==null&&p.p95!==null&&p.p95>=p.value).filter(segment=>segment.length>1).map(segment=>segment.map((p,i)=>(i?'L':'M')+coordinate(p,'p95')).join(' ')+' '+[...segment].reverse().map(p=>'L'+coordinate(p,'value')).join(' ')+' Z');
      return {key:sample.name,color:colors[index%colors.length],dash:index<6?'':'6 3',points:sample.points.filter(p=>p.value!==null||p.p95!==null),paths,upperPaths,bands};
    })},
    rows(){return this.hospitalNames.map(hospName=>{
      const values50=[],values95=[];
      for(const snapshot of this.historyRows){const row=snapshot.hospitals.find(r=>r.hospName===hospName);const p50=this.minutes(row?.[this.category+'p50']),p95=this.minutes(row?.[this.category+'p95']);if(p50!==null)values50.push(p50);if(p95!==null)values95.push(p95)}
      const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
      const p50=mean(values50),p95=mean(values95);
      return {hospName,p50,p95,count50:values50.length,count95:values95.length,raw50:p50===null?'No data':this.inHours(p50)+' h ('+values50.length+' samples)',raw95:p95===null?'No data':this.inHours(p95)+' h ('+values95.length+' samples)'};
    }).sort((a,b)=>(b.p95??-1)-(a.p95??-1))},
    maximum(){return Math.ceil(Math.max(60,...this.rows.flatMap(r=>[r.p50||0,r.p95||0]))/60)*60},
    ticks(){return Array.from({length:5},(_,i)=>this.maximum*i/4)}
  }
}
</script>
<style>
.ha-history-svg{width:100%;height:auto;overflow:visible}
.ha-history-svg text{font-size:11px;fill:#536a76}
.ha-p95-key{color:#956012;margin-left:12px}
.ha-range-note{color:var(--ha-muted);font-size:12px;line-height:1.6;margin:8px 0 16px}
.ha-range-row,.ha-range-axis{display:grid;grid-template-columns:minmax(100px,150px) minmax(60px,1fr) 76px;gap:10px;align-items:center}
.ha-range-row{width:100%;min-height:44px;font:inherit;font-size:12px;color:inherit;text-align:left;border:0;border-radius:6px;background:transparent;cursor:pointer;padding:0}.ha-range-row:hover{background:#e4eff2}.ha-range-row:focus-visible{outline:2px solid var(--ha-primary);outline-offset:2px}
.ha-range-row:nth-child(odd){background:#f4f8fa}
.ha-range-name{padding:8px;font-size:12px}
.ha-range-track{height:32px;position:relative}
.ha-range-axis{font-size:10px;color:#536a76;height:28px}
.ha-range-axis>div{position:relative;height:15px}
.ha-range-axis>div span{position:absolute;transform:translateX(-50%)}
.ha-range-grid{position:absolute;top:0;bottom:0;border-left:1px solid #dde6eb}
.ha-range-band{position:absolute;top:11px;height:10px;background:#91c8cf;border-radius:3px}
.ha-range-dot,.ha-range-diamond{position:absolute;top:11px;width:10px;height:10px;background:#087e8b;transform:translateX(-50%);border-radius:50%}
.ha-range-diamond{background:#b67c20;border-radius:1px;transform:translateX(-50%) rotate(45deg)}
.ha-range-values{font-variant-numeric:tabular-nums;font-size:10px;padding:6px}
.ha-range-values small{display:block;color:#924316}
.ha-hospital-legend{display:grid;gap:8px;font-size:11px;color:#18313e;margin-top:18px}
.ha-hospital-legend>button{display:flex;gap:8px;align-items:center}
.ha-hospital-legend svg{flex-shrink:0}
.ha-hospital-legend small{color:#536a76}
.ha-region-title{font-size:13px!important;line-height:1.5;margin:16px 0!important}
.ha-region-title small{font-size:12px;color:#536a76;font-weight:400}
.ha-hospital-focus{border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;border-radius:4px;padding:6px}
.ha-hospital-focus:hover{background:#e4eff2}
.ha-hospital-focus:focus-visible{outline:2px solid #087e8b;outline-offset:2px}
.ha-range-row.is-selected,.ha-hospital-focus.is-selected{background:#e0f0f2;font-weight:700}
.ha-range-row.is-ghost,.ha-hospital-focus.is-ghost{opacity:0.22}
.ha-range-row,.ha-hospital-focus{transition:opacity .15s,background .15s}
.ha-chart-footer{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:16px 0 0;color:#536a76;font-size:11px;border-top:1px solid #e0eaee;margin-top:20px}
.ha-chart-footer details{max-width:100%}
.ha-chart-footer summary{cursor:pointer;color:#087e8b}
.ha-chart-footer details[open]{flex-basis:100%}
.ha-chart-footer details p{line-height:1.6;margin:8px 0}
.ha-chart-footer details>div{max-width:900px}
.ha-comparison-layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:24px;margin-top:24px}
.ha-regional,.ha-history{min-width:0}
.ha-history{border-left:1px solid var(--ha-border);padding-left:24px}
.ha-comparison-layout h3{font-size:16px;margin:0 0 8px}
.ha-card-title{font-size:20px;margin:0 0 20px}
@media(max-width:1000px){.ha-comparison-layout{grid-template-columns:1fr}.ha-history{border-left:0;border-top:1px solid var(--ha-border);padding:24px 0 0}}@media(max-width:450px){.ha-range-row,.ha-range-axis{grid-template-columns:95px minmax(45px,1fr) 64px;gap:6px}.ha-range-name,.ha-range-values{font-size:10px}}
</style>
