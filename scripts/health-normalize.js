// Shared by the CLI, Node-RED function nodes and tests. No external dependencies.
function csv(text) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}
  if(quoted)throw Error('Unclosed CSV quote');if(cell||row.length){row.push(cell);rows.push(row)}
  const headers=rows.shift()?.map(h=>h.replace(/^\uFEFF/,'').trim());if(!headers?.length)throw Error('Empty CSV');
  if(new Set(headers).size!==headers.length||rows.some(r=>r.length!==headers.length))throw Error('Malformed CSV columns');
  return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
}
function number(value){
 if(value===null||value===undefined||String(value).trim()===''||/^(NA|N\/A|-)$/i.test(String(value).trim()))return null;
 if(!/^[-+]?\d*\.?\d+$/.test(String(value).trim()))throw Error('Invalid numeric value');
 const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error('Invalid numeric range');return n;
}
function date(value){const s=String(value||'');const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);const iso=m?`${m[3]}-${m[2]}-${m[1]}`:s;if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!Number.isFinite(Date.parse(iso))||new Date(iso).toISOString().slice(0,10)!==iso)throw Error('Invalid reporting date');return iso}
function normalize(source,input){
 const raw=source==='surge'?(typeof input==='string'?JSON.parse(input.replace(/^\uFEFF/,'')):input):csv(input);
 if(!Array.isArray(raw)||!raw.length)throw Error('Empty source');
 const keys=source==='surge'?['ae_first_attend','ae_to_med_ip','med_bed_occ_rate','ped_bed_occ_rate']:source==='flu'?['AandB_proportion','H1','H3','B','ILI_School','ILI_NonSchool','Adm_0_5','Adm_6_11','Adm_12_17','Adm_18_49','Adm_50_64','Adm_65_higher','Adm_All']:['ili_weekly_average_rate','hfmd_weekly_average_rate','age_weekly_average_rate','acj_weekly_average_rate'];
 if(!['surge','flu','aed'].includes(source)||raw.some(r=>!r||keys.some(k=>!(k in r))))throw Error('Unexpected source schema');
 const rows=raw.map(r=>({date:date(source==='surge'?r.date:source==='flu'?r.To:r.end_date),...(source==='surge'?{hospital:r.hospital||'',cluster:r.cluster}: {start:date(source==='flu'?r.From:r.start_date)}),...Object.fromEntries(keys.map(k=>[k,number(r[k])]))}));
 if(source==='surge'&&rows.some(r=>typeof r.cluster!=='string'||typeof r.hospital!=='string'))throw Error('Invalid hospital');
 if(source==='flu'&&rows.some(r=>r.AandB_proportion!==null&&r.AandB_proportion>1))throw Error('Invalid positivity proportion');
 if(source!=='surge'&&rows.some(r=>Date.parse(r.date)-Date.parse(r.start)!==6*86400000))throw Error('Invalid weekly reporting window');
 const ids=new Set();for(const r of rows){const key=JSON.stringify([r.date,r.hospital,r.cluster]);if(ids.has(key))throw Error('Duplicate source record');ids.add(key)}
 rows.sort((a,b)=>a.date.localeCompare(b.date));const latest=rows.at(-1).date;
 const cutoff=Date.parse(latest)-(source==='surge'?180:730)*86400000;
 return {source,latest,rows:rows.filter(r=>Date.parse(r.date)>=cutoff)};
}
if(typeof module!=='undefined')module.exports={csv,number,date,normalize};
