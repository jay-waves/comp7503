// Include the current comparison in the replayed message so refresh restores both panels.
return {topic: 'ha-history', raw: flow.get('haChartView') || flow.get('haLastView'), payload: {
  snapshots: msg.payload,
  windowStart: msg.historyWindow.start,
  windowEnd: msg.historyWindow.end,
  generatedAt: new Date().toISOString()
}};
