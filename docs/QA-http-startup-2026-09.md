# 普通 HTTP 页面启动修复（2026-09-15）

用户报告 `tabStorage.ts:2 Uncaught TypeError: crypto.randomUUID is not a function`，导致浏览器无法打开页面。本轮以主线 `bee9008` 为基线，分支 `fix-http-random-uuid`，修复范围为页面启动、后端同步标识及三维挂点创建的同类调用。

## 复现与原因

在现有 Compose 服务的非 localhost HTTP 地址，用 Chromium 打开首页并读取运行环境：`isSecureContext=false`、`typeof crypto.randomUUID="undefined"`、`typeof crypto.getRandomValues="function"`、`#root.childElementCount=0`。控制台出现完全相同的 TypeError，位置为旧生产包 `index-DmZspqA8.js`。因此可以排除仅由开发环境或构建失败造成的白屏。

`tabStorage.ts` 在模块导入时直接调用仅安全上下文提供的 `randomUUID`；后端同步与 Mover Creator 新建挂点也直接使用它。统一通过 `src/core/randomId.ts` 生成标识：优先原生 UUID，缺失或拒绝调用时使用 `getRandomValues` 生成 UUID v4；随机源完全不可用时以时间、递增计数和随机串生成对象标识。回退不用于工作空间访问凭证，凭证仍由服务端生成。

## 本轮 ToDo 与验收

- [x] 复现用户的空白页与完全相同的 TypeError。
- [x] 替换标签页、同步、三维挂点的全部直接调用，保留原有持久化键与同步标识处理。
- [x] 随机源兼容测试 4 项通过；既有 7 项真实同步订阅测试均在缺少 `randomUUID` 的环境下通过，覆盖多页草稿隔离、保存、断网与刷新恢复。
- [x] 完整 `npm run ci`：1,042 个前端测试、35 个后端测试、lint、格式、模型校验和生产构建通过。
- [x] 重建 `map_army_backend` Compose；5 个服务 healthy，首页 HTTP 200，`/api/health` 返回 MySQL/S3/schema 0002；普通 HTTP 新会话 `#root.childElementCount=1`。
- [x] 18 项 Chromium E2E（含三维挂载、刷新恢复、AFSIM 类型筛选、移动端触屏）通过；普通 HTTP Mover Creator 可新增挂点和安装锚点。
- [x] 规范与需求评审无发现；本地修复提交 `039c705`，待合并后继续复核主线。

## 原站依据与下一轮差异

2026-09-15 已重新读取官方索引与以下页面，均 HTTP 200。普通 HTTP 自托管为本项目部署兼容修复，官方托管站使用 HTTPS，不将这次修复视为原站 Pro 能力。

| 官方来源 | 本地入口与结论 | 后续验收 |
| --- | --- | --- |
| https://www.map.army/doc/en/about/compatibility/ | `src/core/randomId.ts`；官方列 Chrome/Edge/Firefox 126+、Safari 17+，本次消除 HTTP 下的启动崩溃。 | Firefox/Safari 与真实移动 GPU 矩阵仍未专项验证。 |
| https://www.map.army/doc/en/progressive-web-application/install/ | `src/core/backend/serviceWorker.ts`；本次未改变 PWA 安装或文件关联范围。 | 跨浏览器文件关联与离线恢复沿用现有 ToDo。 |
| https://www.map.army/doc/en/about/faq/ | `src/core/backend/sync.ts`；原站完整功能依赖服务，本地自托管同步与草稿恢复继续保留。 | 真实 MSS、DEM 与原生 MilX 语义继续按专项清单验收。 |

下一轮继续以 [TODO-after-mover-2026-09.md](TODO-after-mover-2026-09.md) 和 [TODO-original-site-audit-2026-09.md](TODO-original-site-audit-2026-09.md) 中尚未完成的项目为范围；不扩大本次故障修复。
