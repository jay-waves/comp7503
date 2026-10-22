#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

# 正常停止本项目容器，给数据库时间完成写入；保留容器与全部数据卷。
sudo docker compose stop --timeout 60
echo '本项目容器已停止，Node-RED 文件和 MongoDB 数据卷均保留。'
