"""项目修订、关系投影与历史资产引用在同一数据库事务中保存。"""

import base64
import copy
import json
import re

from sqlalchemy import delete, select

from .models import Asset, AssetReference, Feature, Layer, ModelDefinition, ProjectVersion, now
from .storage import store_asset
from .validation import check_locks, require, sanitize_svg, validate_document

ASSET_PATTERN = re.compile(r"/api/assets/([a-f0-9]{32})/content")


def normalize_images(db, doc, owner):
    for layer in doc["layers"]:
        image = layer.get("image")
        if image and image.get("url", "").startswith("data:"):
            match = re.fullmatch(r"data:(image/[a-zA-Z0-9.+-]+);base64,([\s\S]*)", image["url"])
            require(match is not None, "内嵌图像格式无效")
            try:
                data = base64.b64decode(match[2], validate=True)
            except ValueError:
                require(False, "图像编码无效")
            if match[1] == "image/svg+xml":
                data = sanitize_svg(data.decode()).encode()
            asset = store_asset(db, data, layer["name"], match[1], "image", owner)
            image["url"] = f"/api/assets/{asset.id}/content"


def collect_assets(db, doc, workspace_id=None, permitted=None):
    ids = set(ASSET_PATTERN.findall(json.dumps(doc)))
    for f in doc.get("features", []):
        ref = f.get("equipment3d")
        if not ref:
            continue
        model = db.get(ModelDefinition, (ref["modelId"], ref["assetVersion"]))
        if model:
            ids.add(model.asset_id)
            ids.update(ASSET_PATTERN.findall(json.dumps(model.payload)))
            sockets = {s["id"]: s for s in model.payload.get("sockets", [])}
            attachments = {a["id"]: a for a in model.payload.get("attachments", [])}
            for part in ref["attachments"]:
                socket, attachment = sockets.get(part["socketId"]), attachments.get(part["attachmentId"])
                require(
                    socket
                    and attachment
                    and part["attachmentId"] in socket["accepts"]
                    and attachment["version"] == part["assetVersion"],
                    "模型挂载与该版本目录不兼容",
                )
    permitted = permitted or set()
    for aid in ids:
        asset = db.get(Asset, aid)
        require(
            asset is not None
            and (asset.workspace_id is None or asset.workspace_id == workspace_id or aid in permitted),
            "文档引用的资产不可访问",
            403,
        )
    return ids


def references(db, ids, kind, owner, version):
    for aid in ids:
        key = (aid, kind, owner, str(version))
        if not db.get(AssetReference, key):
            db.add(AssetReference(asset_id=aid, owner_type=kind, owner_id=owner, version=str(version)))


def document_of(db, project):
    metadata = copy.deepcopy(project.metadata_json)
    metadata.update(
        name=project.name,
        layers=[
            r.payload
            for r in db.scalars(select(Layer).where(Layer.project_id == project.id).order_by(Layer.position))
        ],
        features=[
            r.payload
            for r in db.scalars(
                select(Feature).where(Feature.project_id == project.id).order_by(Feature.position)
            )
        ],
    )
    return metadata


def save_project(db, project, value, first=False):
    doc = validate_document(value)
    if not first:
        check_locks(document_of(db, project), doc)
    normalize_images(db, doc, project.workspace_id)
    ids = collect_assets(db, doc, project.workspace_id)
    db.execute(delete(Feature).where(Feature.project_id == project.id))
    db.execute(delete(Layer).where(Layer.project_id == project.id))
    project.name = doc["name"]
    project.revision += 1
    project.updated_at = now()
    project.metadata_json = {k: v for k, v in doc.items() if k not in ("name", "layers", "features")}
    db.flush()
    for index, layer in enumerate(doc["layers"]):
        db.add(
            Layer(
                project_id=project.id,
                id=layer["id"],
                position=index,
                name=layer["name"],
                locked=layer["locked"],
                payload=layer,
            )
        )
    db.flush()
    for index, feature in enumerate(doc["features"]):
        db.add(
            Feature(
                project_id=project.id,
                id=feature["id"],
                layer_id=feature["layerId"],
                position=index,
                sidc=feature["sidc"],
                payload=feature,
            )
        )
    db.add(ProjectVersion(project_id=project.id, revision=project.revision, document=doc))
    references(db, ids, "project", project.id, project.revision)
    db.flush()
    return {"id": project.id, "revision": project.revision, "document": doc, "updatedAt": project.updated_at}
