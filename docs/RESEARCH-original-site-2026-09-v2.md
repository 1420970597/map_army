# map.army 免费托管版复刻复核与迭代 ToDo（2026-09）

本轮只引用 gs-soft 的一手页面（英文文档索引见 [llms.txt](https://www.map.army/doc/en/llms.txt)）。逐页核对公开行为，并与当前仓库 `src/` 实现对照。这里的“缺口”指会导致用户行为、数据格式或可见结果与原站不一致的项目；Pro 的时间轴、BFT、账号、私有 WMTS/WMS、密码分享不属于免费版复刻范围。

## 已核对的原站行为

* 主窗口在 2D 与只读 3D 间切换；3D 有鼠标/触摸平移、缩放、俯仰、旋转、升降、N 朝北，且可在 3D 面板逐层控制可见性和透明度。[Introduction](https://www.map.army/doc/en/first-steps/introduction/)、[3D Map View](https://www.map.army/doc/en/map/3d_map_view/)
* 图层严格只有一个活动图层；图层可新建、排序、显隐、缩放到内容、重命名、删除、设置 Working/Approved、透明度；Ctrl 点击或框选后可拖到另一图层批量移动。[Edit Overlays](https://www.map.army/doc/en/layers/edit_layer/)
* 符号库分为 My Favorites、Formations、Equipment and Installations、Tactical Graphics、Function-Specific、Metoc；基线是 MIL-STD-2525C，Extended 还包括瑞士军警消符号。符号编辑器有 Edit、Preview、About MSS 三页签，Extended 可挂最多两个 Icon Extension Modifier。[Symbol Gallery](https://www.map.army/doc/en/symbols/symbol-gallery/)、[Symbol Editor](https://www.map.army/doc/en/symbols/symbol-editor/)
* 多点图形按逐点点击绘制，Space 完成、Esc 放弃；Point Editor 可插入、删除、移动控制点。[Point Editor](https://www.map.army/doc/en/symbols/point-editor/)
* 网格包括 None、WGS84、MGRS、UTM、GARS、BNG、LV95、LV03、Hexagonal；六边形网格可调边长、标签、颜色、不透明度和线宽。[Coordinate Grid](https://www.map.army/doc/en/map/coordinate-grid/)、[Map Coord Options](https://www.map.army/doc/en/options/map_coord/)
* 坐标搜索支持 WGS84、GARS、MGRS、UTM、BNG，一次一个坐标，接受度分秒、`deg` 以及 m/km/ft/yd/mi。[Coordinate Search](https://www.map.army/doc/en/map-tools/coordinate-search/)
* 量测支持多段距离（逐段和总长、方位角）、三点以上面积，双击/右键/Space/Esc 结束；距离有 metric、imperial、nautical，角度有 degree、NATO milliradian，真北/磁北由 WMM2025 修正；Terrain Tool 显示约 30 m DEM 的 AMSL 高程。[Measurement](https://www.map.army/doc/en/map-tools/measurement/)、[Magnetic Declination](https://www.map.army/doc/en/map-tools/magnetic-declination/)
* 底图选项公开 Satellite、Terrain、Hybrid、Roads、Roadmap、OSM、OpenTopoMap、swisstopo National/Aerial；另有亮度、Hue、Chroma 和标注语言设置。[Map Settings](https://www.map.army/doc/en/options/map_settings/)
* 导出对话框支持 PDF/IMAGE、A4/A3、横竖、DPI、当前视口/全部内容、坐标网格/参考点、JPG+`.jgw`、PNG+`.pgw`，右下必须保留底图和 map.army 归属。[Create Export](https://www.map.army/doc/en/export-and-prints/create-export/)、[Print](https://www.map.army/doc/en/export-and-prints/print-project/)
* 导入追加而不覆盖现有图层：`.milxlyz`、KML、GPX、JSON、GeoJSON、PNG/SVG/JFIF/JPEG/BMP/WebP；图像可拖拽、缩放、旋转并用 world file/config.json 配准。NVG 2.0.0/2.0.2 仅导入，导出走 MilX。[Import](https://www.map.army/doc/en/layers/import_layer/)、[NVG](https://www.map.army/doc/en/data-exchange/nvg/)
* `.milxly` 是 XML，`.milxlyz` 是 ZIP 内 XML；每个 SIDC 固定 15 字符，默认 WGS84，图像/在线矢量不嵌入。[MilX Format](https://www.map.army/doc/en/about/milx-format/)
* 分享先建立空 Share，再显式拖入图层并 Update；权限 Read Only、Edit & Copy、Edit & Overwrite，支持版本号、固定版本和约 10 分钟 Track Changes。在线 KML/GeoJSON/图像通过 URL 分享，接收方每次重新抓取。[Create Share](https://www.map.army/doc/en/data-exchange/create-a-share/)、[Online Layers](https://www.map.army/doc/en/data-exchange/share-online-source-layers/)
* URL 图层格式为 `?layer=<URL>;readonly`，外部服务器必须提供 `application/milxlyz` MIME 和允许 `https://www.map.army` 的 CORS；分享对话框可生成 iframe。[URL Layer](https://www.map.army/doc/en/data-exchange/load-milx-layer-using-url-parameter/)、[iFrame](https://www.map.army/doc/en/data-exchange/iframe/)
* General Options 还包含 11 种 UI 语言、Work Mode、提示开关、MilX Advanced Settings、重置通知、教程、距离/角度单位、地理度数格式；Symbol Format 有阴影、填充、框、修饰符文字大小/颜色/粗体、Colored、战术图形标签间距等。[General](https://www.map.army/doc/en/options/general/)、[Symbol Format](https://www.map.army/doc/en/options/symbol-format/)
* PWA 桌面可关联 `.milxlyz/.milxly` 并由 `launchQueue` 打开；静态资源可离线缓存，但 MSS/MilX 后端功能仍需网络。[Install PWA](https://www.map.army/doc/en/progressive-web-application/install/)、[FAQ](https://www.map.army/doc/en/about/faq/)

## 当前仓库的真实差距

| 优先级 | 缺口与证据 | 可验收 ToDo |
| --- | --- | --- |
| P0 | **3D 图层控制缺失**：`Map3DView.tsx` 只有高度/航向/俯仰按钮，没有原站的图层显隐、透明度面板；Cesium 地形使用 Ellipsoid，不能显示原站地形。 | 在 3D 叠加面板列出所有图层并实时切换 visible/opacity；切换回 2D 时按原站取消活动层；增加真实地形 Provider 或明确显示不可用提示。 |
| P0 | **量测行为不符**：`DrawHandler` 把量测永久写成普通要素，仅有最终线/面，无逐段长度、总长、方位角、单位切换、临时结果删除，也无 Terrain/AMSL 高程。 | 新增量测状态层（临时预览、逐段/总计标签、方位角）；支持 nautical、NATO mil、真/磁北；结束后可保留或删除；接入 DEM 高程读数。 |
| P0 | **原生 MilX 互操作仍不严格**：`documentToMilxXml` 强制 `WGS84`、固定旧 MSS 版本并写入私有 `maparmy:MapArmyDocument`；图层坐标系、RefDateTime、Legend、DisplayBW 等丢失；SIDC 仍允许内部 20 位数字。 | 按公开 V3.1 XML/ZIP 样例逐字段往返；保留每层 CoordSystemType 与元数据；导入严格拒绝非 15 位 SIDC并报告跳过原因；`.milxly` 与 `.milxlyz` 产物用 QGIS/原站样例交叉验证。 |
| P0 | **分享模型与原站不同**：`ShareDialog` 默认勾选所有图层，而原站新 Share 为空且需拖入；Edit & Copy 只在本地继续编辑，不生成新 Share ID；在线图层分享内容未真正持久化 source 元数据。 | 新建空 Share；增加图层拖放到 Share 区；Edit & Copy 生成独立副本 ID；实现版本固定/Track Changes 状态与 10 分钟轮询；在线层仅存 URL 并在源不可用时提示。 |
| P1 | **符号库规模和标准错误**：当前约 90 个自绘定义 + 7 个占位战术图形，面板底部却标称 `2525D/APP-6(D)`；原站基线 2525C，MSS 库远大于此。 | 引入完整 2525C MSS 数据或明确覆盖清单；补齐 Tactical Graphics/Metoc/Function-Specific；界面显示 International/Extended 与实际标准版本；Extended 最多两个 Icon Extension Modifier。 |
| P1 | **Symbol Editor 功能不完整**：当前只编辑少量 SIDC/文本，缺少 Preview/About MSS、提示开关、完整非文本修饰符（图标扩展、日期格式、颜色/阴影/填充/框、战术图形标签分布）。 | 按三页签重构编辑器；补齐字段校验、修饰符可用性/长度、预览和 MSS 版本信息；设置项持久化并影响渲染。 |
| P1 | **选项与单位缺失**：`Preferences` 仅 5 种语言、metric/imperial；缺 Angular Unit、Geo Degree Format、nautical、提示/教程/高级 MilX、亮度/Hue/Chroma、网格颜色/透明度/线宽。 | 扩展偏好模型和 UI；所有量测、状态栏、Point Editor、网格渲染读取同一单位/格式；底图 CSS 滤镜和网格样式实时生效。 |
| P1 | **底图目录不足且来源不一致**：仅 8 个瓦片源，缺 Google Hybrid/Roads/Roadmap、NLS、IGN、PZGiK、OS Maps；Satellite 使用 Esri，不能复现原站 Google 行为；mapLanguage 未透传。 | 增加公开可用源及许可归属，按许可将需密钥源置为可选；实现亮度/Hue/Chroma、标注语言；导出归属根据实际源动态生成。 |
| P1 | **网格/状态栏表现简化**：网格仅粗略经纬线/GARS，缺原站六边形参数面板；状态栏固定显示经纬度/MGRS/UTM，无当前网格格式、比例尺、角度/单位。 | 实现六边形边长、标签、颜色、不透明度、线宽；状态栏按所选网格显示坐标、比例尺和光标高程；跨 180° 与高纬度回归测试。 |
| P1 | **战术图形绘制语义不完整**：7 个自定义图形使用内部伪 SIDC，Point Editor/导出无法表达原站全部控制措施、范围扇/威胁半径等。 | 对照 MSS Tactical Graphics 清单逐项映射真实 15 位 SIDC；补范围扇、PAA、线型/箭头/标签修饰符；确保 N 点图形插入/删除/方向重置后与 XML 往返一致。 |
| P2 | **图层与导入细节差异**：缺单图层导出/导入到指定层菜单；图像层在内部 JSON/MilX 扩展中可能被嵌入，原站要求旁车 config.json；KML 样式/icon href、GPX 非标准颜色和超大文件限制未完全提示。 | 在图层行提供导出/导入菜单；MilX 导出排除图像/在线层并提示 sidecar；导入报告样式丢失和大小限制。 |
| P2 | **PWA/站点内容差距**：虽有 `launchQueue` 和 Service Worker，但未覆盖 Android/iOS 降级提示、离线后端限制说明、安装教程；示例页/视频/投稿指引缺失。 | 完善文件关联能力检测和手动导入降级；显示“静态资源可离线、MSS 服务需网络”；补 2–3 个真实态势图示例与官方教程链接。 |
| P2 | **快捷键和真北行为差异**：当前 D 放大镜、F11、复制等部分存在；原站还要求方向键平移、Z/X、N、Ctrl/Shift 点编辑模式、Ctrl+S 更新分享。磁北文档说明指南针恢复真北，当前点击箭头直接切换磁北。 | 建立统一快捷键注册表并避开输入框；补齐 3D/点编辑冲突规则；指南针点击只恢复真北，磁偏角作为读数/量测参考。 |

## 本轮迭代验收顺序

1. 先完成 P0 的 3D 图层控制、量测状态机、严格 MilX XML/ZIP、三种 Share 语义；每项补纯函数测试和原站样例回归。
2. 再完成 P1 的选项/单位、标准版本与符号编辑、底图/网格；手动按官方文档逐条冒烟。
3. 最后处理 P2 的导入提示、PWA 降级和站点内容。

每个条目合并前运行 `npm run ci`，并在 PR 描述中附原站 URL、复现步骤、导入导出样例哈希和截图。禁止把 Pro 专属能力写成免费版已支持，也禁止继续把内部 JSON 或 20 位 SIDC 称为原生 MilX。
