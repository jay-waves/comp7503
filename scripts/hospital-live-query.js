// Restore the latest persisted snapshot without fetching or writing a new record.
if (msg.topic && msg.topic !== 'ha-overview-request') return null;
msg.payload = [[
  {$sort: {sourceTime: -1}},
  {$limit: 1},
  {$project: {_id: 0, raw: 1, sourceTime: 1, fetchedAt: 1}}
], {maxTimeMS: 10000}];
return msg;
