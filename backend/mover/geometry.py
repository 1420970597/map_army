"""AMC 无损参数到原生几何命令；输出 X 前、Y 上、Z 右的米制 GLB。"""

import copy
import io
import json
import math
import os
import struct
import subprocess
import zipfile
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).with_name("data")
KINDS = {
    "Geometry" + kind
    for kind in (
        "Body",
        "Fuselage",
        "Wing",
        "Surface",
        "Engine",
        "Nacelle",
        "Dish",
        "SpeedBrake",
        "LandingGear",
        "PointMass",
        "MassProperties",
        "PropulsionData",
    )
}
NON_VISUAL = {"GeometryPointMass", "GeometryMassProperties", "GeometryPropulsionData"}
FORWARD = ["Cone", "Ogive", "Round", "Blunt"]
AFT = ["Cone", "Ogive", "Round", "BoatTail", "Blunt"]
SHAPES = [
    "Rounded",
    "Half-Round-Right",
    "Half-Round-Left",
    "Half-Round-Top",
    "Half-Round-Bottom",
    "Flat-Sided",
    "Flat-Swept-Right",
    "Flat-Swept-Left",
]


@lru_cache
def catalog():
    return json.loads((DATA / "catalog.json").read_text())


def template(kind, identifier):
    entry = next((e for e in catalog() if e["kind"] == kind and e["id"] == identifier), None)
    if not entry:
        raise ValueError("模板不存在：" + identifier)
    raw = (DATA / entry["path"]).read_text()
    return json.loads(raw) if kind != "airfoil" else raw


def component_kind(g):
    return g.get("GeometryObjectType") or ("GeometryEngine" if g.get("EngineModel") else "")


def number(g, field, default=0):
    value = g.get(field, default)
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or abs(value) > 1e6
    ):
        raise ValueError("有限数值超出范围：" + field)
    return value


def positive(g, field):
    value = number(g, field)
    if value <= 0:
        raise ValueError(field + " 必须大于零")
    return value


def dependency(bundle, kind, identifier):
    custom = bundle.get("dependencies", {}).get(kind, {}).get(identifier)
    return custom if custom is not None else template(kind, identifier)


def resolved_bundle(bundle):
    """版本快照自包含依赖，后续目录更新不会改变历史设计。"""
    result = copy.deepcopy(bundle)
    result.setdefault("dependencies", {})
    for g in result["amc"]["geometry"].values():
        for kind, field in [("engine", "EngineModel"), ("airfoil", "Airfoil")]:
            if g.get(field):
                value = dependency(result, kind, g[field])
                result["dependencies"].setdefault(kind, {})[g[field]] = value
    return result


def rotate_ecs(p, yaw, pitch, roll):
    y, t, r = (math.radians(v) for v in (yaw, pitch, roll))
    x, a, b = p
    a, b = a * math.cos(r) - b * math.sin(r), a * math.sin(r) + b * math.cos(r)
    x, b = x * math.cos(t) + b * math.sin(t), -x * math.sin(t) + b * math.cos(t)
    return [x * math.cos(y) - a * math.sin(y), x * math.sin(y) + a * math.cos(y), b]


def commands(bundle):
    amc = bundle.get("amc")
    if (
        not isinstance(amc, dict)
        or not isinstance(amc.get("geometry"), dict)
        or not 1 <= len(amc["geometry"]) <= 300
    ):
        raise ValueError("AMC 需要 1 至 300 个有效组件")
    result, nonvisual = [], []

    def add(name, kind, args):
        result.append({"name": name, "kind": kind, "args": args})

    for name, g in amc["geometry"].items():
        if not isinstance(name, str) or not 1 <= len(name) <= 160 or not isinstance(g, dict):
            raise ValueError("组件名称或参数无效")
        kind = component_kind(g)
        if kind not in KINDS:
            raise ValueError("不支持的组件类型：" + str(kind))
        ref = g.get("Reference Point", {})
        p = [number(ref, axis) for axis in ("x", "y", "z")]
        if kind in NON_VISUAL:
            nonvisual.append(
                {"name": name, "kind": kind, "position": [p[0] * 0.3048, -p[2] * 0.3048, p[1] * 0.3048]}
            )
            continue
        yaw, pitch, roll = (number(g, axis + " Angle") for axis in ("Yaw", "Pitch", "Roll"))
        sy, sz = number(g, "Symmetry Horizontal Y"), number(g, "Symmetry Vertical Z")
        variants = [(p, yaw, pitch, roll)]
        if g.get("Symmetrical"):
            variants.append(([p[0], 2 * sy - p[1], p[2]], -yaw, pitch, -roll))
        if kind in ("GeometryBody", "GeometryFuselage"):
            length, height, width = (positive(g, f) for f in ("Length", "Height", "Width"))
            front, aft = g.get("Forward Shape", "Ogive"), g.get("Aft Shape", "Blunt")
            if front not in FORWARD or aft not in AFT:
                raise ValueError("机身端部形状无效")
            fl = 0 if front == "Blunt" else number(g, "Forward Shape Length")
            al = 0 if aft == "Blunt" else number(g, "Aft Shape Length")
            if fl < 0 or al < 0 or fl + al >= length:
                raise ValueError(name + "：前后段长度之和必须小于总长")
            for q, y, t, r in variants:
                add(
                    name,
                    "body",
                    [
                        *q,
                        length,
                        height,
                        width,
                        FORWARD.index(front),
                        fl,
                        AFT.index(aft),
                        al,
                        number(g, "Aft Shape Diameter"),
                        y,
                        t,
                        r,
                    ],
                )
                if kind == "GeometryFuselage" and g.get("Canopy Present"):
                    c = rotate_ecs([number(g, "Canopy Ref-" + a) for a in ("X", "Y", "Z")], y, t, r)
                    cl, ch, cw = (positive(g, "Canopy " + f) for f in ("Total Length", "Height", "Width"))
                    cf, ca = number(g, "Canopy Forward Length"), number(g, "Canopy Aft Length")
                    if cf < 0 or ca < 0 or cf + ca >= cl:
                        raise ValueError("座舱前后段长度无效")
                    add(
                        name, "body", [*[q[i] + c[i] for i in range(3)], cl, ch, cw, 1, cf, 1, ca, 0, y, t, r]
                    )
        elif kind in ("GeometryWing", "GeometrySurface"):
            span = positive(g, "Span") * (0.5 if kind == "GeometryWing" else 1)
            root, tip = positive(g, "Root Chord"), number(g, "Tip Chord")
            sweep, dihedral, incidence = (number(g, f + " Angle") for f in ("Sweep", "Dihedral", "Incidence"))
            thickness = positive(g, "Thickness Ratio")
            if tip < 0 or abs(sweep) >= 89 or thickness > 1:
                raise ValueError("翼面弦长、后掠角或厚度无效")
            symmetry = "Horizontal" if kind == "GeometryWing" else g.get("Symmetry Type", "Single")
            surfaces = [(p, dihedral, incidence)]
            if symmetry == "Horizontal":
                surfaces.append(([p[0], 2 * sy - p[1], p[2]], -180 - dihedral, -incidence))
            elif symmetry == "Vertical":
                surfaces.append(([p[0], p[1], 2 * sz - p[2]], -dihedral, -incidence))
            elif symmetry in ("X Pattern", "+ Pattern"):
                surfaces = []
                radius = number(g, "Fin Ref Radius")
                for angle in range(45 if symmetry == "X Pattern" else 0, 360, 90):
                    rad = math.radians(angle)
                    surfaces.append(
                        (
                            [p[0], p[1] + radius * math.cos(rad), p[2] - radius * math.sin(rad)],
                            angle,
                            incidence,
                        )
                    )
            elif symmetry != "Single":
                raise ValueError("翼面对称类型无效")
            if g.get("Airfoil"):
                dependency(bundle, "airfoil", g["Airfoil"])
            for q, d, i in surfaces:
                add(name, "surface", [*q, span, sweep, root, tip, thickness, d, i])
        elif kind == "GeometryEngine":
            engine = dependency(bundle, "engine", g.get("EngineModel", ""))
            if engine.get("engine_type") != g.get("EngineType"):
                raise ValueError("发动机类别与依赖不一致")
            for q, y, t, r in variants:
                add(
                    name,
                    "engine",
                    [
                        *q,
                        positive(engine, "Diameter"),
                        positive(engine, "Length"),
                        number(engine, "ThrustOffset"),
                        y,
                        t,
                        r,
                    ],
                )
        elif kind == "GeometryNacelle":
            shape, aft = g.get("Overall Shape", "Rounded"), g.get("Aft Section Shape", "Blunt")
            if shape not in SHAPES or aft not in ("Blunt", "Tapered"):
                raise ValueError("进气道形状无效")
            length, width, thickness = (positive(g, f) for f in ("Length", "Width", "Thickness"))
            heights = [number(g, f) for f in ("Height", "Height (Inner)", "Height (Outer)")]
            used_heights = heights[1:] if shape.startswith("Flat-Swept") else heights[:1]
            if min(used_heights) <= thickness * 2 or width <= thickness * 2:
                raise ValueError("进气道壁厚必须小于截面的一半")
            al = number(g, "Aft Section Length")
            if al < 0 or al >= length or abs(number(g, "Forward Sweep Length")) >= length:
                raise ValueError("进气道端部长度无效")
            for index, (q, y, t, r) in enumerate(variants):
                if index and shape in (
                    "Half-Round-Right",
                    "Half-Round-Left",
                    "Flat-Swept-Right",
                    "Flat-Swept-Left",
                ):
                    r += 180
                add(
                    name,
                    "nacelle",
                    [
                        *q,
                        length,
                        *heights,
                        width,
                        thickness,
                        number(g, "Forward Sweep Length"),
                        shape,
                        aft,
                        al,
                        y,
                        t,
                        r,
                    ],
                )
        elif kind == "GeometryDish":
            add(name, "dish", [*p, positive(g, "Diameter"), positive(g, "Thickness")])
        elif kind == "GeometryLandingGear":
            length = positive(g, "Uncompressed Length")
            tire = positive(g, "Tire Diam")
            if tire >= length:
                raise ValueError("起落架长度必须大于轮胎直径")
            for q, _, _, _ in variants:
                add(
                    name,
                    "gear",
                    [
                        *q,
                        length,
                        positive(g, "Strut Diam"),
                        tire,
                        positive(g, "Tire Width"),
                        number(g, "Max Angle", 90),
                    ],
                )
        elif kind == "GeometrySpeedBrake":
            length, width = positive(g, "Length"), positive(g, "Width")
            angle = number(g, "Max Angle")
            brakes = [(p, roll)]
            symmetry = g.get("Symmetry Type", "Single")
            if symmetry == "Horizontal":
                brakes.append(([p[0], 2 * sy - p[1], p[2]], -roll))
            elif symmetry == "Vertical":
                brakes.append(([p[0], p[1], 2 * sz - p[2]], 180 - roll))
            elif symmetry != "Single":
                raise ValueError("减速板对称类型无效")
            for q, r in brakes:
                add(name, "brake", [*q, length, width, r, angle])
    if not result:
        raise ValueError("设计没有可见几何组件")
    return result, nonvisual


def meshes(bundle):
    calls, points = commands(bundle)
    binary = os.environ.get("MOVER_KERNEL", str(Path(__file__).with_name("mover-kernel")))
    result = subprocess.run([binary], input=json.dumps(calls).encode(), capture_output=True, timeout=30)
    if result.returncode:
        raise ValueError("几何生成失败：" + result.stderr.decode(errors="replace")[:500])
    raw = json.loads(result.stdout)
    merged = {}
    for mesh in raw:
        if not mesh["positions"]:
            raise ValueError("组件未生成几何：" + mesh["name"])
        merged.setdefault(mesh["name"], []).extend(mesh["positions"])
    return [{"name": name, "positions": values} for name, values in merged.items()], points


def unpack_glb(data):
    if len(data) < 20 or struct.unpack_from("<4sII", data) != (b"glTF", 2, len(data)):
        raise ValueError("GLB 文件无效")
    size, kind = struct.unpack_from("<II", data, 12)
    if kind != 0x4E4F534A or size > len(data) - 20:
        raise ValueError("GLB JSON 块无效")
    return json.loads(data[20 : 20 + size]), data[20 + size :]


def pack_glb(root, chunks):
    raw = json.dumps(root, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()
    raw += b" " * (-len(raw) % 4)
    return (
        struct.pack("<4sIIII", b"glTF", 2, 20 + len(raw) + len(chunks), len(raw), 0x4E4F534A) + raw + chunks
    )


def mount_nodes(mounts):
    if not isinstance(mounts, list) or len(mounts) > 100:
        raise ValueError("最多支持 100 个挂载节点")
    result, identifiers, anchors = [], set(), 0
    for m in mounts:
        if (
            not isinstance(m, dict)
            or not isinstance(m.get("id"), str)
            or not 1 <= len(m["id"]) <= 160
            or m["id"] in identifiers
        ):
            raise ValueError("挂点标识无效或重复")
        identifiers.add(m["id"])
        role = m.get("role")
        if role not in ("socket", "anchor"):
            raise ValueError("挂点角色无效")
        anchors += role == "anchor"
        if anchors > 1:
            raise ValueError("只能有一个安装锚点")
        values = []
        for field in ("position", "rotation"):
            v = m.get(field)
            if not isinstance(v, list) or len(v) != 3:
                raise ValueError("挂点需要三轴位置和角度")
            values.append([number({"value": x}, "value") for x in v])
        position, rotation = values
        # 与 Three.js 的 XYZ Euler 一致，角度为度，位置为 GLB 米制坐标。
        x, y, z = [math.radians(a) / 2 for a in rotation]
        c1, c2, c3 = math.cos(x), math.cos(y), math.cos(z)
        s1, s2, s3 = math.sin(x), math.sin(y), math.sin(z)
        quaternion = [
            s1 * c2 * c3 + c1 * s2 * s3,
            c1 * s2 * c3 - s1 * c2 * s3,
            c1 * c2 * s3 + s1 * s2 * c3,
            c1 * c2 * c3 - s1 * s2 * s3,
        ]
        result.append(
            {
                "name": str(m.get("name", m["id"]))[:160],
                "translation": position,
                "rotation": quaternion,
                "extras": {
                    "mapArmyNodeRole": "attachmentSocket" if role == "socket" else "attachmentAnchor",
                    "socketId": m["id"],
                    "mapArmyMount": m,
                },
            }
        )
    return result


def with_mounts(data, mounts):
    root, chunks = unpack_glb(data)
    # 旧节点保留索引和子节点，只解除旧挂点语义，避免破坏蒙皮和动画引用。
    for node in root.get("nodes", []):
        extra = node.get("extras", {})
        if isinstance(extra, dict) and extra.get("mapArmyNodeRole") in (
            "attachmentSocket",
            "attachmentAnchor",
        ):
            node["extras"] = {
                k: v for k, v in extra.items() if k not in ("mapArmyNodeRole", "socketId", "mapArmyMount")
            }
    nodes = root.setdefault("nodes", [])
    start = len(nodes)
    nodes.extend(mount_nodes(mounts))
    scenes = root.setdefault("scenes", [{"nodes": list(range(start))}])
    scenes[root.get("scene", 0)].setdefault("nodes", []).extend(range(start, len(nodes)))
    return pack_glb(root, chunks)


def read_mounts(data):
    """把嵌套 GLB 安装节点转为编辑器使用的世界位置与 XYZ 欧拉角。"""
    root, _ = unpack_glb(data)
    nodes = root.get("nodes", [])
    identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    result = []

    def multiply(a, b):
        return [sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4)) for c in range(4) for r in range(4)]

    def visit(index, parent, ancestors):
        if index in ancestors:
            raise ValueError("GLB 节点存在循环")
        node = nodes[index]
        if "matrix" in node:
            local = node["matrix"]
        else:
            x, y, z, w = node.get("rotation", [0, 0, 0, 1])
            sx, sy, sz = node.get("scale", [1, 1, 1])
            tx, ty, tz = node.get("translation", [0, 0, 0])
            local = [
                (1 - 2 * y * y - 2 * z * z) * sx,
                (2 * x * y + 2 * z * w) * sx,
                (2 * x * z - 2 * y * w) * sx,
                0,
                (2 * x * y - 2 * z * w) * sy,
                (1 - 2 * x * x - 2 * z * z) * sy,
                (2 * y * z + 2 * x * w) * sy,
                0,
                (2 * x * z + 2 * y * w) * sz,
                (2 * y * z - 2 * x * w) * sz,
                (1 - 2 * x * x - 2 * y * y) * sz,
                0,
                tx,
                ty,
                tz,
                1,
            ]
        world = multiply(parent, local)
        extra = node.get("extras", {})
        role = extra.get("mapArmyNodeRole") if isinstance(extra, dict) else None
        if role in ("attachmentSocket", "attachmentAnchor"):
            rotation = world[:]
            for c in range(3):
                scale = math.sqrt(sum(world[c * 4 + r] ** 2 for r in range(3)))
                if scale < 1e-10:
                    raise ValueError("安装节点缩放不能为零")
                for r in range(3):
                    rotation[c * 4 + r] /= scale
            y = math.asin(max(-1, min(1, rotation[8])))
            if abs(rotation[8]) < 0.9999999:
                x, z = math.atan2(-rotation[9], rotation[10]), math.atan2(-rotation[4], rotation[0])
            else:
                x, z = math.atan2(rotation[6], rotation[5]), 0
            result.append(
                {
                    "id": extra.get("socketId", "anchor"),
                    "name": node.get("name", "安装节点"),
                    "role": "socket" if role == "attachmentSocket" else "anchor",
                    "position": world[12:15],
                    "rotation": list(map(math.degrees, [x, y, z])),
                    "accepts": [],
                }
            )
        for child in node.get("children", []):
            visit(child, world, ancestors | {index})

    for index in root["scenes"][root.get("scene", 0)].get("nodes", []):
        visit(index, identity, set())
    return result


def glb(bundle):
    parts, points = meshes(bundle)
    binary = bytearray()
    root = {
        "asset": {"version": "2.0", "generator": "map.army AMC native geometry"},
        "scene": 0,
        "scenes": [{"nodes": []}],
        "nodes": [],
        "meshes": [],
        "buffers": [],
        "bufferViews": [],
        "accessors": [],
        "materials": [
            {
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.55, 0.63, 0.68, 1],
                    "metallicFactor": 0.25,
                    "roughnessFactor": 0.65,
                },
                "doubleSided": True,
            }
        ],
        "extras": {"coordinateSystem": "X-forward Y-up Z-right", "units": "meters"},
    }
    for part in parts:
        values = part["positions"]
        index = len(root["meshes"])
        root["bufferViews"].append(
            {"buffer": 0, "byteOffset": len(binary), "byteLength": len(values) * 4, "target": 34962}
        )
        binary.extend(struct.pack("<" + "f" * len(values), *values))
        root["accessors"].append(
            {
                "bufferView": index,
                "componentType": 5126,
                "count": len(values) // 3,
                "type": "VEC3",
                "min": [min(values[a::3]) for a in range(3)],
                "max": [max(values[a::3]) for a in range(3)],
            }
        )
        root["meshes"].append(
            {
                "name": part["name"],
                "primitives": [{"attributes": {"POSITION": index}, "material": 0, "mode": 4}],
            }
        )
        root["nodes"].append({"name": part["name"], "mesh": index, "extras": {"componentId": part["name"]}})
    for point in points:
        root["nodes"].append(
            {
                "name": point["name"],
                "translation": point["position"],
                "extras": {
                    "componentId": point["name"],
                    "referencePoint": True,
                    "componentType": point["kind"],
                },
            }
        )
    root["nodes"].extend(mount_nodes(bundle.get("mounts", [])))
    root["scenes"][0]["nodes"] = list(range(len(root["nodes"])))
    root["buffers"] = [{"byteLength": len(binary)}]
    return pack_glb(root, struct.pack("<II", len(binary), 0x004E4942) + binary)


def export_bundle(bundle):
    output = io.BytesIO()
    bundle = resolved_bundle(bundle)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("vehicle.amc", json.dumps(bundle["amc"], indent=2, ensure_ascii=False))
        archive.writestr("maparmy-design.json", json.dumps(bundle, ensure_ascii=False))
        for kind, items in bundle["dependencies"].items():
            for name, value in items.items():
                if "/" in name or "\\" in name or name in (".", ".."):
                    raise ValueError("依赖名称无效")
                path = (
                    f"Engines/{value['engine_type']}/{name}.amc"
                    if kind == "engine"
                    else f"Airfoils/{name}.foil"
                )
                archive.writestr(path, json.dumps(value, indent=2) if kind == "engine" else value)
    return output.getvalue()


def import_bundle(data, filename):
    if filename.lower().endswith(".amc"):
        result = {"amc": json.loads(data), "mounts": []}
    else:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if (
                len(archive.infolist()) > 200
                or sum(e.file_size for e in archive.infolist()) > 20 * 1024 * 1024
            ):
                raise ValueError("AMC 依赖包超过限制")
            if "maparmy-design.json" in archive.namelist():
                result = json.loads(archive.read("maparmy-design.json"))
            else:
                vehicles = []
                deps = {"engine": {}, "airfoil": {}}
                for entry in archive.infolist():
                    if entry.filename.lower().endswith(".amc"):
                        value = json.loads(archive.read(entry))
                        if "geometry" in value:
                            vehicles.append(value)
                        elif "engine_type" in value:
                            deps["engine"][Path(entry.filename).stem] = value
                    elif entry.filename.lower().endswith(".foil"):
                        deps["airfoil"][Path(entry.filename).stem] = archive.read(entry).decode()
                if len(vehicles) != 1:
                    raise ValueError("依赖包须包含一个 Vehicle AMC")
                result = {"amc": vehicles[0], "dependencies": deps, "mounts": []}
    commands(result)
    mount_nodes(result.get("mounts", []))
    return resolved_bundle(result)
