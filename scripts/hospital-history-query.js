// Seven days at source resolution; browser selectors filter without another query.
const end = new Date();
const start = new Date(end.getTime() - 7 * 86400000);
msg.historyWindow = {start: start.toISOString(), end: end.toISOString()};
msg.payload = [[
  {$match: {sourceTime: {$gte: start, $lte: end}}},
  {$sort: {sourceTime: 1}},
  {$project: {_id: 0, time: '$sourceTime', hospitals: '$raw.waitTime'}}
], {maxTimeMS: 20000}];
return msg;
