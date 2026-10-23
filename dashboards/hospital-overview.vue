<template>
<section class="ha-overview">
  <header><span class="ha-eyebrow">HONG KONG · PUBLIC HEALTHCARE</span><h1>A&E waiting time overview</h1>
    <p>Published estimates across {{ ranked.length }} hospitals</p>
  </header>
  <div class="ha-toolbar">
    <label>Compare waiting times
      <select v-model="metric"><option v-for="m in metrics" :key="m.key" :value="m.key">{{ m.label }}</option></select>
    </label>
    <div><strong>Source updated</strong><br>{{ msg?.payload?.updateTime || 'Awaiting first collection' }} (Hong Kong)<br><span role="status">{{ freshness }}</span></div>
  </div>
  <p class="ha-note">Categories IV and V are combined by the source. Bars compare published estimates, converted to minutes. Categories I and II retain their original status below.</p>
  <h2>Hospital map <small>{{ mappedHospitals.length }} mapped hospitals · {{ selectedLabel }}</small></h2>
  <p v-if="mapError" class="ha-map-error" role="status">{{ mapError }}</p>
  <div class="ha-map-layout">
    <div ref="hospitalMap" class="ha-map" aria-label="Interactive Hong Kong hospital map"></div>
    <aside class="ha-map-details">
      <template v-if="selectedHospital">
        <h3>{{ selectedHospital.hospName }}</h3>
        <p>{{ selectedHospital.location.cluster }}</p><p>{{ selectedHospital.location.address }}</p>
        <dl><template v-for="m in metrics" :key="m.key"><dt>{{m.label}}</dt><dd>{{selectedHospital[m.key] || 'Not available'}}</dd></template></dl>
        <p>I · {{selectedHospital.t1wt}}<br>II · {{selectedHospital.t2wt}}</p>
      </template>
      <p v-else>Select a hospital marker to inspect its waiting times.</p>
      <button type="button" @click="resetMap">Show all hospitals</button>
    </aside>
  </div>
  <div class="ha-map-legend"><span v-for="item in legend" :key="item.label"><i :style="{background:item.color}"></i>{{item.label}}</span></div>
  <p class="ha-note">Colours show the selected estimate in minutes, using fixed bands across hospitals. Zoom or drag to explore. Locations: Hospital Authority.</p>
  <p v-if="unmappedHospitals.length" class="ha-map-error">No official location match: {{ unmappedHospitals.join(', ') }}</p>
  <h2>Hospital comparison <small>{{ selectedLabel }}</small></h2>
  <div v-if="ranked.length" class="ha-chart" role="img" :aria-label="'Hospital waiting time bar chart: '+selectedLabel">
    <div class="ha-axis">0 min <span>{{ maximum }} min</span></div>
    <div v-for="r in ranked" :key="r.hospName" class="ha-bar-row">
      <span class="ha-hospital">{{ r.hospName }}</span>
      <div class="ha-track"><div class="ha-bar" :style="{width: barWidth(r[metric])}" :title="r.hospName+': '+r[metric]"></div></div>
      <span class="ha-value">{{ r[metric] || 'Not available' }}</span>
    </div>
  </div>
  <p v-else>No data yet. Collection and database errors appear in Node-RED Debug.</p>
  <h2>Published values and triage status</h2>
  <div class="ha-table-wrap"><table><thead><tr><th>Hospital</th><th>{{ selectedLabel }}</th><th>I · Critical</th><th>II · Emergency</th></tr></thead>
    <tbody><tr v-for="r in ranked" :key="r.hospName"><td>{{ r.hospName }}</td><td>{{ r[metric] }}</td><td>{{ r.t1wt }}</td><td>{{ r.t2wt }}</td></tr></tbody>
  </table></div>
  <p class="ha-note">Source: Hospital Authority via DATA.GOV.HK. Estimates support statistical observation and are not individual waiting-time guarantees.</p>
</section>
</template>
<script>
export default {
  data() { return {
    metric: 't45p50', clock: Date.now(), timer: null,
    mapError:'', mapReady:false, selectedName:null,
    legend:[{label:'Under 60 min',color:'#087e8b'},{label:'60–179 min',color:'#d49c16'},{label:'180–359 min',color:'#df7025'},{label:'360+ min',color:'#bd3245'},{label:'Unknown',color:'#7d8792'}],
    metrics: [
      {key:'t3p50', label:'III · Urgent · P50'},
      {key:'t3p95', label:'III · Urgent · P95'},
      {key:'t45p50', label:'IV/V · Semi-urgent & non-urgent · P50'},
      {key:'t45p95', label:'IV/V · Semi-urgent & non-urgent · P95'}
    ]
  } },
  mounted() {
    this.timer = setInterval(() => { this.clock = Date.now() }, 30000)
    this.startMap()
  },
  unmounted() {
    this._disposed=true
    clearInterval(this.timer)
    this._resizeObserver?.disconnect()
    this._map?.remove()
  },
  watch: {
    mappedHospitals: {handler() { this.refreshMarkers() }, deep:true},
    metric() { this.refreshMarkers() }
  },
  methods: {
    hospitalLocation(name) {
      // The official A&E feed omits the period used in the directory.
      const aliases={'St John Hospital':'St. John Hospital'}
      return this.msg?.payload?.locations?.[aliases[name] || name]
    },
    async startMap() {
      try {
        if (!window.L) {
          if (!window.haLeafletPromise) window.haLeafletPromise = new Promise((resolve,reject) => {
            const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';css.crossOrigin='';document.head.appendChild(css)
            const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';script.crossOrigin=''
            const timeout=setTimeout(()=>reject(new Error('Map library timed out')),15000)
            script.onload=()=>{clearTimeout(timeout);resolve()};script.onerror=()=>{clearTimeout(timeout);reject(new Error('Map library unavailable'))};document.head.appendChild(script)
          }).catch(error=>{window.haLeafletPromise=null;throw error})
          await window.haLeafletPromise
        }
        if(this._disposed)return
        const L=window.L
        this._map=L.map(this.$refs.hospitalMap,{scrollWheelZoom:false}).setView([22.31,114.17],12)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{this.mapError='Some map tiles could not load. Hospital markers and the table remain available.'}).addTo(this._map)
        this._markers=L.layerGroup().addTo(this._map)
        this._resizeObserver=new ResizeObserver(()=>this._map?.invalidateSize())
        this._resizeObserver.observe(this.$refs.hospitalMap)
        this.mapReady=true
        this.refreshMarkers()
      } catch(error) {if(!this._disposed)this.mapError='Map could not load. Check access to unpkg.com; the hospital comparison remains available.'}
    },
    markerColor(value) {
      const n=this.minutes(value)
      return n===null?'#7d8792':n<60?'#087e8b':n<180?'#d49c16':n<360?'#df7025':'#bd3245'
    },
    refreshMarkers() {
      if(!this._markers)return
      this._markers.clearLayers()
      for(const r of this.mappedHospitals){
        const label=document.createElement('span')
        label.textContent=r.hospName+': '+(r[this.metric] || 'Not available')
        window.L.circleMarker([r.location.lat,r.location.lon],{radius:this.selectedName===r.hospName?11:8,color:'#ffffff',weight:2,fillColor:this.markerColor(r[this.metric]),fillOpacity:0.95})
          .bindTooltip(label).on('click',()=>{this.selectedName=r.hospName;this.refreshMarkers()}).addTo(this._markers)
      }
    },
    resetMap() {
      if(!this._map || !this.mappedHospitals.length)return
      this._map.fitBounds(this.mappedHospitals.map(r=>[r.location.lat,r.location.lon]),{padding:[25,25],maxZoom:12})
    },
    minutes(value) {
      const match = String(value).match(/^(\d+(?:\.\d+)?)\s*(minute|hour)s?$/i)
      return match ? Number(match[1]) * (match[2].toLowerCase() === 'hour' ? 60 : 1) : null
    },
    barWidth(value) {
      const minutes = this.minutes(value)
      return minutes === null ? '0%' : (100 * minutes / this.maximum) + '%'
    }
  },
  computed: {
    mappedHospitals() {
      return this.ranked.filter(r=>this.hospitalLocation(r.hospName)).map(r=>({...r,location:this.hospitalLocation(r.hospName)}))
    },
    unmappedHospitals() {
      return this.ranked.filter(r=>!this.hospitalLocation(r.hospName)).map(r=>r.hospName)
    },
    selectedHospital() {return this.mappedHospitals.find(r=>r.hospName===this.selectedName)},
    selectedLabel() { return this.metrics.find(m => m.key === this.metric).label },
    freshness() {
      const sourceTime = Date.parse(this.msg?.payload?.sourceISO)
      if (!Number.isFinite(sourceTime)) return 'No source timestamp available'
      const age = Math.max(0, Math.floor((this.clock - sourceTime) / 60000))
      return age > 30 ? `Stale data · updated ${age} minutes ago` : `Updated ${age} minutes ago`
    },
    ranked() {
      return [...(this.msg?.payload?.waitTime || [])].sort((a,b) => {
        const av = this.minutes(a[this.metric]), bv = this.minutes(b[this.metric])
        if (av === null) return bv === null ? 0 : 1
        return bv === null ? -1 : bv - av
      })
    },
    maximum() { return Math.max(1, ...this.ranked.map(r => this.minutes(r[this.metric]) ?? 0)) }
  }
}
</script>
<style>
.ha-map-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(200px,1fr);gap:16px}.ha-map{height:450px;min-width:0;z-index:0;border:1px solid #cbd9df;border-radius:8px;background:#e5eef0}.ha-map-details{padding:16px;background:#f2f6f8;border-radius:8px;font-size:13px}.ha-map-details h3{font-size:18px;margin-bottom:12px}.ha-map-details dt{color:#536a76;font-size:11px;margin-top:10px}.ha-map-details dd{margin:3px 0;font-weight:600}.ha-map-details button{padding:8px 12px;border:1px solid #a6bbc3;border-radius:4px;background:white;margin-top:12px}.ha-map-legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:14px;font-size:12px}.ha-map-legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}.ha-map-error{font-size:12px;color:#924316}@media(max-width:700px){.ha-map-layout{grid-template-columns:1fr}.ha-map{height:360px}}

.ha-overview{padding:20px;color:#18313e}.ha-overview h1{font-size:28px;margin:8px 0}.ha-overview h2{font-size:19px;margin:28px 0 16px}.ha-overview small{display:block;font-size:13px;font-weight:400;margin-top:5px}.ha-eyebrow{font-size:11px;letter-spacing:2px;color:#087e8b}.ha-toolbar{display:flex;flex-wrap:wrap;gap:24px;justify-content:space-between;background:#eef5f7;padding:16px;border-radius:8px;margin-top:20px}.ha-toolbar label{display:grid;gap:8px}.ha-toolbar select{background:white;border:1px solid #a6bbc3;padding:8px;border-radius:4px;max-width:100%;color:#18313e}.ha-note{font-size:12px;line-height:1.6;color:#536a76}.ha-axis{display:flex;justify-content:space-between;margin-left:34%;margin-right:145px;color:#536a76;font-size:11px;border-bottom:1px solid #cbd9df;padding-bottom:6px}.ha-bar-row{display:grid;grid-template-columns:minmax(140px,1fr) minmax(100px,2fr) 125px;gap:12px;align-items:center;margin:12px 0;font-size:12px}.ha-track{background:#edf2f4;border-radius:3px;height:18px;overflow:hidden}.ha-bar{height:100%;background:#087e8b;border-radius:3px;transition:width .25s}.ha-value{font-variant-numeric:tabular-nums}.ha-table-wrap{overflow-x:auto}.ha-overview table{width:100%;border-collapse:collapse;font-size:12px}.ha-overview th{text-align:left;background:#eef5f7}.ha-overview td,.ha-overview th{padding:10px;border-bottom:1px solid #dde6eb}.ha-overview tbody tr:nth-child(even){background:#f8fafb}@media(max-width:600px){.ha-overview{padding:8px}.ha-bar-row{grid-template-columns:minmax(100px,1fr) minmax(60px,1fr) 80px;gap:6px;font-size:10px}.ha-axis{margin-left:35%;margin-right:86px}.ha-toolbar{padding:10px}}
</style>
