# 五轮完整复刻迭代计划（2026-09）

本计划遵循 [项目记忆](PROJECT_MEMORY.md)：每轮只在全部 ToDo 有代码和验收证据后关闭；每轮提交后重新读取原站索引与相关页面，生成下一轮差异清单。

## 五轮边界

| 轮次 | 范围                                                                                                   | 完成判据                                                            | 状态   |
| ---- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------ |
| 1    | 图层管理闭环：定位全部/单层、过滤、单层导出、指定目标层导入、锁定语义、无变化历史                      | 纯逻辑和 store 测试通过；浏览器可操作；Compose/CI 全绿              | 进行中 |
| 2    | 原生 MilX：V3.1 Layer 结构、15 位 SIDC、MSS 属性、坐标系元数据、XML/ZIP 往返                           | 官方样例逐字段往返；不支持字段有提示；导出 ZIP 可被独立解析         | 未开始 |
| 3    | 分享闭环：空 Share、图层加入/移除、Edit & Copy 独立副本、版本固定、冲突提示、在线层元数据、iframe 预览 | 服务端并发/版本测试；三个权限模式浏览器冒烟；离线/在线边界清楚      | 未开始 |
| 4    | 符号与编辑器：2525C 基线标识、Edit/Preview/About、修饰符校验、Icon Extension、Extended 瑞士符号        | 符号目录/编辑器回归；15 位 SIDC 不退化；预览与导出一致              | 未开始 |
| 5    | 地图与平台：六边形网格高级配置、DEM/AMSL 能力边界、PWA 离线恢复、示例画廊与浏览器矩阵                  | Chromium/Firefox 自动化；移动触摸与离线恢复；站点示例可打开并可复现 | 未开始 |

## 迭代记录

### 第 1 轮：图层管理闭环

本轮目标是让图层操作与原站的编辑边界一致：用户能够定位全部或单层内容、过滤当前图层要素、从图层行导出、把导入数据放入指定图层；锁定图层的更新、删除、移动、顶点编辑和草稿预览均不写入文档历史。

验收证据在本轮提交中记录；完成后将本节标记为已关闭，并在同一 PR 后追加原站差异复核。

本轮已关闭（提交 `def539b`）：`npm run ci` 通过（60 个测试文件、966 个测试），
Compose 前端首页和 `/api/health` 均正常，两个容器 healthy。PR 推送后重新读取原站页面：

- `layers/edit_layer`：`cd873ee85bdb22a4b4680ab3b141d3faa880d80e2a449da5ea51392bd7242e55`
- `map-tools/coordinate-search`：`20d3fcca1e9e8d43de4ada00bf4db2b8011ea9a4607911fe02f80b064e5c6639`
- `export-and-prints/create-export`：`021d81dde25ac787572bc921afd9631786c46d4bc58615361c89b745e6dd7bcc`

复核确认图层闭环差异已关闭；下一轮聚焦 MilX V3.1 字段与官方样例往返。

### 第 2 轮：原生 MilX 互操作

本轮将原生 XML 的坐标系、图层可见性、MSS 字段和 15 位 SIDC 作为独立边界处理；内部 20 位 SIDC
只在导出时映射并显示警告，图像/在线层不伪装为已嵌入。非 15 位外部符号计入跳过报告，官方样例结构和 ZIP
容器均进行往返测试。

本轮完成后必须重新读取 `about/milx-format`、`data-exchange/import` 和 `data-exchange/create-a-share`，
再建立第三轮 Share ToDo。

本轮已关闭（提交 `37e583a`）：`npm run ci` 通过（60 个测试文件、968 个测试），原生交换测试覆盖
15 位 SIDC、LV95 坐标、MSS 原文、ZIP 和导出警告。PR 推送后重新读取原站页面：

- `about/milx-format`：`cc74e2459e16042a1faacc5f3368ec1780043525bd54c39c9b824b32c13048a8`
- `data-exchange/import`：`b5b3f9b34b146cd7c1e59ce2a45c7e285c1350d6ea2b554af069ae9cb5a4fe23`
- `data-exchange/create-a-share`：`a7c3dc3b6147974c74987ed5148e9b08826e23603f8660f08d5613f5da5de6a1`
- `data-exchange/load-milx-layer-using-url-parameter`：`d413f266727ad0daaf94298697d02dd41711ace64053e1f55ee8086363cbc55b`

复核确认原生 MilX 差异已关闭；在线图层 URL 元数据与 Share 权限闭环进入第三轮。

### 第 3 轮：Share 协作闭环

本轮完成空分享、图层选择更新、版本固定链接、If-Match 冲突提示、在线图层 URL 说明和 iframe 预览，
并新增服务端独立副本接口。离线快照继续保持纯前端权限边界，编辑副本通过独立 ID 和令牌隔离。

本轮完成后重新核对 Share、iframe、在线图层和版本跟踪页面，再进入符号编辑器轮次。

本轮已关闭（提交 `904a2e6`）：`npm run ci` 通过（60 个测试文件、968 个测试、3 个分享服务测试），
Compose 两个容器 healthy，首页和健康检查正常。PR 推送后重新读取原站页面：

- `data-exchange/create-a-share`：`a7c3dc3b6147974c74987ed5148e9b08826e23603f8660f08d5613f5da5de6a1`
- `data-exchange/iframe`：`935514abb747fee3cfa7c065f871f05dd33044a45445f6b1fab232cea2487319`
- `data-exchange/share-online-source-layers`：`21995c2cefc002af4021bcc8c32ed85368fd1f201c5ad66bdc84575357150bc3`
- `data-exchange/track-changes`：`b5b3f9b34b146cd7c1e59ce2a45c7e285c1350d6ea2b554af069ae9cb5a4fe23`

复核确认 Share 核心差异已关闭；原站符号编辑器的三页签、2525C 与 Extended 修饰符进入第四轮。

### 第 4 轮：符号编辑器与标准兼容

本轮完成 Edit/Preview/About MSS 三个视图；原生 15 位 SIDC 编辑时保留警告和 MSS 原文，修改字段后才重新生成
本地格式；符号库标注 2525C/APP-6(C) 基线与 2525D 数字兼容，Extended 两个扩展图标代码有确定位置和回归测试。

本轮完成后重新核对 Symbol Gallery、Symbol Editor 和 MSS 版本页面，再进入六边形网格与 PWA 轮次。
