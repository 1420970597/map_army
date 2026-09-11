# map.army — 军事标图 Web 应用（开源复刻版）

[![CI](https://github.com/1420970597/map_army/actions/workflows/ci.yml/badge.svg)](https://github.com/1420970597/map_army/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

本项目是对 [https://www.map.army](https://www.map.army) 的**功能等价开源复刻**。

> **重要声明**：原站为 gs-soft AG 出品的商业闭源产品，本项目**不包含任何原站源码**，
> 所有代码均为依据公开标准（MIL-STD-2525、STANAG APP-6、MGRS/UTM/BNG 规范）
> 与可公开观察的产品行为从零实现，仅用于技术学习与研究。

## 项目定位

map.army 是一款用于**创建、保存与交换军事标图**的纯前端 Web 应用。它支持北约联合军标体系
（NATO Joint Military Symbology），可在地图上绘制战术图形与单位符号，并叠加
MGRS / UTM / BNG 军用网格，最终导出为图片或 MilX 交换格式。

## 技术栈

| 领域 | 选型                                | 说明                            |
| ---- | ----------------------------------- | ------------------------------- |
| 构建 | Vite 7                              | 原生 ESM，冷启动快              |
| 框架 | React 19 + TypeScript 5.8           | 严格模式全开                    |
| 状态 | Zustand 5                           | 轻量 store，避免 Redux 样板代码 |
| 地图 | Leaflet 1.9 + react-leaflet 5       | 成熟稳定的开源瓦片地图          |
| 测试 | Vitest 3                            | 与 Vite 共享配置                |
| 规范 | ESLint 9 (Flat Config) + Prettier 3 | 统一代码风格                    |
| 交付 | GitHub Actions                      | Node 20.x / 22.x 矩阵           |

## 目录结构

```
src/                        # 应用源码
├─ core/                    # 与 UI 无关的纯逻辑层，可独立测试
│  ├─ geo/                  # 测绘核心：横轴墨卡托投影、UTM、MGRS、BNG、军网生成
│  ├─ symbology/            # MIL-STD-2525D / APP-6(D) 军标符号引擎（SIDC 解析、框架、图标、渲染）
│  ├─ model/                # 要素 / 图层 / 文档数据模型与球面几何
│  └─ io/                   # 导入导出（.milxly/.milxlyz、GeoJSON）与本地持久化
├─ features/                # 按功能域组织的界面模块
│  ├─ map/                  # 地图引擎、军网叠加、要素图层
│  ├─ draw/                 # 标图绘制交互（点选 / 连续采点 / 草稿状态）
│  ├─ symbol/               # 符号选择面板
│  ├─ layers/               # 图层管理面板
│  ├─ inspector/            # 要素属性检查器
│  ├─ statusbar/            # 状态栏（经纬度 / MGRS / UTM 实时坐标）
│  ├─ toolbar/              # 顶部工具栏
│  └─ io/                   # 导入导出操作栏
├─ stores/                  # Zustand 状态容器（文档 + 视图）
└─ styles/                  # 全局样式
site/                       # 静态站点的内容源与生成器
├─ content.json             # 五语言（zh/en/de/fr/it）× 三页面的全部文案
├─ examples.json            # 示例页符号清单（SIDC 与分组标题译文）
├─ generate.mjs             # 页面生成器（产出 15 个本地化 HTML）
└─ icons.mjs                # PWA 图标生成器（零依赖 PNG 编码）
public/                     # 原样拷贝的静态资源（favicon、manifest、sw.js、llms.txt 等）
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（http://localhost:5173）
npm run dev

# 生成静态站点页面与 PWA 图标（build 时会自动执行）
npm run site

# 类型检查
npm run typecheck

# 运行单元测试
npm run test

# 生产构建
npm run build
```

### Docker Compose 部署

生产镜像会在容器内完成构建，并由 nginx 提供带 SPA 回退的静态站点：

```bash
docker compose up --build -d
# 浏览器打开 http://localhost:8080
docker compose logs -f map-army
docker compose down
```

三维视图默认使用项目内置的椭球高程基线与随 Cesium 发布的 Natural Earth 离线底图，不请求外部
高程或影像瓦片；因此完全离线部署仍能看到可辨识的地球。需要真实 DEM 或内网影像时，复制 `.env.example`，在构建前配置
`VITE_CESIUM_ION_TOKEN`、`VITE_CESIUM_TERRAIN_URL` 和 `VITE_CESIUM_IMAGERY_URL` 中的相应项。

容器不保存业务数据；标图文档继续按浏览器 localStorage 保存，也可以使用应用内的
`.milxlyz` 导出作为跨设备备份。

若浏览器曾打开过旧版本，首次部署新镜像后请执行一次强制刷新（Ctrl+F5）。Nginx 已对入口
和 Service Worker 禁止缓存，后续发布会自动清理旧资源缓存。

## 导入 AFSIM 想定

在“文件”中选择“导入 AFSIM 想定文件夹”，选取包含入口及公共类型库的目录，确认 `.txt` 或
`.afproj` 入口后点击“解析想定”。检查单位数和诊断报告，再点击“绘制到地图”。导入沿用追加、
活动图层、指定图层或替换文档模式，整批操作可撤销；刷新后点击会话横幅的“恢复”继续编辑。

这是本项目的扩展功能。它解析静态平台、类型继承、include 依赖及路线起点，按阵营和运动域生成
军标；不执行 AFSIM 脚本或仿真。缺少类型、无法解析的位置等会报告并跳过，不能将导入结果视为
任意仿真时刻的状态。完整语法依据和兼容范围见
[AFSIM 格式研究](docs/RESEARCH-afsim-import-2026-09.md) 与
[导入验收记录](docs/QA-afsim-import-2026-09.md)。

例如选择 `/root/afsim/demo/0_sensor` 后使用 `main.txt`；`simple_scenario` 引用相邻的
`base_types`，因此应选择 `/root/afsim/demo`，再选 `simple_scenario/simple_scenario.txt`。

## 开发规范

本项目的长期复刻约束、原站差异审计流程和每轮迭代完成门槛记录在
[AGENTS.md](AGENTS.md) 与 [docs/PROJECT_MEMORY.md](docs/PROJECT_MEMORY.md)。任何功能迭代、PR
更新或合并后的工作都必须先阅读项目记忆，并重新对照原站生成下一轮 ToDo。

- **注释语言**：全部代码注释使用**简体中文**。
- **提交信息**：遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)，
  PR 标题由 CI 自动校验。
- **分支模型**：`main`（稳定） ← `develop`（集成分支） ← 功能分支。
  所有功能分支必须通过 Pull Request 合入，禁止直接推送。
  > 环境注记：本仓库所在环境对带斜杠的分支名存在引用写入问题，
  > 功能分支实际使用连字符命名（如 `feature-geo-core`），
  > 分支开发 + PR 评审 + 语义化提交的规范实质不变。
- **提交前自检**：`npm run ci`（lint + 格式校验 + 测试 + 构建）必须全绿。

## 已实现

- [x] 测绘核心：Krüger 级数横轴墨卡托投影、UTM 正反算、MGRS 编解码、BNG 正反算、军网生成
      （70 个单元测试，与第三方实现逐点交叉验证，往返误差达纳米级）
- [x] 军标符号引擎：20 位 SIDC 解析与校验、七大框架族、四大符号集核心图标、
      梯队 / 司令部 / 状态 / 机动方向修饰符、昼间与夜间配色（82 个单元测试）
- [x] 数据模型与球面几何：Haversine 距离、方位角、球面过剩面积（30 个单元测试）
- [x] 地图引擎与界面：三种底图、MGRS/UTM/BNG 军网叠加、要素图层、绘制交互、
      符号面板、图层管理、属性检查器、坐标状态栏
- [x] 导入导出与持久化：`.milxly` / `.milxlyz`（gzip）读写、GeoJSON 往返、
      图片导出、localStorage 自动保存（18 个单元测试）
- [x] 静态站点与 PWA：五语言关于 / 示例 / 文档页（内容文件 + 生成器产出）、
      Service Worker 离线缓存、Web App Manifest、llms.txt、sitemap 与 hreflang

## 路线图：与原站的功能差距

**复刻基线**：原站**免费托管版**（free hosted）。原站 Pro 的时间轴 / BFT / 用户管理 /
自定义底图 / 口令保护分享 / 封闭网络部署均需服务端，不在复刻范围内。

**比对依据**：原站官方文档索引 `https://www.map.army/doc/en/llms.txt`（全部文档页），
以及 `Free vs Pro`、`Symbol Gallery`、`Create Export`、`Keyboard Shortcuts`
等页面的细节说明。每项格式为「原站行为 → 本项目现状」。

图例：`[x]` 已复刻 · `[~]` 部分复刻 · `[ ]` 未复刻

### 一、图层与项目

- [x] 多图层容器，其中之一为活动图层（仅活动图层可绘制）
- [x] 图层创建、重命名、删除、可见性、锁定、排序
- [x] 会话持久化 —— 原站无服务端存储，需手动导出 `.milxlyz`；本项目有 localStorage
      自动保存，启动时给出恢复 / 丢弃入口，并对存储超限、数据损坏与多标签页冲突分别提示
      （**优于原站**）
- [x] 图层导入导出 —— 支持原生 `.milxly` / `.milxlyz`、MilX XML、GeoJSON、KML、NVG/GPX、
      图像叠加与在线图层，导入默认追加且可合并到活动图层
- [x] 图层状态（working / approved）—— 图层名左侧徽标，点击在草稿 / 已核定间切换
- [x] 符号跨图层移动（多选后整批拖拽到另一图层）—— 检查器下拉与图层面板拖放两条入口，
      整批移动只产生一条撤销记录
- [x] 图层透明度设置 —— 0.05–1 滑块，一次拖动只留一条撤销记录

### 二、符号库

- [x] 符号库六大分区浏览 —— My Favorites、Formations、Equipment and Installations、
      Tactical Graphics、Function-Specific、Metoc
- [x] 符号搜索 —— 支持中英文名称、别名与装备型号检索并实时过滤
- [~] 符号标准版本 —— 原站基线为 **MIL-STD-2525C**；本项目按 **2525D / APP-6(D)**
  实现（**版本更新于原站**，但符号总数远少于原站 MSS 服务）
- [x] 战术图形（Tactical Graphics）：进攻/防御箭头、集结地域、分界线、走廊、相位线
- [x] 气象海洋、职能、装备与设施符号分组及目录元数据
- [x] 收藏夹（右键加入 My Favorites）
- [x] International / Extended 工作模式
- [x] 符号格式默认值：线宽、填充色、字号与字体

### 三、符号编辑与几何编辑

- [~] 文本修饰符 —— 原站按军标定义的位置环绕基础符号排布；本项目支持
  4 类文本与机动方向，定位规则简化
- [~] 非文本修饰符 —— 本项目支持梯队、状态、司令部/特遣队、机动方向；
  缺兵力、部队代号、平台代号等完整属性
- [x] 点编辑器：添加 / 移动 / 删除参考点 —— 拖手柄改形，一次拖拽只产生一条撤销记录
- [x] N 点编辑器模式：Ctrl 插入点、Shift 删除点、Ctrl+←/→ 切换点
- [x] 顶点吸附（snapping）—— 自身顶点 / 其他要素顶点 / 军网交点三源候选，10px 阈值，
      `S` 键开关；绘制期采点与顶点编辑共用同一吸附引擎与提示样式
- [x] 顶点方向重置 —— 单个顶点与整条要素的方向均恢复为自动切线方向
- [x] 复制 / 粘贴（Ctrl+C / Ctrl+V）—— 连续粘贴按 24px 逐级偏移，属性与顶点方向完整保留
- [x] 多选：Ctrl+点击 与 Ctrl+框选 —— 框选为追加语义，检查器提供批量操作面板

### 四、底图与视图

- [x] 2D 标图画布
- [~] 底图样式 —— 原站提供 OSM / OpenTopoMap / Google / swisstopo 等多家；
  本项目为 3 种无密钥公开底图
- [x] 3D 视图（含高度升降、航向/俯仰控制、图层可见性与透明度）
- [x] 太平洋视图（投影中心切换）
- [x] 地形晕渲
- [x] 底图标注语言设置（支持的底图透传）

### 五、坐标网格与地图工具

- [x] 坐标网格 —— MGRS / UTM / WGS84 / GARS / BNG / LV95·LV03 / 六边形网格
- [x] 距离、面积与方位角量测
- [x] 坐标搜索：按 WGS84 / MGRS / UTM / GARS / BNG / LV95 / LV03 跳转定位
- [x] 距离环 / 武器威胁半径绘制
- [x] 指北针与真北 / 磁北切换
- [x] WMM 磁偏角与 GM 角显示
- [x] 放大镜（按住 D）与自身地理定位

### 六、选项

- [x] 语言切换（中文、英文、德语、法语、意大利语设置入口）
- [x] 工作模式与单位约定（公制 / 英制）
- [x] 地图工具开关（坐标搜索、指北针、量测、晕渲、放大镜）
- [x] 坐标系设置（MGRS / UTM / BNG / WGS84 / GARS / LV95 / LV03 / HEX）

### 七、导出与打印

- [x] PNG/JPG 导出 —— 支持当前视口或全部要素、倍率、透明底与归属标签
- [x] 打印与 PDF 导出：纸张（A4/A3）、方向、DPI、1:25 000 比例尺校验
- [x] 地理配准图片：JPG + `.jgw` / PNG + `.pgw`（WGS84 world file）
- [x] 导出自动附加底图归属、应用名与日期标签

### 八、数据交换

- [x] 分享链接三种形态：只读 / 编辑副本 / 编辑覆盖（服务端版本与并发校验）
- [x] iframe 嵌入代码生成
- [x] URL 参数加载内联或服务端 MilX 图层
- [ ] 兵棋推演模式：双方对抗、裁判控制、隐藏信息
- [ ] 在线图层分享（KML / GeoJSON，接收方免上传）
- [x] NVG 导入（NATO Vector Graphics 2.0.0 / 2.0.2）
- [x] KML 导入导出
- [x] 图像叠加层导入（本地配准与在线 URL）
- [x] MilX 原生 XML（`.milxly` / `.milxlyz`）互转

### 九、应用与平台

- [x] 键盘快捷键 —— 撤销 / 重做、复制粘贴、删除、全选、Esc、F11 全屏、
      Ctrl+F5 强制重载、方向键平移、Z/X 缩放、N 重置朝北、Space 确认、S 吸附、
      B 框选、`?` 帮助面板，与 `docs/ARCH-geo-edit.md` 的注册表一致
- [x] PWA 安装与 `.milxlyz` 文件关联 —— manifest 声明并通过 `launchQueue` 接收
- [x] 全屏模式 —— Fullscreen API、F11 命令与工具栏按钮
- [x] 新版本更新提示（PWA 更新后提示刷新）
- [ ] 大图层性能优化

### 十、站点与内容

- [x] 五语言（zh/en/de/fr/it）关于 / 示例 / 文档页
- [x] `llms.txt` 与 sitemap、hreflang
- [~] 示例画廊 —— 原站为真实用户态势图（iframe 嵌入 + 视频 + 每月精选）；
  本项目示例页为符号陈列
- [ ] 用户作品提交与展示

### 不在复刻范围（依赖原站服务端或属商业能力）

本节是路线图的**范围边界**，不是“入口待补齐”列表。2026-09-09 对照官方
[`llms.txt`](https://www.map.army/doc/en/llms.txt)、[`Free vs Pro`](https://www.map.army/doc/en/about/pro-vs-free/)、
[`FAQ`](https://www.map.army/doc/en/about/faq/) 及相关数据交换页面复核后，当前共有 **9 项**：

| 编号   | 能力                         | 原站真实行为与证据                                                                                                                                                                                                                                                                                                         | 当前实现事实                                                                                                                   | 排除原因与边界                                                                                                                              |
| ------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| OOS-01 | Pro 时间轴与单位动画         | Pro 才支持单位沿航路点自动移动、播放控制；免费版不提供。[Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/)                                                                                                                                                                                                      | `src/features/map/Map3DView.tsx` 明确关闭 Cesium timeline/animation；模型没有时间轴、航路和回放状态                            | **Pro 能力**，需要时间序列项目数据、服务端保存/协作和动画状态同步；不纳入免费版复刻。                                                       |
| OOS-02 | Blue Force Tracking（BFT）   | Pro 才支持参与单位的实时位置共享；免费版仅能显示当前浏览器自己的位置，且不会转发给他人。[FAQ](https://www.map.army/doc/en/about/faq/)、[Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/)                                                                                                                       | `src/features/toolbar/Toolbar.tsx` 只有 `navigator.geolocation` 的本机定位；没有 WebSocket、位置广播、订阅或轨迹存储           | **Pro 实时协作能力**，需要身份、位置服务、推送通道和权限控制；本机定位继续属于复刻范围。                                                    |
| OOS-03 | 外部 GPS / SIM 追踪器        | Pro 支持硬件 beacon 推送位置；免费版不能接入 SIM tracker、硬件信标或把位置推送到地图。[FAQ](https://www.map.army/doc/en/about/faq/)                                                                                                                                                                                        | 当前没有串口、蓝牙、NMEA、HTTP tracker 或设备注册协议，仅使用浏览器 Geolocation API                                            | **商业项目集成能力**，依赖设备协议、网关、鉴权和后端接入；不以浏览器定位冒充完成。                                                          |
| OOS-04 | 用户管理与登录               | Pro 提供多用户、登录和基于角色的权限；免费托管版无账号、无登录、无用户级持久化。[Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/)、[FAQ](https://www.map.army/doc/en/about/faq/)                                                                                                                               | 当前没有用户表、会话认证、登录页面或角色模型；`server/index.mjs` 的 Bearer token 只保护分享更新，不代表用户身份                | **Pro 服务端身份能力**，需要账号目录、会话、角色/审计和持久化；分享令牌保持资源级编辑令牌语义。                                             |
| OOS-05 | 自定义 WMTS / WMS 底图       | Pro 可配置地图提供商，包含私有和本地瓦片服务器；免费版只提供官方预置样式。[Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/)、[Map display settings](https://www.map.army/doc/en/options/map_settings/)                                                                                                         | `src/features/map/tileSources.ts` 是固定公开源目录；虽支持图像/在线图层 URL，但没有用户自定义 WMTS/WMS、服务能力探测或私有凭据 | **Pro GIS/部署能力**。公开无密钥底图、图像叠加和在线图层仍可继续完善，但不实现任意 WMTS/WMS 管理。                                          |
| OOS-06 | 口令保护的分享链接           | Pro/项目部署可提供非公开访问控制；免费分享链接是无密码、持有链接即可访问。[Create a Share](https://www.map.army/doc/en/data-exchange/create-a-share/)、[Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/)                                                                                                       | 当前 `GET /api/shares/:id` 以随机 ID 读取；随机 Bearer token 和 `If-Match` 只用于编辑更新，未实现密码校验、登录或访问过期策略  | **商业安全能力**，需要认证、密钥生命周期、限流和访问审计；随机分享 ID 不得描述为口令保护。                                                  |
| OOS-07 | 封闭网络 / 完整本地化部署    | FAQ 说明可按项目把 Web 应用及 MSS/MilX 后端部署到无互联网网络，并按 Active Directory、GIS、WMTS/WMS 等环境定制。[FAQ](https://www.map.army/doc/en/about/faq/)                                                                                                                                                              | `docker-compose.yml` 只提供本项目静态前端和 Share API；前端仍引用外部瓦片，未包含原站 MSS/MilX 后端、账号体系或离线数据供应链  | **项目交付/部署能力**。Docker Compose 是本项目开发和可自托管部署方式，不等同于原站 Pro 的闭网交付；闭网全套依赖不纳入。                     |
| OOS-08 | gs-soft MSS 托管符号服务/API | 原站由 MSS（Military Symbol Service）提供超过 3500 个符号和战术图形，map.army 通过 REST/SOAP 后端使用；完整规格需联系 gs-soft。[MSS 产品页](https://www.gs-soft.com/CMS/en/products/mssstick-mss-and-milx/mss)、[FAQ](https://www.map.army/doc/en/about/faq/)、[MilX 格式](https://www.map.army/doc/en/about/milx-format/) | 本项目在 `src/core/symbology/` 使用本地目录和自绘渲染，未调用 `symbol.army`/MSS Web API；仅实现已审计的本地兼容子集            | **不是免费版功能排除，而是实现依赖替代/兼容限制**。复刻可见符号功能与交换格式，但不复制闭源 MSS 服务、完整专有目录、服务端 API 或商业授权。 |
| OOS-09 | 用户论坛与社区作品征集/托管  | 原站 FAQ 页提供 Google Group User Forum；社区作品、示例精选和投稿流程依赖外部社区/站点运营，而非地图编辑器本身。[FAQ](https://www.map.army/doc/en/about/faq/)、[官方首页](https://www.map.army/)                                                                                                                           | `site/` 仅生成静态关于、示例和文档页，没有账号、投稿接口、审核队列、评论、社区存储或运营后台                                   | **外部社区服务能力**，需要论坛平台、投稿审核、内容存储和运营流程；本项目最多提供静态说明或外链，不实现社区后台。                            |

#### 范围统计与判定

- **9 项总计**：OOS-01 至 OOS-09；其中 OOS-01～OOS-07 与 OOS-09 是严格排除项，OOS-08 是本地替代引擎的兼容边界。
- **7 项 Pro 专属**：OOS-01～OOS-07，官方 `Free vs Pro` 明确将其列为免费版没有、Pro 提供的能力。
- **1 项专有服务依赖**：OOS-08，MSS/MilX 服务由 gs-soft 维护，完整 schema、目录和授权不公开；本项目保留本地符号功能，但不宣称与原站服务完全等价。
- **1 项外部社区能力**：OOS-09，依赖 Google Group/站点运营和内容审核。
- **严格排除 8 项**：7 项 Pro 专属 + 1 项论坛/社区后端；OOS-08 不删除符号功能，只排除对原站闭源服务的直接依赖。
- **当前替代状态**：OOS-02 保留“本机浏览器定位”这一免费能力；OOS-05 保留预置公开底图和在线图层；OOS-07 提供开发者 Docker Compose。上述替代均不扩大为原站 Pro 功能。
- **明确不误判**：本项目自有 Share API、localStorage、Docker Compose 和本地符号渲染是复刻实现手段，不代表已实现原站用户账号、口令分享、MSS 服务或闭网 Pro 交付。

原站与当前实现的完整逐项范围审计、抓取日期和后续可纳入 ToDo 见
[`docs/RESEARCH-out-of-scope-2026-09.md`](docs/RESEARCH-out-of-scope-2026-09.md)、
[`docs/RESEARCH-original-site-2026-09-v2.md`](docs/RESEARCH-original-site-2026-09-v2.md) 与
[`docs/TODO-original-site-audit-2026-09.md`](docs/TODO-original-site-audit-2026-09.md)。

## 许可证

[MIT](./LICENSE)
