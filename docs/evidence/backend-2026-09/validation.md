# 后端迁移验收证据

代码分支 `feature-python-mysql-s3-backend`，基点 `07aa102`；应用代码最终修复提交 `9c598ba`。所有秘密、浏览器凭证、数据库备份和带请求头的浏览器 trace 均不入库。

| 验收 | 结果与定位 |
| --- | --- |
| Python API / 备份恢复 | `backend/tests/` 23 项真实 MySQL/MinIO 测试通过；含归属与权限、关系投影、并发、版本、挂载、旧迁移、S3 冲突、备份哈希和多格式交换 |
| 前端 / 原格式 | 69 个 Vitest 文件、1,036 项通过；含新增同步 5 项；保留旧 Node 分享 3 项兼容回归 |
| 完整质量门槛 | `npm run ci` 包含 lint、格式、模型结构、前后端回归、类型检查和生产构建；构建保留原有大包提示 |
| 生产 Compose 浏览器 | `E2E_BASE_URL=http://127.0.0.1:8088 npm run test:e2e`，18 项通过；含 PWA 旧 Worker 升级和私有 API 缓存隔离 |
| 模型转换与重启 | `scripts/backend-smoke.py` 从 Nginx HTTP 上传 OBJ，真实独立 Blender worker 输出 GLB；重启 API/worker/MySQL/S3 后原件、模型和项目均可读取 |
| 断网交互 | Chromium 页面断网后修改标题“断网恢复验收”，出现离线状态；联网同步成功后刷新，标题仍在。截图见同目录 `backend-offline.png` |
| 页面模型选择 | 工作空间新建项目，模型库上传 GLB 后列入选择目录；导入飞机示例、打开三维页、拆卸/安装并保存。截图 `backend-model-library.png`、`backend-assembly.png` |
| 初始旧数据保护 | 旧分享卷只读导入；切换前另存旧分享 tar 与 MySQL/S3 tar，权限 0600；未删除旧卷 |
| 原站复核 | `original-site-pre-pr.json` 保存 5 个官方页面的 HTTP 状态、SHA-256 与时间 |

补充限制：模型 GLB 不随 JSON 自动打包，跨部署需同时迁移资产；自包含且无需 Draco/Meshopt/KTX2 解码的 GLB 与 OBJ 几何可导入；完整 AMC 转换仍按专项 ToDo 推进。工作空间是本项目扩展，不冒称原站免费版账户服务。


补充回归：c332f2c 修复锁定图层名称/顺序/状态管理；后续同步修复按标签页隔离未同步草稿并按当前分享版本生成导出/模型资产权限参数。新增 7 项同步测试全部通过。
