"""S3 的对象键由服务生成；浏览器通过鉴权接口读取文件。"""

from functools import lru_cache
from hashlib import sha256

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from sqlalchemy.orm import Session

from .config import settings
from .models import Asset, uid


@lru_cache
def s3():
    cfg = settings()
    return boto3.client(
        "s3",
        endpoint_url=cfg.s3_endpoint,
        aws_access_key_id=cfg.s3_access_key,
        aws_secret_access_key=cfg.s3_secret_key,
        region_name=cfg.s3_region,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            connect_timeout=5,
            read_timeout=30,
            retries={"max_attempts": 2},
        ),
    )


def initialize_bucket():
    try:
        s3().head_bucket(Bucket=settings().s3_bucket)
    except ClientError as exc:
        if exc.response["Error"]["Code"] not in ("404", "NoSuchBucket"):
            raise
        s3().create_bucket(Bucket=settings().s3_bucket)


def store_asset(db: Session, data: bytes, name: str, content_type: str, kind: str, workspace_id: str | None):
    asset_id = uid()
    digest = sha256(data).hexdigest()
    key = f"{workspace_id or 'builtin'}/{asset_id}/{digest}"
    s3().put_object(Bucket=settings().s3_bucket, Key=key, Body=data, ContentType=content_type)
    asset = Asset(
        id=asset_id,
        workspace_id=workspace_id,
        name=name[:300],
        kind=kind,
        content_type=content_type,
        object_key=key,
        sha256=digest,
        size=len(data),
    )
    db.add(asset)
    db.flush()
    return asset


def read_asset(asset: Asset):
    return s3().get_object(Bucket=settings().s3_bucket, Key=asset.object_key)["Body"]


def asset_json(asset: Asset):
    return {
        "id": asset.id,
        "name": asset.name,
        "kind": asset.kind,
        "size": asset.size,
        "contentType": asset.content_type,
        "sha256": asset.sha256,
        "createdAt": asset.created_at,
        "url": f"/api/assets/{asset.id}/content",
    }
