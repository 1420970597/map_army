"""数据校验独立于 HTTP；保存与文件导入共用同一规则。"""

import copy
import json
import math
import re
from xml.etree import ElementTree as ET

from defusedxml.ElementTree import fromstring
from fastapi import HTTPException


def require(condition, message, status=422):
    if not condition:
        raise HTTPException(status, message)


def text(value, maximum=300):
    return isinstance(value, str) and len(value) <= maximum


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def sanitize_svg(value):
    require(text(value, 2 * 1024 * 1024), "SVG 文件过大或格式无效")
    try:
        root = fromstring(value)
    except Exception as exc:
        raise HTTPException(422, "SVG XML 无效") from exc

    def local(s):
        return s.split("}")[-1].lower()

    require(local(root.tag) == "svg", "SVG 根元素无效")
    allowed = {
        "svg",
        "g",
        "defs",
        "path",
        "rect",
        "circle",
        "ellipse",
        "line",
        "polyline",
        "polygon",
        "text",
        "tspan",
        "title",
        "desc",
        "clippath",
        "mask",
        "lineargradient",
        "radialgradient",
        "stop",
        "pattern",
        "filter",
        "fegaussianblur",
        "feoffset",
        "fecolormatrix",
        "feblend",
        "femerge",
        "femergenode",
    }
    for parent in root.iter():
        for child in list(parent):
            if local(child.tag) not in allowed:
                parent.remove(child)
        for key, item in list(parent.attrib.items()):
            name = local(key)
            if (
                name.startswith("on")
                or name in ("href", "src")
                or re.search(r'(javascript:|@import|expression\s*\(|url\s*\(\s*[\'"]?(?!#))', item, re.I)
            ):
                del parent.attrib[key]
    return ET.tostring(root, encoding="unicode")


def validate_document(value):
    require(isinstance(value, dict), "文档结构无效")
    doc = copy.deepcopy(value)
    require(text(doc.get("name")), "文档名称无效")
    layers, features = doc.get("layers"), doc.get("features")
    require(isinstance(layers, list) and len(layers) <= 2000, "图层列表无效或超过限制")
    require(isinstance(features, list) and len(features) <= 50000, "要素列表无效或超过限制")
    layer_ids, feature_ids = set(), set()
    for layer in layers:
        require(
            isinstance(layer, dict) and text(layer.get("id"), 160) and bool(layer.get("id")), "图层标识无效"
        )
        require(layer["id"] not in layer_ids, "图层标识重复")
        layer_ids.add(layer["id"])
        require(
            text(layer.get("name"))
            and isinstance(layer.get("locked"), bool)
            and isinstance(layer.get("visible"), bool),
            "图层属性无效",
        )
        require(
            finite(layer.get("opacity")) and 0 <= layer["opacity"] <= 1 and finite(layer.get("order")),
            "图层显示参数无效",
        )
        if layer.get("image"):
            image = layer["image"]
            require(isinstance(image, dict) and text(image.get("url"), 32 * 1024 * 1024), "图像属性无效")
            corners = image.get("corners")
            require(isinstance(corners, list) and len(corners) == 3, "图像配准必须有三个角点")
            for p in corners:
                validate_point(p)
    for feature in features:
        require(
            isinstance(feature, dict) and text(feature.get("id"), 160) and bool(feature.get("id")),
            "要素标识无效",
        )
        require(feature["id"] not in feature_ids, "要素标识重复")
        feature_ids.add(feature["id"])
        require(feature.get("layerId") in layer_ids, "要素引用了不存在的图层")
        require(text(feature.get("sidc"), 80) and isinstance(feature.get("textFields"), dict), "军标属性无效")
        geometry = feature.get("geometry")
        require(isinstance(geometry, dict), "几何结构无效")
        kind = geometry.get("kind")
        require(kind in ("point", "line", "area"), "几何类型无效")
        points = [geometry.get("position")] if kind == "point" else geometry.get("points")
        require(
            isinstance(points, list) and {"point": 1, "line": 2, "area": 3}[kind] <= len(points) <= 100000,
            "几何顶点数量无效",
        )
        for point in points:
            validate_point(point)
        if feature.get("customSymbolSvg"):
            feature["customSymbolSvg"] = sanitize_svg(feature["customSymbolSvg"])
        if feature.get("equipment3d") is not None:
            e = feature["equipment3d"]
            require(
                kind == "point"
                and isinstance(e, dict)
                and text(e.get("modelId"), 160)
                and text(e.get("assetVersion"), 80),
                "三维装配引用无效",
            )
            parts = e.get("attachments")
            require(isinstance(parts, list) and len(parts) <= 100, "挂载列表无效")
            ids = set()
            for part in parts:
                require(
                    isinstance(part, dict)
                    and all(text(part.get(k), 160) for k in ("socketId", "attachmentId", "assetVersion")),
                    "挂载引用无效",
                )
                require(part["socketId"] not in ids, "挂点重复")
                ids.add(part["socketId"])
    try:
        json.dumps(doc, allow_nan=False)
    except (TypeError, ValueError) as exc:
        raise HTTPException(422, "文档包含非 JSON 数据") from exc
    return doc


def validate_point(point):
    require(isinstance(point, dict) and finite(point.get("lon")) and finite(point.get("lat")), "坐标无效")
    require(abs(point["lat"]) <= 90 and abs(point["lon"]) <= 540, "坐标超出范围")


def check_locks(previous, current):
    layers = {layer["id"]: layer for layer in current["layers"]}
    for layer in previous["layers"]:
        if not layer["locked"]:
            continue
        new = layers.get(layer["id"])
        require(new is not None, "锁定图层不能删除", 409)

        def unchanged(x):
            # 页面允许管理锁定图层的名称、顺序和状态，锁定仍保护内容与数据源。
            return {
                k: v
                for k, v in x.items()
                if k not in ("locked", "visible", "opacity", "name", "order", "status")
            }

        require(unchanged(new) == unchanged(layer), "锁定图层不能修改", 409)
        before = {f["id"]: f for f in previous["features"] if f["layerId"] == layer["id"]}
        after = {f["id"]: f for f in current["features"] if f["layerId"] == layer["id"]}
        require(before == after, "锁定图层中的要素不能修改", 409)
