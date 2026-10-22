# COMP7503

基于 Docker Compose 的 Node-RED、Dashboard 2.0 与 MongoDB 本地实验环境。

## 使用

```bash
bash install.sh  # 首次安装 Docker 并启动（Fedora）
bash start.sh    # 构建并后台启动
bash stop.sh     # 停止容器，保留数据
```

需要 Python 3、sudo；Node-RED 数据目录所有者 UID 为 1000。

- 编辑器：http://localhost:1880
- Dashboard：http://localhost:1880/dashboard（添加页面并部署后）
- MongoDB：`localhost:27017`；容器内使用 `mongodb:27017`
- 数据库账号见自动生成的 `.env`；Node-RED 连接 URI 可使用 `${MONGODB_URI}`。

## 数据与日志

Node-RED 数据位于 `node-red/data/`，MongoDB 数据保存在 Docker 命名卷中。
停止或重建容器会保留数据；不要执行 `docker compose down -v` 或删除数据目录。
Node-RED 的 flow/global context 默认只保存在内存中。

```bash
sudo docker compose ps                  # 查看状态
sudo docker compose logs -f --tail=100  # 查看日志
```

Dashboard 和 MongoDB 连接节点由 `node-red/Dockerfile` 预装；MongoDB 独立运行。

## HKO 示例

编辑器右上角菜单 → Import → 选择 `docs/HKO.Flow.dashboard2.json` → 导入 → Deploy。
查看 http://localhost:1880/dashboard/temperature 。每 5 分钟读取香港天文台实时数据，写入 MongoDB，并展示最近 24 小时的各站温度；首次只有当前观测点，历史数据会逐步累积。

原始 `docs/HKO.Flow.json` 保留不变。迁移版使用现有 Dashboard 2.0、mongodb4 节点和 `${MONGODB_URI}`；导入本身不包含数据库密码。
