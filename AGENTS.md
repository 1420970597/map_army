# map.army 代理工作入口

这是一个以 `map.army` 免费托管版为行为基线的长期复刻工程。开始任何开发、审查、重构或发布任务前，必须先阅读 [docs/PROJECT_MEMORY.md](docs/PROJECT_MEMORY.md)；其中记录项目定位、差异审计流程、迭代完成门槛、Git/Compose/PR 约束和当前事实基线。

当任务涉及原站行为、路线图或功能差异时，还必须阅读 [docs/RESEARCH-original-site-2026-09-v2.md](docs/RESEARCH-original-site-2026-09-v2.md)、[docs/RESEARCH-out-of-scope-2026-09.md](docs/RESEARCH-out-of-scope-2026-09.md) 与 [docs/TODO-original-site-audit-2026-09.md](docs/TODO-original-site-audit-2026-09.md)。每次 PR 合并前后都要重新核对原站，生成下一轮差异 ToDo；PR 通过评审、CI 和 Compose 验收后必须合并到 `main` 分支，再核对主线状态；不能把未完成条目包装成已完成，也不能以 MVP 作为交付标准。
