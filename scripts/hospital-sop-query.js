if (msg.topic && msg.topic !== 'ha-sop-request') return null;
msg.payload = [[
  {$sort: {fetchedAt: -1, _id: 1}},
  {$group: {_id: {from:'$raw.date_id_from',to:'$raw.date_id_to',cluster:'$raw.cluster',specialty:'$raw.specialty',category:'$raw.Category',description:'$raw.Description'}, raw:{$first:'$raw'}}},
  {$project: {_id:0, raw:1}}
], {maxTimeMS:10000}];
return msg;
