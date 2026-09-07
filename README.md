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
- [~] 会话持久化 —— 原站无服务端存储，需手动导出 `.milxlyz`；本项目有
  localStorage 自动保存（**优于原站**）
- [~] 图层导入导出 —— 原站支持 MilX、矢量图形、图像叠加；本项目支持
  `.milxly` / `.milxlyz` / GeoJSON，缺 KML、NVG、图像叠加层
- [ ] 图层状态（working / approved）
- [ ] 符号跨图层移动（多选后整批拖拽到另一图层）
- [ ] 图层透明度设置

### 二、符号库

- [~] 符号库分组浏览 —— 原站分 My Favorites / Formations / Equipment and
  Installations / **Tactical Graphics** / Function-Specific / **Metoc** 六大区；
  本项目仅地面单位、空中、海面、水下四组共 44 个符号
- [~] 符号搜索 —— 原站支持按军标名或装备名（如 "F/A 18"）检索并过滤结果；
  本项目支持中英文检索，无结果过滤
- [~] 符号标准版本 —— 原站基线为 **MIL-STD-2525C**；本项目按 **2525D / APP-6(D)**
  实现（**版本更新于原站**，但符号总数远少于原站 MSS 服务）
- [ ] 战术图形（Tactical Graphics）：多点符号 —— 进攻/防御箭头、集结地域、
      分界线、走廊、相位线
- [ ] 气象海洋符号（Metoc）
- [ ] 职能符号（Function-Specific）：紧急、维和等
- [ ] 装备与设施符号（Equipment and Installations）独立分组
- [ ] 收藏夹（右键加入 My Favorites）
- [ ] 工作模式 Standard / Extended（Extended 才显示瑞士国家符号与额外修饰符）
- [ ] 图标扩展修饰符（Extended 模式，最多挂两个指示图标）
- [ ] 符号格式默认值：线宽、填充色、字号与字体

### 三、符号编辑与几何编辑

- [~] 文本修饰符 —— 原站按军标定义的位置环绕基础符号排布；本项目支持
  4 类文本与机动方向，定位规则简化
- [~] 非文本修饰符 —— 本项目支持梯队、状态、司令部/特遣队、机动方向；
  缺兵力、部队代号、平台代号等完整属性
- [ ] 点编辑器：添加 / 移动 / 删除参考点
- [ ] N 点编辑器模式：Ctrl 插入点、Shift 删除点、Ctrl+←/→ 切换点
- [ ] 顶点吸附（snapping）
- [ ] 顶点方向重置
- [ ] 复制 / 粘贴（Ctrl+C / Ctrl+V）
- [ ] 多选：Ctrl+点击 与 Ctrl+框选

### 四、底图与视图

- [x] 2D 标图画布
- [~] 底图样式 —— 原站提供 OSM / OpenTopoMap / Google / swisstopo 等多家；
  本项目为 3 种无密钥公开底图
- [ ] 3D 视图（含高度升降、航向/俯仰控制、图层可见性与透明度面板）
- [ ] 太平洋视图（投影中心切换）
- [ ] 地形晕渲
- [ ] 底图标注语言设置

### 五、坐标网格与地图工具

- [~] 坐标网格 —— 原站支持 MGRS / UTM / WGS84 / GARS / BNG / **LV95·LV03** /
  **六边形网格**；本项目支持 MGRS / UTM / BNG
- [~] 距离、面积与方位角量测
- [ ] 坐标搜索：按 WGS84 / MGRS / UTM / GARS / BNG 跳转定位
- [ ] 距离环 / 武器威胁半径绘制
- [ ] 指北针
- [ ] 磁偏角：WMM2025 计算、真北 / 磁北切换、GM 角显示
- [ ] 放大镜（按住 D）
- [ ] 自身地理定位

### 六、选项

- [ ] 语言切换（原站 en/de/fr/it；本项目应用界面仅中文，静态站点已五语言）
- [ ] 工作模式与单位约定（米 / 码）
- [ ] 地图工具开关（坐标搜索、指北针、量测）
- [~] 坐标系设置（本项目可在 MGRS / UTM / BNG 间切换）

### 七、导出与打印

- [~] PNG 导出 —— 已实现，但无地理配准与归属标签
- [ ] 打印与 PDF 导出：纸张（A4/A3）、方向、DPI、1:25 000 比例尺校验
- [ ] 地理配准图片：JPG + `.jgw` / PNG + `.pgw`（world file，WGS84 度每像素）
- [ ] 导出自动附加归属 / 版权标签（右下角，原站为法律要求项）

### 八、数据交换

- [ ] 分享链接三种形态：只读 / 编辑副本 / 编辑覆盖
- [ ] iframe 嵌入代码生成
- [ ] URL 参数加载 MilX 图层
- [ ] 兵棋推演模式：双方对抗、裁判控制、隐藏信息
- [ ] 在线图层分享（KML / GeoJSON，接收方免上传）
- [ ] NVG 导入（NATO Vector Graphics 2.0.0 / 2.0.2）
- [ ] KML 导入导出
- [ ] 图像叠加层导入（原站用作自定义符号的变通方案）
- [ ] MilX 原生 XML（`.milx`）互转

### 九、应用与平台

- [~] 键盘快捷键 —— 原站含全屏 F11、强制重载 Ctrl+F5、复制粘贴、方向键平移、
  Z/X 缩放、N 重置朝北、Space 确认、S 吸附等；本项目仅撤销重做、删除、
  Esc 与画布内结束绘制
- [~] PWA 安装与 `.milxlyz` 文件关联 —— manifest 已声明 `file_handlers`，
  未实现运行时接收
- [ ] 全屏模式
- [ ] 新版本更新提示（PWA 更新后提示重载）
- [ ] 大图层性能优化

### 十、站点与内容

- [x] 五语言（zh/en/de/fr/it）关于 / 示例 / 文档页
- [x] `llms.txt` 与 sitemap、hreflang
- [~] 示例画廊 —— 原站为真实用户态势图（iframe 嵌入 + 视频 + 每月精选）；
  本项目示例页为符号陈列
- [ ] 用户作品提交与展示

### 不在复刻范围（依赖原站服务端或属商业能力）

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
