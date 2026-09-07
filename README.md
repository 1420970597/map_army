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

## 路线图

- [ ] 3D 视图（原站基于 Cesium 的地形与三维符号）
- [ ] 更多符号集（控制措施、设施、海上装备全集）
- [ ] KML / MilX 原生格式互转
- [ ] 多人协同编辑

## 许可证

[MIT](./LICENSE)
