"""Python 管理交换文件的权限、存储和失败；格式工具不接触持久数据。"""

import base64
import json
import subprocess
import tempfile

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from .assets import accessible
from .auth import workspace
from .config import settings
from .db import session
from .documents import collect_assets, references
from .models import AssetReference, Share
from .storage import asset_json, read_asset, store_asset
from .validation import require, validate_document

router = APIRouter(prefix="/api/exchange")


def convert(payload):
    cfg = settings()
    with tempfile.TemporaryDirectory(prefix="maparmy-exchange-") as directory:
        try:
            result = subprocess.run(
                ["node", "--max-old-space-size=512", str(cfg.tool_path.resolve())],
                input=json.dumps(payload),
                capture_output=True,
                text=True,
                cwd=directory,
                timeout=cfg.converter_timeout,
            )
        except subprocess.TimeoutExpired:
            require(False, "文件处理超时，请保留原文件并重试", 422)
        try:
            output = json.loads(result.stdout)
        except (ValueError, TypeError):
            require(False, "文件处理工具不可用", 503)
        require(result.returncode == 0 and "error" not in output, output.get("error", "文件处理失败"))
        return output


@router.post("/import")
async def import_file(
    request: Request, file: UploadFile = File(), db: Session = Depends(session, scope="function")
):
    owner = workspace(request, db)
    data = await file.read(settings().max_document_bytes + 1)
    require(0 < len(data) <= settings().max_document_bytes, "文件为空或超过 32 MB", 413)
    result = convert({"action": "import", "name": file.filename, "data": base64.b64encode(data).decode()})
    result["document"] = validate_document(result["document"])
    asset = store_asset(
        db,
        data,
        file.filename or "import",
        file.content_type or "application/octet-stream",
        "import",
        owner.id,
    )
    return {**result, "sourceAsset": asset_json(asset)}


@router.post("/afsim")
def import_afsim(body: dict, request: Request, db: Session = Depends(session, scope="function")):
    owner = workspace(request, db)
    require(isinstance(body.get("files"), list) and len(body["files"]) <= 4096, "文件列表无效")
    result = convert({**body, "action": "afsim-import"})
    result["document"] = validate_document(result["document"])
    asset = store_asset(
        db, json.dumps(body).encode(), "afsim-source.json", "application/json", "import", owner.id
    )
    return {**result, "sourceAsset": asset_json(asset)}


@router.post("/export")
def export_file(body: dict, request: Request, db: Session = Depends(session, scope="function")):
    owner = workspace(request, db)
    doc = validate_document(body.get("document"))
    require(
        body.get("format") in ("milxlyz", "milxly", "milx", "json", "geojson", "kml", "afsim"), "导出格式无效"
    )
    sid = request.query_params.get("share")
    share = db.get(Share, sid) if sid else None
    permitted = set()
    if share:
        version = request.query_params.get("version", str(share.version))
        permitted = set(
            db.scalars(
                select(AssetReference.asset_id).where(
                    AssetReference.owner_type == "share",
                    AssetReference.owner_id == sid,
                    AssetReference.version == version,
                )
            )
        )
    ids = collect_assets(db, doc, owner.id, permitted)
    # JSON 与 GeoJSON 导出恢复内嵌图像，另一个工作空间导入时无需原空间凭证。
    if body["format"] in ("json", "geojson"):
        for layer in doc["layers"]:
            image = layer.get("image")
            if image and image.get("url", "").startswith("/api/assets/"):
                asset_id = image["url"].split("/")[3]
                asset = accessible(db, request, asset_id)
                with read_asset(asset) as stream:
                    image["url"] = (
                        "data:" + asset.content_type + ";base64," + base64.b64encode(stream.read()).decode()
                    )

    result = convert({**body, "document": doc, "action": "export"})
    data = base64.b64decode(result.pop("data"))
    asset = store_asset(db, data, doc["name"] + "." + result["extension"], result["mime"], "export", owner.id)
    references(db, ids, "export", asset.id, "1")
    return {**result, "asset": asset_json(asset)}
