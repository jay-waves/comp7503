// The checked-in official snapshot provides a dated fallback for first startup.
const documents=new Map(seed.map(d=>[d.source,d]));
for(const d of Array.isArray(msg.payload)?msg.payload:[]){const previous=documents.get(d.source);if(d.rows?.length&&(!previous||d.latest>previous.latest||d.latest===previous.latest&&String(d.fetchedAt)>=previous.fetchedAt))documents.set(d.source,d)}
const errors={...(flow.get('haHealthErrors')||{})};delete errors.database;flow.set('haHealthErrors',errors);msg.errors=errors;
msg.topic='ha-health-data';msg.payload=[...documents.values()];return msg;
