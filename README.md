# map.army — 军事标图 Web 应用（开源复刻版）

[![CI](https://github.com/your-org/map-army/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/map-army/actions/workflows/ci.yml)
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

| 领域 | 选型 | 说明 |
| --- | --- | --- |
| 构建 | Vite 7 | 原生 ESM，冷启动快 |
| 框架 | React 19 + TypeScript 5.8 | 严格模式全开 |
| 状态 | Zustand 5 | 轻量 store，避免 Redux 样板代码 |
| 地图 | Leaflet 1.9 + react-leaflet 5 | 成熟稳定的开源瓦片地图 |
| 测试 | Vitest 3 | 与 Vite 共享配置 |
| 规范 | ESLint 9 (Flat Config) + Prettier 3 | 统一代码风格 |
| 交付 | GitHub Actions | Node 20.x / 22.x 矩阵 |

## 目录结构

```
src/
├─ core/                 # 与 UI 无关的纯逻辑层，可独立测试
│  ├─ geo/               # 测绘核心：投影、UTM、MGRS、BNG、军网生成
│  ├─ symbology/         # MIL-STD-2525 / APP-6 军标符号引擎
│  ├─ milx/              # MilX 交换格式的读写
│  └─ io/                # 导入导出（GeoJSON、KML、图片、PDF）
├─ components/           # 通用 UI 组件
├─ features/             # 按功能域组织的应用模块
│  ├─ map/               # 地图引擎与军网图层
│  ├─ draw/              # 标图绘制与要素编辑
│  └─ layers/            # 图层管理
├─ stores/               # Zustand 状态容器
├─ i18n/                 # 多语言（en / de / fr / it）
├─ pages/                # 静态站点页面（about / example / doc）
└─ styles/               # 全局样式与主题
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（http://localhost:5173）
npm run dev

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
- **分支模型**：`main`（稳定） ← `develop`（集成分支） ← `feature/*`（功能分支）。
  所有功能分支必须通过 Pull Request 合入，禁止直接推送。
- **提交前自检**：`npm run ci`（lint + 格式校验 + 测试 + 构建）必须全绿。

## 已实现

- [x] 测绘核心：Krüger 级数横轴墨卡托投影、UTM 正反算、MGRS 编解码、BNG 正反算、军网生成
      （70 个单元测试，与第三方实现逐点交叉验证，往返误差达纳米级）

## 路线图

- [ ] MIL-STD-2525 / APP-6 军标符号引擎
- [ ] 地图引擎与军网叠加层
- [ ] 标图绘制与要素编辑
- [ ] 图层管理与侧边栏 UI
- [ ] 导入导出与持久化
- [ ] 静态站点页面与 PWA

## 许可证

[MIT](./LICENSE)
