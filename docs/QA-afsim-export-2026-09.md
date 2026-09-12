# AFSIM 想定导出验收记录

验收日期：2026-09-12。实现分支：`feature-afsim-export`。本记录只覆盖本项目新增的静态导出；动态脚本、航路仿真、传感器、武器和三维装配仍由 AFSIM 工程另行配置。

## 格式依据

- AFSIM 2.9 源码 `swdev/src/core/wsf/doc/platform.rst`：平台使用 `side`、`icon`、`marking`、`spatial_domain`、`position <latitude> <longitude>`、`altitude` 和 `heading`。
- AFSIM 2.9 源码 `swdev/src/tools/util/source/UtLatPos.cpp`、`UtLonPos.cpp` 和 `UtAngle.cpp`：坐标使用带半球的十进制度/度分秒，导出采用 `31.25N 121.5E` 形式。
- AFSIM 2.9 源码 `swdev/src/core/wsf/source/WsfPlatform.cpp`：`agl` 与 `msl` 是不同高度基准，导出保留原值和单位。
- AFSIM 随附 `afsim2.9-data/resources/models/models.txt`：使用其中已存在的通用 `fighter`、`infantry`、`tank`、`ship`、`submarine` 和 `satellite` 图标别名；导出不会把通用图标冒充具体装备型号。
- 原站资料：[导出图层](https://www.map.army/doc/en/layers/export_layer/)、[导入图层](https://www.map.army/doc/en/layers/import_layer/)。抓取哈希分别为 `2b0ada1a565a5ab4f4c3b856ef371243f6701650a8e978c1e2da893c965556e2`、`f6166f3d2de91a6401d15ea8503403c99ea2d2b0f6827d54a4ca0d80de8f8659`；索引哈希为 `65fc0c3715015b59109cefdc6acf7c404484391e18eb6d7f2f751cb36cc3aa4b`。

## 输出目录

文件菜单的 `AFSIM 想定 ZIP（标准目录）` 生成以下结构：

```text
main.txt
<project>.afproj
README.txt
platforms/<layer>.txt
```

`main.txt` 只通过 `include_once` 引用同一 ZIP 内的图层文件，并以 `end_time 1 sec` 结束。每个地图点单位生成一个静态 `platform ... WSF_PLATFORM`，保留阵营、作战域、显示名、WGS84 坐标、海拔/离地高度和航向。内部 20 位 SIDC、原生 15 位 SIDC 会以 `aux_data.string map_army_sidc` 保留，导入器识别该字段后可以恢复原 SIDC。

导出包含隐藏和锁定图层，因为这两种状态只控制地图编辑/显示，不应静默丢失单位；文件菜单仍可选择“全部图层”或“活动图层”。图像、在线源、多点图形、折线、面和无效坐标不伪造为平台，都会进入可见诊断和 README 统计。

## 自动化证据

- `npx vitest run src/core/io/afsimExport.test.ts src/core/io/afsim.test.ts`：36 项通过，覆盖目录往返、ZIP、重名、特殊文本、半球坐标、极点、微小坐标、AGL/MSL、15/20 位 SIDC、隐藏/锁定图层、非法输入和大小限制。
- `npm run ci`：68 个测试文件、1017 个 Vitest 测试、3 个服务端测试、模型校验、生产构建均通过。
- 使用 `/root/afsim/demo/0_sensor/main.txt` 作为官方样例入口完成“导入 → 导出 → 再导入”：首次导入 6 个、跳过 0 个；导出 6 个、跳过 0 个；再导入 6 个、跳过 0 个。生成 `main.txt`、`platforms/red.txt`、`platforms/blue.txt`、`.afproj` 和 README 五个文件。
- 本机 AFSIM 2.9 `mission` 实际验收：导出含空中、地面、海面、水下和太空 5 个静态平台的目录，执行
  `/home/kasm-user/afsim-build/mission -es -sm main.txt`，初始化、运行和退出均成功，退出码 `0`。
- 单平台 ZIP 样例哈希：`d50fc18f3b61862e97583b06b7d4a4ba3ca653615362bf5782436899e6e5dd13`。
- `npm run build` 已通过。Chromium E2E 在当前机器未形成有效证据：预览服务可启动，但本机 Playwright 浏览器会话未渲染入口；不能将该次超时标记为通过，需在 CI 或安装浏览器后复验下载动作。

## 兼容边界

导出是静态部署快照，不执行脚本、随机生成、`creation_time`、轨道初始化、动态创建/删除/移动、mover 和 route。导出的通用 AFSIM 图标只保证想定可以加载和运行；若需要真实模型、组件或仿真行为，应在 AFSIM 工程中继续补充。自定义 SVG、三维模型和战术图形的完整外观保留在本项目 JSON/MilX 扩展中，不会嵌入 AFSIM 静态平台文件。
