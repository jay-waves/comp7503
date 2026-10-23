<template>
<section class="ha-panel ha-overview">
  <header class="ha-page-header">
    <div><span class="ha-eyebrow">HONG KONG · PUBLIC HEALTHCARE</span><h1>A&amp;E waiting times</h1><p>{{ ranked.length }} hospitals · Hong Kong time</p></div>
    <div class="ha-source-status"><v-chip size="small" variant="tonal" color="primary" role="status">{{ freshness }}</v-chip><span>Source: {{ liveView?.updateTime || 'Awaiting first collection' }}</span></div>
  </header>
  <v-expansion-panels class="ha-guide" variant="accordion" flat>
    <v-expansion-panel title="Triage categories &amp; reading this dashboard">
      <v-expansion-panel-text>
  <section class="ha-triage-guide" aria-label="Triage categories explained">
    <h2>Triage guide · 分診簡介</h2>
    <p>Patients are prioritised by clinical urgency after assessment by healthcare staff.</p>
    <div class="ha-triage-categories">
      <article><strong>I · Critical · 危殆</strong><span>Highest priority · immediate treatment target</span></article>
      <article><strong>II · Emergency · 危急</strong><span>Target: 95% treated within 15 minutes</span></article>
      <article><strong>III · Urgent · 緊急</strong><span>Target: 90% treated within 30 minutes</span></article>
      <article><strong>IV · Semi-urgent · 次緊急</strong><span>Lower priority than Categories I–III</span></article>
      <article><strong>V · Non-urgent · 非緊急</strong><span>Lowest triage priority</span></article>
    </div>
    <p class="ha-note">Targets are service pledges, not measured compliance or personal waiting-time guarantees. P50 = median estimate; P95 = 95th-percentile estimate. IV/V are combined in the source. “0 minute” does not mean no critical patients or spare capacity. <a href="https://www.ha.org.hk/visitor/ha_serviceguide_details.asp?Content_ID=10051&amp;IndexPage=200066&amp;Lang=ENG" target="_blank" rel="noopener noreferrer">Hospital Authority guide</a></p>
  </section>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
  <h2>Hospital map <small>{{ mappedHospitals.length }} locations · III Urgent · P50</small></h2>
  <p v-if="mapError" class="ha-map-error" role="status">{{ mapError }}</p>
  <div class="ha-map-layout">
    <div class="ha-map-container">
      <div ref="hospitalMap" class="ha-map" aria-label="Interactive Hong Kong hospital map"></div>
      <v-btn class="ha-map-reset" icon size="small" variant="elevated" color="white" aria-label="Show all hospitals" title="Show all hospitals" :disabled="!mapReady || !mappedHospitals.length" @click.stop="resetMap">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/><path d="M8 8h8v8H8z"/></svg>
      </v-btn>
    </div>
    <aside class="ha-map-details">
      <v-select v-model="selectedName" :items="mappedHospitals.map(r => r.hospName)" label="Hospital" variant="outlined" density="compact" hide-details :disabled="!mappedHospitals.length" @update:model-value="refreshMarkers"></v-select>
      <template v-if="selectedHospital">
        <h3>{{ selectedHospital.hospName }}</h3>
        <p>{{ selectedHospital.location.cluster }}</p><p>{{ selectedHospital.location.address }}</p>
        <h4>Published triage information</h4>
        <dl class="ha-priority-status">
          <dt>I · Critical · 危殆</dt><dd>{{ selectedHospital.t1wt || 'Not available' }}</dd>
          <dt>II · Emergency · 危急</dt><dd>{{ selectedHospital.t2wt || 'Not available' }}</dd>
        </dl>
        <dl><template v-for="m in metrics" :key="m.key"><dt>{{m.label}}</dt><dd>{{selectedHospital[m.key] || 'Not available'}}</dd></template></dl>
        <p class="ha-note">I/II show the source waiting estimate or status; no P50/P95 is published for these categories. IV/V cannot be separated.</p>
      </template>
      <p v-else>Select a hospital marker to inspect its waiting times.</p>
    </aside>
  </div>
  <div class="ha-map-legend"><span v-for="item in legend" :key="item.label"><i :style="{background:item.color}"></i>{{item.label}}</span></div>
  <p class="ha-note">Colours show III · Urgent · P50 waiting estimates, using fixed bands across hospitals. Zoom or drag to explore. Locations: Hospital Authority.</p>
  <p v-if="unmappedHospitals.length" class="ha-map-error">No official location match: {{ unmappedHospitals.join(', ') }}</p>
</section>
</template>
<script>
export default {
  data() { return {
    liveView:null, clock: Date.now(), timer: null,
    mapError:'', mapReady:false, selectedName:null,
    legend:[{label:'Under 60 min',color:'#087e8b'},{label:'60–89 min',color:'#4e9da5'},{label:'90–119 min',color:'#8eaa64'},{label:'120–179 min',color:'#d49c16'},{label:'180–359 min',color:'#df7025'},{label:'360+ min',color:'#bd3245'},{label:'Unknown',color:'#7d8792'}],
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
    this.send({topic:"ha-overview-request"})
  },
  unmounted() {
    this._disposed=true
    clearInterval(this.timer)
    this._resizeObserver?.disconnect()
    this._map?.remove()
  },
  watch: {
    msg: {immediate:true,handler(value){if(Array.isArray(value?.payload?.waitTime))this.liveView=value.payload}},
    mappedHospitals: {immediate:true,handler(rows) {
      if(!rows.some(r=>r.hospName===this.selectedName))this.selectedName=(rows.find(r=>r.hospName==='Queen Elizabeth Hospital')||rows[0])?.hospName||null;
      this.refreshMarkers()
    }, deep:true}
  },
  methods: {
    hospitalLocation(name) {
      // The official A&E feed omits the period used in the directory.
      const aliases={'St John Hospital':'St. John Hospital'}
      return this.liveView?.locations?.[aliases[name] || name]
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
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{this.mapError='Some map tiles could not load. Hospital markers and the regional comparison remain available.'}).addTo(this._map)
        this._markers=L.layerGroup().addTo(this._map)
        this._resizeObserver=new ResizeObserver(()=>this._map?.invalidateSize())
        this._resizeObserver.observe(this.$refs.hospitalMap)
        this.mapReady=true
        this.refreshMarkers()
      } catch(error) {if(!this._disposed)this.mapError='Map could not load. Check access to unpkg.com; the hospital comparison remains available.'}
    },
    markerColor(value) {
      const n=this.minutes(value)
      return n===null?'#7d8792':n<60?'#087e8b':n<90?'#4e9da5':n<120?'#8eaa64':n<180?'#d49c16':n<360?'#df7025':'#bd3245'
    },
    refreshMarkers() {
      if(!this._markers)return
      this._markers.clearLayers()
      if(!this.selectedName && this.mappedHospitals.length){
        const initial=this.mappedHospitals.find(r=>r.hospName==='Queen Elizabeth Hospital') || this.mappedHospitals[0]
        this.selectedName=initial.hospName
      }
      for(const r of this.mappedHospitals){
        const label=document.createElement('span')
        label.textContent=r.hospName+' · III · Urgent · P50: '+(r.t3p50 || 'Not available')
        window.L.circleMarker([r.location.lat,r.location.lon],{radius:this.selectedName===r.hospName?11:8,color:'#ffffff',weight:2,fillColor:this.markerColor(r.t3p50),fillOpacity:0.95})
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
  },
  computed: {
    mappedHospitals() {
      return this.ranked.filter(r=>this.hospitalLocation(r.hospName)).map(r=>({...r,location:this.hospitalLocation(r.hospName)}))
    },
    unmappedHospitals() {
      return this.ranked.filter(r=>!this.hospitalLocation(r.hospName)).map(r=>r.hospName)
    },
    selectedHospital() {return this.mappedHospitals.find(r=>r.hospName===this.selectedName)},
    freshness() {
      const sourceTime = Date.parse(this.liveView?.sourceISO)
      if (!Number.isFinite(sourceTime)) return 'No source timestamp available'
      const age = Math.max(0, Math.floor((this.clock - sourceTime) / 60000))
      return age > 30 ? `Stale data · updated ${age} minutes ago` : `Updated ${age} minutes ago`
    },
    ranked() {
      return [...(this.liveView?.waitTime || [])].sort((a,b) => {
        const av = this.minutes(a.t3p50), bv = this.minutes(b.t3p50)
        if (av === null) return bv === null ? 0 : 1
        return bv === null ? -1 : bv - av
      })
    },
  }
}
</script>
<style>
.ha-map-container{position:relative;min-width:0;isolation:isolate}.ha-map-container .ha-map-reset{position:absolute;top:12px;right:12px;z-index:1;color:var(--ha-primary)!important;border:1px solid var(--ha-border);border-radius:8px}

.ha-page-header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:20px}.ha-source-status{display:grid;justify-items:end;gap:8px;font-size:12px;color:var(--ha-muted)}.ha-guide{margin-bottom:24px}.ha-triage-categories{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:16px 0}.ha-triage-categories article{border-left:2px solid var(--ha-primary);padding-left:12px}.ha-triage-categories strong,.ha-triage-categories span{display:block;font-size:12px}.ha-triage-categories span{margin-top:6px;color:var(--ha-muted)}.ha-map-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(260px,1fr);gap:20px}.ha-map{height:450px;min-width:0;z-index:0;border:1px solid var(--ha-border);border-radius:12px;background:var(--ha-soft)}.ha-map-details{padding:20px;background:var(--ha-soft);border-radius:12px;font-size:13px}.ha-map-details h3{font-size:18px;margin:20px 0 8px}.ha-map-details h4{font-size:13px;margin-top:20px}.ha-map-details dl{display:grid;grid-template-columns:1fr auto;gap:10px;margin:16px 0}.ha-map-details dt{color:var(--ha-muted);font-size:12px}.ha-map-details dd{margin:0;font-weight:600;text-align:right}.ha-map-legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;font-size:11px}.ha-map-legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}.ha-map-error{font-size:12px;color:#924316}
@media(max-width:900px){.ha-triage-categories{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.ha-page-header{align-items:start;flex-direction:column}.ha-source-status{justify-items:start}.ha-map-layout{grid-template-columns:1fr}.ha-map{height:340px}}
</style>
