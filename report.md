# 香港公立医院急症室等候时间分析

## 项目文件与 HKO 示例

Node-RED、Dashboard 2.0 和 MongoDB 通过 Docker Compose 运行。Dashboard 及 MongoDB 节点已在 `node-red/Dockerfile` 中安装。HKO 示例流程位于 `docs/HKO.Flow.dashboard2.json`，可在 Node-RED Editor 中导入并 Deploy；它每五分钟采集一次天文台天气观测，将数据存入 MongoDB，并展示最近 24 小时的气温。旧版流程保留在 `docs/HKO.Flow.json`。示例使用 `${MONGODB_URI}`，导出的流程不包含数据库密码。

Healthcare 仪表板模板位于 `dashboards/`，流程生成脚本为 `scripts/build-hospital-flow.py`，生成的首次启动模板为 `flows/hospital-starter.dashboard2.json`。Node-RED Editor 修改并保存的 `node-red/data/flows.json` 是实际运行流程；重新生成模板不会覆盖它。医院地图使用医院管理局坐标，每周更新并以 `data/hospital-locations.json` 作为备用快照。地图依赖浏览器访问 unpkg.com 与 OpenStreetMap。

## 选题与目标

本项目关注香港公立医院急症室的服务可及性，利用医院管理局公开数据比较不同医院、时段及分流类别的等候时间估算，观察医疗服务压力的时空差异，为城市医疗资源分析提供参考。数据是官方发布的估算值，不代表患者实际完成的等候时间，也不构成个人医疗建议。

## 部署与浏览

项目以 Docker Compose 启动 Node-RED 和 MongoDB。首次运行 `bash start.sh` 时，脚本会检查 `node-red/data` 的 UID 是否为 1000、从流程模板初始化 Node-RED runtime flow，并生成本地 MongoDB 账号配置 `.env`；随后构建并启动服务。之后再次运行同一命令即可启动已有环境，MongoDB 数据和 Node-RED 流程保存在持久卷及 `node-red/data/` 中。停止服务可运行 `bash stop.sh`，不会删除数据库卷。

Node-RED 编辑器位于 `http://localhost:1880`，可查看和维护流程；医疗仪表板位于 `http://localhost:1880/dashboard/healthcare/overview`，页面向下滚动可查看历史热图。仪表板不需要登录编辑器。地图底图及 Leaflet 程序库需浏览器访问 OpenStreetMap 和 unpkg.com；若地图资源加载失败，比较图表仍可使用。MongoDB 仅绑定本机端口 `27017`，连接凭据保存在 `.env`。

## 原始数据结构

以下为实际响应节选，各保留一条记录。

### 急症室候诊（A&E）

来源：<https://www.ha.org.hk/opendata/aed/aedwtdata2-en.json>

```json
{
  "waitTime": [
    {
      "hospName": "Alice Ho Miu Ling Nethersole Hospital",
      "t1wt": "0 minute",
      "manageT1case": "N",
      "t2wt": "less than 15 minutes",
      "manageT2case": "Y",
      "t3p50": "42 minutes",
      "t3p95": "68 minutes",
      "t45p50": "3 hours",
      "t45p95": "4 hours"
    }
  ],
  "updateTime": "23/10/2026 6:00PM"
}
```

| 字段 | 内容 |
| --- | --- |
| `updateTime` | 香港本地发布时间，`DD/MM/YYYY h:mmAM/PM` |
| `waitTime[].hospName` | 医院名称 |
| `t1wt`、`t2wt` | I、II 类候诊估计或文字状态：`0 minute`、`less than 15 minutes`、`Managing multiple resuscitation cases` |
| `manageT1case`、`manageT2case` | 来源附带的 I、II 类个案处理标记：`Y`、`N`、`N/A` |
| `t3p50`、`t3p95` | III 类候诊估计的 P50、P95，字符串，单位为分钟或小时 |
| `t45p50`、`t45p95` | 合并 IV/V 类候诊估计的 P50、P95，字符串，单位为分钟或小时 |

I、II 类没有 P50/P95；来源不包含患者记录、P25/P75 或完整箱线图所需的极值。

### 专科门诊（SOP）

来源：<https://www.ha.org.hk/opendata/sop/sop-waiting-time-en.json>

```json
[
  {
    "date_id_from": 20250701,
    "date_id_to": 20260630,
    "cluster": "Hong Kong East Cluster",
    "specialty": "Ear, Nose, Throat",
    "Category": "Urgent Case - Median",
    "Description": "Median Waiting Time for New Case Booking for Specialist Out-patient Services",
    "Value": "Less than 1 week"
  }
]
```

- `date_id_from`、`date_id_to`：报告期起止日期，整数 `YYYYMMDD`。
- `cluster`、`specialty`：医院联网、专科。
- `Category`、`Description`：统计类别、指标说明。
- `Value`：原始统计值字符串，保留单位及“少于”等限定。

### 医院目录与坐标

来源：<https://www.ha.org.hk/opendata/facility-hosp.json>

```json
[
  {
    "cluster_eng": "Hong Kong Island Cluster",
    "institution_eng": "Cheshire Home, Chung Hom Kok",
    "with_AE_service_eng": "No",
    "address_eng": "128 Chung Hom Kok Road, HK",
    "cluster_tc": "香港島醫院聯網",
    "institution_tc": "舂磡角慈氏護養院",
    "with_AE_service_tc": "否",
    "address_tc": "香港舂磡角道128號",
    "cluster_sc": "香港岛医院联网",
    "institution_sc": "舂磡角慈氏护养院",
    "with_AE_service_sc": "否",
    "address_sc": "香港舂磡角道128号",
    "latitude": 22.212024,
    "longitude": 114.1973
  }
]
```

- `cluster_*`、`institution_*`、`with_AE_service_*`、`address_*`：联网、机构名称、是否提供急症服务、地址；`eng` / `tc` / `sc` 分别为英文／繁体中文／简体中文。
- `latitude`、`longitude`：纬度、经度；应用筛选 `with_AE_service_eng = "Yes"`。
- `sourceTime`、`fetchedAt`、`lastSeenAt`、`sourceUrl` 为应用存储时添加的元数据，不属于上述原始响应。

## 数据流与状态流

急症室数据流按每 15 分钟触发：Node-RED 请求医院管理局 JSON，检查并整理来源时间和各医院记录后，以来源时间为键写入 `ha_ae_snapshots`。相同时间重复获取时更新最近抓取时间，不重复插入快照。首次启动另有一次性历史回填流程，下载并写入最近 28 天的官方档案，完成后刷新热图。急症采集成功写库后，将最新医院记录与医院位置合并并推送至概览仪表板。

专科门诊数据流每日检查医院管理局数据，将记录写入 `ha_sop_snapshots`；报告周期和记录内容用于区分数据修订。新增独立卡片按专科和联网筛选，展示最新统计期内紧急、半紧急、稳定病例的中位数及稳定病例的第 90 百分位轮候时间，保留来源单位和联网名称。医院位置参考数据每周更新并校验坐标，作为地图标记的来源。

各图筛选相互独立，顶部不提供统一指标选择。状态信息随仪表板数据一并更新：页面显示来源更新时间，并按来源时间计算数据新旧，超过 30 分钟标记为过期。采集、格式检查或数据库错误由 Catch 流程捕获，经摘要后输出到 Node-RED Debug 面板；因此浏览仪表板时若没有数据，应同时查看编辑器右侧 Debug 信息。页面统一在顶部显示来源更新时间；各图保留统计时间窗、样本数及预期采集时段覆盖率；缺失值保留为空，不当作零。

## 图表与交互功能

- **分诊简介**：解释 I（危殆）、II（危急）、III（紧急）、IV（次紧急）、V（非紧急）的优先级，以及 I–III 类服务目标；服务目标不代表实时达标率。说明 P50/P95 含义及 IV/V 合并口径，链接医管局说明。
- **医院地图**：展示有官方坐标的急症室医院。圆点颜色固定对应 III（Urgent）类 P50 的分钟数区间，灰色表示没有可用数值；可缩放、拖动地图。点击标记可查看医院名称、地区、地址、四项 III 类及 IV/V 类指标和 I/II 类原始状态。“Show all hospitals”可重新缩放至全部医院范围。
- **医院等候时间比较图**：III 类和合并 IV/V 类分别使用独立卡片，各有地区选择器；地区分为港岛、九龙、新界东、新界西、荃湾／葵青、将军澳、离岛，以 P50 圆点、区间条和 P95 菱形展示所选时间窗内各医院发布估计的算术平均值；数值统一以小时展示，缺失或文字值不绘制为零。该图是 P50–P95 区间图，不是完整箱线图。
- **医院历史折线图**：位于比较图右侧，同一张图展示所选地区的全部医院，每家医院以 P50 实线、P50–P95 同色半透明区间带及 P95 虚线上边界同时展示，颜色对应医院图例，不提供单独医院筛选；点击医院名称或图例可同步高亮两图中的该医院，其他医院淡化，再次点击恢复全部，切换地区清除高亮。3h、12h、24 Hours、7 Days 与地区选择并排放在卡片顶部，同时控制两图；不再切换 P50/P95；分流类别按卡片固定，不提供切换；纵轴使用小时；3h、12h、24 小时模式保留原始采样，缺失数值或超过 30 分钟的间隔会断线；7 天模式按香港时间每 3 小时分别取各医院已发布 P50、P95 的中位数，空时段断线，悬停显示样本数；区间带不是置信区间，聚合 P95 不代表患者层面的合并 P95；悬停显示两项估计和差值，窄屏上下排列。详细数值表已移除，I/II 类状态保留在地图详情中。
- **星期与小时热图**：按医院和四项指标筛选最近 28 天的记录，以香港时间按星期一至星期日及 0–23 时分组，显示每格发布估算值的中位数。悬停、聚焦或点击格子可查看样本数、预期 15 分钟时段数及覆盖率；颜色表示分钟区间，空格代表没有有效数值。热图中的 P95 是已发布 P95 估算值的中位数，并非患者层面的合并 P95。

## 近期更新（2026-10-26）

- **新增监测数据与面板**：接入医管局服务需求高峰期统计、卫生防护中心流感数据及急症科传染病症状监测，每日检查并分别写入 `ha_health_sources`。服务需求仅在高峰期间每日发布，其余两类每周发布；各自显示统计日期及历史／延迟标记。当前数据分别截至 2026-08-04、2026-10-17、2026-10-17。
- **高密度可视化**：新增医院服务负荷排行、联网筛选、趋势图和 100% 占用参考线；流感显示阳性率趋势、分型历史堆叠柱图及年龄组入院率；四类急症症状采用独立刻度小图，支持 13／26／52 周窗口。症状监测基于诊断编码，不代表实验室确诊数。
- **流感环形图**：展示最新周 A(H1)、A(H3)、B 的检出数量与占比，与历史柱图使用相同颜色。中心及占比分母为三类检出数之和，不能视为全部 A/B 阳性数；分型缺失时不绘制比例，总数为零时显示空环及说明。
- **颜色与布局**：III 类地图及热图改用 `<10、10–<20、20–<30、30–<45、45–<60、60+` 分钟固定区间，避免大部分数据落入同一颜色；IV/V 类保持原区间，图例随指标同步。隐藏 Dashboard 顶部标题栏，保留卡片内的数据更新时间。
- **质量控制与验证**：拒绝非法数值、畸形 CSV、重复记录及无效周统计窗口；缺失值不转为零。MongoDB 原子更新阻止旧统计日期覆盖新数据，同时允许同统计期修订；各来源错误独立记录和清除。已完成代码测试、Vue 模板编译及 MongoDB 写入验证，并通过 Node-RED API 备份、部署；未使用浏览器或图片验证。

## 分析方向与局限

后续可比较平日与周末、日间与夜间的分布，并在相同时间及分流类别下比较医院。若与香港天文台天气数据进行相关分析，应先对齐时间，并考虑医院、星期和时段等因素；相关性不能直接解释为因果关系。专科门诊数据按报告周期独立比较，避免将季度发布的统计误读为每日变化。分析结论受数据缺测、估算口径及历史积累长度影响；热图的周期性判断需要足够多周的数据支持。

## 数据储存

MongoDB 保存带来源时间、首次及最近抓取时间、来源地址和原始响应的急症快照，并保存专科门诊原始记录及其抓取信息，便于去重、复查和后续分析。Docker 持久卷可保留容器重启后的数据库数据，但不等同于备份；项目应另行导出数据以防主机故障。
