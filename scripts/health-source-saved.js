const result=msg.payload;
if (!result?.acknowledged || (!result.modifiedCount && !result.upsertedCount)) {
  node.error('Source write rejected: reporting date regressed or write was not acknowledged',msg);
  return null;
}
const errors={...(flow.get('haHealthErrors')||{})};
delete errors[msg.healthSource];flow.set('haHealthErrors',errors);
msg.topic='ha-health-request';return msg;
