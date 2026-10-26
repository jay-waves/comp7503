if (msg.statusCode !== 200) { node.error('Official source HTTP '+msg.statusCode,msg); return null; }
try {
  const document={...normalize(source,msg.payload),url,fetchedAt:new Date().toISOString()};
  msg.healthSource=source;
  msg.topic='ha-health-request';
  // Compare dates inside MongoDB so concurrent or regressed responses cannot
  // replace a newer reporting window. Same-period official corrections are valid.
  msg.payload=[{_id:source},[{$replaceWith:{$cond:[
    {$or:[{$eq:[{$type:'$latest'},'missing']},{$lte:['$latest',{$literal:document.latest}]}]},
    {$mergeObjects:['$$ROOT',{$literal:document}]},'$$ROOT'
  ]}}],{upsert:true}];
  return msg;
} catch(e) { node.error(e.message,msg); return null; }
