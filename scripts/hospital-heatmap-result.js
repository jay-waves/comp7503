const cells = msg.payload;
const {start, end} = msg.heatmapWindow;
const expected = {};
const step = 15 * 60000;
// Count source publication slots, rather than treating missing values as zero.
for (let time = Math.ceil(Date.parse(start) / step) * step; time <= Date.parse(end); time += step) {
  const local = new Date(time + 8 * 3600000);
  const day = local.getUTCDay() || 7;
  const key = `${day}:${local.getUTCHours()}`;
  expected[key] = (expected[key] || 0) + 1;
}
msg.payload = {
  cells,
  hospitals: [...new Set(cells.map(row => row.hospital))].sort(),
  expected,
  windowStart: start, windowEnd: end,
  generatedAt: new Date().toISOString()
};
return msg;
