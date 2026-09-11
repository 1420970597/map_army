# SPDX-License-Identifier: GPL-3.0-or-later
"""用 Blender 后台生成原创示意资产；导出模型按 CC0-1.0 发布。"""

import math
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'public' / 'models' / 'demo-v1'
SOURCE = ROOT / 'assets' / 'unit-models'


def material(name, color, metallic=0.0, roughness=0.5):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    return result


def reset(model_id):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1
    root = bpy.data.objects.new(model_id, None)
    bpy.context.collection.objects.link(root)
    root['modelId'] = model_id
    root['assetVersion'] = '1'
    root['mapArmySchemaVersion'] = 1
    return root


def ellipsoid(name, position, scale, mat, parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.parent = parent
    return obj


def prism(name, outline, bottom, top, mat, parent):
    vertices = [(x, y, bottom) for x, y in outline] + [(x, y, top) for x, y in outline]
    n = len(outline)
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def socket(name, position, parent, role='attachmentSocket'):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    obj.parent = parent
    obj.empty_display_type = 'ARROWS'
    obj.empty_display_size = 0.5
    obj['mapArmySchemaVersion'] = 1
    obj['mapArmyNodeRole'] = role
    if role == 'attachmentSocket':
        obj['socketId'] = name
        obj['socketClass'] = 'demo_external_mount'
    return obj


def export(name):
    # Blender 的 -Y 前向、+Z 上向仅在导出器中转成 glTF 的 +Z 前向、+Y 上向。
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / f'{name}.blend'))
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT / f'{name}.glb'), export_format='GLB',
        export_yup=True, export_extras=True, export_cameras=False, export_lights=False,
    )


OUTPUT.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
body = material('机身涂装', (0.28, 0.37, 0.42), 0.3)
wing = material('机翼涂装', (0.46, 0.55, 0.60), 0.3)
glass = material('座舱罩', (0.045, 0.18, 0.25), 0.6, 0.16)
dark = material('发动机与光学窗口', (0.055, 0.065, 0.08), 0.5)
accent = material('示意标记', (0.95, 0.55, 0.12))

root = reset('demo-aircraft')
ellipsoid('机身', (0, 0, 0.6), (0.85, 6.8, 0.8), body, root)
ellipsoid('座舱', (0, -3.1, 1.2), (0.58, 1.65, 0.48), glass, root)
for side in (-1, 1):
    outline = [(side * x, y) for x, y in [(0.65, -1.6), (5.9, 1.8), (5.9, 2.6), (0.65, 1.7)]]
    if side < 0:
        outline.reverse()
    prism('主翼', outline, 0.25, 0.45, wing, root)
    tail = [(side * x, y) for x, y in [(0.5, 3.9), (2.6, 5.6), (2.6, 6.2), (0.5, 5.6)]]
    if side < 0:
        tail.reverse()
    prism('水平尾翼', tail, 0.6, 0.75, wing, root)
    ellipsoid('发动机', (side * 0.65, 4.5, 0.45), (0.46, 1.35, 0.48), dark, root)
# 垂直尾翼从平面轮廓旋转为立面，网格尺寸仍按米保留。
fin = prism('垂直尾翼', [(3.5, 0.8), (5.1, 3.0), (5.9, 3.0), (6.0, 0.8)], -0.09, 0.09, body, root)
fin.rotation_euler = (math.pi / 2, 0, math.pi / 2)
socket('left_wing', (3.0, 0.7, 0.2), root)
socket('right_wing', (-3.0, 0.7, 0.2), root)
socket('center', (0, -0.8, -0.2), root)
export('aircraft')

root = reset('demo-tank')
ellipsoid('副油箱', (0, 0, -0.52), (0.36, 1.7, 0.36), wing, root)
prism('连接支架', [(-0.08, -0.4), (0.08, -0.4), (0.08, 0.4), (-0.08, 0.4)], -0.45, 0, body, root)
socket('mount_anchor', (0, 0, 0), root, 'attachmentAnchor')
export('tank')

root = reset('demo-sensor')
ellipsoid('传感器吊舱', (0, 0, -0.45), (0.29, 1.05, 0.3), body, root)
ellipsoid('光学窗口', (0, -0.87, -0.45), (0.25, 0.24, 0.25), glass, root)
prism('连接支架', [(-0.07, -0.3), (0.07, -0.3), (0.07, 0.3), (-0.07, 0.3)], -0.4, 0, accent, root)
socket('mount_anchor', (0, 0, 0), root, 'attachmentAnchor')
export('sensor')

# 独立的装甲车辆类别示意模型，作为页面模型库中的可选主模型。
root = reset('demo-armored-vehicle')
prism('车体', [(-1.25, -2.2), (1.25, -2.2), (1.25, 2.2), (-1.25, 2.2)], 0, 1.1, body, root)
prism('上装甲', [(-0.95, -1.35), (0.95, -1.35), (0.95, 1.35), (-0.95, 1.35)], 1.1, 1.65, wing, root)
ellipsoid('炮塔', (0, 0, 1.85), (0.75, 0.85, 0.45), dark, root)
prism('炮管', [(-0.12, -2.1), (0.12, -2.1), (0.12, -0.2), (-0.12, -0.2)], 1.8, 2.05, dark, root)
for side in (-1, 1):
    ellipsoid('履带', (side * 1.35, 0, 0.55), (0.34, 2.3, 0.55), dark, root)
export('vehicle')
