"""Blender 独立进程将 OBJ 几何转换为浏览器 GLB。"""

import sys
from pathlib import Path

import bpy

folder = Path(sys.argv[sys.argv.index("--") + 1])
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.wm.obj_import(filepath=str(folder / "source.obj"))
bpy.ops.export_scene.gltf(filepath=str(folder / "model.glb"), export_format="GLB", export_extras=True)
