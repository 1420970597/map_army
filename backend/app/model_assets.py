"""模型目录和异步转换任务；GLB 的节点元数据用于可视化装配。"""

import json
import struct
import subprocess

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import optional_workspace, workspace
from .config import settings
from .db import session
from .documents import ASSET_PATTERN, references, workspace_assets
from .models import Asset, AssetReference, CatalogEntry, Job, ModelDefinition, Share, uid
from .storage import read_asset
from .validation import require, text

router = APIRouter(prefix="/api")


def inspect_glb(data):
    require(len(data) >= 20, "GLB 文件截断")
    try:
        result = subprocess.run(
            [
                "node",
                "--max-old-space-size=512",
                str(settings().tool_path.with_name("validate-glb.cjs").resolve()),
            ],
            input=data,
            capture_output=True,
            timeout=settings().converter_timeout,
        )
        report = json.loads(result.stdout)
    except (subprocess.TimeoutExpired, ValueError, OSError):
        require(False, "模型校验未完成，请检查文件或稍后重试")
    require(
        result.returncode == 0,
        "GLB 校验失败："
        + "; ".join(str(e.get("message", "结构无效")) for e in report.get("errors", []))[:1200],
    )
    magic, version, length = struct.unpack_from("<4sII", data)
    require(magic == b"glTF" and version == 2 and length == len(data), "需要完整的 glTF 2.0 GLB 文件")
    size, kind = struct.unpack_from("<II", data, 12)
    require(kind == 0x4E4F534A and size <= len(data) - 20, "GLB JSON 块无效")
    try:
        root = json.loads(data[20 : 20 + size])
    except (ValueError, UnicodeError):
        require(False, "GLB 元数据无效")
    require(isinstance(root, dict) and root.get("asset", {}).get("version") == "2.0", "glTF 版本无效")
    require(bool(root.get("meshes")), "GLB 没有可显示的网格")
    for group in ("buffers", "images"):
        for value in root.get(group, []):
            uri = value.get("uri")
            require(uri is None or uri.startswith("data:"), "GLB 必须自包含贴图和缓冲区")
    sockets, anchor = [], False
    for node in root.get("nodes", []):
        extra = node.get("extras", {})
        if not isinstance(extra, dict):
            continue
        if extra.get("mapArmyNodeRole") == "attachmentSocket":
            identifier = extra.get("socketId")
            require(
                text(identifier, 160) and identifier and all(s["id"] != identifier for s in sockets),
                "GLB 挂点标识无效或重复",
            )
            sockets.append({"id": identifier, "name": node.get("name", identifier), "accepts": []})
        elif extra.get("mapArmyNodeRole") == "attachmentAnchor":
            require(not anchor, "部件只能有一个安装锚点")
            anchor = True
    return {
        "sockets": sockets,
        "hasAttachmentAnchor": anchor,
        "meshCount": len(root["meshes"]),
        "extras": root.get("extras", {}),
    }


def model_metadata(db, owner_id, payload, asset):
    with read_asset(asset) as stream:
        geometry = inspect_glb(stream.read())
    sockets = payload.get("sockets", geometry["sockets"])
    require(
        isinstance(sockets, list) and all(isinstance(s, dict) and text(s.get("id"), 160) for s in sockets),
        "挂点配置无效",
    )
    require(
        {s.get("id") for s in sockets} == {s["id"] for s in geometry["sockets"]}
        and len(sockets) == len(geometry["sockets"]),
        "挂点配置与 GLB 节点不一致",
    )
    attachments = payload.get("attachments", [])
    require(isinstance(attachments, list) and len(attachments) <= 100, "部件目录无效")
    resolved, asset_ids, part_ids = [], {asset.id}, set()
    for part in attachments:
        require(
            isinstance(part, dict) and text(part.get("id"), 160) and text(part.get("version"), 80),
            "部件引用无效",
        )
        model = db.get(ModelDefinition, (part["id"], part["version"]))
        require(
            model and model.workspace_id in (None, owner_id) and model.payload.get("hasAttachmentAnchor"),
            "部件不存在、无权访问或缺少安装锚点",
        )
        require(part["id"] not in part_ids, "部件目录重复")
        part_ids.add(part["id"])
        resolved.append(
            {
                "id": model.id,
                "version": model.version,
                "name": model.payload["name"],
                "url": model.payload["url"],
            }
        )
        asset_ids.add(model.asset_id)
    for socket in sockets:
        require(
            text(socket.get("name"))
            and isinstance(socket.get("accepts"), list)
            and all(text(a, 160) for a in socket["accepts"])
            and set(socket["accepts"]).issubset(part_ids),
            "挂点兼容部件无效",
        )
    return {
        **payload,
        "url": f"/api/assets/{asset.id}/content",
        "sockets": sockets,
        "attachments": resolved,
        "hasAttachmentAnchor": geometry["hasAttachmentAnchor"],
        "meshCount": geometry["meshCount"],
    }, asset_ids


@router.get("/catalog")
def catalog(db: Session = Depends(session, scope="function")):
    return {
        kind: [
            r.payload
            for r in db.scalars(
                select(CatalogEntry).where(CatalogEntry.kind == kind).order_by(CatalogEntry.id)
            )
        ]
        for kind in ("symbol", "afsim")
    }


@router.get("/models")
def models(request: Request, db: Session = Depends(session, scope="function")):
    owner = optional_workspace(request, db)
    allowed = workspace_assets(db, owner.id if owner else None)
    sid = request.query_params.get("share")
    share = db.get(Share, sid) if sid else None
    if share:
        revision = request.query_params.get("version", str(share.version))
        allowed |= set(
            db.scalars(
                select(AssetReference.asset_id).where(
                    AssetReference.owner_type == "share",
                    AssetReference.owner_id == share.id,
                    AssetReference.version == revision,
                )
            )
        )
    result = []
    for model in db.scalars(select(ModelDefinition).order_by(ModelDefinition.id, ModelDefinition.created_at)):
        if model.workspace_id is not None and (not owner or model.workspace_id != owner.id):
            asset_ids = {model.asset_id, *ASSET_PATTERN.findall(json.dumps(model.payload))}
            if not asset_ids.issubset(allowed):
                continue
        result.append(
            {
                **model.payload,
                "readOnly": model.workspace_id is None or not owner or model.workspace_id != owner.id,
            }
        )
    return result


@router.post("/model-imports", status_code=202)
def import_model(body: dict, request: Request, db: Session = Depends(session, scope="function")):
    owner = workspace(request, db)
    asset = db.get(Asset, body.get("assetId"))
    require(asset and asset.workspace_id == owner.id, "源资产不存在", 404)
    require(asset.name.lower().endswith((".glb", ".obj")), "当前转换支持自包含 GLB 和 OBJ")
    require(text(body.get("name", asset.name)) and text(body.get("category", "未分类")), "模型名称或类型无效")
    job = Job(
        workspace_id=owner.id,
        source_asset_id=asset.id,
        payload={
            "modelId": uid(),
            "name": body.get("name", asset.name),
            "category": body.get("category", "未分类"),
        },
    )
    db.add(job)
    db.flush()
    return job_json(job)


def job_json(job):
    return {
        "id": job.id,
        "status": job.status,
        "result": job.result,
        "error": job.error,
        "attempts": job.attempts,
        "createdAt": job.created_at,
        "name": job.payload.get("name", ""),
    }


@router.get("/model-imports")
def jobs(request: Request, db: Session = Depends(session, scope="function")):
    owner = workspace(request, db)
    return [
        job_json(j)
        for j in db.scalars(
            select(Job).where(Job.workspace_id == owner.id).order_by(Job.created_at.desc()).limit(200)
        )
    ]


@router.post("/model-imports/{job_id}/retry")
def retry(job_id: str, request: Request, db: Session = Depends(session, scope="function")):
    owner = workspace(request, db)
    job = db.scalar(select(Job).where(Job.id == job_id, Job.workspace_id == owner.id).with_for_update())
    require(job is not None, "任务不存在", 404)
    require(job.status == "failed", "任务当前不能重试", 409)
    job.status, job.error, job.leased_until = "queued", None, None
    return job_json(job)


@router.put("/models/{model_id}/metadata", status_code=201)
def edit_metadata(
    model_id: str, body: dict, request: Request, db: Session = Depends(session, scope="function")
):
    owner = workspace(request, db)
    model = db.get(ModelDefinition, (model_id, body.get("baseVersion")))
    require(model and model.workspace_id == owner.id, "模型不存在或是只读内置模型", 404)
    payload = {
        **model.payload,
        **{
            k: v
            for k, v in body.items()
            if k in ("name", "category", "description", "sockets", "attachments")
        },
    }
    require(all(text(payload.get(k, "")) for k in ("name", "category", "description")), "模型属性无效")
    payload["version"] = uid()
    checked, ids = model_metadata(db, owner.id, payload, db.get(Asset, model.asset_id))
    db.add(
        ModelDefinition(
            id=model_id,
            version=payload["version"],
            workspace_id=owner.id,
            asset_id=model.asset_id,
            payload=checked,
        )
    )
    references(db, ids, "model", model_id, payload["version"])
    db.flush()
    return checked
