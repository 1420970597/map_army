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

## 下一轮 ToDo（Iteration 2026-09-D）

- [ ] 符号编辑器增加 Edit/Preview/About MSS 三个视图，原生 15 位 SIDC 显示保留提示且不退化为默认 20 位。
- [ ] 完善 2525C 基线标识、Extended 两个 Icon Extension Modifier 的校验与预览，补充导出回归测试。

## 后续 ToDo（本轮不伪装完成）

- [ ] 符号 Editor 的 Preview/About 页、完整 2525C 修饰符位置表、Icon Extension 图标语义与 Extended 瑞士符号。
- [ ] 六边形网格的边长/颜色/线宽/标签配置与网格交点吸附的完整设置界面。
- [ ] 3D 地形 DEM、导航面板、相机姿态持久化和性能基线（2000 要素拖拽 ≥30fps）。
- [ ] 兵棋演示模式：红/蓝/裁判图层组、视角预设、非安全隔离提示。
- [ ] 示例画廊改为真实态势图 iframe、视频教程、月度精选和投稿指引。
- [ ] 浏览器矩阵回归：Chromium、Firefox、Safari；移动端触摸绘制、PWA 文件关联与离线恢复。

## 验收证据

- 官方索引：`https://www.map.army/doc/en/llms.txt`
- 坐标搜索：`https://www.map.army/doc/en/map-tools/coordinate-search/`
- 测量：`https://www.map.army/doc/en/map-tools/measurement/`
- 图层管理：`https://www.map.army/doc/en/layers/edit_layer/`
- 符号编辑：`https://www.map.army/doc/en/symbols/symbol-editor/`
- 导出：`https://www.map.army/doc/en/export-and-prints/create-export/`
- 分享：`https://www.map.army/doc/en/data-exchange/create-a-share/`
- 3D：`https://www.map.army/doc/en/map/3d_map_view/`
