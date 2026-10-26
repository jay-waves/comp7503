"""Deploy only the health additions through Node-RED's revision-checked API."""
import json
import os
from pathlib import Path
from datetime import datetime, timezone
from urllib.request import Request, build_opener, ProxyHandler

root = Path(__file__).resolve().parents[1]
api = 'http://127.0.0.1:1880/flows'
http = build_opener(ProxyHandler({}))
headers = {'Node-RED-API-Version': 'v2'}
with http.open(Request(api, headers=headers), timeout=15) as response:
    state = json.load(response)
nodes = state['flows']
by_id = {n['id']: n for n in nodes}
for required in ['ha-tab', 'ha-group', 'ha-mongo', 'ha-debug', 'sop-save']:
    if required not in by_id:
        raise RuntimeError('Missing existing node: ' + required)
backup_dir = root / 'backups'
backup_dir.mkdir(exist_ok=True)
backup = backup_dir / ('health-before-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json')
with os.fdopen(os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as stream:
    json.dump(state, stream)
patches = []
for filename in ['hospital-sop-card.dashboard2.json', 'health-surveillance.dashboard2.json']:
    patches.extend(json.loads((root / 'flows' / filename).read_text()))
for patch in patches:
    if patch['id'] == 'sop-save':
        # Preserve existing collection settings and any editor-created outputs.
        existing = by_id['sop-save']
        if 'ha-sop-query' not in existing['wires'][0]:
            existing['wires'][0].append('ha-sop-query')
    else:
        by_id[patch['id']] = patch
original_ids = {n['id'] for n in nodes}
merged = [by_id[n['id']] for n in nodes] + [n for key, n in by_id.items() if key not in original_ids]
ids = set(by_id)
for node in merged:
    for wire in node.get('wires', []):
        for target in wire:
            if target not in ids:
                raise RuntimeError('Dangling wire: ' + target)
body = json.dumps({'rev': state['rev'], 'flows': merged}).encode()
request = Request(api, data=body, method='POST', headers={**headers, 'Content-Type': 'application/json', 'Node-RED-Deployment-Type': 'nodes'})
with http.open(request, timeout=45) as response:
    result = json.load(response)
print('Deployed health cards; nodes:', len(nodes), '->', len(merged))
print('Revision:', result.get('rev'))
print('Backup:', backup.relative_to(root))
