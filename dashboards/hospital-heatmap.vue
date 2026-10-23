<template>
<section class="ha-heatmap-panel">
  <h2>Weekly waiting-time patterns</h2>
  <p>Median of published estimates by weekday and hour · Last 28 days · Hong Kong time</p>
  <div class="ha-heatmap-filters">
    <label>Hospital <select v-model="hospital"><option v-for="name in hospitals" :key="name" :value="name">{{name}}</option></select></label>
    <label>Metric <select v-model="metric"><option v-for="m in metrics" :key="m.key" :value="m.key">{{m.label}}</option></select></label>
  </div>
  <p class="ha-heatmap-summary">{{ hospital || 'Waiting for stored observations' }} · {{ sampleCount }} valid samples · Source window: {{ windowLabel }}</p>
  <div class="ha-heatmap-scroll">
    <table class="ha-heatmap" aria-label="Weekday by hour heatmap of published waiting-time estimates">
      <thead><tr><th scope="col">HK time</th><th v-for="hour in 24" :key="hour" scope="col">{{String(hour-1).padStart(2,'0')}}</th></tr></thead>
      <tbody><tr v-for="(day,index) in days" :key="day"><th scope="row">{{day}}</th>
        <td v-for="hour in 24" :key="hour"><button type="button" :style="{background:color(cell(index+1,hour-1))}" :aria-label="describe(index+1,hour-1)" :title="describe(index+1,hour-1)" @click="selected={day:index+1,hour:hour-1}" @focus="selected={day:index+1,hour:hour-1}" @mouseenter="selected={day:index+1,hour:hour-1}"><span>{{cell(index+1,hour-1) ? Math.round(cell(index+1,hour-1).minutes) : '—'}}</span></button></td>
      </tr></tbody>
    </table>
  </div>
  <p class="ha-heatmap-detail" role="status">{{ describe(selected.day,selected.hour) }}</p>
  <div class="ha-heatmap-legend"><span v-for="item in legend" :key="item.label"><i :style="{background:item.color}"></i>{{item.label}}</span></div>
  <p class="ha-heatmap-note">Cells show minutes, not patient counts. P95 cells summarize published P95 estimates, not a pooled patient percentile. Coverage compares valid observations with expected 15-minute slots in the query window. Missing or non-numeric values remain empty. A full weekly pattern needs several weeks of collection.</p>
  <p class="ha-heatmap-note">Query updated: {{ msg?.payload?.generatedAt || 'Awaiting database query' }}</p>
</section>
</template>
<script>
export default {
  data(){return {
    hospital:'',metric:'t45p50',selected:{day:1,hour:0},
    days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    metrics:[{key:'t3p50',label:'III · P50'},{key:'t3p95',label:'III · P95'},{key:'t45p50',label:'IV/V · P50'},{key:'t45p95',label:'IV/V · P95'}],
    legend:[{label:'Under 60 min',color:'#d2eeed'},{label:'60–179 min',color:'#6dbbb5'},{label:'180–359 min',color:'#efbb68'},{label:'360+ min',color:'#d56864'},{label:'No valid data',color:'#edf1f4'}]
  }},
  watch:{hospitals:{immediate:true,handler(names){if(!names.includes(this.hospital))this.hospital=names[0]||''}}},
  methods:{
    cell(day,hour){return this.cellIndex[`${day}:${hour}`]},
    color(cell){return !cell?'#edf1f4':cell.minutes<60?'#d2eeed':cell.minutes<180?'#6dbbb5':cell.minutes<360?'#efbb68':'#d56864'},
    describe(day,hour){
      const cell=this.cell(day,hour), expected=this.msg?.payload?.expected?.[`${day}:${hour}`]||0
      const when=`${this.days[day-1]} ${String(hour).padStart(2,'0')}:00–${String(hour).padStart(2,'0')}:59`
      if(!cell)return `${when}: no valid observations; ${expected} expected collection slots.`
      const coverage=expected?Math.min(100,100*cell.samples/expected).toFixed(0):'0'
      return `${when}: median ${Number(cell.minutes.toFixed(1))} min · ${cell.samples} samples / ${expected} expected slots (${coverage}% coverage).`
    }
  },
  computed:{
    hospitals(){return this.msg?.payload?.hospitals||[]},
    cellIndex(){const index={};for(const row of this.msg?.payload?.cells||[])if(row.hospital===this.hospital&&row.metric===this.metric)index[`${row.day}:${row.hour}`]=row;return index},
    sampleCount(){return Object.values(this.cellIndex).reduce((sum,row)=>sum+row.samples,0)},
    windowLabel(){const start=this.msg?.payload?.windowStart,end=this.msg?.payload?.windowEnd;const format=v=>new Date(v).toLocaleString('en-GB',{timeZone:'Asia/Hong_Kong',dateStyle:'medium',timeStyle:'short'});return start&&end?`${format(start)} – ${format(end)}`:'not available'}
  }
}
</script>
<style>
.ha-heatmap-panel{padding:20px;color:#18313e}.ha-heatmap-panel h2{font-size:23px;margin-bottom:8px}.ha-heatmap-panel>p{font-size:13px}.ha-heatmap-filters{display:flex;flex-wrap:wrap;gap:16px;margin:20px 0}.ha-heatmap-filters label{display:grid;gap:6px;font-size:13px}.ha-heatmap-filters select{padding:8px;background:white;border:1px solid #a6bbc3;border-radius:4px;max-width:100%;color:#18313e}.ha-heatmap-scroll{overflow-x:auto}.ha-heatmap{border-collapse:separate;border-spacing:3px;min-width:780px;width:100%;font-size:11px}.ha-heatmap th{font-weight:500;color:#536a76;text-align:center}.ha-heatmap tbody th{text-align:left}.ha-heatmap td{padding:0}.ha-heatmap td button{display:block;width:100%;height:34px;border-radius:3px;color:#18313e;text-align:center}.ha-heatmap td button:hover,.ha-heatmap td button:focus-visible{outline:2px solid #18313e;outline-offset:1px}.ha-heatmap-detail{background:#f2f6f8;padding:12px;min-height:44px;border-radius:5px}.ha-heatmap-legend{display:flex;flex-wrap:wrap;gap:16px;font-size:12px}.ha-heatmap-legend i{display:inline-block;width:12px;height:12px;margin-right:5px;border-radius:2px}.ha-heatmap-note{color:#536a76;line-height:1.6}.ha-heatmap-summary{color:#536a76}@media(max-width:600px){.ha-heatmap-panel{padding:8px}}
</style>
