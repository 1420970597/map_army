"""兼容旧分享地址和令牌；数据库行锁串行化版本递增。"""

import secrets

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import credential, digest, optional_workspace
from .db import session
from .documents import collect_assets, normalize_images, references
from .models import AssetReference, Share, ShareVersion
from .projects import DocumentInput
from .validation import require, validate_document
from .workspaces import if_match

router = APIRouter(prefix="/api/shares")


def share_doc(db, request, value, share_id=None):
    doc = validate_document(value)
    owner = optional_workspace(request, db)
    # 旧客户端可发布无资产文档；上传私有资产需要工作空间凭证。
    if owner:
        normalize_images(db, doc, owner.id)
    permitted = (
        set(
            db.scalars(
                select(AssetReference.asset_id).where(
                    AssetReference.owner_type == "share", AssetReference.owner_id == share_id
                )
            )
        )
        if share_id
        else set()
    )
    ids = collect_assets(db, doc, owner.id if owner else None, permitted)
    return doc, ids


@router.post("", status_code=201)
def create(body: DocumentInput, request: Request, db: Session = Depends(session, scope="function")):
    doc, assets = share_doc(db, request, body.document)
    token = credential()
    share = Share(token_hash=digest(token), version=1)
    db.add(share)
    db.flush()
    db.add(ShareVersion(share_id=share.id, version=1, document=doc))
    references(db, assets, "share", share.id, 1)
    db.flush()
    return {"id": share.id, "token": token, "version": 1}


@router.get("/{share_id}")
def read(share_id: str, version: int | None = None, db: Session = Depends(session, scope="function")):
    share = db.get(Share, share_id)
    require(share is not None, "分享不存在", 404)
    actual = version if version is not None else share.version
    saved = db.get(ShareVersion, (share.id, actual))
    require(saved is not None, "分享版本不存在", 404)
    return {
        "document": saved.document,
        "version": actual,
        "latestVersion": share.version,
        "updatedAt": saved.created_at,
    }


@router.put("/{share_id}")
def update(
    share_id: str, body: DocumentInput, request: Request, db: Session = Depends(session, scope="function")
):
    share = db.scalar(select(Share).where(Share.id == share_id).with_for_update())
    require(share is not None, "分享不存在", 404)
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    require(secrets.compare_digest(digest(token), share.token_hash), "需要有效的编辑链接才能更新分享", 403)
    if_match(request, share.version)
    doc, assets = share_doc(db, request, body.document, share.id)
    share.version += 1
    db.add(ShareVersion(share_id=share.id, version=share.version, document=doc))
    references(db, assets, "share", share.id, share.version)
    db.flush()
    return {"id": share.id, "version": share.version}


@router.post("/{share_id}/copy", status_code=201)
def copy_share(share_id: str, db: Session = Depends(session, scope="function")):
    original = db.scalar(select(Share).where(Share.id == share_id).with_for_update())
    require(original is not None, "分享不存在", 404)
    source = db.get(ShareVersion, (share_id, original.version))
    token = credential()
    share = Share(token_hash=digest(token), version=1)
    db.add(share)
    db.flush()
    db.add(ShareVersion(share_id=share.id, version=1, document=source.document))
    assets = db.scalars(
        select(AssetReference.asset_id).where(
            AssetReference.owner_type == "share",
            AssetReference.owner_id == share_id,
            AssetReference.version == str(original.version),
        )
    )
    references(db, assets, "share", share.id, 1)
    db.flush()
    return {"id": share.id, "token": token, "version": 1, "copiedFrom": share_id}
