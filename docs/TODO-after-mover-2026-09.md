# Mover Creator 后续差异

本文件保留本轮三维几何工作流之外的功能差异，不改变本轮完成判据。

- [ ] 原站免费版差异继续按 `TODO-original-site-audit-2026-09.md`：真实 MSS 目录/2525C 修饰符与 Extended、真实离线 DEM、3D 导航与性能、量测/交换细节、Firefox/Safari/移动端矩阵。
- [ ] AFSIM 动态想定的 route/mover、传感器、武器行为、脚本与运行时状态仍见原 AFSIM 导入/导出专项清单；三维可视挂载不代表仿真武器建模。
- [ ] Mover Creator 的气动求解、飞行性能试验、自动驾驶优化若纳入需求，需要单独设计运行任务、计算结果版本与原生求解器验收；当前只保留原始参数，不提供伪造计算。
- [ ] 几何编辑器后续可增加 Firefox/Safari GPU 与移动浏览器专项矩阵、压缩网格/纹理格式扩展；当前已验证 Chromium 与详情页移动触屏。

PR #41 已于 2026-09-14 合并为 `be2c06b`。合并后重新访问官方索引、3D、符号编辑和分享页面，全部 200，哈希与合并前一致，见 `evidence/mover-creator-2026-09/original-site-post-merge.json`。上述差异继续作为下一轮范围，未因本轮三维建模扩展而标为完成。
