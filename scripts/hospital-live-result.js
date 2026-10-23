const snapshot = msg.payload?.[0];
if (!snapshot?.raw?.waitTime) return null;
const cached = flow.get('haLastView');
if (cached?.sourceISO && Date.parse(cached.sourceISO) > +new Date(snapshot.sourceTime)) return null;
msg.view = {...snapshot.raw, sourceISO: new Date(snapshot.sourceTime).toISOString(), fetchedAt: new Date(snapshot.fetchedAt || snapshot.sourceTime).toISOString()};
return msg;
