#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

mkdir -p node-red/data
if [[ "$(stat -c %u node-red/data)" != 1000 ]]; then
  echo 'node-red/data 的所有者 UID 必须是 1000。' >&2
  exit 1
fi

# Initialize the persistent runtime flow once. Node-RED Editor owns this copy after startup.
runtime_flow=node-red/data/flows.json
if [[ ! -f "$runtime_flow" ]]; then
  cp flows/hospital-starter.dashboard2.json "$runtime_flow"
  echo '已从项目流程初始化 Node-RED runtime flow。'
fi

# 首次生成账号；已有配置始终保留。十六进制密码可直接用于 MongoDB URI。
if [[ ! -f .env ]]; then
  (umask 077; python3 - <<'PY'
import secrets
with open('.env', 'x') as config:
    config.write('MONGO_ROOT_USERNAME=admin\n')
    config.write('MONGO_ROOT_PASSWORD=' + secrets.token_hex(24) + '\n')
PY
  )
fi

sudo docker compose config --quiet
sudo docker compose up -d --build --wait --wait-timeout 180
sudo docker compose ps
echo 'Node-RED：http://localhost:1880'
echo 'MongoDB：localhost:27017；账号密码见 .env'
