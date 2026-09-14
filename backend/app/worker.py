"""MySQL 租约队列允许任务在进程中断后重新领取，HTTP 不等待 Blender。"""

import json
import subprocess
import tempfile
import time
from pathlib import Path

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .db import engine
from .documents import references
from .model_assets import inspect_glb, model_metadata
from .models import Asset, Job, ModelDefinition, now
from .mover_render import render_bundle
from .storage import read_asset, store_asset


def run_one(job_id=None):
    with Session(engine()) as db, db.begin():
        job = db.scalar(
            select(Job)
            .where(or_(Job.status == "queued", (Job.status == "running") & (Job.leased_until < now())))
            .where(Job.id == job_id if job_id else True)
            .order_by(Job.created_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if not job:
            return False
        job.status = "running"
        job.attempts += 1
        job.leased_until = now() + 240000
        identifier, attempt, source, owner, metadata = (
            job.id,
            job.attempts,
            job.source_asset_id,
            job.workspace_id,
            job.payload,
        )
    try:
        with Session(engine()) as db:
            asset = db.get(Asset, source)
            with read_asset(asset) as body:
                data = body.read()
            filename = asset.name
        bundle = None
        if metadata.get("kind") == "mover":
            bundle = json.loads(data)
            with Session(engine()) as db:
                data = render_bundle(db, owner, bundle, assembled=False)
        elif filename.lower().endswith(".obj"):
            with tempfile.TemporaryDirectory(prefix="maparmy-model-") as tmp:
                path = Path(tmp)
                # OBJ 原件只携带几何；材质依赖需要使用自包含 GLB 导入。
                allowed = {"v", "vt", "vn", "f", "o", "g", "s"}
                geometry = "\n".join(
                    line
                    for line in data.decode("utf-8-sig").splitlines()
                    if line.split() and line.split()[0] in allowed
                )
                (path / "source.obj").write_text(geometry)
                subprocess.run(
                    [
                        "blender",
                        "--background",
                        "--factory-startup",
                        "--disable-autoexec",
                        "--python-exit-code",
                        "1",
                        "--python",
                        str(Path(__file__).with_name("convert_model.py").resolve()),
                        "--",
                        str(path),
                    ],
                    check=True,
                    timeout=180,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                data = (path / "model.glb").read_bytes()
        info = inspect_glb(data)
        with Session(engine()) as db, db.begin():
            job = db.scalar(select(Job).where(Job.id == identifier).with_for_update())
            if job.status != "running" or job.attempts != attempt:
                return True
            output = store_asset(db, data, metadata["name"] + ".glb", "model/gltf-binary", "model", owner)
            payload = {
                "id": metadata["modelId"],
                "version": metadata.get("version", "1"),
                "name": metadata["name"],
                "category": metadata["category"],
                "description": "自定义三维模型",
                "url": f"/api/assets/{output.id}/content",
                "sockets": info["sockets"],
                "attachments": [],
                "hasAttachmentAnchor": info["hasAttachmentAnchor"],
                "meshCount": info["meshCount"],
                "source": "custom",
            }
            asset_ids = {output.id}
            if bundle is not None:
                payload["equipmentType"] = (
                    "aircraft"
                    if bundle.get("amc", {}).get("VehicleType") == "Aircraft"
                    else "weapon"
                    if bundle.get("amc", {}).get("VehicleType") == "Weapon"
                    else "custom"
                )
                payload["attachments"] = bundle.get("attachments", [])
                payload["sockets"] = [
                    {"id": m["id"], "name": m.get("name", m["id"]), "accepts": m.get("accepts", [])}
                    for m in bundle.get("mounts", [])
                    if m["role"] == "socket"
                ]
                payload, asset_ids = model_metadata(db, owner, payload, output)
            db.add(
                ModelDefinition(
                    id=payload["id"],
                    version=payload["version"],
                    workspace_id=owner,
                    asset_id=output.id,
                    payload=payload,
                )
            )
            references(db, asset_ids, "model", payload["id"], payload["version"])
            job.status, job.result, job.error, job.leased_until = "complete", payload, None, None
    except Exception as exc:
        with Session(engine()) as db, db.begin():
            job = db.scalar(select(Job).where(Job.id == identifier).with_for_update())
            if job.status == "running" and job.attempts == attempt:
                job.status, job.error, job.leased_until = (
                    "failed",
                    str(getattr(exc, "detail", exc))[:2000],
                    None,
                )
    return True


if __name__ == "__main__":
    while True:
        if not run_one():
            time.sleep(2)
