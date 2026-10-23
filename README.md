# COMP7503

## 部署

Fedora 环境首次部署运行：

```bash
bash install.sh
```

之后启动或更新服务：

```bash
bash start.sh
```

停止服务并保留数据：

```bash
bash stop.sh
```

需要 Python 3、sudo 和 Docker。`node-red/data` 目录的所有者 UID 必须为 1000。首次启动会生成 `.env` 并初始化 Node-RED 流程；MongoDB 数据保存在 Docker 持久卷中，流程保存在 `node-red/data/`。

## 访问

- Node-RED 编辑器：<http://localhost:1880>
- HKO 仪表板：<http://localhost:1880/dashboard/temperature>
- Healthcare 仪表板：<http://localhost:1880/dashboard/healthcare/overview>
- MongoDB：`localhost:27017`

查看容器状态和日志：

```bash
sudo docker compose ps
sudo docker compose logs -f --tail=100
```

不要运行 `docker compose down -v`，否则会删除 MongoDB 数据卷。
