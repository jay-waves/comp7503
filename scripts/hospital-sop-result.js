const rows = (Array.isArray(msg.payload) ? msg.payload : []).map(r=>r.raw).filter(r=>r && r.specialty && r.cluster && r.date_id_from && r.date_id_to);
// Use one complete published reporting window, not the date of collection.
rows.sort((a,b)=>Number(b.date_id_to)-Number(a.date_id_to)||Number(b.date_id_from)-Number(a.date_id_from));
const latest=rows[0];
msg.topic='ha-sop-data';
msg.payload={rows:latest ? rows.filter(r=>String(r.date_id_to)===String(latest.date_id_to)&&String(r.date_id_from)===String(latest.date_id_from)) : [], from:latest?.date_id_from,to:latest?.date_id_to};
return msg;
