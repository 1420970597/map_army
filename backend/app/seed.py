"""内置目录幂等入库；资产文件按实际内容复用，保留不可用来源的状态。"""

import copy
import hashlib
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .db import engine
from .documents import references
from .models import Asset, CatalogEntry, ModelDefinition
from .storage import initialize_bucket, store_asset


def seed():
    cfg = settings()
    initialize_bucket()
    data = json.loads(cfg.seed_path.read_text())
    with Session(engine()) as db, db.begin():
        for kind, items in [("symbol", data["symbols"]), ("afsim", data["afsim"])]:
            for item in items:
                identifier = item.get("id") or item["key"]
                old = db.get(CatalogEntry, (kind, identifier))
                if old:
                    old.payload = item
                else:
                    db.add(CatalogEntry(kind=kind, id=identifier, payload=item))
        cache = {}

        def asset_for(url):
            if url not in cache:
                path = (cfg.public_path / url.lstrip("/")).resolve()
                if not path.is_relative_to(cfg.public_path.resolve()):
                    raise ValueError("种子资产路径无效")
                content = path.read_bytes()
                digest = hashlib.sha256(content).hexdigest()
                asset = db.scalar(select(Asset).where(Asset.workspace_id.is_(None), Asset.sha256 == digest))
                if not asset:
                    asset = store_asset(db, content, path.name, "model/gltf-binary", "builtin-model", None)
                cache[url] = asset
            return cache[url]

        for raw in data["models"]:
            item = copy.deepcopy(raw)
            asset = asset_for(item["url"])
            item["url"] = f"/api/assets/{asset.id}/content"
            ids = {asset.id}
            for part in item["attachments"]:
                attachment = asset_for(part["url"])
                ids.add(attachment.id)
                part["url"] = f"/api/assets/{attachment.id}/content"
            old = db.get(ModelDefinition, (item["id"], item["version"]))
            if old:
                if old.payload != item or old.asset_id != asset.id:
                    raise ValueError("内置模型内容变化时必须递增资产版本：" + item["id"])
            else:
                db.add(
                    ModelDefinition(
                        id=item["id"],
                        version=item["version"],
                        workspace_id=None,
                        asset_id=asset.id,
                        payload=item,
                    )
                )
            references(db, ids, "model", item["id"], item["version"])
        db.flush()
    print("模型、军标目录与内置资产已入库。")


if __name__ == "__main__":
    seed()
