# 原站免费版复刻范围审计（2026-09）

本报告专门核对 README“ 不在复刻范围（依赖原站服务端或属商业能力）”一节。研究对象是官方免费托管站 `https://www.map.army/`，证据只来自 gs-soft 官方英文文档、FAQ、Free vs Pro 对照和官方数据交换页面。核心判定原则是：**Free vs Pro 表中标为 Free 的能力不能因为它调用服务端就列为功能排除；可以把原站云服务替换成项目自有 API 或本地存储，并在文档中标注兼容边界。**

## 官方 Free/Pro 边界

官方 [Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/) 明确列出：免费版有 MIL-STD-2525 MSS 符号、2D/3D、MilX 图层创建/编辑/导入/导出、MGRS/UTM/WGS84/GARS/BNG/LV95/LV03/Hex 网格、坐标搜索与量测、PDF/图像归属导出、Read Only/Edit & Copy/Edit & Overwrite 三种分享、iframe 和浏览器自身定位。免费版没有时间轴、BFT、外部 GPS/SIM 跟踪器、用户管理/登录、自定义 WMTS/WMS、口令保护分享、封闭网络部署。

官方 [FAQ](https://www.map.army/doc/en/about/faq/) 补充：免费版无账号、无个人服务端持久化；浏览器只能显示**自己的** Geolocation 位置，不会向参与者广播；真正离线运行不可用，封闭网络部署属于项目交付；MSS/MilX 是后端 REST/SOAP 服务。免费版分享没有密码，但分享服务本身存在并支持协作。

## README 排除项逐项复核

| README 项目 | 官方证据与免费版状态 | 当前仓库差异 | 是否应列为排除项 |
| --- | --- | --- | --- |
| Pro 时间轴与单位动画 | [Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/) 的 Capability 表中 Free 为“—”，Pro 描述为单位沿航路航点移动并带播放控制。免费公开文档没有此功能入口。 | `src` 没有时间轴或动画模型。 | **是，P0 商业能力排除。** 可以保留数据模型扩展位，但不能把静态路线/战术图形误称为时间轴。 |
| Blue Force Tracking（BFT）实时位置共享 | 同一 Capability 表明确 Free 为“—”、Pro 为参与单位实时位置共享；[FAQ](https://www.map.army/doc/en/about/faq/) 说免费版不共享参与者 GPS。 | 当前仅 `navigator.geolocation` 一次定位按钮，无 BFT 推送/订阅。 | **是，P0 商业/多用户后端排除。** 自身定位仍是免费版功能，不能一并删掉。 |
| 外部 GPS / SIM 追踪器接入 | [Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/) 明确 Free 为“—”、Pro 为硬件信标推送位置；[FAQ](https://www.map.army/doc/en/about/faq/) 明确不能接外部 GPS、SIM tracker。 | 当前没有设备协议或位置上报 API。 | **是，P0 硬件/服务端排除。** 保留浏览器 Geolocation 即可满足免费版。 |
| 用户管理与登录（多用户、角色权限） | [Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/) 明确 Free 为“—”、Pro 才有账号和基于角色权限；FAQ 说明免费版没有账号/登录。 | 当前没有账号体系；分享使用随机 ID/令牌，不是用户账户。 | **是，P0 账户服务排除。** 不应为免费版复刻强行加入登录。 |
| 自定义 WMTS / WMS 底图（含私有与本地瓦片服务） | [Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/) 将可配置地图提供商（含私有/本地瓦片）列为 Pro；[Map Settings](https://www.map.army/doc/en/options/map_settings/) 的免费页面只列固定 Satellite/Terrain/Hybrid/Roads/Roadmap/OSM/OpenTopoMap/swisstopo 样式。 | `src/features/map/tileSources.ts` 有固定公开源，无 WMTS/WMS 配置。 | **是，Pro 能力排除。** 免费源目录扩充仍属复刻范围；不要把“更多固定源”和“自定义 WMTS/WMS”混为一谈。 |
| 口令保护的分享链接 | [Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/) 将 Password-protected shares 列为仅 Pro；[Create Share](https://www.map.army/doc/en/data-exchange/create-a-share/) 说明免费链接是公开、无密码、无账户，持有链接者按权限访问。 | 本项目服务端分享用随机 ID + 编辑令牌，未提供密码；符合免费版。 | **是，密码/认证层排除。** 但 Read Only、Edit & Copy、Edit & Overwrite、版本和 Track Changes 都是免费版能力，不能因需要 API 就排除。 |
| 封闭网络 / 本地化部署 | [Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/) 将 closed-network/on-premise 与现场 MSS/MilX 后端列为 Pro 项目交付；[FAQ](https://www.map.army/doc/en/about/faq/) 说 hosted app 不能真正离线运行，封闭网络部署需项目支持。 | 本仓库可用 Docker Compose 在本机运行前端和分享 API，但没有原站 MSS/MilX 后端、离线地图数据或商业部署集成。 | **原站商业部署能力应排除。** Docker 是本项目开发/自托管便利，不能宣传为等价于 map.army pro 的封闭网络产品。 |
| MSS（Military Symbol Service）托管符号服务 | [Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/) 中 MSS 符号在 Free、Pro 均为“✓”；[FAQ](https://www.map.army/doc/en/about/faq/) 说明网页通过 REST/SOAP 调用 MSS/MilX 服务，且这些服务可授权给合作方使用。它是原站免费版的实现依赖，不是用户可选择的 Pro 功能。 | 本项目用 `milsymbol`/本地 `src/core/symbology` 自绘引擎替代 MSS，没有原站完整符号覆盖和服务版本。 | **不应把“功能”列为排除；应列为明确兼容限制。** 复刻路线需说明“本地替代引擎，非 gs-soft MSS；标准覆盖和渲染可能不同”，不能声称完全等价。 |
| 用户论坛与社区作品征集 | [首页](https://www.map.army/) 和 [Examples](https://www.map.army/example/en.html) 把 User Forum、用户示例/视频作为站点外围内容；Free vs Pro 能力表没有论坛或投稿权限。 | 当前应用仓库没有论坛后端和在线投稿；有静态示例/文档。 | **是，产品外部社区服务排除。** 可在静态站点提供论坛链接、投稿说明和示例 iframe；不应伪造在线社区。 |

## 容易被误列为“范围外”的服务端能力

这些能力确实调用原站后端，但官方明确是免费版公开功能，因此只能替换实现，不能从 ToDo 删除：

| 能力 | 免费证据 | 当前仓库应有的边界 |
| --- | --- | --- |
| 三种分享、版本和 Edit & Overwrite | [Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/)、[Create Share](https://www.map.army/doc/en/data-exchange/create-a-share/)：三种权限 Free 均为“✓”；分享有版本和 Track Changes。 | 本项目 `server/index.mjs` 已提供随机 ID、编辑令牌、版本和乐观并发检查；这是本地替代服务，不是越界功能。仍需补齐原站“新建空 Share、显式加入图层、固定版本、Track Changes”行为。 |
| iframe 嵌入 | Free vs Pro 的 iframe 行为为“✓”；[iFrame](https://www.map.army/doc/en/data-exchange/iframe/) 给出 share URL 和外链 MilX 两种方式。 | `ShareDialog` 可生成 iframe；需确保只读权限、CORS/MIME 提示和外链失败提示。 |
| URL 加载 MilX 与在线源图层 | [URL Layer](https://www.map.army/doc/en/data-exchange/load-milx-layer-using-url-parameter/) 支持 `?layer=<URL>;readonly`；[Online Layers](https://www.map.army/doc/en/data-exchange/share-online-source-layers/) 支持 KML/GeoJSON/PNG/JPG URL，接收方每次重新抓取。 | 当前有 URL 载入和 `sourceUrl` 字段；必须明确“不嵌入快照、源站/CORS 不可用则失效”。在线层分享不是 Pro 专属。 |
| 兵棋协作 | [Wargaming](https://www.map.army/doc/en/data-exchange/wargaming/) 说明免费可用三 Share 手工模式：蓝方、红方、裁判各一 Share；没有内建按层选择性分享或安全隐藏。 | 当前没有完整三方视图/快捷流程，但这不是 Pro 功能。可做演示级红蓝/裁判分组，必须标注前端隐藏不提供安全隔离。 |
| 自身浏览器定位 | Free vs Pro 表把 own browser geolocation 列为两档均有；FAQ 说明位置只在本地显示。 | 当前 `Toolbar` 有“我所在位置”按钮。 | **必须保留在免费复刻范围内。** 不应与 BFT/外部 GPS 一起排除。 |
| PWA 缓存与离线边界 | [Install PWA](https://www.map.army/doc/en/progressive-web-application/install/) 宣传静态资源缓存后可离线访问；[FAQ](https://www.map.army/doc/en/about/faq/) 又明确完整 Web 应用不能离线运行，因为 MSS/MilX 服务需网络。 | 当前 Service Worker 缓存应用壳和 `launchQueue`；本地绘制可部分工作，但外部瓦片/MSS/分享离线不可用。 | 不能宣传“完整离线 map.army”；验收应拆成“壳离线可打开”和“服务依赖离线有清晰提示”。 |

## 对 README/路线图的范围修订建议

1. 保留排除项：时间轴/单位动画、BFT、外部 GPS/SIM、用户管理/登录、自定义 WMTS/WMS、密码分享、原站 Pro 封闭网络部署、官方论坛/社区后端。
2. 将“MSS 托管符号服务”从“功能排除”改成“实现依赖替代/兼容限制”：免费原站确实使用 MSS，本项目用本地引擎，不得标称符号覆盖完全一致。
3. 在免费复刻 ToDo 中明确纳入三种分享、版本/并发、iframe、URL 图层、在线图层分享、三 Share 兵棋演示、浏览器自身定位。这些能力虽然原站有后端，但 Free vs Pro 已确认可用。
4. Docker Compose 只描述本项目的本地部署方式，不要把它写成可替代原站 Pro 的“闭网/离线部署”；除非另行实现 MSS/MilX、本地瓦片、用户和认证等完整商业部署栈。

## 来源索引

* [Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/)
* [FAQ](https://www.map.army/doc/en/about/faq/)
* [Create a Share](https://www.map.army/doc/en/data-exchange/create-a-share/)
* [iFrame](https://www.map.army/doc/en/data-exchange/iframe/)
* [Load MilX via URL](https://www.map.army/doc/en/data-exchange/load-milx-layer-using-url-parameter/)
* [Share Online-Source Layers](https://www.map.army/doc/en/data-exchange/share-online-source-layers/)
* [Wargaming](https://www.map.army/doc/en/data-exchange/wargaming/)
* [Install PWA](https://www.map.army/doc/en/progressive-web-application/install/)
* [Examples](https://www.map.army/example/en.html)
