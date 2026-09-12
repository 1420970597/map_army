# Blender 装备详情与挂载验证（2026-09-10）

本轮是用户提出的扩展：验证 Blender 资产到军标详情三维展示、飞机外挂部件的拖放装配。
真实型号全量生产、舰载机/载运关系、编制关系和地图上实体模型另列后续，不以示意飞机代替全量资产交付。
原始评估见 [研究文档](RESEARCH-blender-unit-models-2026-09.md)。

## 本轮范围与判据

- [x] Blender 可运行，保留可复现生成脚本、三份源文件与 GLB、坐标和资产许可。
- [x] GLB 经 Validator 与 Three.js 实际加载校验：挂点、米制尺寸、轴向、锚点、格式与资源预算。
- [x] 单个点要素详情可显式关联示意飞机；不适用的线/面不错误关联装备，未知版本保留并提示。
- [x] 浏览器验证旋转、缩放、按需加载、失败重试；模型和挂载确实可见。
- [x] 拖放至兼容挂点，临时预览、取消、替换、拆卸与点击替代操作可验收。
- [x] 装配写入文档，可撤销/重做，无变化操作不增加历史；锁定和只读入口拒绝编辑。
- [x] JSON、GeoJSON、分享快照、MilX XML/ZIP 私有扩展往返；复制不共享装配数组；KML 丢失提示。
- [x] 浏览器验证刷新恢复、锁定、只读、快速切换和移动端点击替代路径。
- [x] 页面内置模型库：无需本地上传即可选择飞机或独立装甲车辆类别示意模型；模型切换清空不兼容挂载并可撤销，资源检查失败时保留当前模型。
- [x] AFSIM 模型索引与许可接入：解析 325 个模型定义并自动识别类型；嵌入 6 个允许外部分发且带署名的 GLB；98 个受限模型只保留索引，221 个可转换但未获再分发许可的源模型标记为 source-only；没有伪造 AFSIM 未提供的武器硬点。
- [x] 项目 CI、Compose 首页/健康检查与代码评审问题修复。
- [ ] 发布闭环：PR CI、合并主线和合并后原站复核。

## 验收证据

- `npm run models:build`：Blender 4.3.2 后台导出成功。
- `npm run models:check`：三个资产零错误、零警告；报告在 `assets/unit-models/validation.json`。
- `src/core/model/equipment3d.test.ts`：装配规则、非法操作、复制、往返、权限和历史回归。
- `e2e/equipment3d.spec.ts`：真实浏览器与 GLB 的交互验收，截图存入 `test-results/`。
- 2026-09-10：`npx playwright test e2e/equipment3d.spec.ts e2e/pwa-smoke.spec.ts` 全部 11 个用例通过。
  其中三维装配 9 个，包含 Chromium 390×844 触屏仿真、五种语言切换、上下文在加载前后丢失和恢复。
- [桌面装配截图](evidence/blender-2026-09/equipment3d-assembly.png)、[空装配](evidence/blender-2026-09/equipment3d-empty.png)、[移动端截图](evidence/blender-2026-09/equipment3d-mobile.png)。
- 可复现示例：在“文件”导入 [`example.json`](../public/models/demo-v1/example.json)，选择 `DEMO-01` 后打开“三维模型”。
  无模型的点要素可用“关联示意飞机”进入；查看机腹、拖部件到挂点或点击安装；原有撤销行为会清空选择，重新选中要素即可核对。
- 原站合并前页面 SHA-256：三维地图 `1d9937f6d80ee59d043b9c9d66246104e2e5e3bfa4894f22fa463c0697ad1788`；
  符号编辑器 `ae6896236c09746726faceaa4e6297770d6f71306b1874365bb611a52c2ed2c8`。
- `npm run ci`：991 个 Vitest、3 个分享服务测试、lint、format、模型校验及生产构建全部通过。
- `docker compose up --build -d`：前端与分享服务均 healthy；首页 HTTP 200、`/api/health` 返回 `{"status":"ok"}`；
  经 HTTP 下载的 GLB 与仓库资产逐字节一致。评审记录见 [QA 文档](QA-blender-unit-models-2026-09.md)。
- PR #35 已 squash 合并到 `main`；合并后主线 SHA：`b49b271a23574c21e669e290fb52aae899eb928b`。
- 合并后原站复核页面 SHA-256 未变化：三维地图 `1d9937f6d80ee59d043b9c9d66246104e2e5e3bfa4894f22fa463c0697ad1788`；
  符号编辑器 `ae6896236c09746726faceaa4e6297770d6f71306b1874365bb611a52c2ed2c8`。

## 原站复核

2026-09-10 先读取 [官方索引](https://www.map.army/doc/en/llms.txt)，再核对
[三维地图](https://www.map.army/doc/en/map/3d_map_view/) 与
[符号编辑器](https://www.map.army/doc/en/symbols/symbol-editor/)。原站资料的三维地图导航与图层控制
不包含本轮单装备装配；当前实现仍将其标注为项目扩展，不计为原站功能差距补齐。
实现位置：`src/features/inspector/Equipment3DPanel.tsx`、`equipmentPreview.ts`、
`src/core/model/equipment3d.ts`。此扩展无 Pro 账号或其他原站服务依赖。

## 下一轮待办

- [ ] 定义“所有军标”的覆盖清单：真实装备型号/变体、类别示意、编制表示、不适用、尚未映射。
- [ ] 核定视觉质量、尺寸精度、资产来源和许可；试制不同复杂度型号后估算全量生产工时。
- [ ] 扩充真实飞机、车辆、舰船资产与多型号选择，逐项审查 LOD、贴图、可动部件和挂点。
- [ ] 如果“挂载”含舰载机/运输装备/下属单位，单独建立载运或编制关系模型。
- [ ] Firefox、Safari、实际触屏设备和低端 GPU 的性能与操作验证；当前不声称完成全浏览器覆盖。
- [ ] 将实体模型放入 Cesium 地图、资产离线缓存与分发版本迁移，分别建立可验收范围。
