"""资产权限由数据库引用校验；S3 桶不对浏览器公开。"""

from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import optional_workspace, workspace
from .config import settings
from .db import session
from .documents import workspace_assets
from .models import Asset, AssetReference, Job, Share
from .storage import asset_json, read_asset, store_asset
from .validation import require, sanitize_svg

router = APIRouter(prefix="/api/assets")


def accessible(db, request, asset_id):
    asset = db.get(Asset, asset_id)
    require(asset is not None, "资产不存在", 404)
    owner = optional_workspace(request, db)
    if asset.workspace_id is None or (owner and asset.workspace_id == owner.id):
        return asset
    if owner and asset.id in workspace_assets(db, owner.id):
        return asset
    sid = request.query_params.get("share")
    share = db.get(Share, sid) if sid else None
    if share:
        version = request.query_params.get("version", str(share.version))
        if db.get(AssetReference, (asset.id, "share", share.id, version)):
            return asset
    require(False, "资产不存在", 404)


@router.post("", status_code=201)
async def upload(
    request: Request,
    file: UploadFile = File(),
    kind: str = Form("file"),
    db: Session = Depends(session, scope="function"),
):
    owner = workspace(request, db)
    require(kind in ("file", "image", "model-source", "export", "report"), "资产类别无效")
    data = await file.read(settings().max_file_bytes + 1)
    require(0 < len(data) <= settings().max_file_bytes, "文件为空或超过大小限制", 413)
    mime = file.content_type or "application/octet-stream"
    if mime == "image/svg+xml" or Path(file.filename or "").suffix.lower() == ".svg":
        data = sanitize_svg(data.decode("utf-8")).encode()
        mime = "image/svg+xml"
    require(len(mime) <= 100, "文件类型无效")
    return asset_json(store_asset(db, data, Path(file.filename or "asset").name, mime, kind, owner.id))


@router.get("")
def listing(request: Request, db: Session = Depends(session, scope="function")):
    owner = workspace(request, db)
    return [
        asset_json(a)
        for a in db.scalars(
            select(Asset).where(Asset.workspace_id == owner.id).order_by(Asset.created_at.desc()).limit(1000)
        )
    ]


@router.get("/{asset_id}/content")
def content(asset_id: str, request: Request, db: Session = Depends(session, scope="function")):
    asset = accessible(db, request, asset_id)
    body = read_asset(asset)

    def chunks():
        try:
            yield from body.iter_chunks(128 * 1024)
        finally:
            body.close()

    inline = asset.content_type in (
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
        "model/gltf-binary",
        "application/pdf",
    )
    return StreamingResponse(
        chunks(),
        media_type=asset.content_type,
        headers={
            "Content-Length": str(asset.size),
            "ETag": '"' + asset.sha256 + '"',
            "Cache-Control": "private, no-cache",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            "Content-Disposition": f"{'inline' if inline else 'attachment'}; filename*=UTF-8''{quote(asset.name)}",
        },
    )


@router.delete("/{asset_id}", status_code=204)
def remove(asset_id: str, request: Request, db: Session = Depends(session, scope="function")):
    owner = workspace(request, db)
    asset = db.scalar(
        select(Asset).where(Asset.id == asset_id, Asset.workspace_id == owner.id).with_for_update()
    )
    require(asset is not None, "资产不存在", 404)
    reference = db.scalar(select(AssetReference).where(AssetReference.asset_id == asset.id).limit(1))
    job = db.scalar(select(Job).where(Job.source_asset_id == asset.id).limit(1))
    require(reference is None and job is None, "资产仍被项目版本、目录或任务引用，不能删除", 409)
    # 数据库先解除引用；文件留给独立清理命令，避免回滚产生悬空资产。
    db.delete(asset)
    db.flush()
    return Response(status_code=204)
