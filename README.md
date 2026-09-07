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

## 开发规范

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

> 以下测试数量为 `vitest run` 的**实际执行结果**（共 **200** 个，9 个测试文件全部通过）。
> 注意：不要用 `grep -c "it("` 静态计数——`it.each(...)` 在运行时会展开为 N 个测试，
> 静态计数会严重低估（本仓库实测少计 41 个）。

- [x] 测绘核心：Krüger 级数横轴墨卡托投影、UTM 正反算、MGRS 编解码、BNG 正反算、军网生成
      （**70** 个单元测试：transverse-mercator 7 · utm 10 · mgrs 34 · bng 9 · grid 10，
      与第三方实现逐点交叉验证，往返误差达纳米级）
- [x] 军标符号引擎：20 位 SIDC 解析与校验、七大框架族、**41** 个符号定义
      （地面单位 24 · 空中 9 · 海面 6 · 水下 2）、梯队 / 司令部 / 状态 / 机动方向修饰符、
      昼间与夜间配色（**82** 个单元测试：sidc 27 · frames 55）
- [x] 数据模型与球面几何：Haversine 距离、方位角、球面过剩面积（30 个单元测试）
- [x] 地图引擎与界面：3 种底图（OSM / OpenTopoMap / Esri 卫星）、MGRS/UTM/BNG 军网叠加
      及标注开关、要素图层、绘制交互（点符号 / 折线 / 多边形 / 量距）、
      符号面板、图层管理、属性检查器、坐标状态栏（经纬度 + MGRS + UTM）
- [~] 导入导出与持久化：自有格式的 `.milxly` 序列化与反序列化、`.milxlyz`（gzip）压缩读写、
  GeoJSON 往返、PNG 图片导出、localStorage 自动保存（18 个单元测试）。
  **注意：自有的 `.milxly` 与原站的 MilX 并非同一种格式，互不支持**——详见下方注记
- [x] 撤销 / 重做：快照栈实现，最大深度 100 步（`src/stores/useDocumentStore.ts:15`）
- [x] 静态站点与 PWA：五语言关于 / 示例 / 文档页（内容文件 + 生成器产出）、
      Service Worker 三层缓存（shell / pages / tiles）与预缓存、Web App Manifest
      （含 `file_handlers` 与 `shortcuts`）、llms.txt、sitemap 与 hreflang

### 实现深度注记（避免高估）

- **符号覆盖面窄**：`SymbolSet` 枚举定义了 **19** 个符号集，但只有 **4 个**真正配有图标
  —— 地面单位 24、空中 9、海面 6、水下 2（合计 **41**）。
  控制措施（战术图形）、地面装备、地面设施、徒步单兵、水雷战、活动/事件、
  大气（气象）、海洋（水文）、信号情报、网络空间、太空等**全部为空**，渲染时回退到通用图标。
  （历史 README 声明的"47 个 / 14 个符号集"与代码不符，已按 `icons.ts` 实测校正。）
- **量测只有总长**：`Measure` 工具仅实时显示路径总长，**没有面积量测、分段距离与方位角**
  （`core/model/geometry.ts` 中的面积与方位角函数已实现且已测试，但无对应交互入口）。
- **状态栏无 BNG / GARS / LV95**：仅显示经纬度、MGRS、UTM 三种，且经纬度固定为十进制度。
- **快捷键共 7 个**：`Ctrl+Z` 撤销、`Ctrl+Shift+Z` / `Ctrl+Y` 重做、`Delete`/`Backspace` 删除、
  `Escape` 取消、`Enter` 结束绘制（见 `src/App.tsx:40-76` 与 `src/features/draw/DrawHandler.tsx:104-119`）。
  历史 README 称"Ctrl+Z / Ctrl+Y 未注册全局监听"**已不成立**，该监听已实现。
- **PDF 导出未接线**：`jspdf` 已在 `package.json` 中声明，但 `src/` 与 `site/` 中**零引用**。
- **图层模型有 `opacity` 字段，UI 未暴露**：`Layer` 接口定义了不透明度，
  但图层面板只提供可见性、锁定、删除，**无透明度滑块**。
- **图层重命名与排序未实现**：`LayerPanel` 中图层名是不可编辑的 `<span>`，
  `order` 字段仅在新建图层时自增（`useDocumentStore.ts:135`），**无拖拽排序交互**。
  历史 README 将"重命名、排序"标为已复刻，与代码不符，已校正。
- **导入会整体替换文档**：`ImportExportBar.importFile` 调用 `replaceDocument()`，
  即导入即覆盖当前全部图层与要素；原站行为是**追加图层、保留已有图层**。
- **要素只能单选**：`selectedIds` 虽为数组，但所有 UI 入口均传入单元素数组
  （`select([id])`），无 Ctrl 多选、无框选。
- **`.milxly` 与原站 MilX 不互通（重要）**：原站的 MilX 是 **XML 格式**——
  `.milxly` 为纯 XML 文本，`.milxlyz` 为** zip 容器**内装同一份 XML。
  本项目 `src/core/io/milxly.ts` 用的是 **JSON 文本 + gzip 字节流**（代码注释中说明了
  这是为体积与解析速度做的有意取舍）。因此两者**文件级互不兼容**：
  本项目打不开原站的 `.milxlyz`，原站与其他 MIL-STD-2525 系统（如 KADAS Albireo）
  也读不了本项目导出的文件。
- **SIDC 位数不同**：原站 MilX 按 **15 位**符号标识符校验（对应 2525C 基线），
  本项目 `SIDC_LENGTH = 20`（`src/core/symbology/sidc.ts:26`，对应 2525D）。
  即便补齐 XML 序列化，仍需一层 15/20 位转换才能真正互操作。

## 路线图：与原站的功能差距

**复刻基线**：原站**免费托管版**（free hosted）。原站 Pro 的时间轴 / BFT / 用户管理 /
自定义 WMTS-WMS 底图 / 口令保护分享 / 封闭网络部署均需服务端，不在复刻范围内。

**比对依据**：原站官方文档索引 `https://www.map.army/doc/en/llms.txt`（共 30 个页面），
已逐页抓取并比对其中的 **22 个**：`Introduction`、`Symbol Gallery`、`Symbol Editor`、
`Point Editor`、`Edit Layer`、`Import Layer`、`Export Layer`、`Project Model`、
`Coordinate Grid`、`Measurement`、`Range Rings`、`Coordinate Search`、
`Magnetic Declination`、`3D Map View`、`Options` 五个分节
（General / Map Settings / Map Tools / Map Coord / Symbol Format）、
`Create Export`、`Print Project`、`Create a Share`、`Install PWA`、
`Keyboard Shortcuts`、`Free vs Pro`、`MilX File Format`。
每项格式为「原站行为 → 本项目现状」。

> 尚未抓取的 8 页为操作/部署类（`Add First Symbol`、`Plan an Exercise`、`MilX Layer`、
> `Pacific View`、`Route Planning`、`Iframe`、`NVG`、`Wargaming`、`File Association`、
> `Uninstall`、`FAQ`、`Compatibility`、`Performance`、`Update`、`Glossary` 中的大部分），
> 其中 `NVG`、`Iframe`、`Wargaming`、`Pacific View` 已在下方按文档索引标题列为待复刻项。

图例：`[x]` 已复刻 · `[~]` 部分复刻 · `[ ]` 未复刻

### 一、主窗口与功能入口

原站主窗口是一组固定按钮，本项目目前只有一条顶部工具栏 + 两个可开合侧栏。

- [ ] **Map Overlays 统一入口**（图层、导入导出、分享的聚合对话框）
- [ ] **Print & Export 按钮**（打印 / 导出 PDF 的独立对话框）
- [ ] **Options 按钮与选项窗口**（五个分节：General / Map Settings / Map Tools /
      Map Coord / Symbol Format）
- [ ] **Add Symbol 按钮**（独立的符号库与符号搜索双标签页对话框）
- [ ] **MSS Symbol Editor 按钮**（独立编辑器，含 Edit / Preview / **About MSS** 三个标签页，
      About 页显示 MSS Web Service 与 MSS Library 版本）
- [ ] **View and Edit graphic's coordinate**（查看并直接改写要素参考坐标）
- [ ] **3D / 2D 视图切换按钮**（右下角）
- [ ] **Message and Info Center 消息与信息中心**
- [ ] **Full Screen 全屏按钮**（右下角，等同 F11）
- [ ] **左下角控件区**：坐标搜索框、量距按钮、量面积按钮、光标坐标读数、**比例尺条**
- [ ] **首次启动引导教程（Tutorial）**与"重新打开教程"入口

### 二、图层与项目

- [x] 多图层容器，其中之一为活动图层（仅活动图层可绘制）
- [x] 图层创建、删除、可见性、锁定
- [~] 会话持久化 —— 原站无服务端存储，MilX 图层仅存于浏览器缓存、清缓存即丢，
  需手动导出 `.milxlyz`；本项目有 localStorage 自动保存（**优于原站**）
- [~] 图层导入导出 —— 原站支持 MilX、矢量图形、图像叠加；本项目支持
  `.milxly` / `.milxlyz` / GeoJSON，缺 KML、GPX、NVG、图像叠加层
- [ ] **图层重命名**（原站通过齿轮设置对话框改名称与设置）
- [ ] **图层重排序**（原站可调整层序；本项目 `order` 仅新建时自增，无交互）
- [ ] **图层透明度设置**（原站与 3D 视图中均提供）
- [ ] **缩放到图层**（原站 Zoom to Layer 按钮，且表头按钮可对所有图层执行）
- [ ] **表头批量操作**：一键显示全部/隐藏全部、一键缩放到全部图层范围
- [ ] **图层状态 working / approved** —— approved 图层**强制黑白渲染**，
      忽略每个符号自身的 Colored 设置
- [ ] **符号跨图层移动**：Ctrl 多选或 Ctrl 框选后整批拖拽到另一图层（原站也用它来合并图层）
- [ ] **矢量图层转换为 MilX 图层**（转换后即可用战术图形编辑器并导出 `.milxlyz`）
- [ ] **图层内符号过滤搜索**（原站"Filter MSS Symbols …"输入框）
- [ ] **导入时保留已有图层** —— 原站 MilX 导入为追加；本项目为整体替换
- [ ] **图层与地图符号联动选中**（原站对话框中标记符号，地图上会居中并标记，反之亦然）
- [ ] **多图层选择性导出**：原站可勾选要导出的图层；单层时以**图层名**为文件名，
      多层时输出 `LayerCollection.milxlyz`。本项目一律导出整份文档
- [~] **项目（Project）概念** —— 原站的项目即"当前浏览器标签页"，**没有新建/打开项目菜单**；
  本项目同样是单文档，此项行为等价。但原站的**应用设置（语言、单位、默认符号格式）
  会持久化在浏览器存储中**，而本项目没有任何应用设置，故也无设置持久化

### 三、符号库（Symbol Gallery）

- [~] 符号库分组浏览 —— 原站分 **My Favorites / Formations /
  Equipment and Installations / Tactical Graphics / Function-Specific / Metoc** 六大区，
  每区再分子组；本项目仅地面单位、空中、海面、水下四组共 41 个符号
- [~] 符号搜索 —— 原站有独立的 `MSS Symbol Search` 标签页，按军标名或装备名检索；
  本项目为面板内嵌搜索框，中英文检索，搜索时跨全部符号集
- [~] 符号标准版本 —— 原站基线为 **MIL-STD-2525C**（明确不含 2525D/E 与 APP-6D/E 独占符号，
  也不含 APP-6(C) 独有的 CIMIC、Combat Support 等类目）；
  本项目按 **2525D / APP-6(D)** 实现（**版本更新于原站**，但符号总数远少于原站 MSS 服务）
- [ ] **战术图形（Tactical Graphics）**：多点符号 —— 进攻/防御箭头、集结地域、
      分界线、走廊、相位线、射程环 / 威胁半径、炮兵阵地（PAA）、交战区
- [ ] **气象海洋符号（Metoc）**：大气与海洋两类 1 点与多点符号
- [ ] **职能符号（Function-Specific）**：紧急、维和等 1 点与多点符号
- [ ] **装备与设施（Equipment and Installations）独立分组**
- [ ] **收藏夹**：右键加入 My Favorites
- [ ] **工作模式 Standard / Extended** —— Extended 才显示瑞士国家符号、
      **民防符号（警察 / 消防救援 / 民事应急，依瑞士警务符号标准）**与额外修饰符；
      且切换工作模式前原站会提示先导出备份
- [ ] **图标扩展修饰符**（Extended 模式，每个符号最多挂两个指示图标，可写入 MilX）
- [ ] **Show Hints in Symbol Gallery**：选中符号时显示详细说明

### 四、符号编辑与几何编辑

- [ ] **独立符号编辑器对话框**（Symbol Editor）—— 原站为集中编辑的模态对话框，
      分五个功能组：**Modifiers / Affiliation / Operational Condition /
      Text Modifier / Icon Extension Modifier**，并有 Preview 与 About MSS 标签页；
      本项目仅有侧边属性检查器
- [~] **身份与状态编辑** —— 本项目 Inspector 可改身份（7 种）、上下文、
  状态（5 种）、司令部/特遣队、梯队（**已实现**）
- [~] **文本修饰符** —— 原站按军标定义的位置环绕基础符号排布，并**按
  MIL-STD-2525 / MIP / JC3IEDM 限制字符数**，且每个修饰符带 `i` 信息按钮；
  本项目支持 4 类文本（唯一标识 / 上级编成 / 附加信息 / 参谋注记）与机动方向，
  定位规则简化，**无长度限制、无信息提示**
- [ ] **完整修饰符下拉菜单**（按符号类型动态可用，含位置、可用性、长度定义）
- [ ] **图标扩展修饰符菜单**（Extended 模式）
- [ ] **点编辑器（Point Editor）**：原站选中图形后有四个专用按钮 ——
      **插入点**（开启后每次在地图上点击即插入新点）、**删除点**（开启后点击图形上的点即删除）、
      **完成编辑**（等同 Space 或 Esc）、**删除整个图形**；
      并可数值化输入半径（单位取 Options → General → Distance Unit）
- [ ] **N 点编辑器模式**：Ctrl 按住插入点、Shift 按住删除点、Ctrl+←/→ 切换点
- [ ] **顶点吸附（snapping，快捷键 S）**
- [ ] **顶点方向重置（Shift+Delete）**
- [ ] **复制 / 粘贴（Ctrl+C / Ctrl+V）**
- [ ] **多选**：Ctrl+点击 与 Ctrl+框选
- [ ] **要素拖移**（原站可整体拖动已放置符号）
- [ ] **Show Hints in Symbol Editor**：选中修饰符时显示解释性提示
- [~] **撤销 / 重做范围** —— 原站的 Ctrl+Z / Ctrl+Y **只覆盖删除图形与删除图层**，
  放置、修饰符编辑、图层重命名都不进历史栈；本项目为全量文档快照（**优于原站**）

### 五、底图与视图

- [x] 2D 标图画布
- [~] 底图样式 —— 原站提供 **9 种**：Google Satellite / Terrain / Hybrid / Roads / Roadmap、
  OSM、OpenTopoMap、swisstopo 国家图（仅瑞士）、swisstopo 航拍（仅瑞士）；
  本项目为 3 种无密钥公开底图（OSM / OpenTopoMap / Esri 卫星）
- [ ] **3D 视图**：飞行进入、鼠标与触摸导航、高度升降、航向/俯仰、
      3D 导航面板、罗盘、图层可见性与透明度面板；
      且原站 3D 返回 2D 后**活动图层会被取消激活**
- [ ] **太平洋视图**（投影中心切换）
- [ ] **底图亮度**（-100 ~ +100）、**色相**（0 ~ 360）、**饱和度 / 彩度**（0 ~ 100%）
- [ ] **底图标注语言设置**（注：原站明确底图商未提供全局"隐藏标注"开关，
      OpenTopoMap 是最干净的选择）
- [ ] **Google 底图授权提示**（原站提示 Google 底图不得用于印刷与静态出版，
      出版前须切到 OSM / OpenTopoMap）

### 六、坐标网格与地图工具

- [~] **坐标网格** —— 原站支持 **9 种**：None / WGS84 / MGRS / UTM / GARS /
  BNG（限英国）/ LV95（限瑞士）/ LV03（限瑞士）/ **六边形网格**；
  本项目支持 MGRS / UTM / BNG 三种（`GridType` 定义于 `src/core/geo/types.ts:68`）
- [~] **网格标签** —— 原站在**可视范围四角**显示坐标标签与 **GM 角**；
  本项目在每条网格线上挂 tooltip
- [ ] **网格外观可调**：原站提供 **Grid Color**（用户取色对话框）、
      **Grid Opacity**（0~1，默认 1）、**Grid Line Width**（默认 1 像素），
      同时作用于坐标网格与六边形网格；本项目三者均硬编码
      （`src/features/map/GridOverlay.tsx:22` 固定三种层级配色）
- [ ] **六边形网格参数**：Hex size（平行边间距）与 Hex labels（按行列编号，
      零点在赤道与本初子午线交点）
- [ ] **读取多边形顶点坐标** —— 原站也不能在 UI 内直接查看，
      但其官方支持路径是导出 KML / GeoJSON 后在文本编辑器中读取；
      本项目可导出 GeoJSON，故此项实际可用
- [~] **量测** —— 原站有独立的量距与量面积两个工具，量距显示**分段距离 + 总距离 + 方位角**，
  量面积计算三点以上闭合区域；本项目只有路径总长
- [ ] **量测单位**：原站支持公制 / 英制 / **海里（NM）**，由 Unit of Measurements 下拉设置
- [ ] **坐标搜索**：按 WGS84 / MGRS / UTM / GARS / BNG 跳转定位，
      支持 `m / km / ft / yd / mi` 与 `°`、`deg`、`degree`，一次一个坐标
- [ ] **距离环 / 武器威胁半径**（作为战术图形符号绘制，拖拽定半径，
      可在点编辑器中数值化输入，支持同心环堆叠）
- [ ] **指北针 / 罗盘**（左下角，点击复位为正北）
- [ ] **磁偏角**：**WMM2025** 模型（2025-01-01 ~ 2029-12-31）逐点计算、
      真北 / 磁北基准切换、**GM 角**（= 磁偏角 ± 网格收敛角）在网格显示中呈现
- [ ] **角度单位**：度（360°）与**密位（NATO milliradian，1000 密位/周）**
- [ ] **地理坐标显示格式**：十进制度 / 度分 / 度分秒
- [ ] **Terrain Tool 地形高程**：随光标显示 **AMSL 正高**（基于约 30 m 分辨率全球 DEM，
      非椭球高），按公制/英制显示
- [ ] **放大镜**（按住 D）
- [ ] **自身地理定位**（原站免费版已含"仅自己位置"）
- [ ] **比例尺条**（左下角，随缩放变化）

### 七、选项（Options）

原站选项窗口分五节，本项目**完全没有**选项窗口。

- [ ] **语言切换**：原站支持 **11 种**界面语言 —— 荷兰语、英语、法语、德语、意大利语、
      日语、韩语、波兰语、葡萄牙语、西班牙语、泰语，且同一设置同时作用于界面与军标图标；
      本项目应用界面仅中文（静态站点已五语言）
- [ ] **工作模式** Standard / Extended 与切换前备份提示
- [ ] **Show Hints**（符号库 / 符号编辑器两处）
- [ ] **MilX 图层高级设置**：下载前把图层**转换到另一坐标系**和/或**降级到旧版 MilX**
- [ ] **重置通知 / 消息**（清除已保存的对话框与通知操作）
- [ ] **教程重开**
- [ ] **单位设置**：距离（公制 / 英制）、角度（度 / 密位）、地理坐标格式
- [ ] **地图工具开关**：坐标搜索、量测工具、**显示光标坐标**、**显示比例尺**
- [~] **坐标系设置**（本项目可在 MGRS / UTM / BNG / 关闭 间切换，缺其余 5 种）
- [ ] **符号格式默认值**：线宽（默认 2.5%，按符号尺寸百分比）、日期时间格式
      （yy/yyyy/m/mm/mmm/mmmm/d/dd/ddd/dddd/h/hh/am-pm/a-p/n/nn/s/ss 等）、
      Optimized Colors、Optimized Status Light Modifier Size
- [ ] **1 点符号格式**：符号尺寸、显示阴影、符号填充、可选框架格式、
      修饰符文字大小（默认 33%）、粗体修饰符文字、修饰符文字颜色、线色、**Colored 彩色/黑白**
- [ ] **战术图形格式**：标签间距（默认 15 cm）、修饰符文字颜色、线色、Colored
- [ ] **重置符号格式**

### 八、导出与打印

- [~] **PNG 导出** —— 已实现（`html-to-image` 抓取 `.leaflet-container`，pixelRatio 2），
  但无地理配准、无纸张/方向/DPI 选择、无归属标签
- [ ] **打印与 PDF 导出**：纸张（A4/A3）、方向、**比例尺**；走浏览器打印对话框，
      并需按原站指引设置 **页边距 None**、**勾选 Background graphics**、宽幅地图用横向
- [ ] **打印比例尺校验指引**：浏览器打印对话框的 Page Scaling 必须设为
      **None / 100%**（不可"Fit to printable area"或"Shrink to fit"），
      打印机驱动要关闭 margin auto-shrink（常显示为 Borderless / Auto / Fit to page），
      再用图上比例尺条或量规（如 Pickett roamer）量测已知网格方格核对 **1:25 000**
- [ ] **地理配准栅格导出**：JPG + `.jgw`、PNG + `.pgw` 世界文件
      （六行：X 像素尺寸 / Y 旋转 / X 旋转 / Y 像素尺寸 / 左上角像素中心 X / Y，
      单位为该影像的坐标系，**原站导出为 WGS84 度每像素**）
- [ ] **导出自动附加归属 / 版权标签**（右下角，原站声明为**法律要求项**，不得裁切遮挡）
- [ ] **底图许可指引**（出版前从 Google 底图切换到 OSM / OpenTopoMap）

### 九、数据交换

- [ ] **MilX Share 分享链接**三种形态：Read Only / Edit & Copy（另存新 ID）/ Edit & Overwrite
- [ ] **分享版本管理**：版本号递增、"Include Version in Link"、回退历史版本
- [ ] **Ctrl+S 更新已发布的分享链接**
- [ ] **Track changes**：分享变更后约 10 分钟轮询通知
- [ ] **分享需显式添加图层**（新建分享默认为空，须从图层管理器拖入并保存）
- [ ] **iframe 嵌入代码生成**
- [ ] **URL 参数加载 MilX 图层**
- [ ] **兵棋推演模式**：双方对抗、裁判控制、隐藏信息（Kriegsspiel）
- [ ] **在线源图层分享**（KML / GeoJSON / 在线图片，接收方免上传，每次打开重新拉取 URL）
- [ ] **NVG 导入**（NATO Vector Graphics 2.0.0 / 2.0.2）
- [ ] **KML / KMZ 导出**（Google Earth / ESRI Earth）——原站在图层管理器中选
      "Google Earth Export"，可选 KML 或 KMZ；导出精度受当前地图缩放级别影响，
      且相对 MilX 是有损的（军标被渲染为静态图形而非可编辑元数据）
- [ ] **KML 导入**（原站不保留 `href` 自定义图标，要素退化为通用符号）
- [ ] **GPX 导入**（原站不解析 `topografix:color` 等非标准颜色扩展）
- [ ] **真正的 MilX XML 互操作**：本项目为 JSON + gzip，原站为 XML + zip，互不兼容
- [ ] **导出时降级到旧版 MilX 格式**（原站 MilX-Layer Advanced Settings，
      用于对接 KADAS Albireo 等待定版本系统；导出可写旧版，但导入始终按当前版本读）
- [ ] **导出前转换坐标系**（原站默认 WGS84，可转换为其他坐标系后下载）
- [ ] **图像叠加层导入**：png / svg / jfif / pjpeg / jpeg / jpg / pjp / bmp / webp，
      支持拖拽 / 缩放 / 旋转定位，配 `.pgw` / `.jgw` 地理配准，
      位置写入 `config.json` 伴生文件（须与图片同目录）
- [ ] **在线源图层**（按 URL 每次重新加载）
- [ ] **MilX 原生 XML（`.milx`）互转**

> 注：原站的图像叠加层与矢量图层**不会**被嵌入 `.milxlyz` 导出，
> 也不参与分享与保存；这是原站自身限制，非复刻差距。

### 十、应用与平台

- [~] **键盘快捷键** —— 原站完整集合：
  - 应用：`F11` 全屏、`Ctrl+F5` 强制清缓存重载、`Ctrl+S` 更新分享
  - 编辑：`Ctrl+Z` / `Ctrl+Y`（仅删除图形与删除图层）、`Ctrl+C` / `Ctrl+V`
  - 地图导航：方向键平移、`Shift+↑/↓` 升降高度（3D）、`Ctrl+方向键` 航向/俯仰（3D）、
    `Z`/`+` 放大、`X`/`-` 缩小、`N` 复位朝北、`D`（按住）放大镜
  - 几何编辑器：`Space` 确认、`Escape` 取消、`Delete` 删除路径点、
    `Shift+Delete` 重置点方向、`S` 吸附
  - N 点编辑器：`Ctrl`（按住）插入点、`Shift`（按住）删除点、`Ctrl+←/→` 切换点
  - 图层管理器：`Ctrl+点击` 多选、`Ctrl+框选` 矩形多选
  - 本项目仅 7 个：撤销、重做（含 Ctrl+Shift+Z）、删除、Esc、Enter
- [~] **PWA 安装与 `.milxlyz` 文件关联** —— manifest 已声明 `file_handlers`，
  但**未实现运行时接收**；`sw.js` 已实现 shell / pages / tiles 三层缓存与预缓存
- [ ] **全屏模式**（按钮 + F11）
- [ ] **新版本更新提示**（PWA 更新后提示重载，配合 Ctrl+F5）
- [ ] **大图层性能优化**
- [ ] **桌面 PWA 的 `.milxlyz` 双击打开**（Windows / macOS / Linux / Chrome OS；
      Android 与 iOS 不支持文件关联，走应用内导入）

### 十一、站点与内容

- [x] 五语言（zh/en/de/fr/it）关于 / 示例 / 文档页
- [x] `llms.txt` 与 sitemap、hreflang
- [~] **示例画廊** —— 原站为真实用户态势图（iframe 嵌入 + 视频 + 每月精选）；
  本项目示例页为符号陈列
- [ ] **用户作品提交与展示**
- [ ] **联系表单与社区入口**

## 本项目优于原站的方面

记录这些是为了避免"复刻"被理解成"处处不如原站"：

- **会话持久化**：原站明确声明"没有自动保存与恢复功能，请把打开的会话当作未保存文档"，
  MilX 图层清缓存即丢失；本项目有 localStorage 自动保存与启动恢复。
- **撤销 / 重做范围更大**：原站仅覆盖删除图形与删除图层；本项目为全量文档快照栈（100 步）。
- **符号标准版本更新**：原站基线为 MIL-STD-2525C 且不含 2525D/E、APP-6D/E 独占符号；
  本项目按 2525D / APP-6(D) 实现。
- **地理配准能力更完整**：BNG 正反算已实现并有 9 个单元测试交叉验证；
  原站 BNG 仅限英国范围使用。

## 不在复刻范围（依赖原站服务端或属商业能力）

- Pro 时间轴与单位动画（按计划路线播放）
- Blue Force Tracking（BFT）实时位置共享
- 外部 GPS / SIM 追踪器接入
- 用户管理与登录（多用户、角色权限）
- 自定义 WMTS / WMS 底图（含私有与本地瓦片服务）
- 口令保护的分享链接
- 封闭网络 / 本地化部署
- Military Symbol Service（MSS）托管符号服务 —— 本项目以自绘符号引擎替代
- 用户论坛与社区作品征集

## 许可证

[MIT](./LICENSE)
