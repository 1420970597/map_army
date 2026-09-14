# AFSIM API ZIP 与 Mover Creator 三维视觉建模研究

研究日期：2026-09-14。研究范围仅为浏览器视觉几何、场景节点、AMC 模型编辑和视觉挂载；不涉及动力、弹道、制导或武器性能。来源许可不作为本任务的工程阻塞。

## 结论与证据边界

`/root/afsim/afsim_api_zip.zip` 是 WSF C++ Doxygen API 文档，并不是 Mover Creator GUI SDK，也不包含内置 AMC 文件。其 `index.html` 明确写明项目是 World Simulation Framework；`files.html` 和 `annotated.html` 没有 `MoverCreator`、`GeometryObject`、`GeometryObjFile`、`GeometryWidget` 或 `GeometryGLWidget`。ZIP 对本任务有用的部分是 WSF 单位/坐标系、`WsfVisualPart` 和 `WsfArticulatedPart` 的视觉姿态语义；参数化网格生成、AMC 字段和 GUI 行为必须以本地 Mover Creator 文档及源码为依据。[Z1][Z2][Z3][Z4][Z5]

本次仅读取 ZIP 中央目录和选定 HTML 条目，未全文解压。中央目录实际为 41,143 项、5,088,154,259 字节。`zipinfo -1` 对 `.amc`、`GeometryObj`、`GeometryWidget`、`GeometrySurface`、`GeometryBody`、`MoverCreator`、`VaModel`、`VaAttachment`、`VaEntity`、`UtEntityPart`、`wsf_version_defines` 文件名合并检索为 0；其中 `UtEntityPart` 在其他 HTML 正文中被引用，但其自身类/源文档不在此包中。

原生 Mover Creator 的直接基线是左侧部件树与属性编辑、右侧实时三维、选中部件高亮及其他部件透明、旋转/缩放、添加与删除部件、线框与可见性选项、模型导出。[L1] 本报告提出验收要求，不表示浏览器功能已全部实现或验收通过。

## 版本

| 对象 | 可核实的版本 | 证据与限制 |
| --- | --- | --- |
| ZIP 文档生成器 | Doxygen 1.13.0 | `index.html` 的 generator 元标签；这是文档生成器版本，不是 AFSIM 版本。[Z1] |
| ZIP 中 AFSIM/WSF | 未能从包内确认精确版本 | `WsfVersion.hpp` 仅引用 `wsf_version_defines.hpp` 宏，包内未收录宏定义；首页没有版本号。[Z6] |
| 本地源码基线 | AFSIM 2.9.0，release date 02-25-2022 | `/root/afsim/swdev/src/CMakeLists.txt:71` 定义 major/minor/patch/release date。[L10] |
| 本地 Mover Creator | 使用全局 AFSIM 构建版本 | `VersionInfo.hpp` 引用生成的 `mover_creator_version_defines.hpp`；本地有 2.9 更新记录，不能据此推断 ZIP 的精确版本。[L11] |

## ZIP 实际覆盖

| API/文档 | 实际内容 | 对视觉建模的用途 | 不提供的内容 |
| --- | --- | --- | --- |
| `db/d52/units.html` | WSF 默认米/千克/秒和弧度；ECS 为 +X 向前、+Y 向右、+Z 向下；PCS 相对父部件/实体。[Z4] | 统一单位和父子局部变换语义。 | AMC 字段单位、网格生成或挂点定义。 |
| `db/dc8/WsfVisualPart_8hpp_source.html` | `WsfVisualPart : WsfArticulatedPart`；`SetIcon/GetIcon`、克隆、更新间隔、显示相关状态。[Z5] | 模型标识和可动视觉部件的概念映射。 | 读取 GLB/AMC、部件编辑器、几何构建器或 sockets。 |
| `db/ddb/WsfArticulatedPart_8hpp_source.html` | 继承 `UtEntityPart`；`SetYaw/SetPitch/SetRoll`、`GetCurrentOrientationECS` 等接口。[Z7] | 局部姿态与实体姿态的区分。 | Three.js 场景树、模型资源加载、父子挂载持久化协议。 |
| `dd/d75/namespacevespa.html`、`d8/d91/namespacewkf.html` | 两页存在，但 `contents` 均为空。 | 确认命名空间被引用。 | 不可将其算作 Vespa/WKF 三维加载 API 已收录的证据。[Z8] |
| `files.html` / `annotated.html` | 收录 WSF、Wizard 等类；名为 Geometry 的命中主要是其他几何领域。 | 排除同名误判。 | 无 Mover Creator 的 `Designer::Geometry*` GUI 几何类。[Z2][Z3] |

ZIP 是本地 C++ API 参考，没有可直接供浏览器调用的 REST/JavaScript/Three.js 几何服务。浏览器交付需要建立 AMC 解析、几何生成和编辑状态管线；可在服务端复用原生几何生成代码，再交给已有 Three.js 渲染，也可实现浏览器几何生成器。不应将 C++ API 列表当成可执行前端实现。

## 内置 AMC 与场景来源

实际资源目录为 `/root/afsim/afsim2.9-data/resources/data/mover_creator`，而源码还有 `/root/afsim/swdev/src/mover_creator/data` 镜像。对前者执行 JSON 解析清点，得到 79 个 `.amc`：34 个 Vehicles（Aircraft 17、Weapon 17）和 45 个 Engines；另有 12 个 Airfoils 文件。这些是不同资源角色，不应把 45 个发动机定义显示成 45 架完整载具。

AMC 顶层有 `VehicleType`、`VehicleControlConfiguration`、`fileName`、`geometry`、`standardTemplate`、`inheritedFileName` 等。`geometry` 是按部件名称索引的对象，部件含 `GeometryObjectType`、`Reference Point` 和形状/对称字段。原生使用 `QJsonDocument::fromJson` 读取，保存整份 JSON；新建载具可从模板派生，分类来自目录，型号来自 `.amc` 文件名。[L2][L3][L4]

不能只依赖非空 `GeometryObjectType` 识别部件。实际 `F-L4-11A-1.amc` 的 `geometry.Engine.GeometryObjectType` 是空字符串，但它拥有 `EngineType: Jet`、`EngineModel: F-L4-11A-1-TF`、位置和角度字段；原生 `MoverCreatorWidget::SetCurrentVehicleFile` 专门读取此处并打开 `Engines/<EngineType>/<EngineModel>.amc`。[L3][L12]

实际 34 个载具中非空 `GeometryObjectType` 计数：GeometryBody 57、GeometryPointMass 87、GeometrySurface 111、GeometryNacelle 29、GeometryFuselage 17、GeometryMassProperties 34、GeometryPropulsionData 34、GeometrySpeedBrake 7、GeometryWing 24、GeometryEngine 10、GeometryDish 1。该计数不包括空类型的 Engine，也不表示镜像后的场景节点数。

原生安装路径规则是从可执行文件上溯 `bin` 后寻找 `resources/data/mover_creator`；开发环境回退到 `SOURCE_ROOT/../afsim_shared/mover_creator/data`。本次 `find /root/afsim -type f -name mover_creator -executable` 没有发现该名称的可执行文件，因此有源码和资源并不等于已经安装 GUI。[L5]

## 视觉几何规则

### 部件与形状

`GeometryObject` 是全部几何部件基类，提供名称、参考点、移动、可删除标志、包围范围和关联树节点。原生 `GeometryGLWidget::DrawVehicle` 绘制 engines、wings/surfaces、speed brakes、landing gear、dishes、bodies/nacelles、canopy、fuel tanks、point masses。[L6][L7]

| 部件 | 必须保留的视觉参数/行为 | 直接依据 |
| --- | --- | --- |
| Fuselage、Body、Pod | 长宽高、位置、方向；前端 Ogive/Cone/Round/Blunt；后端 Ogive/Cone/Round/BoatTail/Blunt；机身可包含座舱罩。 | [L1] Bodies/Fuselage/Body/Pod；[L8] DrawBodiesAndNacelles/DrawCanopy |
| Wing | 展长、根弦、梢弦、后掠、上反、安装角、厚度；始终水平对称；翼面区域以弦长和展长比例定义。 | [L1] Wing；[L8] DrawWingsAndSurfaces |
| Surface / Fin | 几何尺寸、参考半径、上反/后掠/安装角、厚度和允许的对称方式；水平尾翼、鸭翼、垂尾、腹鳍、V 尾等保留名称约束。 | [L1] Surfaces/Fixed Surfaces |
| Nacelle | 长宽高/厚度、方向、水平对称；Rounded、Half-Round 各方向、Flat-Sided、Flat-Swept-Left/Right；尾端 Blunt/Tapered。 | [L1] Nacelle |
| Dish | 位置、直径、厚度。 | [L1] Dish |
| Speed Brake | 位置、长宽、姿态与可见展开角；Single/Horizontal/Vertical。 | [L1] Speed Brake；[L7] DrawSpeedBrakes |
| Landing Gear | 位置、支柱长/直径、轮胎直径/宽度、展开外观；可水平镜像；仅飞机。 | [L1] Landing Gear；[L7] DrawLandingGear |
| Engine | 从 EngineType/EngineModel 解析外观尺寸，保留位置、方向和水平对称；不运行性能计算。 | [L1] Engine；[L3] SetCurrentVehicleFile；[L8] DrawEngines |
| Point Mass / Propulsion Data | 作为可选几何辅助标记显示，不能替代实体网格，也不应与外部挂载混淆。 | [L1] Point Mass/Propulsion Data；[L7] DrawPointMasses/DrawFuelTanks |

### 单位与轴向

AMC 几何字段使用英尺和角度。`GeometryObject.cpp:131` 起为 Reference Point 的 x/y/z 显示 `ft`；`GeometryObjFile` 使用 `GetLength_ft`、`GetYawAngle_deg` 等接口。其导出模型定义明确附加 `scale UtMath::cM_PER_FT`，即英尺转米，并附加 `rotate x 180`。[L6][L8]

原生 OpenGL 预览的平移是 `glTranslated(aPosX, -aPosZ, aPosY)`。因此浏览器若采用 Three.js 常见 Y-up 渲染空间，应统一使用 `render = 0.3048 * [amc.x, -amc.z, amc.y]`，方向也须作相同基变换。不能将已变换位置与未经变换的 Euler 角混用。[L7] 此处是视觉坐标转换；WSF API 默认米/弧度规则不应直接套在 AMC 原始数值上。[Z4]

### 镜像

原生镜像不仅复制位置，还改变方向。水平对称围绕 `symmetryHorizontalY`：`otherY = 2 * symmetryHorizontalY - currentY`。Engine 的镜像角度为 `(-yaw, pitch, -roll)`。Surface 水平镜像同时使用 `dihedral = -180 - dihedral` 与反向 incidence；垂直镜像围绕 `symmetryVerticalZ`，改变 dihedral 和 incidence。`+ Pattern` 为四个每隔 90 度的表面，`X Pattern` 在此基础上偏移 45 度。[L8]

对称不能作为所有部件通用自由设置：Wing 固定水平对称；固定 Surface 支持 Single/Horizontal/Vertical/+/X；Speed Brake 仅前三种；Nacelle/Engine/Landing Gear 为水平对称开关；不同保留控制面还有各自允许集合。[L1]

## 挂点与外部模型

原生 `mc_geometry.rst` 未定义通用 hardpoint/socket 结构；`geometry` 是可编辑部件对象，不是显式父子挂载树。不过 AMC 中存在具体的挂架几何。例如 `A-M4-22A-1.amc` 有 `Weapon Pylon Center`、`Weapon Pylon Central Inner/Outer`、`Weapon Pylon Wing Center/Inner/Outer`，均为 GeometrySurface，并含 Reference Point、Span、Chord、Dihedral 和 Symmetry。`Weapon Pylon Center` 的参考点约 `[1.22687, 0, 2.29069] ft`、Span 0.8 ft、Dihedral -90、Single；`Central Inner` 为 `[1.22687, 2, 1.69069] ft`、Span 1.3 ft、Horizontal。[L13]

这些数据可用于建立视觉挂点参考，但参考点是挂架部件原点，并非已验证的插接表面。项目需明确保存 `parent component/node`、局部 position/quaternion、连接端偏移和子模型 id；支持手动调整，镜像派生节点，移除/替换和撤销。兼容过滤如“载具/外挂/发动机”是项目交互规则，不能宣称来自 AMC 的真实适配清单。翼尖、发动机出口及 articulation 映射也不能等同于挂点。

本地 Vespa 有真正的场景加载实现：`VaModelDefinition::Load` 先调用 `osgDB::readRefObjectFile`，必要时回退 `readRefNodeFile`；再应用 pre-transform、screen scale、billboard、team color。`articulation` 被解析成节点名到视觉部件名的映射，有可动节点的实例使用独立资源。[L9] 这些源码未收录在本次 ZIP 的类/文件索引中。

## 导入导出边界

原生支持从内置 AMC 派生/编辑并保存 AMC JSON；这应成为浏览器“自定义模型”的第一条可往返路径。其“Output 3D Model”导出 OBJ/MTL，再按配置调用 osgconv 转 OSGB 或 IVE，默认站点输出目录为 `resources/site/models`。没有证据表明原生 Geometry 页面能够把任意 GLB/OBJ 自动反求为 AMC 参数化部件。[L1][L2][L3][L8]

原生导出的 OBJ 不是完整的编辑状态快照：`OutputObjFiles` 只调用 Engines、WingsAndSurfaces、Dishes、BodiesAndNacelles、Canopy；未调用预览中存在的 SpeedBrakes、LandingGear、FuelTanks、PointMasses；材质仅一份灰色 material0，源码明示不写透明度和纹理。这是原生导出实际覆盖差异，浏览器不应因此丢失它自己已显示的实体部件。[L7][L8]

浏览器 GLB 导入可作为网格子模型与自定义视觉资产，但需保留模型原始单位/轴向的显式适配，不能声称可逆生成 AMC 几何参数。浏览器 GLB 导出应包含所有可见实体、父子变换、挂载对象、材质和自定义节点，编辑项目/AMC 导出另行保留可编辑字段与未知字段。GLB 是浏览器扩展要求，不是 ZIP 提供的现成接口。

## 三维验收矩阵

下表都是待实现/待验证判据；本次研究未运行浏览器验收。

| 编号 | 范围 | 验收输入/动作 | 必须观察到的结果 | 依据 |
| --- | --- | --- | --- | --- |
| V01 | 全量内置 AMC | 枚举 34 个载具、45 个发动机定义 | 34 个载具均可在页内直接选取；发动机资源正确关联并可作为外观部件使用；无静默跳过或只显示名称的假覆盖。 | 实际资源清点；[L2][L3] |
| V02 | 类型识别 | VehicleType、目录类别、GeometryObjectType、空类型 Engine 样例 | 飞机/外挂、具体几何部件、发动机角色正确；空 Engine 类型仍按结构识别。 | [L3][L4][L12] |
| V03 | 机身与吊舱 | 所有前后端形状、座舱罩、长宽高和方向变化 | 网格、包围范围和属性同步，无倒置面或空白。 | [L1][L8] |
| V04 | 翼/尾/鳍 | 根梢弦、展长、后掠、上反、安装角、厚度 | 形状响应各字段，选中部件高亮；线框显示翼面区域。 | [L1][L8] |
| V05 | 其他实体 | Nacelle 全部外形、Dish、Speed Brake、Landing Gear | 每类可添加/编辑/删除；实际几何与参数一致；飞机专属限制明确。 | [L1][L7] |
| V06 | 单位/轴向 | 参考点 `[10, 2, 3] ft`；已知长度 10 ft | Y-up 米制预览位置为 `[3.048, -0.9144, 0.6096]`，长度 3.048 m；三个旋转方向可单独核对。 | [Z4][L6][L7] |
| V07 | 水平/垂直镜像 | 非零对称中心，带 yaw/roll 的 Engine、带 incidence 的 Surface | 派生位置、方向、法线正确，编辑原部件同步更新镜像。 | [L8] |
| V08 | +/X 阵列 | Single、Horizontal、Vertical、+、X 样例 | 实例数量与角度正确；不允许的对称选项不出现。 | [L1][L8] |
| V09 | 编辑与选择 | 树选择、场景选择、属性修改、添加、重命名、删除 | 树/场景选择一致；选中高亮和透视查看；保留部件不可随意重命名/删除。 | [L1][L6] |
| V10 | 自定义 AMC | 派生内置型号、改名/改几何、导出并重新导入 | 所有几何及未知字段保留，内置原模板未被覆盖，修改可恢复。 | [L2][L3] |
| V11 | 视觉挂载 | 选 AMC 挂架、拖入外挂/自定义子模型，修改局部位置与角度，替换/拆除 | 子模型跟随父部件，镜像有独立可选节点；撤销/重做和保存恢复一致；挂点来自显式项目数据。 | [L13]；本项目扩展 |
| V12 | 自定义网格 | 导入 GLB 后挂在指定节点 | 轴向/单位可校正，材质正常，保留原模型；不会虚构 AMC 参数。 | 浏览器扩展边界 |
| V13 | 场景导出 | 含机身、镜像、起落架、减速板、自定义挂载的场景导出 GLB 并重开 | 非空、实体数量/位置/比例一致；无只导出主机身或遗漏挂载。 | [L7][L8] 的实际差异；本项目完整导出要求 |
| V14 | 视图交互 | 桌面/移动浏览器旋转、缩放、复位、线框、选择、显隐 | 场景完整构图且不空白，工具与画布不重叠，选中不会跳视角；截图与像素检查留证。 | [L1]；项目验收规范 |
| V15 | 持久化与失败 | 刷新、撤销/重做、锁定/只读、损坏 AMC/GLB、加载失败 | 不丢模型与挂载；失败有可恢复状态；锁定和只读不允许写入。 | 本项目共享行为要求 |

## 引用索引

ZIP 内引用以下路径均相对 `/root/afsim/afsim_api_zip.zip`；可用 `unzip -p <zip> <内部路径>` 定点读取。

- [Z1] `afsim_api.zip/doxygen/html/index.html`：WSF 项目说明、Doxygen 1.13.0。
- [Z2] `afsim_api.zip/doxygen/html/files.html`：文件索引；没有 Mover Creator/Designer 几何文件。
- [Z3] `afsim_api.zip/doxygen/html/annotated.html`：类索引；有 WsfVisualPart，无 GeometryObject/GeometryObjFile。
- [Z4] `afsim_api.zip/doxygen/html/db/d52/units.html`：单位、ECS、PCS。
- [Z5] `afsim_api.zip/doxygen/html/db/dc8/WsfVisualPart_8hpp_source.html`；`dc/d13/classWsfVisualPart.html`。
- [Z6] `afsim_api.zip/doxygen/html/d0/d10/WsfVersion_8hpp_source.html`：版本宏引用，无宏值。
- [Z7] `afsim_api.zip/doxygen/html/db/ddb/WsfArticulatedPart_8hpp_source.html`：继承关系、姿态接口。
- [Z8] `afsim_api.zip/doxygen/html/dd/d75/namespacevespa.html` 与 `d8/d91/namespacewkf.html`：空内容页。
- [L1] `/root/afsim/swdev/src/mover_creator/doc/mc_geometry.rst`：交互 13-44，部件 243-701，导出 703-705，视图 707-726。
- [L2] `/root/afsim/swdev/src/mover_creator/doc/mc_users_guide.rst:24`：模板/AMC 新建编辑；`:35`：OBJ/OSGB/IVE 导出设置。
- [L3] `/root/afsim/swdev/src/mover_creator/source/MoverCreatorWidget.cpp:159`：AMC 读取、Engine 文件关联、整份 JSON 保存。
- [L4] `/root/afsim/swdev/src/mover_creator/source/GeometryWidget.cpp:1290`：LoadVehicleGeometry、Aircraft/Weapon 类型、配置、几何字段读取。
- [L5] `/root/afsim/swdev/src/mover_creator/source/MoverCreatorMainWindow.cpp:394`：GetDataPath 安装及开发路径。
- [L6] `/root/afsim/swdev/src/mover_creator/source/GeometryObject.hpp:45` 与 `GeometryObject.cpp:119`：部件基类、参考点英尺、不可删除标志。
- [L7] `/root/afsim/swdev/src/mover_creator/source/GeometryGLWidget.cpp:2608`：完整 DrawVehicle；`:4630` 等：`(x,-z,y)` 渲染变换。
- [L8] `/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:98`：OBJ/MTL 覆盖；`:510`：引擎对称；`:543`：表面对称；`:5088`：导出单位与轴向变换。
- [L9] `/root/afsim/swdev/src/tools/vespatk/source/VaModelDatabase.cpp:989`：模型参数及 articulation；`:1199`：OSG 模型加载。
- [L10] `/root/afsim/swdev/src/CMakeLists.txt:71`：2.9.0 与 release date。
- [L11] `/root/afsim/swdev/src/mover_creator/source/VersionInfo.hpp:14`；`/root/afsim/swdev/src/cmake/Modules/GenerateVersionInfo.cmake:28`；`/root/afsim/swdev/src/mover_creator/doc/changelog/mover_creator_2.9.rst`。
- [L12] `/root/afsim/afsim2.9-data/resources/data/mover_creator/Vehicles/Aircraft/01 - Fighter Aircraft/F-L4-11A-1.amc`：空 GeometryObjectType 的 Engine。
- [L13] `/root/afsim/afsim2.9-data/resources/data/mover_creator/Vehicles/Aircraft/02 - Attack Aircraft/A-M4-22A-1.amc:487`：Weapon Pylon 几何参考点及对称。

复核方法：ZIP 中央目录与四个索引页交叉检索；定点读取 8 组 HTML；本地 RST/CPP/HPP 对照；使用 JSON.parse 遍历资源目录清点 AMC 和部件类型。无工程代码变更，无模型转换，无浏览器或性能测试。
