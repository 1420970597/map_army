# Mover Creator AMC 无 Qt 几何生成研究

日期：2026-09-14。工作区：`/root/map_army-mover`，研究范围仅为三维外形与可视化装配。依据本机 AFSIM 源码和全部 34 份 Vehicles AMC，未搜索互联网模型、未修改应用、未编译或提交转换器。

## 结论与推荐路径

最可靠的无 Qt 路径是抽取 `GeometryObjFile.cpp` 的低层 `Draw*` 网格函数及 `ObjPointCollection`，用独立 JSON 读取器准备纯数据参数，生成带部件名称的 OBJ 或网格中间产物，再用 Blender 后台模式输出 GLB。不要直接编译整个 `GeometryObjFile.cpp` 或实例化 `Vehicle/GeometryObject`：导出入口从主窗口单例取得当前车辆，而几何对象继承 `QObject`，AMC 加载也通过 Qt 控件赋值触发信号完成，依赖扩散很大。

可直接抽取的核心是 `GeometryObjFile.cpp:928` 到 `:4741`，这一低层区间只使用标量参数、STL、`GeometryBody` 两个形状枚举、`UtVec3dX`、`UtDCM`、`UtMath::cRAD_PER_DEG`、`ObjPointCollection` 和 `Obj*` 收集/变换方法；没有 Qt、OpenGL 或 `Vehicle` 调用。取代 GUI 的 driver 必须重现上层 Draw 分发中的参考点、对称和发动机依赖规则。

原 OBJ 导出仅包含发动机、翼面、dish、body/nacelle 和 canopy（[GeometryObjFile.cpp:100](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:100)）。完整默认 GUI 外观还需要加入 `GeometrySpeedBrake`：34 AMC 实际包含 7 个减速板定义，GUI 默认显示；低层形状很简单，可从 [GeometryGLWidget.cpp:9542](/root/afsim/swdev/src/mover_creator/source/GeometryGLWidget.cpp:9542) 提取箱体变换。内置 34 AMC 没有起落架几何对象，因此不应为“全内置覆盖”额外编造起落架。

## 34 个模型及实际几何覆盖

数据根目录是 `/root/afsim/swdev/src/mover_creator/data/Vehicles`。通过 Node `JSON.parse` 对所有 `.amc` 的 `geometry` 对象逐项统计；发动机优先根据 `EngineType` 判定，因为部分文件的 `GeometryObjectType` 为空。此规则与原 [LoadGeometryEngines](/root/afsim/swdev/src/mover_creator/source/GeometryWidget.cpp:2062) 一致。

Aircraft 17 个：`F-H4-21C-1`、`F-H4-22A-1`、`F-H4-22B-1`、`F-L4-11A-1`、`F-L4-11C-1`、`F-M5-12A-1`、`A-M4-22A-1`、`B-H1-80W-1`、`B-H3-81A-1`、`B-H4-40W-1`、`R-MJ-11A-1`、`E-HJ-41A-1`、`K-MJ-21A-1`、`C-HJ-41A-1`、`P-MJ-21A-1`、`D-L4-11V-1`、`D-L4-11Z-1`。

Weapon 17 个：`AIM-MR-1`、`AIM-SR-1`、`MIM-MR-1`、`RIM-MR-1`、`FIM-SR-1`、`AGM-CM-1`、`AGM-SR-1`、`BGM-CM-1`、`RGM-CM-1`、`UGM-CM-1`、`ADM-MR-1`、`AQM-MR-1`、`BQM-MR-1`、`GBU-S-1`、`MUN-B-1`、`MUN-R-1`、`TNK-370-1`。这是源文件顶层分类，包含副油箱等部件，不等于全部都应在页面标为导弹。

| 源对象类型 | 定义数，展开对称前 | 几何生成要求 |
| --- | ---: | --- |
| GeometryBody | 57 | 椭圆柱中段和前后外形，可水平对称 |
| GeometryFuselage | 17 | 与 Body 共用主体生成，另有 9 份启用 canopy |
| GeometryWing | 24 | Span 表示完整翼展；每侧使用 Span / 2，始终左右对称 |
| GeometrySurface | 111 | 单翼面、水平镜像、四片十字或 X 字翼面 |
| GeometryNacelle | 29 | 中空圆/半圆/斜切进气道，保留内外壁、厚度与尾段 |
| GeometryEngine | 40 | 根据 EngineType/EngineModel 读取独立配置中的外形尺寸 |
| GeometryDish | 1 | `E-HJ-41A-1` 的扁椭球外形 |
| GeometrySpeedBrake | 7 | 简单箱体，GUI 默认显示，原 OBJ 导出遗漏 |
| GeometryPointMass | 87 | 没有实体外形尺寸，仅有点/质量元数据；GUI 使用辅助图标 |
| GeometryMassProperties | 34 | 非实体外形数据 |
| GeometryPropulsionData | 34 | 非实体外形数据；GUI fuel-tank 辅助图标不代表真实油箱外形 |

全部 AMC 共 441 个 geometry 定义。最后三种属于辅助/非实体配置，不能为其捏造真实外形。GUI 的点质量和燃油辅助显示默认关闭，而减速板默认打开，见 [GeometryGLWidget.hpp:675](/root/afsim/swdev/src/mover_creator/source/GeometryGLWidget.hpp:675)；图标大小由车辆最小尺寸乘 0.35 推出，见 [DrawFuelTanks](/root/afsim/swdev/src/mover_creator/source/GeometryGLWidget.cpp:4058) 和 [DrawPointMasses](/root/afsim/swdev/src/mover_creator/source/GeometryGLWidget.cpp:4146)。

### Body/Fuselage 外形

Body 前端实际使用 Ogive 25、Round 31、Blunt 1；Body 后端使用 BoatTail 12、Ogive 27、Round 10、Blunt 8。Fuselage 前端 Ogive 13、Round 4；后端 Ogive 8、BoatTail 7、Round 1、Cone 1。因此需要完整实现 Round、Ogive、Cone、Blunt、BoatTail 五种分段规则。枚举映射见 [GeometryBody.cpp:46](/root/afsim/swdev/src/mover_creator/source/GeometryBody.cpp:46)，组合位置见 [GeometryObjFile.cpp:2149](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:2149)。

- Body 参考点在整体长度中心，局部前端朝 +X；中段从 `-Length/2 + AftLength` 延伸到 `Length/2 - ForwardLength`。
- 横截面 Width 为 Y 方向全宽，Height 为 Z 方向全高，截面是椭圆；原算法沿四个高度区间各取 10 点组成 40 点环，并非等角圆环。[DrawBodyCylinder:1113](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:1113)
- Ogive 使用纵向/半径比例 `(0,1)、(0.3,0.9)、(0.55,0.7)、(0.8,0.4)、(1,0.001)`；不要误用文件开头另一个 `mOgivePts` 数组代替这组实际 body 采样。[DrawBodyOgive:1226](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:1226)
- Round 使用归一化纵向站位 `0、0.2、0.4、0.6、0.8、0.9、0.999`，半径比例为 `sqrt(1 - x*x)`；是椭球头段。[DrawBodySphere:1569](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:1569)
- Cone、Blunt、BoatTail 分别为锥段、封口和收缩至指定 `Aft Shape Diameter` 的尾段。Aft Blunt 必须将尾段长度按 0 处理，再生成中段。[DrawBodiesAndNacelles:788](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:788)
- Canopy 是前后均 Ogive 的附加 Body。`Canopy Ref X/Y/Z` 是机身参考系中的局部偏移，经机身 yaw/pitch/roll 转到全局后再加机身 Reference Point，不能直接当全局位置。[DrawCanopy:875](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:875)

本轮对全部 Body/Fuselage 检查后，没有发现会触发原 `frontLength + rearLength >= length` 跳过条件的内置输入。

### Nacelle 外形

实际 Overall Shape 为 Rounded 11、Half-Round-Top 4、Half-Round-Bottom 8、Half-Round-Right 2、Flat-Swept-Right 3、Flat-Swept-Left 1；Aft Section Shape 为 Tapered 18、Blunt 11。原分发还支持 Half-Round-Left、Flat-Sided，支持自定义 AMC 时可一并保留。[DrawNacelle:4655](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:4655)

应保留 Length、Width、Height、Height (Inner/Outer)、Thickness、Forward Sweep Length、Aft Section Length，以及方向。不能统一替换成实心圆柱；半圆和斜切形状是部分飞机外观的关键特征。原 Flat-Sided 函数只调用 `DrawBoxWithHole`，没有使用尾段和前掠参数，应在转换报告中注明源算法局限。[DrawFlatSidedNacelle:4361](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:4361)

### 发动机外形依赖

40 个发动机实例引用 28 份唯一 `data/Engines/<EngineType>/<EngineModel>.amc`；本轮逐项检查全部存在，且 Length、Diameter 均为正。只需读取 Length、Diameter、ThrustOffset 这些视觉字段，不需要实现配置中的性能计算。[LoadEngineLengthDiameterThrustOffset:2320](/root/afsim/swdev/src/mover_creator/source/GeometryWidget.cpp:2320)

原 DrawEngine 先将参考点沿发动机局部 -X 偏移半长度，再绘制圆柱；`ThrustOffset` 足够靠后时会追加一段同直径圆柱。这些偏移必须在 yaw/pitch/roll 下旋转。[DrawEngine:2483](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:2483)

## 坐标、单位、参考点

AMC 位置和外形尺寸为英尺，角度为度。Reference Point 控件明确标注 ft：[GeometryObject.cpp:129](/root/afsim/swdev/src/mover_creator/source/GeometryObject.cpp:129)；Body getter 用 `_ft` 和 `_deg` 区分：[GeometryBody.hpp:54](/root/afsim/swdev/src/mover_creator/source/GeometryBody.hpp:54)。

源坐标为 +X forward、+Y right、+Z down，见 [UtVec3dX.cpp:25](/root/afsim/swdev/src/tools/util/source/UtVec3dX.cpp:25)。GUI 和 OBJ 网格使用 `(renderX, renderY, renderZ) = (sourceX, -sourceZ, sourceY)`，因此 render 的 +Y 向上；例见 [DrawSurface:2544](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:2544)。

推荐 GLB 保持这一右手 Y-up 朝向并将所有坐标乘 `0.3048` 转米。若下游需要统一朝 -Z 的模型库，只在资产根节点再做一次明确旋转；模型网格、部件锚点、挂点必须应用完全相同变换。原 OBJ 仍为英尺，原程序另在 AFSIM `models.txt` 写 `rotate x 180` 和 `scale 0.3048`，见 [GeometryObjFile.cpp:5088](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:5088)。这个面向 AFSIM 下游的额外 X 旋转不能未经确认再次套到 Three.js Y-up 场景。

Body/Nacelle 按原矩阵顺序 `T(x,-z,y) * R(-Y,yaw) * R(+Z,pitch) * R(+X,roll)`；Surface 为 `T(x,-z,y) * R(-X,dihedral) * R(+Z,incidence)`。翼面参考点是根部四分之一弦点，根部前缘 `rootChord * 0.25`，尖端前缘再后移 `span * tan(sweep)`。这是 Draw 函数的实际视觉规则，不能改用其他几何/面积计算函数中的四分之一弦后掠假设。[DrawSurface:2528](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:2528)

不建议在转换时重新计算重心或自动移动 AMC 的 Reference Point。保留文件的参考系，仅为预览相机计算包围盒和取景中心；否则装配位置会随重新居中发生漂移。

## 对称与翼型视觉规则

- GeometryWing 的 Span 是完整翼展，每侧为 `Span/2`，`IsSymmetrical()` 恒 true。[GeometryObjFile.cpp:559](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:559)、[GeometryWing.hpp:104](/root/afsim/swdev/src/mover_creator/source/GeometryWing.hpp:104)
- 普通 GeometrySurface 的 Span 是单侧长度。水平对称位置为 `yOther = 2*symmetryY - y`；另一侧 `dihedral = -180 - dihedral`，`incidence = -incidence`。Vertical 为 `zOther = 2*symmetryZ - z`，另一侧 `dihedral = -dihedral`、`incidence = -incidence`。[DrawWingsAndSurfaces:681](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:681)
- 内置 Surface 的 Symmetry Type：Horizontal 63、Single 30、X Pattern 16、+ Pattern 2。四片模式取 `theta = 0/45 + 90*k`，位置为 `(x, y + FinRefRadius*cos(theta), z - FinRefRadius*sin(theta))`，dihedral 为 theta。不要忽略半径直接把四片叠在中心。[GeometryObjFile.cpp:634](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:634)
- GUI 的 Quad Control Fins Pattern 变更会同步 Symmetry Type；用于渲染的最终规则是 Symmetry Type。自定义数据两字段冲突时要显式规范化并报告，不能无提示采用另一份。[GeometrySurface.cpp:808](/root/afsim/swdev/src/mover_creator/source/GeometrySurface.cpp:808)
- Body/Engine 的水平对称位置相同，镜像实例 yaw 和 roll 取反、pitch 不变。Nacelle 的 Half-Round-Right/Left、Flat-Swept-Right/Left 另用 `rollOther = 180 - roll`；其他形状为 `-roll`。[DrawBodiesAndNacelles:850](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:850)
- 默认对称平面坐标为 0。源 GUI 平移整个几何时会同时平移对称平面，但 AMC 样本并无这些平面字段，不能把每个部件自己的 Reference Point Y 当作镜像平面。[GeometrySurface.hpp:267](/root/afsim/swdev/src/mover_creator/source/GeometrySurface.hpp:267)
- 可视化网格使用同一组七点对称翼型：`X=[0,.05,.15,.25,.5,.75,1]`，半厚度权重 `Y=[0,.5,.875,1,.875,.625,0]`，实际半厚度为 `.5 * ThicknessRatio * chord * Y`。GUI 与 OBJ 均使用此固定轮廓；不会按 Airfoil 文件加载不同弯度。[GeometryObjFile.cpp:47](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:47)、[GeometryGLWidget.cpp:7109](/root/afsim/swdev/src/mover_creator/source/GeometryGLWidget.cpp:7109)
- AMC 涉及的翼型名称共 10 个：NACA-64012、NACA-653018、NACA-0012、NACA-64206、NACA-6716、NACA-633218、NACA-63409、BAC-3XX、NASA-SC20412、BAC-4XX。对齐现有视觉外观时无需解析它们的性能数据。Invert Airfoil 的 GUI 控件被禁用并标明未来实现，全部内置值也为 false。[GeometrySurface.cpp:237](/root/afsim/swdev/src/mover_creator/source/GeometrySurface.cpp:237)
- 原 OBJ 的 `aNumSpanElements` 参数不参与实体网格生成；GUI 只在线框叠加时用它画网格及控制面边界。实体翼面是根尖轮廓间的六组上下面四边形。不要将 Num Aero Sections 当作需要真实分段/铰链的实体结构。[GeometryGLWidget.cpp:7415](/root/afsim/swdev/src/mover_creator/source/GeometryGLWidget.cpp:7415)

本轮几何仅用静态中立姿态。原上层 DrawWingsAndSurfaces 从 `VehicleAero` 获取控制角，独立视觉 driver 可明确设为 0，保留 AMC incidence；不要引入 VehicleAero 或相关仿真计算。

## 能否抽取为独立 executable，以及最小依赖

可以，建议分为三个较小边界：

1. `amc-reader`：成熟 JSON parser 读取 geometry；识别 EngineType；校验数值；解析发动机外形依赖；生成命名部件清单和展开对称实例的纯视觉参数。保留源文件 ID/部件名，不实例化 QObject。
2. `mover-mesh`：原低层 Draw 函数、ObjPointCollection、形状枚举、向量/矩阵和网格收集器。生成带命名对象的 OBJ/MTL，或直接输出位置/法线/索引数据。
3. `glb-pack`：Blender 后台或成熟 glTF 库读取网格，三角化、米制化，保留命名部件节点和装配锚点，输出 GLB。Blender 原生不解析 AMC，作用在网格生成之后或作为明确实现过的网格写入宿主。

最小运行依赖为 C++ 标准库、JSON parser，以及 Vec3/3x3 或 4x4 变换实现；无需 Qt、OpenGL 上下文、OpenSceneGraph、P6DOF、完整 AFSIM util 库。ObjPointCollection.hpp 中包含 Vehicle.hpp，但实际 ring/collection 实现并未使用 Vehicle，可去除该 include。`UtCast.hpp` 仅用于 `ut::npos`，可以替换为明确的 size_t 无效索引。

如果保留 `UtVec3dX/UtDCM` 原接口，可只提取所用方法（Set、XYZ、加减、标量乘除、Cross、Normalize、矩阵乘法、Euler 构造和 InverseTransform），或用成熟 math 库适配这些接口。不要直接链接完整 `UtDCM.cpp`：它会额外拉入 UtEntity、UtInertiaTensor、UtQuaternion、UtLog；完整 `UtVec3dX.cpp` 也会拉入 Quaternion/Log。其 Euler 矩阵的权威定义是 [UtEntity.cpp:2151](/root/afsim/swdev/src/tools/util/source/UtEntity.cpp:2151)，InverseTransform 为转置矩阵作用；抽取/适配后必须对照此定义验证方向和乘法顺序。

`GeometryBody::ForwardShapeType/AftShapeType` 可移入纯枚举头而不包含原 GeometryBody.hpp，避免其 Qt 类继承。[GeometryBody.hpp:34](/root/afsim/swdev/src/mover_creator/source/GeometryBody.hpp:34)

`Obj*` 方法自身记录 vertices/normals/faces，无需 OpenGL。将 `ut::log` 改为结构化错误并由 CLI 返回非零状态；输出可使用 std::ostream。原 `OutputVertices` 仅输出 3 位小数，应提高精度以免小部件和安装点损失精度。[GeometryObjFile.cpp:428](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:428)

## 抽取时必须补齐的边界

- 原 `ObjPushMatrix` 只保存旋转矩阵，`ObjTranslated` 覆盖平移，`ObjPopMatrix` 清零平移，并非完整 OpenGL 变换栈。原几何调用大多按这一限制排列；加入减速板的第二次局部平移或装配层级前，应使用真正的仿射变换栈，并与原低层函数输出核对。[GeometryObjFile.cpp:4743](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:4743) 具体失配是 `push → translate(parent) → push → rotate(child) → pop` 后父级平移丢失；`translate(parent) → rotate → translate(local)` 后则既未累加父级平移，也未旋转局部平移，并使 `mNumTranslations > 1`，导致 ObjEnd 拒收面。要保存/恢复完整 4×4 矩阵，局部平移按 `M = M * T` 合成，法线只用旋转（有缩放时为逆转置）并归一化；不要只修计数器掩盖变换问题。
- 原 DrawNacelle 在推入矩阵后遇到尾段长度过长直接 return，没有 pop；本轮 29 个内置输入均未触发，但自定义 AMC 需要先校验或用作用域恢复矩阵。[GeometryObjFile.cpp:4689](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:4689)
- 原 OBJ 将所有内容放一个 group、一个不透明灰色材质，没有纹理。要支持拆装，driver 应每个部件/对称实例输出独立命名对象，而非把整机压成一块。原源库是参数化外形，贴图缺失不能通过互联网补模型冒充完整支持。[GeometryObjFile.cpp:136](/root/afsim/swdev/src/mover_creator/source/GeometryObjFile.cpp:136)
- 7 个减速板需要 GUI 的 `DrawBox` 和 `DrawSpeedBrake` 补充，厚度为 `0.04 * min(length,width)`；变换为参考点、roll、`-Z` 轴 Max Angle，然后局部 X 后移半长。可将折叠/展开仅作为视觉状态，不实现动作性能。[GeometryGLWidget.cpp:9542](/root/afsim/swdev/src/mover_creator/source/GeometryGLWidget.cpp:9542)
- 不用忽略未知几何类型来满足全覆盖。34 个内置文件应全部生成逐部件报告，给出生成/元数据辅助/不支持/无效输入状态，并对后两者验收失败。

## 验证建议

先固定上述源文件哈希和全部 AMC 的几何清单，再对抽取器做有意义的数值验证：原低层函数与独立实现的顶点/法线/包围盒、左右镜像、X/+ 模式、非零 yaw/pitch/roll、canopy 局部偏移、半翼展和英尺转米。随后对 34 个 GLB 全部运行 glTF 校验、有限数值/非空三角形检查，并在浏览器生成统一三视图及斜视角截图。特殊样本至少包括双进气道、canopy、唯一 dish、四片翼面、带尾锥机身、减速板及 TNK-370-1。

当前研究已确认解析范围、实际外形种类、发动机依赖和提取边界；没有编译 headless executable 或生成全部 GLB，因此不宣称转换器已可用。研究期间只创建本文件。
