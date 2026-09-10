# Blender 军标关联三维模型与拖拽挂载可行性评估（2026-09）

调研日期：2026-09-10。最初范围为技术可行性、资产生产规范和本机工具验证；用户继续后新增了示例资产与详情装配实现，实际进展见“本机工具验证记录”及 [本轮验收清单](TODO-blender-unit-models-2026-09.md)。本文是用户提出的项目扩展评估，不是 map.army 免费版复刻缺口清单；不声称完成全部军标建模。

## 结论

**可行。建议用 Blender 制作资产并导出 GLB，在现有军标详情内通过 Three.js 展示，在预定义挂点上进行拖拽装配。** Blender 是生产工具，浏览器使用导出的 glTF/GLB 模型；终端用户查看和配置模型不需要安装 Blender。[B1][B2][T1]

交互实现的技术风险可控，主要工作量在资产制作、型号和军标的对应关系、挂点配置，以及把挂载状态贯穿保存、分享、撤销和导入导出。**SIDC 表达的军标不等于唯一的真实装备型号**：原站图库还包括编制、战术图形、天气和专用符号，不能给每个符号自动分配一个真实车辆或飞机。[M2]

本轮把“挂载”暂按飞机外挂部件、传感器、油箱等装配理解。如果指“在舰船上增加舰载飞机”或“给编制分配下属单位”，则应使用载运/编制关系，不能直接复用外挂插槽语义。当前只评估可视化装配，不推导真实任务载荷或作战能力。

## 原站与实施前项目基线

已先读 `PROJECT_MEMORY.md`、原站研究、范围审计和当前 ToDo，并重新访问原站官方索引、3D Map View 与 Symbol Gallery。官方 3D 文档描述三维地图导航、图层显隐和透明度；本次所读官方资料没有为“单装备详情三维模型和拖拽挂载”提供现成功能依据，因此作为用户授权的扩展独立评估。[M1][M2][M3]

| 当前实现 | 可复用部分 | 需要新增或核验的部分 |
| --- | --- | --- |
| [`Inspector.tsx`](../src/features/inspector/Inspector.tsx) | 单选详情、编辑/预览/关于 MSS 页签、选中要素上下文 | 模型预览和挂载交互；当前整个 `fieldset` 在只读/锁定时禁用，未来应允许查看、旋转和缩放，仅禁止修改装配 |
| [`Map3DView.tsx`](../src/features/map/Map3DView.tsx) | Cesium 三维地球和军标 billboard | 现有军标 billboard 不等于装备实体模型；详情预览可独立使用 Three.js。以后把实体投放到地球是另一项集成工作 |
| [`types.ts`](../src/core/model/types.ts) 的 `MapFeature` | SIDC、自定义 SVG 绑定、方向及要素身份 | 尚无三维资产 ID、资产版本、挂点装配状态。15 位/20 位 SIDC 和自定义 SVG 不能共享未经区分的映射规则 |
| [`package.json`](../package.json) | React 19、Zustand、Cesium | 当前未声明 Three.js 依赖；本轮不修改依赖 |

## 全量覆盖应如何定义

建议建立版本化的资产清单，将以下对象分开管理，而不是按完整 SIDC 字符串复制一份模型：

| 对象 | 建议呈现方式 | 完成判据 |
| --- | --- | --- |
| 确定型号的装备 | 对应型号和变体的模型 | 外形、尺寸、部件布局、许可和版本均经核验 |
| 只知道类别的飞机/坦克/舰船 | 明确标注的类别示意模型，允许用户选定型号 | 示意级覆盖单独统计，不能计为真实型号建模完成 |
| 单位、编制和组织 | 编制表示或关联实际装备清单 | 不能把一个营或旅等同为一辆车 |
| 线、面、天气、控制措施等 | 保留原有军标或使用针对该类语义的空间表示 | 标明“不适用装备模型”，不得归为漏建或随意映射装备 |
| 未映射/自定义军标 | 保留符号及明确的未配置状态，可显式选择三维资产 | 没有资产时仍可正常编辑、保存和分享 |

资产映射至少区分 `modelId`、`variantId`、标准版本、符号类别和覆盖级别。身份、状态等修饰符通常可以复用一个基础模型，但不能因此抹掉型号、阵营标记和涂装差异。先固定可审核的清单和分母，再报告“已完成型号 X/Y、示意类别 A/B、不适用 C、未映射 D”；当前标准符号库本身还存在覆盖缺口，不能以现有本地目录作为“所有军标”的默认分母。[M2][P1]

## 资产生产与坐标规范

建议的生产链：

```text
型号/类别清单与参考资料
  -> Blender 源文件与制作脚本
  -> 网格、材质、尺寸、挂点审查
  -> GLB 导出及 metadata 校验
  -> glTF Validator
  -> Three.js 实际加载及截图验收
  -> 带版本和许可记录的资产发布清单
```

1. **源文件和运行文件分开**：保留 `.blend`、参考资料出处、导出参数与版本；浏览器只加载 `.glb` 及确有必要的压缩解码器。Blender 支持后台运行和 `--python` 脚本执行，批处理应带 `--python-exit-code 1`，让失败明确返回非零退出码。[B1]
2. **长度统一米制**：Blender 制作规范约定 1 场景单位为 1 米，完成后实测导出包围盒；不能仅修改单位显示就认为尺寸正确。glTF 标准规定线性单位为米、右手坐标系、`+Y` 向上、资产正面朝 `+Z`、左侧朝 `+X`。[G1]
3. **轴向只转换一次**：可在 Blender 以 `+Z` 为上、`-Y` 为前制作，启用导出 `Y Up` 转为 glTF 约定；验证前、上、左三个标记的方向。Three.js 端不要再凭经验补一个固定 90 度旋转。[B2][G1]
4. **统一根节点及变换**：资产根节点、地面接触/展示原点、前向和比例写入规范；应用网格缩放，避免负缩放和不均匀父级缩放。飞机建议将展示根原点与安装锚点分开。附加部件也按真实米制制作，不能为好看在运行时任意缩放。
5. **可动部件分层**：炮塔、旋翼、舱门等只有确需操作时才单独建节点；动画需导出为 glTF 支持的变换、形态键或骨骼动画。约束、程序材质和 Blender 特有节点不能假定由浏览器重现，必须烘焙或转换后验收。[B2]
6. **材质与纹理**：优先使用可被 glTF 导出的 PBR 材质；配置有限的纹理分辨率和材质数量。缩略图与浏览器中的模型都需显示真实资产，不能用渲染图代替交互模型的验收。

## 挂点从 Blender 传到浏览器

Blender 的 Empty 是有位置、旋转和父子关系、没有可渲染几何的节点，适合定义挂点。[B3] 将挂点放在对应机翼、机身或其他父节点下；需要随父部件运动时保留该层级。

启用导出器的 `Custom Properties`（Python 导出选项为 `export_extras=True`）后，自定义属性写入 glTF `extras`。Three.js `GLTFLoader` 将节点 `extras` 的对象字段合并进 `Object3D.userData`；无 mesh/camera 等内容的节点仍可加载为 `Object3D`。[B2][T2] glTF `extras` 本身没有本项目的业务语义，因此字段类型、版本及兼容规则需要项目自行规定。[G2]

建议挂点 Empty 使用稳定 ID，不把 Blender 节点名称或数组下标当唯一业务键。例如导出的节点 metadata 可为：

```json
{
  "name": "socket_left_outer",
  "extras": {
    "mapArmySchemaVersion": 1,
    "mapArmyNodeRole": "attachmentSocket",
    "socketId": "left_outer",
    "socketClass": "demo_external_mount"
  }
}
```

这是拟议 schema，`demo_external_mount` 不代表任何真实接口标准。挂点允许的 `attachmentId`、对称配对、互斥关系和所需转接件建议放在版本化资产清单中，与 GLB 节点 ID 做一致性校验；这能避免仅修改规则时重新制作模型。未知资产、未知挂点和未知规则应拒绝装配，不能自动当作兼容。

附加部件设独立的安装锚点。装配时让部件安装锚点与目标挂点位置和方向重合：若部件直接挂到插槽节点，其根变换为安装锚点相对部件根的逆变换。不要靠拖到“看起来差不多”的任意表面位置保存安装结果。坐标变换、ID、父子关系和 metadata 在导出后需自动读取核验。

**Empty 没有网格，不能直接期待鼠标射线命中。** 前端应给允许的挂点创建可拾取的代理几何或屏幕标记，并使用 `Raycaster.setFromCamera()` 加 `intersectObjects()` 计算目标。`Raycaster` 提供射线拾取能力，兼容性、吸附选择和装配提交仍是应用逻辑。[B3][T3]

## 详情展示与拖拽流程

建议在现有详情面板新增三维视图，按单个选中的要素懒加载资产。Three.js 的 `GLTFLoader` 用于加载，`OrbitControls` 提供旋转、缩放、平移及触摸操作；不需要在详情内启动完整 Cesium 地球。[T1][T4]

挂载操作应有完整状态：从部件列表拖出，进入预览后显示兼容挂点和部件预览，移至目标后吸附，松开时校验并一次性提交；移出、Esc、触控取消或选中要素变化时撤销本次临时状态。拖动部件期间暂停相机旋转，结束后恢复。已有部件要支持查看、替换和拆卸。

键盘和移动端同时提供“选择部件 -> 选择挂点 -> 安装”的操作路径。只读/锁定状态允许查看和相机操作，禁用装配提交；多选时不得隐式把装配应用到所有要素。

建议要素仅持久化 `modelId`、`assetVersion` 与 `attachments: [{ instanceId, socketId, attachmentId, assetVersion }]` 等小型业务数据，模型文件由资产清单定位，不把完整 GLB 塞进每个要素。保存前统一校验；刷新恢复、复制、撤销/重做、分享权限、版本冲突、旧数据迁移和型号切换时的挂载处理都属于功能交付范围。节点坐标以版本化资产为准，普通挂点装配无需持久化任意拖动坐标。

原生 MilX 是否保留新增装配数据必须另做兼容设计和往返验证；不能因为本项目 JSON 能保存，就宣称原站可读取。至少区分项目自有数据扩展与原站格式，并在丢失三维信息的导出路径给出明确结果。[P1]

## 加载、压缩和性能预算

以下是建议的初始验收预算，不是 Blender/Three.js 保证，也不是当前测量结果；需按选定设备调整：

| 指标 | 建议起点 |
| --- | --- |
| 单个常规详情资产下载量 | 含纹理的 GLB 目标 1-5 MiB；超出时说明原因并按需分级加载 |
| 单个部件下载量 | 目标 0.1-1 MiB，共享部件使用缓存 |
| 单资产几何量 | 常规详情 20k-80k 三角形；可挂部件合计额外不超过 40k；高复杂装备单独评审 |
| 纹理 | 默认 1K，确需近看细节时使用 2K；限制材质数并统计解码后纹理/GPU 内存 |
| 拖拽渲染 | 在列明设备上桌面目标 60 fps，移动端目标 30 fps，同时记录低分位帧率和加载停顿 |
| 首次可交互 | 在指定网络、冷缓存和实际资产上测量，先以 3 秒为目标；不把无纹理示意模型的时间当作生产基线 |

`GLTFLoader` 支持 Draco、Meshopt 网格压缩和 KTX2 纹理加载，但需要分别配置对应解码器；Blender 导出器提供 Draco 选项。[B2][T1] 建议根据实际文件选择一种网格压缩方式，纹理优化另行处理，避免把“小文件”直接等同于“小内存、快解码”。压缩和优化流程必须保留挂点、节点层级及 `extras`，不允许为合并 draw call 删除插槽节点。

仅进入三维详情时加载 Three.js 和模型，限制同时存在的预览实例；快速切换要素应防止旧请求覆盖新模型。设置有限资产缓存、失败重试和未映射状态，隐藏面板后停止无意义渲染。释放网格、材质、纹理和渲染器等 GPU 资源，并处理 GLTFLoader 文档特别提示的 ImageBitmap 释放问题。[T1] Cesium 与 Three.js 同时显示时需要实测 GPU/显存压力。

## 许可和资产来源

Blender 可免费用于商业目的；官方明确说明用 Blender 生成的图片、`.blend` 和其他数据文件属于创作者，其软件 GPL 许可不会自动使创作资产变为 GPL。[B4] 这只解决工具与原创输出的许可关系，不会赋予第三方模型、纹理、照片或设计资料的再分发权。

建议每个资产记录作者、来源 URL、来源版本、许可全文或许可证标识、必要署名、改动情况、能否随公开仓库及部署包再分发。购买模型时检查 Web/交互式三维展示和可下载资产交付权限；不得从其他仿真软件或游戏中提取模型当作免费资产。委托原创作品也应在交付合同中明确源文件、修改和发布权。

Blender 官方对公开发布的 Python API 插件/脚本另有 GPL 兼容性要求。[B4] 将来发布生成脚本时需核对其许可和引用代码；这与导出模型的许可分别记录，不能把 Blender 的许可文字直接套到整个前端项目。

## 质量与完整性交付

1. **目录覆盖**：先签定目标型号/类别清单，逐项记录真实型号、示意、不适用和未覆盖状态；只有通过审核的项计入分子。不得把自动批量生成的示意外形标为全量真实建模完成。
2. **单资产质量**：检查模型可识别性、参考资料、尺寸、正面/侧面/俯视、材质、法线、穿插、挂点位置与方向、导出版本、许可和缩略图。目标精度须以参考依据定义，例如相对尺寸误差阈值，而不是使用“高精度”空泛表述。
3. **自动检查**：运行 Khronos glTF Validator 并保存报告；它验证格式、引用、二进制数据等，不验证型号真实性。另检验自定义字段、挂点 ID 唯一性、部件兼容清单和资产预算。[G3]
4. **浏览器视觉**：在桌面/移动端用 Playwright 截图及 canvas 像素检查确认非空、模型完整入镜、旋转缩放有效、拖拽后挂件出现且位置正确；验证快速切换、资源失败、无 WebGL 和上下文丢失等状态。
5. **操作与数据**：验证合法/非法挂点、取消、重复安装、替换、拆卸、撤销/重做、锁定、只读、刷新、复制、分享和导入导出。型号/资产版本改变后不能保留悬空或失效的装配引用。
6. **项目交付**：未来实现迭代仍需满足项目的评审、`npm run ci`、Compose 验收和 PR/主线复核要求；本次评估与环境安装不能代替这些功能验收。[P1]

## 分阶段投入与待定边界

在一名熟悉现有代码的前端工程师、有明确资产规格且能获得合格示例资产的前提下，可以先按以下估算安排；这是工程估算，不是完成承诺：

| 阶段 | 输出与通过条件 | 条件性投入 |
| --- | --- | --- |
| 工具验证（本轮） | Blender 可运行，生成或读取模型，导出 GLB 并检查挂点 metadata；不实现应用 | 实测结果见下节 |
| 资产规范验证 | 一架代表性飞机及 2-3 种部件，打通导出、加载、坐标、挂点与优化验证；确定可复现规格 | 约 3-5 工程人日，前提是示例外形和资料已具备；不含高精度原创建模 |
| 详情与装配完整迭代 | 查看、拖拽、替代操作、完整状态校验、持久化、撤销、分享和往返边界、浏览器/Compose 验收 | 约 10-20 工程人日，资产格式稳定且现有存储/分享扩展无额外后端限制时；复杂版本迁移需重新估算 |
| 全量资产生产 | 依据正式清单逐项审核并发布，输出真实覆盖率 | 先由美术完成 3-5 个不同复杂度样本，测量建模、挂点、LOD、贴图和审查工时，再按型号数估算；尚无清单，无法负责任地给出全量总工期 |

开始全量生产前仍需明确：目标型号和变体清单、真实型号与示意级资产的允许比例、模型视觉/尺寸精度、资产自制或采购、目标浏览器和最低设备、是否需要自由装配/挂点装配/载运编制、是否将模型同步放入 Cesium 地图，以及三维信息在 MilX 交换中的保留方式。分阶段验证是降低估算不确定性，不是把局部完成包装成最终交付。

## 本机工具验证记录

本机 `blender --version` 返回 **Blender 4.3.2**，路径 `/usr/bin/blender`。
`npm run models:build` 已在后台模式成功生成三个 `.blend` 和三个 `.glb`，源码位于
[`assets/unit-models/`](../assets/unit-models/README.md)。源模型和 GLB 为原创类别示意，按 CC0-1.0 发布；生成脚本按 GPL-3.0-or-later 发布。

`npm run models:check` 使用 Khronos glTF Validator 和实际 Three.js GLTFLoader 检查：

| 资产 | GLB 字节 | 三角形 | 格式错误/警告 |
| --- | ---: | ---: | --- |
| 示意飞机 | 106044 | 3900 | 0 / 0 |
| 示意副油箱 | 26708 | 972 | 0 / 0 |
| 示意传感器 | 51428 | 1932 | 0 / 0 |

报告为 [`validation.json`](../assets/unit-models/validation.json)，含 SHA-256、实际包围盒、挂点坐标与 `extras`。
飞机尺寸为翼展 11.8 m、长度 13.6 m；这是示意约定，不是实装数据。`left_wing`、`right_wing`、`center`
通过 Empty 导出并被加载器识别；部件 `attachmentAnchor` 在原点，网格位于锚点下方。
Blender 输出过 Draco 库不可用提示；本轮使用未压缩 GLB，导出正常、校验通过，未启用 Draco。

前端新增 `Inspector` 的“三维模型”页签，Three.js 及资产按需加载。点要素可以显式关联示意飞机；
没有根据 SIDC 自动猜测真实装备型号。左右机翼接受两种示意部件，机腹仅接受传感器。
拖放挂点有临时半透明预览，点击部件再点击挂点提供替代路径；支持替换、拆卸、取消、重置视角和移除模型。
装配统一进入文档历史和保存路径；未知资产版本保留引用并提示无法解析。

锁定/只读允许查看和相机操作；三维地图保持只读，并可由点击军标打开详情。
项目 JSON、GeoJSON 自定义属性、分享及 MilX 私有扩展保留引用；KML 不保留装配并给出提示。
这些数据不代表原站支持三维装备装配。验收结果和剩余范围持续记录在本轮清单。

## 一手来源

- [B1] Blender 4.5 Manual, [Command Line Arguments](https://docs.blender.org/manual/en/4.5/advanced/command_line/arguments.html)：后台模式、Python 脚本、异常退出码、参数顺序。
- [B2] Blender 4.5 Manual, [glTF 2.0](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)：可导出对象、材质、动画、Y Up、Custom Properties/extras 与 Draco 压缩。
- [B3] Blender 4.5 Manual, [Empties](https://docs.blender.org/manual/en/4.5/modeling/empties.html)：无几何节点、变换及父子关系。
- [B4] Blender Foundation, [License](https://www.blender.org/about/license/)：软件用途、脚本许可与 Your Artwork 的输出权利说明。
- [G1] Khronos, [glTF 2.0 Specification: Coordinate System and Units](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc#coordinate-system-and-units)：坐标、方向、米制与角度。
- [G2] Khronos, [extras.schema.json](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/extras.schema.json)：应用特定字段，建议使用 JSON 对象。
- [G3] Khronos, [glTF Validator](https://github.com/KhronosGroup/glTF-Validator)：格式、引用、数据、图像和受支持扩展的检查及 JSON 报告。
- [T1] Three.js, [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)：GLB/glTF 加载、Draco/Meshopt/KTX2 解码器与 ImageBitmap 释放提示。
- [T2] Three.js, [GLTFLoader source](https://github.com/mrdoob/three.js/blob/master/examples/jsm/loaders/GLTFLoader.js)：`assignExtrasToUserData` 和节点加载。调研日读取的源码确认对象型 `extras` 合并至 `userData`；落地时需固定 Three.js 版本并做回归。
- [T3] Three.js, [Raycaster](https://threejs.org/docs/pages/Raycaster.html)：`setFromCamera`、`intersectObjects` 和距离排序。
- [T4] Three.js, [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html)：相机环绕、缩放、平移和触摸操作。
- [M1] map.army, [官方索引](https://www.map.army/doc/en/llms.txt)。
- [M2] map.army, [Symbol Gallery](https://www.map.army/doc/en/symbols/symbol-gallery/)：编制、装备/设施、战术图形、功能专用、METOC 等分类及 2525C 基线。
- [M3] map.army, [3D Map View](https://www.map.army/doc/en/map/3d_map_view/)：地图导航与图层显示行为；未将其作为装备详情/装配功能的证据。
- [P1] 项目规则与事实：[`PROJECT_MEMORY.md`](PROJECT_MEMORY.md)、[`TODO-original-site-audit-2026-09.md`](TODO-original-site-audit-2026-09.md) 及本文链接的本地实现。
