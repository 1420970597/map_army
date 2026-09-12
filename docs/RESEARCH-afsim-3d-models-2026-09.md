# AFSIM 三维模型接入审计（2026-09-12）

## 扫描结果

扫描来源为本机 `/root/afsim/afsim2.9-data/resources/models` 与 `models.txt`：

- `models.txt` 有 325 个模型定义、242 个唯一模型名、305 个文件引用。
- `3d/` 有 167 个 OSGB，约 659 MB；`simple/` 有 202 个 OSGB，约 4.2 MB。
- 另有一个 IVE 和一个 OBJ/MTL；没有可直接给浏览器使用的 glTF/GLB。
- 类型由 `category` 和名称组合识别，覆盖航空器、直升机、无人机、地面装备、发射/雷达、舰船、武器和航天器。
- `models.txt` 的 `wing_tip`、`engine` 和 `pre_xform` 已进入索引；AFSIM 没有通用 hardpoint/pylon/station 字段。

## 分发边界

`distribution_notes.txt` 禁止把 45 个模型及其变体带出 AFSIM 工具集，包含大量 F-16/F-15/F-22/F-35、导弹、轰炸机和卫星模型。因此本项目不复制或转换这些受限 OSGB，也不把它们伪装成网页可用模型。

允许外部再分发且需要署名的六个模型已通过 `osgconv → OBJ → Blender → GLB` 转换并嵌入：Cubesat、Cubesat2、Rocket、Rosetta Satellite、Space Shuttle Atlantis、STEREO Satellite。署名保存在 `public/models/afsim/manifest.json`。

## 当前实现

- `assets/afsim/import_models.py` 解析 AFSIM 索引，生成完整页面目录和自动类型字段。
- `src/core/model/afsimCatalog.ts` 将目录编译进前端；详情页按类型筛选可嵌入模型。
- `public/models/afsim/` 只包含六个许可模型的 GLB 和目录，不含受限 OSGB。
- 页面选择后仍使用现有 Three.js 预览和文档撤销历史。
- AFSIM 没有武器硬点定义，因此这些模型当前显示为空挂点；`wing_tip` 只保留为参考元数据，不被伪装成武器挂点。

## 后续工作

获得明确再分发授权和硬点测绘数据后，才能补充更多模型及 sockets/attachments；在此之前不能把 AFSIM 全量资产描述为已完整嵌入。
