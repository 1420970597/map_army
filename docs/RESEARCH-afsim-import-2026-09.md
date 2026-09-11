# AFSIM 想定文件夹静态军标导入研究

研究日期：2026-09-10。本文依据用户提供的本机源码、随附文档和解压样例，只记录格式行为、定位和哈希，不复制 AFSIM 源码或完整想定内容到本仓库。本文证明格式语义，不代表已运行完整 AFSIM 仿真器，也不代替当前项目的测试、原站审计和发布验收。

## 资料基线

- 源码根目录：`/root/afsim/swdev/src`。下文 `core/...`、`tools/...`、`wizard/...` 路径均相对此目录。
- 官方随附文档目录：`/root/afsim/afsim2.9-data/documentation/html/_sources/docs`。下文 `文档/...` 均相对此目录。
- 样例目录：`/root/afsim/demo`，压缩包：`/root/afsim/demos.zip`。
- 项目工作约束：[PROJECT_MEMORY.md](PROJECT_MEMORY.md)。源资料属于外部参考资料，不加入产品仓库。

## 输入结构与入口

AFSIM 想定使用空白分隔的命令流和成对的块终止词，不是 JSON，也不是按行固定字段的表格。一个文件可包含多个定义，一个命令可跨行，多个命令也可在同一行。`platform_type NAME BASE ... end_platform_type` 定义模板；`platform NAME TYPE ... end_platform` 才定义实例。库文件、处理器、武器模板或脚本中的字符串不能直接转成地图单位。证据：`tools/util/source/UtInputBuffer.cpp:129` 的词读取；`core/wsf/source/WsfPlatformTypes.cpp:48`；`core/wsf/source/WsfScenario.cpp:1098`。

`.afproj` 是 Wizard 的 XML 项目文件。根元素是 `wsf-ide-project-file`，`wsf-ide-project` 的 `project-directory` 相对项目文件所在目录；只有 `file-item` 中 `file-type="file-main-source"` 的 `file-path` 被加入启动文件列表，而且可以有多个。启动文件相对项目目录，场景 `working-directory` 相对项目目录指定工作目录。证据：`wizard/lib/source/core/Project.cpp:523`、`:555`、`:574`、`:607`；样例 `0_sensor/sensor_demo.afproj:1`。

导入器应保留文件夹相对路径，优先按显式项目入口解析。没有项目文件时，可以让用户选择入口文件；把整个目录所有文本拼接起来会混入互斥场景和未引用实例。XML 应使用结构化解析器，不能以正则表达式提取属性；项目中的可执行程序路径及命令行配置不应被执行。

## Include 与路径规则

| 命令或阶段 | 本机源码确认的语义 | 证据 |
| --- | --- | --- |
| `include FILE` | 每次出现都读取，不能一律去重 | `tools/util/source/UtInput.cpp:520` |
| `include_once FILE` | 此实际文件已经进入共享文件缓冲缓存时跳过，包括此前经普通 `include` 读取的情况 | `tools/util/source/UtInput.cpp:527`、`:1282` |
| 文件身份 | 底层 `FileID` 比较实际文件身份，不能仅以输入字符串判重 | `tools/util/source/UtInput.cpp:1402` |
| 搜索第一步 | 展开路径变量 | `tools/util/source/UtInput.cpp:254` |
| 绝对路径 | 绝对路径原样返回；Windows 另识别盘符 | `tools/util/source/UtInput.cpp:1072` |
| 相对路径第一候选 | 当前正在处理的文件所在目录 | `tools/util/source/UtInput.cpp:1093` |
| 相对路径后续候选 | `file_path` 列表按加入顺序查找，先加入者优先 | `tools/util/source/UtInput.cpp:1119` |
| 无候选命中 | 返回展开后的原始路径，由文件打开操作在进程工作目录解释，最终可能报错 | `tools/util/source/UtInput.cpp:1130`、`:527` |
| `file_path DIR` | 相对包含该命令的文件目录规范化，再加入全局搜索列表；仅接受存在的目录，重复项不重复加入 | `core/wsf/source/WsfScenario.cpp:289`；`tools/util/source/UtInput.cpp:115` |
| `reset_file_path` | 清空搜索目录列表 | `core/wsf/source/WsfScenario.cpp:305` |

文档 `文档/file_commands.rst.txt:68` 与上述优先级一致。文件名允许双引号包裹空格；`include` 在普通命令读取过程中展开，所以也可以处于组件或数据块内部。证据：`tools/util/source/UtInput.cpp:525`；`tools/util/source/UtInputBuffer.cpp:247`。

对于浏览器文件夹导入，工作目录应明确映射到用户选择的想定根目录或 `.afproj` 的工作目录。路径规范化后仅能解析到已选择的文件集合，不能读取任意本机绝对路径，也不能按 basename 静默匹配同名文件。需要允许仍处于选择范围内的 `../` 引用，并对越界引用、缺少引用和大小写冲突给出定位。循环普通 `include` 必须终止；原引擎也有循环检测，见 `tools/util/source/UtInput.cpp:1258`。解析器还应设置文件数、总大小、展开深度和 token 数上限，避免重复包含导致资源耗尽。

### 路径变量

`define_path_variable NAME VALUE` 保存字符串，不会在定义时递归展开。读取文件名时支持 `$(NAME)` 和 `${NAME}`：内部路径变量优先，随后是环境变量，最后是空字符串；替换后的文本不再递归展开。`$$` 折叠为单个 `$` 并跳过再次替换。`undefine_path_variable NAME` 仅取消内部定义。证据：`core/wsf/source/WsfScenario.cpp:309`；`tools/util/source/UtInput.cpp:171`、`:1138`、`:1193`、`:1218`；`文档/file_commands.rst.txt:37`。

浏览器没有 AFSIM 进程环境，不能假设环境变量存在。未提供变量时应明确诊断，防止替换为空字符串后错误命中另一个文件。不得把路径变量当脚本执行，也不能以全局文本替换修改坐标、类型名或脚本内容。另有独立的 `$define` / `$<...>` 预处理机制，源码 `tools/util/source/UtInputPreprocessor.cpp:97`，不能混同于 `define_path_variable`。未支持此机制时应诊断受影响输入。

## 平台、继承与编辑

`WSF_PLATFORM` 是平台模板的内建根类型。派生 `platform_type` 克隆基类，再依次处理自身块；实例克隆指定模板，再应用实例配置。`side`、`icon`、位置、mover 及组件状态都可能从模板继承，因此只扫描实例块不足以恢复单位。类型加载使用延迟依赖解析，允许被引用模板出现在后续输入；循环依赖和缺失类型是错误。证据：`core/wsf/source/WsfPlatformTypes.cpp:37`、`:64`、`:79`、`:82`；`core/wsf/source/WsfPlatform.cpp:73`；`core/wsf/source/WsfScenario.cpp:1190`；`core/wsf/source/WsfDeferredInput.cpp:65`。

`edit platform NAME ... end_platform` 修改已定义实例，不创建第二个地图单位。编辑本身也延迟加载，并依赖该名称的平台。多个同名 `platform NAME TYPE` 是错误，源码显式要求使用 `edit platform`；随附文档 `platform.rst.txt:118` 的旧描述较宽泛，此处以源码为准。模板重名同样报错。证据：`core/wsf/source/WsfScenario.cpp:1101`、`:1126`、`:1132`、`:1180`；`core/wsf/source/WsfPlatformTypes.cpp:87`。

`platform <default> TYPE` 是引擎支持的自动命名形式，不能按普通重复名称处理；自动名称由引擎生成。证据：`core/wsf/source/WsfScenario.cpp:1160`；`文档/platform.rst.txt:123`。

需要区分平台级编辑和组件级编辑：

- 模板内部未加前缀的组件命令默认执行新增。
- 实例内部未加前缀的组件命令默认执行编辑。
- `add mover TYPE ... end_mover` 新增 mover；`edit mover ... end_mover` 修改 mover；`delete mover` 删除 mover，不是删除平台。
- 一般组件还有名称参数；mover/fuel 编辑删除没有组件名称。

证据：`core/wsf/source/WsfPlatform.cpp:663`、`:686`、`:695`、`:704`；`文档/platform.rst.txt:475`、`:495`。

**在所查 AFSIM 2.9 核心输入中，未发现顶层 `delete platform NAME` 命令。** `WsfScenario::LoadPlatformInstance` 仅处理创建和编辑。已确认的 `delete` 用于平台内部组件；运行时删除平台属于仿真和脚本 API，不应因输入出现 `delete platform` 就假定它是官方静态语法。导入时宜报不支持，而非把后续 token 误识别为新实例。证据：`core/wsf/source/WsfScenario.cpp:1098`；`core/wsf/source/WsfPlatform.cpp:704`；`文档/platform.rst.txt:495`。

## 初始位置与航线

**对于 `WsfRouteMover` 系列，有经纬度起点的初始航线优先于平台级 `position`，与两者的文本先后顺序无关。**

1. 平台 `position` 在输入阶段直接更新平台位置：`core/wsf/source/WsfPlatform.cpp:470`。
2. 平台未识别的命令会交给 mover，因此 `route` 可直接位于平台块：`core/wsf/source/WsfPlatform.cpp:644`。
3. mover 的 `route ... end_route` 创建新航线；`use_route NAME` 克隆全局命名航线；赋值替换现有航线：`core/wsf/source/mover/WsfRouteTypes.cpp:63`；`core/wsf/source/mover/WsfRouteMover.cpp:313`。
4. 初始化默认使用索引 0；`start_at LABEL` 存在且匹配时选择对应航点：`core/wsf/source/mover/WsfRouteMover.cpp:160`、`:318`。
5. 初始化调用 `SetRoutePoint`，后者将平台位置直接设为所选航点：`core/wsf/source/mover/WsfRouteMover.cpp:194`、`:688`。
6. 如果初始航线第一个点不是经纬度点，例如相对偏移或航向航段，先把平台当前坐标插为起点，再进行航线规范化。不能跳过这些点，直接取后续第一个 `position`：`core/wsf/source/mover/WsfRouteMover.cpp:1385`。

空航线保留平台当前运动学状态，见 `core/wsf/source/mover/WsfRouteMover.cpp:200`。没有 mover 时不能把任意嵌套 `route` 当有效平台航线；`delete mover` 后也必须重新考虑位置来源。其他 mover、脚本重定位、路径规划和六自由度初始化不能仅靠这一规则还原。

`mgrs_coordinate` 在平台和航线中均可用，必须经有效 MGRS 转换，不能将任意字符串当经纬度。证据：`core/wsf/source/WsfPlatform.cpp:478`；`core/wsf/source/mover/WsfRoute.cpp:1445`。

`route` 还包含 `label`、`goto`、相对 `offset`、航向航段、路线插入/变换等语义，见 `core/wsf/source/mover/WsfRoute.cpp:1417`、`:1476`；`文档/route.rst.txt:130`、`:291`、`:315`。不能以“找到任何 position 就使用”替代航线结构。未知起点算法或未解析命名航线应产生诊断，避免静默绘制错误位置。

## 坐标与词法

`position` 的顺序是纬度、经度；地图常用的数据顺序是经度、纬度，导入时必须明确转换。`UtInput::ReadValueOfType` 将这两个量分别交给 `UtLatPos`、`UtLonPos`，两者调用 `UtAngle::GetAngle`。证据：`tools/util/source/UtInput.hpp:328`；`tools/util/source/UtLatPos.cpp:17`；`tools/util/source/UtLonPos.cpp:21`。

所查解析器支持带方位前缀或后缀的十进制度、度分和度分秒；方向不区分大小写。以下均为人工编写的格式示例：`12.5N`、`N12.5`、`12:30N`、`12:30:15.5N`。南纬使用 S，西经使用 W；纬度绝对值至多 90，经度绝对值至多 180；分秒必须完整并小于 60。**此源码要求方向字符，不接受只有符号的普通十进制坐标作为该输入类型。** 如产品额外允许 `-12.5`，应说明属于导入器兼容扩展。证据：`tools/util/source/UtAngle.cpp:30`、`:49`、`:79`、`:122`、`:167`、`:195`。

高度、速度等是独立的带单位量，可与坐标处于同一行。不能把后续 `altitude`、`ft`、`agl` 当下一坐标。平台的 MSL/AGL 高度会涉及地形，静态二维军标导入不应声称恢复地形修正后的三维状态。证据：`core/wsf/source/WsfPlatform.cpp:494`；`core/wsf/source/mover/WsfRouteMover.cpp:676`。

注释支持 `#`、`//` 和 `/* ... */`；双引号中的注释符号保留为字符串内容。词法层必须保留文件路径、行号和块上下文，不能先按正则删除注释而破坏被引号包裹的路径。证据：`tools/util/source/UtInputBuffer.cpp:129`、`:197`、`:247`。

`script`、`script_variables`、`on_initialize`、`on_initialize2`、`on_update` 等交给独立脚本编译器，并有对应终止词。应完整隔离这些块，不从其中的字符串、局部变量、方法调用或注释中提取平台或坐标。静态导入不执行用户脚本，也不宣称包含脚本动态生成的单位。证据：`core/wsf/source/script/WsfScriptContext.cpp:169`、`:208`、`:241`、`:678`。

## 阵营、图标与作战域

`side` 和 `icon` 均是自由字符串；`side` 可以是 red/blue，也可以是国家或自定义队名，并不是 SIDC 阵营字段枚举。未配置 `icon` 时，引擎初始化采用类型名。`category` 可以重复添加，`clear_categories` 清空已有分类。证据：`core/wsf/source/WsfPlatform.cpp:414`、`:420`、`:281`；`core/wsf/source/WsfCategoryList.cpp:56`；`文档/platform.rst.txt:180`。

作战域优先级为：显式 `spatial_domain`，否则 mover 的作战域，仍未知则默认 land。合法值是 `land`、`air`、`surface`、`subsurface`、`space`。证据：`core/wsf/source/WsfPlatform.cpp:1002`；`core/wsf/source/WsfTypes.cpp:20`。

| mover | 已确认作战域 | 证据 |
| --- | --- | --- |
| `WSF_AIR_MOVER` | air | `core/wsf/source/mover/WsfAirMover.hpp:42` |
| `WSF_ROTORCRAFT_MOVER` | air | `core/wsf/source/mover/WsfRotorcraftMover.hpp:71` |
| `WSF_GROUND_MOVER` | land | `core/wsf/source/mover/WsfGroundMover.hpp:34` |
| `WSF_ROAD_MOVER` | land | `core/wsf/source/mover/WsfRoadMover.hpp:49` |
| `WSF_SURFACE_MOVER` | surface | `core/wsf/source/mover/WsfSurfaceMover.hpp:36` |
| `WSF_KINEMATIC_MOVER` | air | `core/wsf/source/mover/WsfMoverTypes.cpp:76`；`WsfMath3D_Mover.hpp:53` |

平台类型名、icon 名称不能覆盖显式或 mover 确定的作战域。例如真实样例某类型名看似飞机，但配置使用水面 mover，若按名字猜域会错。SIDC 应由产品明确的映射策略生成，并保留原始 type、side、icon、来源文件等元数据；未知阵营采用未知标识，不应默认友军。AFSIM 图标库名称与 MIL-STD 军标不存在由此源码证明的一一对应关系。

## 真实样例核对

`0_sensor` 目录当前有 42 个文件。`main.txt` 的依赖图引用 `red.txt` 和 `blue.txt`；后两者分别声明 3 个顶层平台，故静态平台实例预期为 **6 个，红方 3 个、蓝方 3 个**。其余 `platforms/` 中大量模板和武器文件不应增加地图单位数。证据：`0_sensor/main.txt:17`、`:27`；`0_sensor/red.txt:9`、`:16`、`:21`；`0_sensor/blue.txt:5`、`:20`、`:36`。

三个蓝方平台同时有平台级 `position` 和带经纬度首航点的 `route`；应采用各自航线起点。随附历史输出 `0_sensor/output/basic_iads.evt:1`、`:14` 的零时刻检测记录中，两个目标平台的位置与各自航线起点一致，从独立运行产物侧印证源码结论。该输出是已有文件，不能当成本轮重新运行仿真的证明，也不能用于证明完整平台数。

该样例的 `.afproj` 列出两个主源文件，第二个是 `platforms/076.txt`，而 `main.txt` 已经通过 `include_once` 引用它。入口列表与 include 图不能简单混为同一种去重语义；单选 `main.txt` 是清晰可复现的静态验收入口。多主文件项目应显式处理和报告重复定义。

| 本机文件 | SHA-256 |
| --- | --- |
| `demos.zip` | `cfd3f07c646f4170cb7083093652573a1f41cae9d2fc3d0c156abc8720b18831` |
| `demo/0_sensor/main.txt` | `12456a549b6b97f05ac7806e75c3e7e8c803e744b3cd460b3945bf1a898e0dc9` |
| `demo/0_sensor/red.txt` | `965b768687868c50e5e365e35a1f3d70d0b0b9b4a10491d7682de915b86781fc` |
| `demo/0_sensor/blue.txt` | `81162228a54f41b0503b269f85cbff3fcd2bac85e080705667f88d2a85dc2e99` |
| `demo/0_sensor/sensor_demo.afproj` | `0e55f2fe4749ccab0147a646f9da18b2be3414d2234ec5ae9016557c97f2813c` |
| `demo/0_sensor/output/basic_iads.evt` | `7214269df2c7b76bcf84ac41520d3e0f0d368dfaeb7d6f99586e36a43d49ea98` |

核心源码校验：`WsfPlatform.cpp` 为 `6c66b3ef66354b676d520022093325ebd56c4d206ceb66c75033974fbe26e507`；`WsfRouteMover.cpp` 为 `ad8445b8a819906afef68587797a62929a0b1d19c29953feff1f4003e9f0b60d`；`UtInput.cpp` 为 `e01ec6e491f0ce3f688435670a177117c2b8463279b95f7044f90a0ad0760938`；`UtAngle.cpp` 为 `a8745514063ba5fe7d3d319ab67ec37e4292e346dd93745ca0de62b4c7fde5b4`。

## 静态导入的验收边界

静态导入的结果是从用户选择入口及其依赖中恢复可确定位置的平台实例，并转换为可编辑地图单位。完整仿真还涉及 creation_time、随机可用性、脚本生成、脚本重定位、运行时删除、六自由度和轨道初始化等；不能把静态导入单位数等同于任意仿真时刻的单位数。依据：`core/wsf/source/WsfPlatform.cpp:301`；`core/wsf/source/WsfPlatformAvailability.cpp:128`；上述脚本和 mover 证据。

建议验收至少覆盖：文件夹相对引用与同名文件冲突，include 顺序及循环，路径变量，前向继承及循环继承，重复实例与 edit，组件删除后的域和位置变化，普通位置与 route/use_route/start_at 优先级，脚本/注释隔离，坐标边界，无坐标与不可解析位置诊断，单次导入撤销、持久化和重新打开。缺少引用或不支持的位置语义应有可追溯诊断；不能静默放置到地图原点或以错误坐标标记为成功。
