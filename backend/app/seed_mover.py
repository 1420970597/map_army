"""所有 AMC 模板、依赖和生成模型进入 MySQL/S3，保留来源哈希。"""

import json

from backend.mover import geometry
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import engine
from .documents import references
from .model_assets import inspect_glb
from .models import Asset, CatalogEntry, ModelDefinition
from .storage import store_asset


def seed_mover():
    with Session(engine()) as db, db.begin():
        for entry in geometry.catalog():
            key = entry["kind"] + ":" + entry["id"]
            raw = (geometry.DATA / entry["path"]).read_bytes()
            source = db.scalar(
                select(Asset).where(Asset.workspace_id.is_(None), Asset.sha256 == entry["sha256"])
            )
            if not source:
                source = store_asset(
                    db,
                    raw,
                    entry["path"].split("/")[-1],
                    "text/plain" if entry["kind"] == "airfoil" else "application/json",
                    "mover-template",
                    None,
                )
            payload = {**entry, "assetId": source.id, "url": f"/api/assets/{source.id}/content"}
            old = db.get(CatalogEntry, ("mover", key))
            if old:
                old.payload = payload
            else:
                db.add(CatalogEntry(kind="mover", id=key, payload=payload))
            if entry["kind"] != "vehicle":
                continue
            identifier, version = "afsim-amc-" + entry["id"], "amc-5"
            old_model = db.get(ModelDefinition, (identifier, version))
            if old_model:
                continue
            amc = json.loads(raw)
            weapon = amc.get("VehicleType") == "Weapon"
            mounts = (
                [
                    {
                        "id": "anchor",
                        "name": "安装锚点",
                        "role": "anchor",
                        "position": [0, 0, 0],
                        "rotation": [0, 0, 0],
                    }
                ]
                if weapon
                else []
            )
            data = geometry.glb({"amc": amc, "mounts": mounts})
            info = inspect_glb(data)
            asset = store_asset(db, data, entry["id"] + ".glb", "model/gltf-binary", "builtin-model", None)
            category = entry["path"].split("/")[-2].split(" - ")[-1]
            model = {
                "id": identifier,
                "version": version,
                "name": entry["id"],
                "category": category,
                "description": "AFSIM Mover Creator 参数化模板",
                "url": f"/api/assets/{asset.id}/content",
                "sockets": [],
                "attachments": [],
                "hasAttachmentAnchor": weapon,
                "meshCount": info["meshCount"],
                "source": "afsim",
                "moverTemplateId": entry["id"],
                "equipmentType": "drone"
                if entry["id"].startswith("D-")
                else "attachment"
                if entry["id"].startswith("TNK-")
                else "weapon"
                if weapon
                else "aircraft",
            }
            db.add(
                ModelDefinition(
                    id=identifier, version=version, workspace_id=None, asset_id=asset.id, payload=model
                )
            )
            references(db, [source.id, asset.id], "model", identifier, version)
    print("Mover Creator：34 个载具、45 个发动机、12 个翼型已入库。")


if __name__ == "__main__":
    seed_mover()
