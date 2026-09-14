"""浏览器几何编辑的版本、交换、预览与发布接口。"""

import copy
import json

from backend.mover import geometry
from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from .assets import accessible
from .auth import workspace
from .db import session
from .documents import references
from .model_assets import inspect_glb, job_json
from .models import Asset, CatalogEntry, Job, ModelDefinition, MoverDesign, MoverVersion, now
from .storage import read_asset, store_asset
from .validation import require, text

router = APIRouter(prefix="/api/mover")


def imported_glb(db, request, asset_id):
    asset = accessible(db, request, asset_id)
    with read_asset(asset) as stream:
        data = stream.read()
    inspect_glb(data)
    return {"assetId": asset.id, "mounts": check(lambda: geometry.read_mounts(data))}


@router.get("/from-asset/{asset_id}")
def from_asset(asset_id: str, request: Request, db: Session = Depends(session, scope="function")):
    workspace(request, db)
    return imported_glb(db, request, asset_id)


@router.get("/from-model/{model_id}/{version}")
def from_model(
    model_id: str, version: str, request: Request, db: Session = Depends(session, scope="function")
):
    workspace(request, db)
    model = db.get(ModelDefinition, (model_id, version))
    require(model is not None, "模型不存在", 404)
    bundle = imported_glb(db, request, model.asset_id)
    bundle["attachments"] = [
        {"id": p["id"], "version": p["version"]} for p in model.payload.get("attachments", [])
    ]
    for mount in bundle["mounts"]:
        socket = next((s for s in model.payload["sockets"] if s["id"] == mount["id"]), None)
        if socket:
            mount["accepts"] = socket["accepts"]
    return bundle


def check(action):
    try:
        return action()
    except (ValueError, KeyError, TypeError, OSError) as exc:
        require(False, str(exc)[:1000])


def prepare(body, request, db):
    bundle = copy.deepcopy(body)
    require(isinstance(bundle, dict), "设计参数无效")
    if "amc" in bundle:
        check(lambda: geometry.commands(bundle))
        bundle = check(lambda: geometry.resolved_bundle(bundle))
    else:
        asset = accessible(db, request, bundle.get("assetId"))
        with read_asset(asset) as stream:
            check(lambda: inspect_glb(stream.read()))
    check(lambda: geometry.mount_nodes(bundle.get("mounts", [])))
    require(isinstance(bundle.get("attachments", []), list), "部件列表无效")
    return bundle


def protect(previous, current):
    old = previous.get("amc", {}).get("geometry", {})
    new = current.get("amc", {}).get("geometry", {})
    for name, g in old.items():
        if g.get("May Not Be Deleted"):
            require(
                name in new
                and new[name].get("May Not Be Deleted") is True
                and geometry.component_kind(new[name]) == geometry.component_kind(g),
                "固定组件不能删除、改名或更改类型：" + name,
            )
        if name in new and g.get("Symmetry Cannot Be Changed"):
            require(
                new[name].get("Symmetry Type") == g.get("Symmetry Type")
                and new[name].get("Symmetry Cannot Be Changed") is True,
                "固定对称规则不能更改：" + name,
            )


def get_design(db, request, identifier, lock=False):
    owner = workspace(request, db)
    query = select(MoverDesign).where(MoverDesign.id == identifier, MoverDesign.workspace_id == owner.id)
    design = db.scalar(query.with_for_update() if lock else query)
    require(design is not None, "设计不存在", 404)
    return design


def result(db, design, revision=None):
    version = db.get(MoverVersion, (design.id, revision or design.revision))
    require(version is not None, "设计版本不存在", 404)
    return {
        "id": design.id,
        "name": design.name,
        "revision": version.revision,
        "headRevision": design.revision,
        "bundle": version.payload,
        "sourceUrl": f"/api/assets/{version.source_asset_id}/content",
        "updatedAt": design.updated_at,
    }


def snapshot(db, design, bundle):
    source = store_asset(
        db,
        json.dumps(bundle, ensure_ascii=False, allow_nan=False).encode(),
        design.name + ".json",
        "application/json",
        "mover-design",
        design.workspace_id,
    )
    db.add(
        MoverVersion(design_id=design.id, revision=design.revision, payload=bundle, source_asset_id=source.id)
    )
    ids = {source.id}
    if bundle.get("assetId"):
        ids.add(bundle["assetId"])
    references(db, ids, "mover", design.id, str(design.revision))
    db.flush()


@router.get("/catalog")
def catalog(db: Session = Depends(session, scope="function")):
    return [
        entry.payload
        for entry in db.scalars(
            select(CatalogEntry).where(CatalogEntry.kind == "mover").order_by(CatalogEntry.id)
        )
    ]


@router.get("/templates/{kind}/{identifier}")
def template(kind: str, identifier: str, db: Session = Depends(session, scope="function")):
    entry = db.get(CatalogEntry, ("mover", kind + ":" + identifier))
    require(entry is not None, "模板不存在", 404)
    with read_asset(db.get(Asset, entry.payload["assetId"])) as stream:
        raw = stream.read()
    return json.loads(raw) if kind != "airfoil" else {"text": raw.decode()}


@router.post("/import")
async def import_amc(
    request: Request, file: UploadFile = File(), db: Session = Depends(session, scope="function")
):
    workspace(request, db)
    data = await file.read(20 * 1024 * 1024 + 1)
    require(len(data) <= 20 * 1024 * 1024, "AMC 包过大", 413)
    return check(lambda: geometry.import_bundle(data, file.filename or "source.amc"))


@router.post("/preview")
def preview(body: dict, request: Request, db: Session = Depends(session, scope="function")):
    workspace(request, db)
    bundle = prepare(body, request, db)
    if "amc" in bundle:
        data = check(lambda: geometry.glb(bundle))
    else:
        with read_asset(accessible(db, request, bundle["assetId"])) as stream:
            data = check(lambda: geometry.with_mounts(stream.read(), bundle.get("mounts", [])))
    return Response(data, media_type="model/gltf-binary")


@router.get("/designs")
def designs(request: Request, db: Session = Depends(session, scope="function")):
    owner = workspace(request, db)
    return [
        {"id": d.id, "name": d.name, "revision": d.revision, "updatedAt": d.updated_at}
        for d in db.scalars(
            select(MoverDesign)
            .where(MoverDesign.workspace_id == owner.id)
            .order_by(MoverDesign.updated_at.desc())
        )
    ]


@router.post("/designs", status_code=201)
def create(body: dict, request: Request, db: Session = Depends(session, scope="function")):
    owner = workspace(request, db)
    require(text(body.get("name"), 200) and body["name"].strip(), "设计名称无效")
    bundle = prepare(body.get("bundle", {}), request, db)
    design = MoverDesign(workspace_id=owner.id, name=body["name"])
    db.add(design)
    db.flush()
    snapshot(db, design, bundle)
    return result(db, design)


@router.get("/designs/{identifier}")
def load(
    identifier: str,
    request: Request,
    revision: int | None = None,
    db: Session = Depends(session, scope="function"),
):
    return result(db, get_design(db, request, identifier), revision)


@router.put("/designs/{identifier}")
def save(identifier: str, body: dict, request: Request, db: Session = Depends(session, scope="function")):
    design = get_design(db, request, identifier, True)
    require(
        request.headers.get("if-match") == str(design.revision),
        "设计已有新版本，请保留本地修改并另存副本或重新加载",
        409,
    )
    require(text(body.get("name"), 200) and body["name"].strip(), "设计名称无效")
    bundle = prepare(body.get("bundle", {}), request, db)
    protect(db.get(MoverVersion, (design.id, design.revision)).payload, bundle)
    design.revision += 1
    design.name, design.updated_at = body["name"], now()
    snapshot(db, design, bundle)
    return result(db, design)


@router.get("/designs/{identifier}/versions")
def versions(identifier: str, request: Request, db: Session = Depends(session, scope="function")):
    design = get_design(db, request, identifier)
    return [
        {"revision": v.revision, "createdAt": v.created_at}
        for v in db.scalars(
            select(MoverVersion)
            .where(MoverVersion.design_id == design.id)
            .order_by(MoverVersion.revision.desc())
        )
    ]


@router.get("/designs/{identifier}/export")
def export(
    identifier: str,
    request: Request,
    revision: int | None = None,
    db: Session = Depends(session, scope="function"),
):
    design = get_design(db, request, identifier)
    bundle = result(db, design, revision)["bundle"]
    require("amc" in bundle, "此设计是 GLB，请下载发布模型")
    return Response(
        check(lambda: geometry.export_bundle(bundle)),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=design.zip"},
    )


@router.post("/designs/{identifier}/publish", status_code=202)
def publish(identifier: str, body: dict, request: Request, db: Session = Depends(session, scope="function")):
    design = get_design(db, request, identifier, True)
    require(body.get("revision") == design.revision, "请先保存当前设计后发布", 409)
    require(text(body.get("category"), 200) and body["category"], "模型分类无效")
    model_id = "mover-" + design.id
    existing = db.get(ModelDefinition, (model_id, str(design.revision)))
    if existing:
        return {"status": "complete", "result": existing.payload}
    old = db.scalar(
        select(Job).where(
            Job.workspace_id == design.workspace_id,
            Job.payload["modelId"].as_string() == model_id,
            Job.payload["version"].as_string() == str(design.revision),
            Job.status.in_(["queued", "running"]),
        )
    )
    if old:
        return job_json(old)
    version = db.get(MoverVersion, (design.id, design.revision))
    job = Job(
        workspace_id=design.workspace_id,
        source_asset_id=version.source_asset_id,
        payload={
            "kind": "mover",
            "modelId": model_id,
            "version": str(design.revision),
            "name": design.name,
            "category": body["category"],
        },
    )
    db.add(job)
    db.flush()
    return job_json(job)
