# 原站复刻差距审计与迭代 ToDo（2026-09-09）

本清单重新对照 `https://www.map.army/doc/en/llms.txt` 索引中的 43 个官方页面，
并用页面正文、公开示例文件和当前应用代码交叉核对。这里的“原站行为”只指免费托管版；
时间轴、BFT、账号、私有 WMTS/WMS 和口令保护分享属于 Pro 或服务端能力，单独列为边界。

## 审计结论

上一版路线图把“代码中存在入口”误判成“功能已完成”。当前最明显的偏差如下：

1. 坐标搜索把十进制度解释成纬度、经度，而原站示例 `7.45 46.95` 是经度、纬度；
   原站还支持 GARS/MGRS/UTM/BNG 的空格、角度和 m/km/ft/yd/mi 单位。
2. 地图选项缺少亮度、Hue、Chroma、比例尺和按所选网格显示光标坐标；
   底图筛选虽有多个源，但没有对许可、标注语言和无底图状态做完整处理。
3. 原站的测量是临时工具，提供分段距离、总距离、方位角、面积和单位/角度设置；
   当前实现把测量写成普通要素，结果只显示总值，且单位设置未真正作用于结果。
4. 原站切入 3D 后会取消活动图层，3D 只读；当前切换保留活动图层，返回后可能继续误绘。
5. 图层管理缺少“缩放到图层/全部图层”、图层内符号过滤、单图层独立导出和导入到指定图层；
   当前更新图层字段无变化也会产生撤销历史，锁定图层仍可能被部分入口修改。
6. 符号编辑器没有原站的 Edit/Preview/About 三页签，15 位 2525C SIDC 导入后编辑属性会退化为默认 20 位符号，
   Extended 的两个 Icon Extension Modifier 也没有真正按图标语义渲染。
7. 原生 MilX 需要兼容 `MilXDocument_Layer` V3.1、15 位 SIDC、MSS 属性、坐标系和 ZIP；
   当前自有 `maparmy:MapArmyDocument` 扩展可保留内部字段，但普通外部消费者会丢失大量修饰符。
8. 分享服务已经可用，但原站“新建分享默认空、拖拽图层后更新、固定旧版本、跟踪变更”的流程没有完整呈现；
   兵棋模式和在线图层目前只在文档中提到，界面没有演示级分组/裁判视图。
9. PWA 已能接收文件和提示更新，但清单 MIME、离线失败提示、地图瓦片缓存边界、首次加载体验仍需验收。
10. 示例站点仍是符号清单，不是原站的真实态势图、视频教程和月度精选；这属于内容迭代，不应伪装成核心功能完成。

## 已完成迭代（Iteration 2026-09-A）

以下项目本轮全部实现并验收，优先修正会导致用户误操作或数据误读的差异：

- [x] **坐标解析核心一致性**：WGS84 使用经度、纬度顺序，支持带 `N/S/E/W`、`deg/degree`、度分秒以及
      GARS、MGRS、UTM、BNG；已为官方示例补充回归测试。投影坐标单位后缀仍列入后续兼容项。
- [x] **坐标与比例尺状态栏核心能力**：根据当前网格显示光标坐标，增加比例尺和当前网格名称；量测结果支持
      metric/imperial/nautical 与 degree/milliradian。复制坐标按钮列入后续细节。
- [x] **地图显示选项核心能力**：亮度、Hue、Chroma 滑块已持久化并实时作用于底图瓦片，且保留 None 底图；
      标注语言透传和更多底图源列入后续底图兼容项。
- [x] **临时测量工具**：测距/测面积不写入文档历史；显示每段长度、总长度、方位角/面积，Esc、右键、双击结束；
      单位与角度设置实时刷新结果。Terrain/AMSL 高程列入后续地形能力。
- [x] **3D 编辑边界**：进入 3D 时清空活动图层和绘制草稿，3D 图层面板可见性/透明度与 2D 同步；回到 2D 后需重新选择绘制图层。
- [x] **图层管理闭环**：支持缩放到图层/全部可见要素、当前图层名称/SIDC/修饰符过滤、图层行单独导出、
      导入到指定目标图层；所有无变化操作不产生历史，锁定图层的更新/删除/移动/顶点编辑/草稿预览均被 store 拒绝。
- [ ] **原生 MilX 兼容性**：保留标准 15 位 SIDC 和 MSS Attribute；对无法编辑的外部字段显示保留提示；
      增加官方样例结构的导入、导出和 ZIP 回归测试。
- [ ] **分享工作流**：新建分享选择图层、固定版本 URL、编辑覆盖冲突提示、在线图层链接和 iframe 预览信息；
      明确纯前端离线快照与服务端分享的权限差异。

## 已完成迭代（Iteration 2026-09-B）

- [x] 严格读取和生成 MilX V3.1 的 `MilXDocument_Layer`、15 位 SIDC、MSS Attribute、CoordSystemType 与 ZIP；
      对外部字段保留原始 MSS，非 15 位 SIDC 计入跳过报告，并用官方样例结构完成 XML/ZIP 往返测试。
- [x] 明确导出时排除图像/在线图层的原站兼容边界；导出界面显示 SIDC 映射和外部图层字段丢失报告。

## 已完成迭代（Iteration 2026-09-C）

- [x] Share 新建保持空图层，提供图层加入/移除语义；Edit & Copy 通过服务端 `/copy` 创建独立副本标识。
- [x] 固定版本 URL、If-Match 冲突提示、在线图层 URL 元数据和 iframe 预览信息均可验收；明确离线快照
      只在浏览器本地编辑，服务端分享通过令牌和版本控制更新。

## 已完成迭代（Iteration 2026-09-D）

- [x] 符号编辑器增加 Edit/Preview/About MSS 三个视图，原生 15 位 SIDC 显示保留提示且不会静默退化为默认 20 位。
- [x] 符号库界面明确 2525C/APP-6(C) 基线与 2525D 数字兼容；Extended 两个 Icon Extension Modifier
      经过代码校验、预览绘制和回归测试。

## 下一轮 ToDo（Iteration 2026-09-E）

- [x] 六边形网格增加边长、颜色、不透明度、线宽、标签和交点吸附设置，状态持久化并实时刷新。
- [x] PWA 补齐离线失败提示、文件关联降级提示和地图瓦片缓存边界；增加 Chromium 浏览器冒烟验收。

## 第五轮验收证据

- 六边形网格配置已接入选项面板和 `map-army.prefs.v1`，绘制与吸附共用 pointy-top 列行坐标；网格单元边长、颜色、线宽、不透明度和标签均实时生效。
- 离线事件会显示可见提示；Chromium 不提供 `launchQueue` 时提示使用导入按钮；Service Worker 仅缓存图像瓦片并限制单瓦片 2 MiB、总量 500 条，导航失败返回缓存外壳或中文离线响应。
- `npx playwright test e2e/pwa-smoke.spec.ts`：1 个 Chromium 用例通过。
- `npm run ci`：62 个测试文件、975 个 Vitest 测试和 3 个服务端测试通过；生产构建通过。
- Docker Compose：`map_army-map-army-1`、`map_army-shares-1` 均 healthy；首页 HTTP 200，`/api/health` 返回 `{"status":"ok"}`。

第五轮提交后重新读取原站页面并记录 SHA-256：

- `map/coordinate-grid`：`f5fa936269f94d79b7d6a8c61401d0b0ec6ddb98b0a9ed97c431af9bbfb911e1`
- `options/map_coord`：`9b0b10a3fa9b0e37a51d4fa740413cf755dc3aa96a708f83f3f0ca1d9ab5a0c7`
- `progressive-web-application/install`：`1027cf572c8d63e61d5e11f7f4bcf481eadb7430e85d0c48ce85cd550aa304f0`
- `about/faq`：`c265fc09f7d9dc57310c47c4b0170683b806d26bed76f9e2193169be49074c01`
- `first-steps/introduction`：`32170fb8df8fadf66f4a4f50956793687bcda2b116c51a34d1b756e7b18fa92e`

## 后续 ToDo（本轮不伪装完成）

- [ ] 符号 Editor 的 Preview/About 页、完整 2525C 修饰符位置表、Icon Extension 图标语义与 Extended 瑞士符号。
- [ ] 六边形网格的边长/颜色/线宽/标签配置与网格交点吸附的完整设置界面。
- [ ] 3D 导航面板、相机姿态持久化和性能基线（2000 要素拖拽 ≥30fps）；DEM 已在 Iteration 2026-09-F 接入。
- [ ] 兵棋演示模式：红/蓝/裁判图层组、视角预设、非安全隔离提示。
- [ ] 示例画廊改为真实态势图 iframe、视频教程、月度精选和投稿指引。
- [ ] 浏览器矩阵回归：Chromium、Firefox、Safari；移动端触摸绘制、PWA 文件关联与离线恢复。

## 第五轮复核后新 ToDo（Iteration 2026-09-F）

- [ ] 将六边形网格从近似经纬度换算升级为按纬度修正的米制投影，补充原站不同纬度和跨日期变更线的视觉回归。
- [ ] PWA 增加离线恢复后的待同步状态、瓦片按地图源与缩放级别的配额统计，并在 Firefox/Safari 验证文件导入降级。
- [x] 3D 离线地形基线：内置无网络高程 provider，移除失效公开地址；支持通过 Cesium Ion 或 `VITE_CESIUM_TERRAIN_URL` 替换为真实 DEM，影像服务也改为显式配置。
- [x] 增加自定义军标目录：支持 SVG 清理、创建、删除、本地持久化、要素绑定、2D/3D 渲染及 MilX 私有字段保留。
- [x] 增加任意 20 位标准 SIDC 直达搜索，交由 milsymbol MSS 兼容引擎渲染；目录页明确本地目录与 MSS 全量渲染边界。
- [ ] 补齐原站真实符号目录、2525C 修饰符位置表和 Extended 瑞士符号语义映射；当前仍需取得可再分发的标准数据集后逐项录入，不能用通用图标冒充。
- [ ] 将示例画廊替换为态势图 iframe、视频教程、月度精选和投稿指引。

## 验收证据

- 官方索引：`https://www.map.army/doc/en/llms.txt`
- 坐标搜索：`https://www.map.army/doc/en/map-tools/coordinate-search/`
- 测量：`https://www.map.army/doc/en/map-tools/measurement/`
- 图层管理：`https://www.map.army/doc/en/layers/edit_layer/`
- 符号编辑：`https://www.map.army/doc/en/symbols/symbol-editor/`
- 导出：`https://www.map.army/doc/en/export-and-prints/create-export/`
- 分享：`https://www.map.army/doc/en/data-exchange/create-a-share/`
- 3D：`https://www.map.army/doc/en/map/3d_map_view/`
