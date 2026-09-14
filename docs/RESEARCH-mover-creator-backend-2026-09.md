# Mover Creator 内置三维模型与自定义模型：后端需求评估

核查日期：2026-09-14。范围：用户指定的本机 `/root/afsim` 内 Mover Creator 资源、网页模型选择、三维显示和可视化装配。本记录不涉及飞行动力学、武器性能或仿真引擎实现；本次仅评估，未修改功能代码或部署服务。

## 结论

完整内置模型的网页显示、类型筛选和拖拽装配，本身不强制要求业务后端：可以提前生成 GLB 和模型目录，通过静态服务器按需加载。若自定义模型也必须进入长期可用的网页目录，支持上传或服务器目录导入、在线转换、跨设备共享和版本管理，则建议增加模型资产服务及独立转换进程。

项目已经有 Node.js 后端，但目前只负责分享文档，并没有模型管理能力。可以扩展现有部署，不需要另建大型业务系统。建议采用轻量 Node API、SQLite 元数据、持久文件卷及独立转换 Worker；这是本次架构建议，并非已实现能力。

## 先纠正资源范围

Mover Creator 的实际安装资源目录是 `/root/afsim/afsim2.9-data/resources/data/mover_creator`，源码资源副本位于 `/root/afsim/swdev/src/mover_creator/data`。[CMake 安装规则](/root/afsim/swdev/src/mover_creator/CMakeLists.txt:21) 和 [GetDataPath](/root/afsim/swdev/src/mover_creator/source/MoverCreatorMainWindow.cpp:394) 均确认这一布局。[目录选择器](/root/afsim/swdev/src/mover_creator/source/MoverCreatorDialogBase.cpp:54) 枚举 `.amc` 文件；[航空器入口](/root/afsim/swdev/src/mover_creator/source/CreateAircraftDialog.cpp:35) 进入 `Vehicles/Aircraft`。

AMC 文件是 JSON，包含 `VehicleType` 和 `geometry` 参数化几何结构，例如 [F-L4-11A-1.amc](</root/afsim/swdev/src/mover_creator/data/Vehicles/Aircraft/01 - Fighter Aircraft/F-L4-11A-1.amc:4>) 与该文件的 [geometry](</root/afsim/swdev/src/mover_creator/data/Vehicles/Aircraft/01 - Fighter Aircraft/F-L4-11A-1.amc:42>)。[官方模板说明](/root/afsim/swdev/src/mover_creator/doc/mc_standard_vehicles.rst:12) 将它们定义为半通用模板，因此模型名称应保留模板身份，不能自动冒称为某个真实装备型号。

现有导入脚本固定读取另一个库 `/root/afsim/afsim2.9-data/resources/models/models.txt`，证据见 [import_models.py](../assets/afsim/import_models.py#L7) 和当前生成的 [manifest.json](../public/models/afsim/manifest.json#L2)。因此现有 OSGB 索引数量、嵌入数量、挂点缺失及该目录的分发说明，均不能直接作为 Mover Creator AMC 库的完整性、挂载或授权结论。

本轮已解析所有 AMC，并逐文件比较安装目录与源码副本的内容及 SHA-256。结果记录于 [资源清单与哈希](evidence/mover-creator-2026-09/inventory.json)：

| 资源                              | 去重后数量 | 含义                                                                                                     |
| --------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| `Vehicles/Aircraft/*.amc`（递归） | 17         | 战斗、攻击、轰炸、侦察、预警、加油、运输、海上巡逻及无人机模板                                           |
| `Vehicles/Weapons/*.amc`（递归）  | 17         | 武器与外挂类模板，包含外置油箱；顶层类型统一为 `Weapon`                                                  |
| `Engines/*.amc`（递归）           | 45         | 30 个 Jet、6 个 Ramjet、1 个 LiquidRocket、8 个 SolidRocket 定义，供模型引用，不能当作 45 个额外整机模型 |
| `Airfoils/*.foil`（递归）         | 12         | 组件引用的翼型定义                                                                                       |

两处目录的 79 个 AMC 和 12 个翼型文件逐文件内容一致；34 个 Vehicles 全部标为 `standardTemplate: true`。检查了模板中的 40 处发动机引用和 135 处翼型引用，均能在对应目录解析。仅 Vehicles AMC 原始文本合计 499,099 字节；这一大小不能用来预测生成 GLB 的体积。高超声速分类是标为 Unavailable 的空模板目录，不计作已提供模型。

## 当前项目可复用的能力

| 能力      | 已核实事实与一手代码依据                                                                                                                                                  | 对本次需求的影响                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| HTTP 后端 | [server/index.mjs](../server/index.mjs#L12) 创建 Node HTTP 服务；路由只有健康检查与分享文档接口，其他路径返回 404                                                         | 可以扩展部署；不存在可直接使用的模型 API                                     |
| 持久化    | [docker-compose.yml](../docker-compose.yml#L12) 为 `shares` 配置独立 `share-data` 卷                                                                                      | 已具备容器服务和持久卷基础，模型文件需要独立存储位置                         |
| 请求限制  | [nginx.conf](../deploy/nginx.conf#L8) 的 `/api/` 代理限制为 8 MB，超时 30 秒；[server/index.mjs](../server/index.mjs#L26) 只解析分享 JSON                                 | 模型上传需要独立路由、流式处理及明确限额；转换不能放在长时间同步请求中       |
| 分享权限  | [server/index.mjs](../server/index.mjs#L106) 读取随机分享地址无需编辑令牌；[更新接口](../server/index.mjs#L130) 才验证编辑令牌                                            | 分享令牌机制不等同于私有模型读写权限，不能直接用来保护模型库                 |
| 网页选择  | [equipment3d.ts](../src/core/model/equipment3d.ts#L80) 将模型写入静态数组；[Equipment3DPanel.tsx](../src/features/inspector/Equipment3DPanel.tsx#L117) 从目录地址获取资产 | 可保留选择交互，改由统一模型注册表提供目录；当前没有服务器自定义模型入库流程 |
| 三维加载  | [equipmentPreview.ts](../src/features/inspector/equipmentPreview.ts#L119) 使用 Three.js `GLTFLoader`                                                                      | 已能消费 GLB；尚无 AMC 参数化几何读取器                                      |
| 挂载显示  | [equipmentPreview.ts](../src/features/inspector/equipmentPreview.ts#L134) 查找 `attachmentSocket` 节点，并以 `attachmentAnchor` 的逆变换安装部件                          | 可以复用装配交互；AMC 需要转换为一致的节点、坐标和安装锚点约定               |
| 装配保存  | [equipment3d.ts](../src/core/model/equipment3d.ts#L5) 保存模型 ID、版本及挂载引用；[geojson.ts](../src/core/io/geojson.ts#L92) 将引用写入文档                             | 可以沿用版本引用；分享文档不会自动携带外部模型二进制资产                     |

当前 [afsimCatalog.ts](../src/core/model/afsimCatalog.ts#L16) 的 `sockets`、`attachments` 被定义为空数组类型，这是旧 OSGB 目录接入的现状，不能据此判断 AMC 源文件没有装配信息。

## 后端是否必要，取决于自定义模型的使用方式

| 目标行为                                     | 是否需要新增业务后端       | 实现边界                                                                         |
| -------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| 固定内置目录，提前生成所有 GLB，页面直接选择 | 不强制需要                 | 离线导入工具产生目录、GLB 和缩略图，静态服务器按需提供资产                       |
| 开发者或管理员离线加入自定义模型，再重新发布 | 不强制需要                 | 通过同一导入流程生成资产；新模型更新随部署生效                                   |
| 自定义 GLB 仅保存在当前浏览器                | 不强制需要                 | 可以使用浏览器持久存储，但不能保证另一台设备或其他查看者可用；也不满足共享模型库 |
| 网页管理自定义模型，保存后进入服务器模型库   | 需要可写资产服务           | 上传或从允许的服务器目录导入、稳定 ID、校验、版本和目录更新                      |
| AMC 等源格式在线生成 GLB、缩略图和装配元数据 | 建议独立 Worker            | 参数化几何生成或格式转换属于后台任务，API 返回任务状态                           |
| 多用户私有模型和跨设备项目分享               | 需要资产服务或等效托管服务 | 模型权限、共享范围、资产引用解析及删除后的引用处理                               |

“页面选择而非本地上传”可通过管理员将本机目录一次性注册到服务器模型库实现。用户选择内置模型时，无需逐个上传文件；自定义模型管理是独立的可选入口。以上为推荐交互，并非当前已经支持。

## 推荐实现边界

### Node 模型 API

保留当前分享 API，新增独立模型模块。建议接口包括：

- `GET /api/models`：按名称、来源和类型查询目录。
- `GET /api/models/:id`：读取版本、来源、转换状态和可视化挂载定义。
- `POST /api/model-imports`：上传源资产或选择管理员配置的本机资源目录，返回任务 ID。
- `GET /api/model-imports/:id`：查看处理进度、校验问题和可重试失败原因。
- `GET /api/models/:id/versions/:version/asset`：读取稳定版本的浏览器资产。
- `PUT /api/models/:id/metadata`：保存类型更正、挂点、安装变换和可用部件关系。

只有进入可视化装配所需的字段应暴露给前端。自动类型识别优先使用 AMC 的 `VehicleType`，目录用于细分类别，例如将顶层同为 `Weapon` 的外置油箱归到外挂部件。无法识别时保留为未分类并允许更正。全部 34 个内置模板具有明确类型字段；识别算法尚待实现和验收。自定义 GLB 不一定包含装备语义，可读取约定的 metadata，但不能保证从任意外形自动准确判断型号或挂载关系。

### SQLite 与持久文件卷

建议 SQLite 保存稳定模型 ID、内容哈希、版本、来源、分类、元数据及转换任务。原始文件和生成 GLB 存在独立持久卷，按模型版本或内容哈希寻址；浏览器仅按需获取当前模型，不把所有二进制资产塞入 JS 包或分享 JSON。

单机部署可先采用这些组件，无需同时引入 Redis、外部对象存储或微服务集群。保留存储接口后，规模扩大时再替换底层存储。这里的“先采用”指架构复杂度，不降低完整模型覆盖、持久化、失败恢复或权限语义。

### 独立转换 Worker

AMC 是参数化几何配置；要生成浏览器资产，必须读取其几何结构并还原对应的可视化几何，不能仅修改文件后缀，也不能直接套用现有 OSGB 导入脚本。Blender 可参与几何生成、后处理或资产校验，但安装 Blender 本身不等于支持 AMC。

已找到可用的导出路径依据：[官方 Geometry 文档](/root/afsim/swdev/src/mover_creator/doc/mc_geometry.rst:703) 提供 “Output 3D Model”；[GeometryObjFile::OutputObjFiles](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:102) 从组件生成 OBJ 与 MTL；[ConvertModelTo](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:5192) 再可选调用 osgconv 生成 OSGB/IVE。因此优先评估的资产链是 `AMC → Mover Creator 几何导出 → OBJ/MTL → Blender → GLB`，无需先绕到通用 OSGB 库。本机 `blender` 与 `osgconv` 命令均已存在。

这条链目前仍是有源码依据的实现方案：现有导出器通过 `MoverCreatorMainWindow` 读取 Qt 界面的 Vehicle 状态，尚未验证可无人值守批量调用。需要评估封装其几何导出入口，或实现与模板外观一致的独立几何转换器。OBJ 路径应另行保存组件、单位、方向及挂点元数据，不能假设 OBJ 能完整保留节点层级或自定义属性。全量转换保真是主要工程工作，新增 HTTP API 本身不能完成它。

建议 Worker 负责源文件校验、依赖解析、参数化几何生成、坐标与单位规范化、GLB 输出、缩略图和转换报告。对自定义 GLB 可直接校验入库；其他格式逐项建立明确支持范围。文件读取和转换进程应有大小、运行时间和内存限额，任务失败不影响分享服务。

类型、几何位置、对称关系、节点层级和装配锚点应尽量保持源数据语义。全量 AMC 字段扫描发现 6 个 Vehicles 中有 19 个名称包含 `Pylon` 的组件，包括发动机挂架；这些组件的类型全部为 `GeometrySurface`，提供几何位置、对称与尺寸等字段。这些是可用于展示和人工标注的挂架几何，尚未发现标准化的 socket ID、安装锚点或允许挂载部件清单，不能将所有挂架或组件参考点自动当作完成校准的安装位置。

挂载支持因此分为两项工作：保留模板已有组件外观；建立本项目的可视化 sockets、部件 anchor 和兼容关系。带约定元数据的自定义 GLB 可自动读取；缺失的数据需要 Blender 标注或页面挂点编辑器补充。兼容规则用于本应用装配显示，不代表真实装备的工程兼容性。

### 前端与可视化装配

保留 Three.js 预览、模型选择、拖拽、撤销、只读和锁定行为。目录从统一注册表获取；装配文档继续保存模型 ID 和版本，通过资产服务解析文件。自定义模型缺少安装锚点时，应由资产编辑流程建立明确锚点，不能静默把模型原点当作已校准安装位置。

删除或替换模型版本时要处理已有文档引用；未找到版本时保留引用并提示不可用。现有 [equipment3d.ts](../src/core/model/equipment3d.ts#L125) 已保留未知模型引用，这一语义应延续。

## 完整支持的验收口径与未决事项

- 已完成 Mover Creator 实际装载路径、AMC 清单、依赖引用及副本哈希核对；以 34 个 Vehicles 为整机/载荷显示覆盖基准，以 45 个 Engines 和 12 个 Airfoils 为支持依赖，不能把重复副本或空目录算成额外车辆模型。
- 对全部内置 Vehicles 模型逐一验证网页可选择、正确生成、类型可解释、刷新可恢复；有源装配数据的模型需要验证位置、方向、对称与层级。
- 自定义模型至少验证：入库、校验失败、转换状态、刷新恢复、版本引用和跨设备读取；若支持私有库，还需验证实际读写权限。
- AMC 模板与导出实现的授权边界仍需按实际 AFSIM 协议确认。已读取 [安装许可说明](/root/afsim/swdev/src/cmake/Modules/cpack_license.txt:1)，其要求遵守适用的 AFSIM MOU/ITA；Mover Creator 源码及说明文件也带有限制标记。本次未取得该具体协议，不能据此确认可公开发布全部导出资产，也不能直接套用另一套 OSGB 库的 45 个受限模型名单。内网服务或加入后端不会自动改变授权范围。
- 本评估没有运行 AMC 转换，也没有验证全部模型的渲染结果；“参数化模型可转换”的架构判断不等于已经完成转换或完成全部挂载兼容。

本记录基于本机源文件和当前项目源码，没有从互联网搜集模型。新增功能应先完成源数据清单与视觉几何映射，再以相同目录接口承载全部内置模型和自定义模型。
