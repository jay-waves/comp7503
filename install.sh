#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if (( EUID == 0 )); then
  echo '请用普通用户执行 bash install.sh；需要管理员权限时脚本会调用 sudo。' >&2
  exit 1
fi

source /etc/os-release
if [[ "${ID:-}" != fedora ]]; then
  echo '此安装脚本适用于 Fedora。' >&2
  exit 1
fi

mkdir -p node-red/data
if [[ "$(stat -c %u node-red/data)" != 1000 ]]; then
  echo 'node-red/data 的所有者 UID 必须是 1000（Node-RED 容器默认用户）。' >&2
  exit 1
fi

sudo -v
sudo dnf install -y dnf5-plugins
if [[ ! -f /etc/yum.repos.d/docker-ce.repo ]]; then
  sudo dnf config-manager addrepo --from-repofile https://download.docker.com/linux/fedora/docker-ce.repo
fi
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
bash start.sh
