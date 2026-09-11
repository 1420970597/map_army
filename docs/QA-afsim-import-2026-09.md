# AFSIM 文件夹导入验收（2026-09-10）

用户范围：解压 `/root/afsim/demos.zip` 至 `/root/afsim/demo`，依据示例与源码研究想定格式，在隔离功能分支实现目录导入并绘制单位军标。研究依据见 [AFSIM 格式研究](RESEARCH-afsim-import-2026-09.md)。

## 本轮交付契约

- [x] 解压完成，共 5550 个文件；示例数据保留在 AFSIM 目录，不提交产品仓库。
- [x] 功能分支 `feature-afsim-import` 使用 `/root/map_army-afsim` 独立工作树，起点 `53f8873`；原 `/root/map_army` 工作区保留给协作者。
- [x] 目录索引保留相对路径，按所选 `.txt/.afproj/.afsim/.wsf` 入口懒读取依赖，普通 include 与 include_once 区分；支持文件目录、file_path、工作目录顺序和路径变量，拒绝越出目录及递归耗尽。
- [x] 区分平台类型/实例、前向继承与平台编辑；继承阵营和 mover，解析经纬度/MGRS、route/use_route/start_at 初始位置；隔离组件、脚本与注释。
- [x] 按阵营分层；side blue/friendly→友军，red/hostile→敌军，neutral→中立，其余→未知。运动域优先于图标启发式；保留原始类型、名称与来源定位。
- [x] 解析预览后显式绘制，显示跳过原因并可下载诊断；零单位不写入。复用四种导入模式与只读/锁定保护，整批导入一次撤销，取消和 Esc 不写入文档。
- [x] 真实示例、格式单测、项目备份 JSON 往返、撤销、浏览器绘制与刷新恢复均有可复现验证。

## 实例证据

运行 `node scripts/verify-afsim-demo.mjs /root/afsim/demo`。脚本只读本地资料，自动断言数量、身份和坐标。

| 入口 | 导入单位 | 读取源文件 | 跳过 | 验证 |
| --- | ---: | ---: | ---: | --- |
| `0_sensor/main.txt` | 6 | 20 | 0 | 红/蓝各 3；f35c-2 位于纬度 24.88821111、经度 135.01069167 的路线首点 |
| `0_sensor/sensor_demo.afproj` | 6 | 20 | 0 | 与 main 一致；项目重复主源去重会显式报告 |
| `simple_scenario/simple_scenario.txt` | 1 | 10 | 0 | SimpleStriker 位于纬度 1.05、经度 1.05 |

测试文件 `src/core/io/afsim.test.ts` 使用人工编写的独立格式片段；`e2e/fixtures/afsim` 同样不复制 AFSIM 分发内容。`npx playwright test e2e/afsim-import.spec.ts` 覆盖目录输入、入口选择、解析前无单位、SVG 军标、整批撤销/重做、会话恢复按钮和取消。

## 已明确的兼容范围

这是静态部署导入器，不是 AFSIM 解释器。脚本、轨道/六自由度初始化、随机生成和路径规划不执行；没有静态位置的单位会跳过。延迟创建平台显示声明位置并报告。仿真过程中航向/地形高度变化不还原，路径不导入为折线。

支持 route 的经纬度、MGRS、命名引用、标签起点和相对转向首点回退；插入/变换/offset 路线会报告并跳过受影响单位。宏预处理尚不支持，会中止而非静默忽略。浏览器要求 UTF-8 文本；没有进程环境变量，未定义路径变量不替换为空以免命中错误文件。目录最多 10000 个文件、依赖文本 32 MiB、展开 500000 个词元、include 64 层、10000 个平台。

AFSIM icon 与标准 SIDC 无一一对应证明。默认按运动域生成通用符号，明确的 fighter/bomber/rotary/UAV/carrier/destroyer/frigate 分类使用对应符号。用户可在导入后编辑军标。裸带符号十进制坐标属于导入器兼容扩展。多个项目主源中已经被前序入口加载的文件只解析一次并报告，这不是仿真器重复定义行为的无损复现。

## 原站复核与下一轮

2026-09-10 读取官方索引 `https://www.map.army/doc/en/llms.txt` 和导入页 `https://www.map.army/doc/en/layers/import_layer/`：免费站公开导入列表没有 AFSIM；当前实现属于用户明确要求的项目扩展，不列为原站已有功能或 Pro 仿真能力。原站导入追加语义仍由 `applyImportedDocument` 保持。

抓取 SHA-256：索引 `65fc0c3715015b59109cefdc6acf7c404484391e18eb6d7f2f751cb36cc3aa4b`；导入页 `f6166f3d2de91a6401d15ea8503403c99ea2d2b0f6827d54a4ca0d80de8f8659`。

下一轮兼容扩展（不包装成本轮完成）：宏预处理、非 UTF-8 编码、路线变换/插入、脚本/轨道运行时位置、Firefox/Safari 目录选择与移动端矩阵。原站其余差距继续以 [差异 ToDo](TODO-original-site-audit-2026-09.md) 为准。

## 质量验收

- `npm run ci`：66 个测试文件、999 个 Vitest 用例及 3 个服务端用例通过，生产构建成功。
- `npx playwright test e2e/afsim-import.spec.ts`：2 个 Chromium 用例通过；刷新后沿用既有的“恢复”按钮。
- Standards/Spec 独立评审发现的未闭合组件、关键字参数、转向首航点与分类清空问题均已修复并补充回归。
- 因原工作区的另一开发者正在使用 8080，Compose 使用独立项目 `map_army_afsim` 和 8081，保留原服务及数据卷。复现命令：`docker compose -p map_army_afsim -f docker-compose.yml -f /tmp/map-army-afsim-compose.yml up --build -d`，临时覆盖文件仅将前端端口替换为 `8081:80`。
- 首页 HTTP 200；`http://localhost:8081/api/health` 返回 `{"status":"ok"}`；前端与 shares 容器均 healthy。

CI/Compose 的最终状态及 PR 链接在 PR 描述记录；本记录不将未合并分支称为已合并主线。
