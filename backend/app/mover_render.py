"""同一管线生成设计预览、发布模型及完整装配导出。"""

import base64
import json
import subprocess

from backend.mover import geometry

from .config import settings
from .models import Asset, ModelDefinition
from .storage import read_asset
from .validation import require


def render_bundle(db, owner_id, bundle, assembled=True):
    if "amc" in bundle:
        data = geometry.glb(bundle)
    else:
        asset = db.get(Asset, bundle.get("assetId"))
        require(asset and asset.workspace_id in (None, owner_id), "模型不可访问", 404)
        with read_asset(asset) as stream:
            data = geometry.transform_glb(
                geometry.with_mounts(stream.read(), bundle.get("mounts", [])), bundle.get("transform")
            )
    parts = []
    for placement in bundle.get("assembly", []) if assembled else []:
        part = db.get(ModelDefinition, (placement["id"], placement["version"]))
        require(part and part.workspace_id in (None, owner_id), "装配部件不可访问", 404)
        with read_asset(db.get(Asset, part.asset_id)) as stream:
            parts.append(
                {
                    "socketId": placement["socketId"],
                    "name": part.payload["name"],
                    "data": base64.b64encode(stream.read()).decode(),
                }
            )
    if not parts:
        return data
    result = subprocess.run(
        [
            "node",
            "--max-old-space-size=768",
            str(settings().tool_path.with_name("assemble-glb.cjs").resolve()),
        ],
        input=json.dumps({"base": base64.b64encode(data).decode(), "parts": parts}).encode(),
        capture_output=True,
        timeout=60,
    )
    require(result.returncode == 0, "场景装配失败：" + result.stderr.decode(errors="replace")[:1000])
    return result.stdout
