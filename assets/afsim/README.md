# AFSIM 三维模型索引与嵌入资产

`import_models.py` 读取本机 `/root/afsim/afsim2.9-data/resources/models/models.txt`，生成
`public/models/afsim/manifest.json`。manifest 保留模型名、类别、变体、原始路径、变换、`wing_tip`、发动机
元数据和分发状态，用于页面自动识别类型和展示可用性。

仅转换并嵌入 `distribution_notes.txt` 明确允许外部再分发且可归属的六个 NASA/Celestia 模型：
Cubesat、Cubesat2、Rocket、Rosetta Satellite、Space Shuttle Atlantis、STEREO Satellite。原始 OSGB
不复制到仓库；受限制模型保留索引但标记 `restricted`，只能在 AFSIM 工具集或获得授权的受控部署中使用。

AFSIM `models.txt` 没有通用 hardpoint/pylon/station 字段。manifest 的 `sockets` 和 `attachments` 因此默认为空；
页面会显示“无挂载点”，不会把 `wing_tip` 或 engine 伪装成武器挂点。获得模型授权和挂点测绘后，可在 manifest
中补充 sockets/attachments。

转换依赖 Debian OpenSceneGraph 的 `osgconv` 和 Blender：

```sh
osgconv input.osgb output.obj
blender --background --python <conversion-script>
python3 assets/afsim/import_models.py
```

`import_models.py` 只生成索引，不会读取或复制受限原始模型。
