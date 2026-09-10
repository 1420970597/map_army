# 军标关联示意资产

这些资产是原创类别示意模型，不对应任何真实装备型号，尺寸和插槽均为演示约定。
Blender 源文件坐标：米制，+Z 上、-Y 前；GLB：+Y 上、+Z 前、+X 左。

生成：`blender --background --python-exit-code 1 --python assets/unit-models/build_models.py`。
输出：本目录的 `.blend` 与 `public/models/demo-v1/` 的 `.glb`。
脚本许可 GPL-3.0-or-later；原创生成资产（网格、材质、GLB、blend）以 CC0-1.0 发布：
https://creativecommons.org/publicdomain/zero/1.0/ 。没有使用第三方纹理或模型。

飞机 `demo-aircraft@1` 的挂点 `left_wing`、`right_wing` 接受 `demo-tank@1` 和
`demo-sensor@1`；`center` 只接受 `demo-sensor@1`。这是可视化规则，不是实际装备兼容性。
挂点与安装锚点通过 Empty 的 `extras` 导出；部件安装锚点位于本地原点。
尺寸、坐标、元数据与格式检查见 `validation.json`。
