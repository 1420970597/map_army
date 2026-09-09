# map.army 原站公开能力研究（2026-09-09）

## 研究范围与方法

本报告用于校准本项目的复刻路线图。研究对象是 `https://www.map.army` 免费托管版及其官方英文文档；不使用第三方评测或二手文章。2026-09-09 通过 `https://www.map.army/doc/en/llms.txt` 取得索引并逐页抓取其中 43 个文档页面的正文、链接和图片；随后使用无头 Chromium 打开首页，对 2D、3D、图层管理、选项、导出和符号库进行了实际操作。公开 MilX 样本也被下载并按 ZIP/XML 结构解析。

文档索引本身的来源为：[官方 llms.txt](https://www.map.army/doc/en/llms.txt)。首页的无 JavaScript 回退说明和产品定位见：[首页](https://www.map.army/)。原站 About 页的产品能力概览见：[About map.army](https://www.map.army/about/en.html)。

本报告中“原站”默认指免费 hosted 版本；只有明确写出 Pro 时才表示项目制商业部署。官方免费/Pro 对照见：[Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/)。

## 可复核的首页与界面行为

### 首页与主窗口

- 首次打开页面显示世界底图和工具栏；无 JavaScript 时回退文本是“map.army — Plan your Mission”，并说明应用支持 NATO Joint Military Symbology、MIL-STD-2525、STANAG APP-6，以及 MGRS、UTM、BNG 和 MilX。[首页](https://www.map.army/)
- 实际 2D 主窗口左侧有图层、活动/选中图层、打印导出和选项按钮；右侧有添加符号、信息和 3D/全屏等控制。无头浏览器在 1440×1000 视口中可见按钮的无障碍标签：`Layers`、`Active/Selected Layer`、`Print map or Export to PDF`、`Options`、`Add new MSS Symbol`、`MSS Symbol Editor`、`View and edit graphic's coordinates`、`Full screen [F11]`、`Message & Info Center`。[Introduction](https://www.map.army/doc/en/first-steps/introduction/)
- 初始 2D 底图实际是全球地形/卫星样式，界面右下有 `3D`、信息、全屏以及撤销/重做。官方图示可直接复核布局：[主窗口截图](https://www.map.army/doc/img/Introduction/MilitaryMap_StartUp-Page_hu_edfcb91070fc74a1.webp)。
- 初次使用流程是：新建或选择活动图层，打开 Symbol Gallery/MSS Symbol Search，选择符号后在地图点击放置，再用 Symbol Editor 调整 affiliation、echelon、status 和文本修饰符。[添加首个符号](https://www.map.army/doc/en/first-steps/add-first-symbol/)

### 3D 视图（免费版实际存在）

- 首页点击 `3D` 后会进入可操作的 WebGL 地球视图；界面切换按钮变为 `2D`，左下显示北向按钮和 3D 导航控制，右下仍有全屏和信息按钮。官方截图：[3D/2D 切换](https://www.map.army/doc/img/3d-Map_View/MilitaryMapGenerator_Switch-3D-2D_Mode_hu_64f13b725d42623a.webp)。
- 文档明确 3D 支持触摸平移、双指缩放、俯仰、旋转；桌面支持鼠标平移、滚轮/右键缩放、`Ctrl`+左键俯仰、`Shift`+左键旋转；导航面板能移动、升降、缩放、俯仰和旋转；`N` 使视图朝北。[3D Map View](https://www.map.army/doc/en/map/3d_map_view/)
- 3D 图层仍可显示/隐藏、缩放到图层和设置透明度，但 3D 是只读；从 3D 返回 2D 会取消活动图层，必须重新激活后才可绘制。[3D Map View](https://www.map.army/doc/en/map/3d_map_view/)
- 官方免费/Pro 表格把“2D and 3D map view”同时列为两档均有的能力。[Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/)

**对本项目的纠正：** `README.md` 和 `docs/PRD-roadmap-gap.md` 把 R26 3D 判定为技术不可行并建议关闭，这与官方免费版行为直接矛盾。Leaflet 现有内核确实不能直接提供原站级 3D，但“关闭 R26”只能作为当前架构的技术决策，不能继续描述成原站没有 3D；若目标仍是 1:1 复刻，应将 Cesium/其他 WebGL 地球内核替换作为高风险专项，而不是把差距从路线图中删除。

### 图层管理

- 一个项目可以有多个 MilX、矢量或图像图层，但任何时刻只有一个活动图层；新符号只能绘制到活动图层。活动图层由铅笔标记。[编辑图层](https://www.map.army/doc/en/layers/edit_layer/)
- 图层管理器提供新建、导入、导出、删除、分享、显示/隐藏、缩放到内容和设置等入口；图层还可在列表内搜索符号。[编辑图层](https://www.map.army/doc/en/layers/edit_layer/)
- 多选支持 `Ctrl`+点击和 `Ctrl`+拖框；把选中符号拖到目标图层可以批量移动或合并图层。[编辑图层](https://www.map.army/doc/en/layers/edit_layer/)
- 图层状态有 Working/Draft 与 Approved；Approved 图层以黑白渲染，不受单个符号 `Colored` 设置影响。[编辑图层](https://www.map.army/doc/en/layers/edit_layer/)
- 原站没有可靠的“项目自动保存并恢复”：MilX 图层只是在当前站点浏览器缓存中尽力保留，图像层需要旁边的 `config.json`，矢量层重新载入，在线图层按 URL 重新抓取；跨会话最可靠的方法是导出 `.milxlyz`。[MilX Layers](https://www.map.army/doc/en/layers/milx-layer/)、[编辑图层](https://www.map.army/doc/en/layers/edit_layer/)、[Project Model](https://www.map.army/doc/en/about/project-model/)

### 符号库和编辑器

- Gallery 的六个区是 `My Favorites`、`Formations`、`Equipment and Installations`、`Tactical Graphics`、`Function-Specific Symbols`、`Metoc`；支持右键收藏。搜索页按标准名称或装备名（例如 “F/A 18”）查找，并可过滤结果。[Symbol Gallery](https://www.map.army/doc/en/symbols/symbol-gallery/)
- 原站公开文档标称基线是 **MIL-STD-2525C**；`Extended` 工作模式增加瑞士国家符号和民防/警察/消防类符号，国际模式对应普通 MIL-STD-2525。[Symbol Gallery](https://www.map.army/doc/en/symbols/symbol-gallery/)、[General Options](https://www.map.army/doc/en/options/general/)
- 实时 Options 菜单的模式标签实际为 `International` 和 `Extended`，不是 README 中假定的 `Standard`/`Extended`。Options 还可开启提示、切换浅色/深色主题、下载/载入设置和打开教程。[General Options](https://www.map.army/doc/en/options/general/)
- Symbol Editor 有 Edit、Preview、About MSS 三个页签；修饰符按标准定义位置、可用性和长度，另有 affiliation、operational condition/status 和文本修饰符。Extended 模式支持最多两个 Icon Extension Modifier。[Symbol Editor](https://www.map.army/doc/en/symbols/symbol-editor/)
- N 点图形按点击逐点绘制，`Space` 完成，`Esc` 放弃；Point Editor 支持插入点、删除点、移动图形和编辑属性。[Point Editor](https://www.map.army/doc/en/symbols/point-editor/)

### 地图、底图和坐标网格

- 免费版官方网格包括 None、WGS84、MGRS、UTM、GARS、BNG（英国）、LV03/LV95（瑞士）和 Hexagonal Grid；实时 Options 还显示 `SLD99 (Sri Lanka)` 与 `Kandawala`，说明原站当前能力已经超过 README 所列范围。[Coordinate Grid](https://www.map.army/doc/en/map/coordinate-grid/)、[Map coordinate settings](https://www.map.army/doc/en/options/map_coord/)
- Hexagonal Grid 可设置六边形边长、标签、颜色、不透明度和线宽；坐标网格设置作用于符号和战术图形的参考点。[Map coordinate settings](https://www.map.army/doc/en/options/map_coord/)
- 实时底图选项远多于 README 所说的“三种无密钥公开底图”：Satellite、Terrain、Hybrid、Roads、Roadmap、OSM、OpenTopoMap、两种 swisstopo、芬兰 NLS、法国 IGN、西班牙 IGN、波兰 PZGiK、英国 OS Maps（Light/Road/Outdoor）和 None。选项还提供亮度、Hue、Chroma。[Map display settings](https://www.map.army/doc/en/options/map_settings/)
- Pacific View 把地图中心从默认大西洋改为太平洋，适合跨 180° 经线的任务；设置持久化到浏览器。[Pacific View](https://www.map.army/doc/en/map/pacific-view/)

### 坐标搜索、测量、磁北和范围环

- Coordinate Search 一次接受一个坐标，支持 WGS84、MGRS、UTM、GARS、BNG，并支持空格、度符号/`deg` 及 m/km/ft/yd/mi 单位。[Coordinate Search](https://www.map.army/doc/en/map-tools/coordinate-search/)
- Measure Tools 默认关闭；开启后可测多段距离、各段/总距离、方位角和多点面积，`Esc`、`Space`、右键或双击结束。距离支持 metric、imperial、nautical，角度支持 degree 与 NATO milliradian。[Measurement](https://www.map.army/doc/en/map-tools/measurement/)
- Terrain Tool 在光标处显示 AMSL 地面高程，来自约 30 m 全球 DEM。[Measurement](https://www.map.army/doc/en/map-tools/measurement/)
- 范围环是 Tactical Graphics 中的 range/threat radius 图形，可拖出半径，再在 Point Editor 中精确设置；可复制成同心环。[Range rings](https://www.map.army/doc/en/map-tools/range-rings/)
- 原站以 WMM2025 计算磁偏角，区分真北、磁北与网格-磁北 GM 角；指南针可恢复真北，3D 中 `N` 也可朝北。[Magnetic Declination](https://www.map.army/doc/en/map-tools/magnetic-declination/)

### 导出、打印和归属

- Print & Export 可选择 PDF/IMAGE、纸张尺寸（A4/A3）、方向、DPI、导出范围、当前/保持底图比例、坐标网格、参考点和输出目录；打印时要关闭自动缩放并使用 100% 才能校验 1:25 000 比例。[Create Export](https://www.map.army/doc/en/export-and-prints/create-export/)、[Print Project](https://www.map.army/doc/en/export-and-prints/print-project/)
- 图像导出可生成 JPG + `.jgw` 或 PNG + `.pgw`。世界文件六行为 A/D/B/E/C/F；原站使用 WGS84 度/像素，E 通常为负。[Create Export](https://www.map.army/doc/en/export-and-prints/create-export/)
- PDF、JPG、PNG 导出右下角自动带 map.army/底图来源版权归属；公开发布时不能裁掉或覆盖。公开发布推荐 OSM/OpenTopoMap，Google 静态图在当前条款下不适合再分发。[Create Export](https://www.map.army/doc/en/export-and-prints/create-export/)

### 数据导入和图像/矢量覆盖

- Load Layer 支持 `.milxlyz`、KML、GPX、JSON、GeoJSON 以及 PNG、SVG、JFIF/JPEG、BMP、WebP 等图像；导入图层追加到现有项目，不覆盖已有图层。[Import Overlays](https://www.map.army/doc/en/layers/import_layer/)
- KML 的 geometry 和部分标准样式可读，但自定义 `href` 图标不保留；GPX/GeoJSON 的非标准颜色扩展通常不保留。矢量层可转成 MilX，但转换时分配的基础符号不能在应用内更换。[Import Overlays](https://www.map.army/doc/en/layers/import_layer/)、[FAQ](https://www.map.army/doc/en/about/faq/)
- 图像覆盖可拖动、缩放、旋转；地理配准使用对应的 world file，位置另存为同目录 `config.json`。图像不会嵌入 `.milxlyz`，PWA 删除图像层还有直接删除磁盘源文件的特殊行为。[Import Overlays](https://www.map.army/doc/en/layers/import_layer/)
- 在线图层可以通过 URL 加载 KML/GeoJSON/PNG/JPG/WebP；分享时只保存 URL，接收方每次打开都重新抓取，因此源站不可用时分享会失效。[Share Online-Source Layers](https://www.map.army/doc/en/data-exchange/share-online-source-layers/)

### 分享、iframe、URL 图层和兵棋

- 新建 MilX Share 默认是空的，必须把图层拖进 `Share MilX Layer` 区域并点击 `Update Current MilX Share` 才会发布；分享有版本号，可固定旧版本或跟踪变更（约 10 分钟通知一次）。[Create a Share](https://www.map.army/doc/en/data-exchange/create-a-share/)
- 三种权限是 `Read Only`、`Edit & Copy`、`Edit & Overwrite`。免费托管分享是公开的、无密码和无账号；链接持有人可按权限打开。[Create a Share](https://www.map.army/doc/en/data-exchange/create-a-share/)、[Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/)
- iframe 可从分享对话框一键生成，也可用 `?layer=<URL>;readonly` 加载外部 `.milxlyz`。外链服务器必须提供 `application/milxlyz` MIME 和允许 `https://www.map.army` 的 CORS。[iFrame](https://www.map.army/doc/en/data-exchange/iframe/)、[Load MilX via URL](https://www.map.army/doc/en/data-exchange/load-milx-layer-using-url-parameter/)
- 兵棋没有真正的按层隔离权限；官方建议蓝方、红方、裁判分别维护三个 Share，红蓝 Read Only，裁判 Edit & Overwrite，人工按回合更新。[Wargaming](https://www.map.army/doc/en/data-exchange/wargaming/)

### NVG、路线和 PWA

- 免费 hosted 版能导入 NATO Vector Graphics 2.0.0 和 2.0.2，但不能内置导出 NVG；推荐导出 MilX 后由下游转换。[NVG](https://www.map.army/doc/en/data-exchange/nvg/)
- 官方路线流程是 Google My Maps 导出 KML → 作为 vector layer 导入 → 转换成 MilX → 增加检查点/释放点/相位线/单位/范围环。[Route Planning](https://www.map.army/doc/en/tips-and-tricks/route-planning/)
- PWA 可安装到 Windows、macOS、Linux、Android、iOS/Chrome OS；桌面注册 `.milxlyz`/`.milxly` 文件关联，移动端需通过应用内导入。缓存后可离线访问静态资源，但 FAQ 对完整 Web 应用的结论仍是“不能离线运行”，因为 MSS/MilX 后端需要网络。[Install PWA](https://www.map.army/doc/en/progressive-web-application/install/)、[File Association](https://www.map.army/doc/en/progressive-web-application/file-assotiation-milx/)、[FAQ](https://www.map.army/doc/en/about/faq/)
- 支持最低系统/浏览器：Windows 11、macOS 10.15、64 位 Linux、Android 8、iOS/iPadOS 15；Chrome/Edge/Firefox 126、Brave 1.68、Safari 17。[Compatibility](https://www.map.army/doc/en/about/compatibility/)

## 原生 MilX 格式的实测结构

官方说明称 MilX 是 XML 交换格式，`.milxly` 为明文 XML，`.milxlyz` 为 ZIP 压缩形式；两者承载同一图层内容，图像和在线矢量不嵌入，默认坐标系是 WGS84，可在 Advanced Settings 转旧版本。[MilX File Format](https://www.map.army/doc/en/about/milx-format/)

为避免只依赖叙述，实测下载了官方公开样本：[Layer.milxlyz](https://www.gs-soft.com/CMS/files/Layer.milxlyz)（HTTP `application/milxlyz`，ZIP 内 `Layer.milxly`）和 [Demo-Layers.milxlyz](https://www.gs-soft.com/CMS/files/Demo-Layers.milxlyz)。样本的可复核事实如下：

```xml
<MilXDocument_Layer xmlns="http://gs-soft.com/MilX/V3.1">
  <MssLibraryVersionTag>2019.10.01</MssLibraryVersionTag>
  <MilXLayer>
    <Name>Layer</Name>
    <LayerType>Normal</LayerType>
    <GraphicList>
      <MilXGraphic>
        <MssStringXML>&lt;Symbol ID="SFG-UCI----J---"&gt;...&lt;/Symbol&gt;</MssStringXML>
        <PointList><Point><X>6.90952832812929</X><Y>52.587778349262</Y></Point></PointList>
      </MilXGraphic>
    </GraphicList>
    <CoordSystemType>WGS84</CoordSystemType>
    <ViewScale>...</ViewScale>
    <SymbolSize>11</SymbolSize>
  </MilXLayer>
</MilXDocument_Layer>
```

- 两个样本中的所有 SIDC 都是 15 个字符；嵌套的 `MssStringXML` 是 XML 转义的 MSS 符号描述，属性形如 `<Attribute ID="G">1st Corp</Attribute>`。
- `X`/`Y` 在 WGS84 层分别表现为经度/纬度；`Demo-Layers` 还含 `SwissLv03` 图层，坐标为瑞士平面米值（例如 `656137.0005`, `230440.0102`），因此解析器不能把所有 X/Y 一律当经纬度。
- 多层样本包含 `RefDateTime`、`Legend`、`DisplayBW`、演习/任务元数据等字段，不能只保存符号点和名称。
- 文档规定 SIDC 长度不正确的要素会在导入时被拒绝。[MilX File Format](https://www.map.army/doc/en/about/milx-format/)

**对本项目的纠正：** 当前 `src/core/io/milxly.ts` 把 `.milxly` 定义为 JSON、`.milxlyz` 定义为 gzip(JSON)，与官方格式不兼容；`README`/PRD 的 R54 也把目标写成 `.milx`，而官方免费应用实际使用的是 `.milxly` 与 `.milxlyz`。若目标是互操作，必须实现上述 XML 命名空间、ZIP 容器、`MssStringXML`、坐标系和 15 位 SIDC，不能把自有 JSON 继续称为原生 MilX。

## 免费版与 Pro 边界

免费版有：MIL-STD-2525 MSS 符号、2D/3D、MilX 图层创建/编辑/导入/导出、全部公开坐标网格、坐标搜索与测量、PDF/图像导出归属、三种分享、iframe、浏览器自身定位。[Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/)

Pro 额外是时间轴/单位动画、BFT、外部 GPS/SIM 追踪器、用户管理和登录、自定义 WMTS/WMS、口令保护分享、封闭网络/本地部署；这是项目制交付，不是公开自助注册。[Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/)、[FAQ](https://www.map.army/doc/en/about/faq/)

FAQ 还说明：免费版没有账号和用户级服务端持久化；自己的浏览器位置可以通过 Geolocation API 显示，但不会共享给其他参与者；MSS/MilX 服务通过 REST/SOAP 后端提供，公开运行时请求可见 `https://www.symbol.army/MSS-2028-01/MssWebAPI/v8.0/`、`MilxWebAPI/v8.0/` 和 `MilxShareWebAPI/v8.0/`。[FAQ](https://www.map.army/doc/en/about/faq/)

## README 与 PRD 的差距/错误核对

| 现有文档表述 | 官方证据 | 修正与复刻优先级 |
| --- | --- | --- |
| R26 将 3D 判为技术不可行并关闭 | 免费/Pro 均列 2D+3D；有完整 3D 导航文档 | **错误且 P0/P1 级差距**；至少保留 WebGL 3D 专项，不能宣称原站没有或不可做 |
| 原站底图“多家”，本项目只需 3 种无密钥底图 | 实时 Options 有 Google、OSM、OpenTopoMap、swisstopo、NLS、IGN、PZGiK、OS Maps 共 19 项 | README 低估了可见功能；按许可实现 OSM/OpenTopoMap/可选公开源，Pro 的私有 WMTS/WMS 仍排除 |
| 原站 UI 仅 en/de/fr/it；本项目应用仅中文 | 实时 Options 有 English、German、French、Italian、Polish、Portuguese、Spanish、Japanese、Korean、Dutch、Thai | **错误**；至少 zh/en 之外应记录原站 11 语言，语言设置属于 P1 |
| 原站只有 MGRS/UTM/WGS84/GARS/BNG/LV95/LV03/Hex | 实时还列 SLD99、Kandawala | 网格枚举应扩展或明确暂不支持的来源与优先级 |
| 原站免费版无 3D、磁偏角、坐标搜索、范围环、定位 | 各自官方页面都描述免费流程；Free vs Pro 将坐标搜索/测量/定位列在两档均有 | **错误**；这些是免费版核心地图工具，应上调到 P0/P1 |
| R54 目标是 `.milx` 原生 XML | 官方扩展名是 `.milxly` XML 与 `.milxlyz` ZIP；公开样本可验证 | **错误**；按 V3.1 XML 和 ZIP 实现，并保留 `.milxly` 扩展名 |
| 原站基线 MIL-STD-2525C，本项目 2525D 是“版本更新” | 官方 Gallery 明确 2525C baseline；实时模式叫 International/Extended | README 的版本判断方向正确，但项目不能以 2525D 自称完整兼容原站；应显示版本差异并补齐 2525C/Extended |
| 原站导入只需 MilX/矢量/图像，KML/NVG 等可后做 | 免费版支持 KML/GPX/JSON/GeoJSON、图像格式；NVG 2.0.0/2.0.2 可导入 | KML/图像/NVG 是公开免费功能，不属于可忽略的 Pro 能力 |
| 原站分享只读/编辑副本/覆盖与在线层差距按纯前端降级 | 官方三种 share 都存在，服务端保存、版本号、Track Changes，在线 URL 层也存在 | 在无后端约束下可以降级，但应明确这是复刻限制；功能说明不可写成原站不支持 |
| 原站无自动保存，本项目 localStorage “优于原站” | 官方称 MilX 图层尽力保存在浏览器缓存，但无可靠 save/resume；跨设备仍需导出 | 本项目 localStorage 的可靠性可作为增强，但应同时实现官方导出/导入行为和损坏/版本兼容 |
| README 示例页只是符号陈列 | 官方 examples 页是用户提交的真实态势图/月度精选征集，About 页嵌入 6 个视频教程 | 站点内容差距真实存在；需要示例态势图、视频/外链和投稿指引，而非只展示符号 |

## 建议的复刻顺序

1. **先修数据互操作（P0）**：以公开 `.milxlyz` 样本建立 XML/ZIP 解析和序列化测试，覆盖 15 位 SIDC、`MssStringXML`、WGS84/SwissLv03 坐标系、图层元数据、旧版本容错；保留当前 JSON 作为项目私有迁移格式，不再称原生 MilX。
2. **补齐免费核心工具（P0/P1）**：坐标搜索、完整网格枚举、范围环、测量/方位角、WMM2025、浏览器自身定位、PDF/PNG/JPG+world file 和右下归属标签。
3. **补齐图层和符号库行为（P1）**：六大分区、收藏、搜索结果过滤、Extended/International 模式、图层 Approved 黑白、图像与 vector layer 生命周期。
4. **把 3D 作为明确专项（P1，高风险）**：选用 WebGL 地球/地形内核，支持只读图层显示、透明度、北向、平移/缩放/俯仰/旋转；不能继续以 Leaflet“技术不可行”结束需求。
5. **最后处理服务端替代能力**：纯前端分享/iframe/URL 载荷可以提供演示级降级；真实版本、Track Changes、在线 URL 层、Edit & Overwrite 需要后端，必须在产品界面和文档中明确限制。

## 43 个官方英文文档逐页来源

以下列表与 `llms.txt` 完全对应，正文均已抓取并纳入上文分类核对：

- [Introduction](https://www.map.army/doc/en/first-steps/introduction/)
- [Add first symbol](https://www.map.army/doc/en/first-steps/add-first-symbol/)
- [Plan an exercise](https://www.map.army/doc/en/first-steps/plan-an-exercise/)
- [MilX layer](https://www.map.army/doc/en/layers/milx-layer/)
- [Edit layer](https://www.map.army/doc/en/layers/edit_layer/)
- [Export layer](https://www.map.army/doc/en/layers/export_layer/)
- [Import layer](https://www.map.army/doc/en/layers/import_layer/)
- [Symbol gallery](https://www.map.army/doc/en/symbols/symbol-gallery/)
- [Symbol editor](https://www.map.army/doc/en/symbols/symbol-editor/)
- [Point editor](https://www.map.army/doc/en/symbols/point-editor/)
- [Coordinate grid](https://www.map.army/doc/en/map/coordinate-grid/)
- [3D map view](https://www.map.army/doc/en/map/3d_map_view/)
- [Pacific view](https://www.map.army/doc/en/map/pacific-view/)
- [Coordinate search](https://www.map.army/doc/en/map-tools/coordinate-search/)
- [Measurement](https://www.map.army/doc/en/map-tools/measurement/)
- [Range rings](https://www.map.army/doc/en/map-tools/range-rings/)
- [Magnetic declination](https://www.map.army/doc/en/map-tools/magnetic-declination/)
- [General options](https://www.map.army/doc/en/options/general/)
- [Map settings](https://www.map.army/doc/en/options/map_settings/)
- [Map tools options](https://www.map.army/doc/en/options/map_tools/)
- [Map coordinate settings](https://www.map.army/doc/en/options/map_coord/)
- [Symbol format](https://www.map.army/doc/en/options/symbol-format/)
- [Print project](https://www.map.army/doc/en/export-and-prints/print-project/)
- [Create export](https://www.map.army/doc/en/export-and-prints/create-export/)
- [Create a share](https://www.map.army/doc/en/data-exchange/create-a-share/)
- [iframe](https://www.map.army/doc/en/data-exchange/iframe/)
- [Load MilX by URL](https://www.map.army/doc/en/data-exchange/load-milx-layer-using-url-parameter/)
- [Wargaming](https://www.map.army/doc/en/data-exchange/wargaming/)
- [Online source layers](https://www.map.army/doc/en/data-exchange/share-online-source-layers/)
- [NVG](https://www.map.army/doc/en/data-exchange/nvg/)
- [Route planning](https://www.map.army/doc/en/tips-and-tricks/route-planning/)
- [Install PWA](https://www.map.army/doc/en/progressive-web-application/install/)
- [MilX file association](https://www.map.army/doc/en/progressive-web-application/file-assotiation-milx/)
- [Uninstall PWA](https://www.map.army/doc/en/progressive-web-application/uninstall/)
- [FAQ](https://www.map.army/doc/en/about/faq/)
- [Compatibility](https://www.map.army/doc/en/about/compatibility/)
- [Performance](https://www.map.army/doc/en/about/performance/)
- [Update](https://www.map.army/doc/en/about/update/)
- [MilX format](https://www.map.army/doc/en/about/milx-format/)
- [Free vs Pro](https://www.map.army/doc/en/about/pro-vs-free/)
- [Project model](https://www.map.army/doc/en/about/project-model/)
- [Keyboard shortcuts](https://www.map.army/doc/en/about/keyboard-shortcuts/)
- [Glossary](https://www.map.army/doc/en/about/glossary/)

