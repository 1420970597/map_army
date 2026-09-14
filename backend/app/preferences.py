"""只接受公开的资料字段及显示选项，拒绝类型错误和未知操作字段。"""

from .validation import finite, require, text

ENUMS = {
    "language": {"zh", "en", "de", "fr", "it"},
    "units": {"metric", "imperial", "nautical"},
    "angularUnit": {"degree", "milliradian"},
    "geoDegreeFormat": {"decimal", "dms"},
    "mapLanguage": {"local", "en"},
}
BOOLS = set(
    "coordinateSearch northArrow measurement hillshade pacific magneticNorth magnifier snapEnabled hexLabels".split()
)
RANGES = {
    "snapThresholdPx": (0, 100),
    "brightness": (0, 200),
    "hue": (-360, 360),
    "chroma": (0, 200),
    "hexEdgeMeters": (10, 1000000),
    "hexOpacity": (0, 1),
    "hexLineWidth": (0, 20),
}


def validate_preferences(scope, data):
    require(isinstance(data, dict), "偏好格式无效")
    if scope == "preferences":
        for key, value in data.items():
            if key in ENUMS:
                require(isinstance(value, str) and value in ENUMS[key], "偏好选项无效：" + key)
            elif key in BOOLS:
                require(isinstance(value, bool), "偏好开关无效：" + key)
            elif key in RANGES:
                low, high = RANGES[key]
                require(finite(value) and low <= value <= high, "偏好数值无效：" + key)
            elif key == "hexColor":
                require(text(value, 80), "网格颜色无效")
            else:
                require(False, "未知偏好字段：" + key)
    elif scope == "symbol":
        require(set(data).issubset({"symbolMode", "symbolDefaults"}), "未知符号偏好字段")
        require(data.get("symbolMode", "standard") in ("standard", "extended"), "符号模式无效")
        require(isinstance(data.get("symbolDefaults", {}), dict), "符号默认格式无效")
    else:
        require(set(data).issubset({"baseMap", "grid", "gridLabels"}), "未知视图偏好字段")
        require(all(text(data[k], 80) for k in ("baseMap", "grid") if k in data), "地图选项无效")
        require(isinstance(data.get("gridLabels", True), bool), "网格标签选项无效")
