// MongoDB 8 aggregation: one observation per source timestamp and hospital.
const end = new Date();
const start = new Date(end.getTime() - 28 * 86400000);
msg.heatmapWindow = {start: start.toISOString(), end: end.toISOString()};
msg.payload = [[
  {$match: {sourceTime: {$gte: start, $lte: end}}},
  {$project: {sourceTime: 1, hospitals: '$raw.waitTime'}},
  {$unwind: '$hospitals'},
  {$project: {sourceTime: 1, hospital: '$hospitals.hospName', values: [
    {metric: 't3p50', raw: '$hospitals.t3p50'},
    {metric: 't3p95', raw: '$hospitals.t3p95'},
    {metric: 't45p50', raw: '$hospitals.t45p50'},
    {metric: 't45p95', raw: '$hospitals.t45p95'}
  ]}},
  {$unwind: '$values'},
  {$set: {parsed: {$regexFind: {input: {$ifNull: ['$values.raw', '']}, regex: '^(\\d+(?:\\.\\d+)?)\\s*(minute|hour)s?$', options: 'i'}}}},
  {$match: {parsed: {$ne: null}}},
  {$set: {minutes: {$multiply: [{$toDouble: {$arrayElemAt: ['$parsed.captures', 0]}}, {$cond: [{$eq: [{$toLower: {$arrayElemAt: ['$parsed.captures', 1]}}, 'hour']}, 60, 1]}]}}},
  {$group: {
    _id: {hospital: '$hospital', metric: '$values.metric', day: {$isoDayOfWeek: {date: '$sourceTime', timezone: 'Asia/Hong_Kong'}}, hour: {$hour: {date: '$sourceTime', timezone: 'Asia/Hong_Kong'}}},
    minutes: {$median: {input: '$minutes', method: 'approximate'}},
    samples: {$sum: 1}
  }},
  {$project: {_id: 0, hospital: '$_id.hospital', metric: '$_id.metric', day: '$_id.day', hour: '$_id.hour', minutes: 1, samples: 1}}
], {maxTimeMS: 20000}];
return msg;
