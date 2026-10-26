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

## Healthcare 面板样式

面板使用 Dashboard 2 内置的 Vue / Vuetify；筛选框、按钮和说明折叠面板无需额外安装组件库。
`dashboards/hospital-shared.css` 统一配色、字体、间距和响应式布局，各 `.vue` 文件保留地图与图表专用样式。

修改后运行 `python3 scripts/build-hospital-flow.py`，共享样式会合并进生成的模板。
生成结果为 `flows/hospital-starter.dashboard2.json`；已有实例需在 Node-RED 中更新对应 Healthcare 模板及主题后部署。
`start.sh` 不会覆盖已存在的运行时流程。

Healthcare 的专科新症轮候卡片支持按专科、联网筛选，显示紧急、半紧急、稳定病例的中位数及稳定病例的第 90 百分位轮候时间，并保留官方统计期和联网名称。官方每季发布，现有采集任务每日检查；卡片从 `ha_sop_snapshots` 恢复数据，采集成功后自动刷新。

已有实例可导入 `flows/hospital-sop-card.dashboard2.json` 到现有 Healthcare 流程；对相同 ID 的 `sop-save` 选择替换，以增加查询卡片的连线，再部署。此增量文件依赖原流程的 `ha-tab`、`ha-group`、`ha-mongo` 和 `ha-debug`，不适用于独立导入到空实例。新实例使用完整 starter 文件。

## 服务需求与传染病监测

`dashboards/health-surveillance.vue` 是 Healthcare 页面中的高密度信息面板，包含医院服务负荷排行及趋势、流感阳性率及分型堆叠柱图、年龄组入院率，以及四类急症症状监测小图。支持医院联网和 13/26/52 周趋势筛选；服务需求趋势显示最近 28 个公布日。

三类来源由 Node-RED 启动时获取，并每日检查一次，分别存入 MongoDB `ha_health_sources`，每个来源保留最近两年周数据或最近 180 日内的服务需求记录。重复采集更新原记录，保留来源自带的历史日期；这些不是每日采集快照档案。失败保留上次数据，各来源独立更新。

官方服务需求数据仅在高峰期每日发布，流感和急症症状数据每周发布。页面突出显示各自统计日期；服务需求超过三日、周数据超过十四日显示历史／延迟标记。占用率允许超过 100%；百分点变化与人数变化分开；缺失保持为空，日期断档不连线。急症症状监测基于诊断编码，不是实验室确诊数。

已保存真实官方初始数据到 `data/health/`，作为带日期的启动备用数据。重新采集和生成导入文件：

```bash
node scripts/collect-health-data.js
python3 scripts/build-hospital-flow.py
node tests/health-surveillance.cjs
```

完整数据源 URL 和采集时间保存在各 JSON 内。三个来源独立写入文件；某来源失败时保留原文件并返回非零退出码。当前采集的服务需求统计截止 2026-08-04，流感和急症症状截止 2026-10-17。

已有实例导入 `flows/health-surveillance.dashboard2.json` 到原 Healthcare 流程后部署；依赖原来的 `ha-tab`、`ha-group`、`ha-mongo`、`ha-debug`。这不会自动安装先前的专科卡片；专科仍使用单独的增量文件。完整 starter 文件包含两者。生成器不会改写运行中的 `node-red/data/flows.json`。

修复后的采集流程会拒绝非法数值、畸形 CSV、重复记录及无效周统计窗口。MongoDB 原子更新会拒绝日期倒退，同一统计期的官方修订仍可更新。每个来源独立记录错误，只有该来源成功写入才清除自己的错误；数据库读取成功不会清除其他来源的错误。

本机 Node-RED 已运行时，也可执行 `python3 scripts/deploy-health-cards.py`。它通过带版本检查的管理 API 合并专科及监测节点，保留现有配置和其他节点，并先将旧流程备份到 `backups/`。无需手动覆盖运行时流程文件。

III 类地图及周热力图采用固定分钟区间 `<10 / 10–<20 / 20–<30 / 30–<45 / 45–<60 / 60+`；III 的 P50/P95 使用同一刻度，IV/V 保留原分钟区间。颜色图例随指标同步更新，不随医院或查询窗口动态缩放。Healthcare 的 Dashboard 标题栏使用 `titleBarStyle: hidden` 隐藏；卡片内的数据更新时间保留。

流感卡片的最新周环形图展示 A(H1)、A(H3)、B 三类检出数构成，中心数字是三类之和，占比不以全部 A/B 阳性数为分母。与历史分型柱图采用相同颜色；分型缺失时不绘制构成比例，总数为零时显示空环及说明。无需新增图表依赖。
