<template>
<section class="ha-panel ha-sop">
  <h2>Specialist outpatient waiting times · 專科新症輪候<small>By specialty and hospital cluster · Updated quarterly</small></h2>
  <p v-if="error" role="alert">{{ error }}</p>
  <p v-else-if="!view">Loading specialist outpatient data…</p>
  <p v-else-if="!view.rows.length" role="status">No specialist outpatient data available yet.</p>
  <template v-else>
    <p>Reporting period · 統計期：{{ date(view.from) }} – {{ date(view.to) }}</p>
    <div class="ha-filters">
      <v-select v-model="specialty" :items="specialties" label="Specialty · 專科" variant="outlined" density="compact" hide-details></v-select>
      <v-select v-model="cluster" :items="['All clusters',...clusters]" label="Cluster · 醫院聯網" variant="outlined" density="compact" hide-details></v-select>
    </div>
    <div class="ha-sop-table"><table>
      <thead><tr><th scope="col">Cluster · 聯網</th><th v-for="c in categories" :key="c.key" scope="col">{{ c.label }}</th></tr></thead>
      <tbody><tr v-for="name in visibleClusters" :key="name"><th scope="row">{{ name }}</th><td v-for="c in categories" :key="c.key">{{ value(name,c.key) }}</td></tr></tbody>
    </table></div>
    <p class="ha-note">Values retain source units (weeks). Stable longest = 90th percentile, not the maximum. These are new appointment booking statistics by cluster, not live hospital queues. Cluster names follow the reporting period.</p>
  </template>
  <details class="ha-help"><summary>About this data · 數據說明</summary><p>Urgent and semi-urgent cases show medians; stable cases show median and longest (90th percentile). Quarterly releases may cover overlapping 12-month periods. Data is collected daily; publication is quarterly. Missing values remain unavailable.</p><a href="https://data.gov.hk/en-data/dataset/hospital-hadata-sop-waiting-time" target="_blank" rel="noopener noreferrer">Source: Hospital Authority / DATA.GOV.HK</a></details>
</section>
</template>
<script>
export default {
  data(){return {view:null,error:'',specialty:'',cluster:'All clusters',categories:[{key:'Urgent Case - Median',label:'Urgent · 緊急 (P50)'},{key:'Semi-urgent Case - Median',label:'Semi-urgent · 半緊急 (P50)'},{key:'Stable Case - Median',label:'Stable · 穩定 (P50)'},{key:'Stable Case - The Longest',label:'Stable · 穩定 (P90)'}]}},
  mounted(){this.send({topic:'ha-sop-request'})},
  watch:{msg:{immediate:true,handler(msg){if(msg?.topic==='ha-sop-error'){this.error=msg.payload;return}if(msg?.topic!=='ha-sop-data'||!Array.isArray(msg.payload?.rows))return;this.view=msg.payload;this.error='';if(!this.specialties.includes(this.specialty))this.specialty=this.specialties[0]||'';if(!this.clusters.includes(this.cluster))this.cluster='All clusters'}}},
  computed:{
    specialties(){return [...new Set((this.view?.rows||[]).map(r=>r.specialty))].sort()},
    clusters(){return [...new Set((this.view?.rows||[]).filter(r=>r.specialty===this.specialty).map(r=>r.cluster))].sort()},
    visibleClusters(){return this.cluster==='All clusters'?this.clusters:this.clusters.filter(c=>c===this.cluster)}
  },
  methods:{date(value){const s=String(value||'');return s.length===8?`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`:'Not available'},value(cluster,category){const row=this.view.rows.find(r=>r.specialty===this.specialty&&r.cluster===cluster&&r.Category===category&&/Waiting Time/i.test(r.Description));return row?.Value??'Not available'}}
}
</script>
<style>
.ha-sop-table{overflow-x:auto}.ha-sop table{border-collapse:collapse;width:100%;font-size:13px}.ha-sop th,.ha-sop td{text-align:left;padding:14px 12px;border-bottom:1px solid var(--ha-border)}.ha-sop thead{background:var(--ha-soft)}.ha-sop td{min-width:130px}.ha-sop tbody th{font-weight:500;min-width:180px}
</style>
