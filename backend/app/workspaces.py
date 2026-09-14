"""工作空间和用户资料；不将不同浏览器的数据混在公共默认空间。"""

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .auth import COOKIE, credential, digest, workspace
from .config import settings
from .db import session
from .models import AssetReference, CustomSymbol, Favorite, MigrationRecord, Preference, Project, Workspace
from .preferences import validate_preferences
from .storage import store_asset
from .validation import require, sanitize_svg, text

router = APIRouter(prefix="/api")


class WorkspaceInput(BaseModel):
    name: str = Field(default="我的工作空间", min_length=1, max_length=200)


def bind_cookie(response, token):
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        samesite="strict",
        secure=settings().cookie_secure,
        max_age=365 * 86400,
        path="/api",
    )


@router.post("/workspaces", status_code=201)
def create_workspace(
    body: WorkspaceInput, response: Response, db: Session = Depends(session, scope="function")
):
    token = credential()
    value = Workspace(name=body.name, token_hash=digest(token))
    db.add(value)
    db.flush()
    bind_cookie(response, token)
    return {"id": value.id, "name": value.name, "token": token}


@router.get("/workspace")
def current_workspace(request: Request, db: Session = Depends(session, scope="function")):
    value = workspace(request, db)
    return {"id": value.id, "name": value.name}


@router.post("/workspace/connect")
def connect_workspace(body: dict, response: Response, db: Session = Depends(session, scope="function")):
    token = body.get("token")
    require(text(token, 200), "工作空间访问码无效", 401)
    value = db.scalar(select(Workspace).where(Workspace.token_hash == digest(token)))
    require(value is not None, "工作空间访问码无效", 401)
    bind_cookie(response, token)
    return {"id": value.id, "name": value.name}


def if_match(request, version):
    header = request.headers.get("if-match")
    require(header is not None, "保存需要版本号 If-Match", 428)
    require(header.strip('"') == str(version), "已有新版本，当前修改未覆盖服务器数据", 409)


def settings_json(db, value):
    data = {
        p.scope: p.value for p in db.scalars(select(Preference).where(Preference.workspace_id == value.id))
    }
    return {
        **data,
        "preferences": data.get("preferences", {}),
        "symbol": data.get("symbol", {}),
        "favorites": list(
            db.scalars(
                select(Favorite.symbol_key)
                .where(Favorite.workspace_id == value.id)
                .order_by(Favorite.position)
            )
        ),
        "customSymbols": [
            s.payload
            for s in db.scalars(
                select(CustomSymbol).where(CustomSymbol.workspace_id == value.id).order_by(CustomSymbol.id)
            )
        ],
        "version": value.settings_version,
    }


@router.get("/workspace/settings")
def read_settings(request: Request, db: Session = Depends(session, scope="function")):
    return settings_json(db, workspace(request, db))


def write_settings(db, value, body):
    for scope in ("preferences", "symbol", "view"):
        data = body.get(scope, {})
        validate_preferences(scope, data)
        require(len(str(data)) <= 100000, "偏好内容过大")
        pref = db.get(Preference, (value.id, scope))
        if pref:
            pref.value = data
        else:
            db.add(Preference(workspace_id=value.id, scope=scope, value=data))
    favorites = body.get("favorites", [])
    require(
        isinstance(favorites, list) and len(favorites) <= 5000 and all(text(k, 160) and k for k in favorites),
        "收藏列表无效",
    )
    db.execute(delete(Favorite).where(Favorite.workspace_id == value.id))
    for position, key in enumerate(dict.fromkeys(favorites)):
        db.add(Favorite(workspace_id=value.id, symbol_key=key, position=position))
    symbols = body.get("customSymbols", [])
    require(isinstance(symbols, list) and len(symbols) <= 2000, "自定义军标列表无效")
    keep = set()
    for symbol in symbols:
        require(
            isinstance(symbol, dict)
            and text(symbol.get("id"), 160)
            and symbol.get("id")
            and text(symbol.get("name")),
            "自定义军标属性无效",
        )
        require(symbol["id"] not in keep, "自定义军标标识重复")
        keep.add(symbol["id"])
        old = db.get(CustomSymbol, (value.id, symbol["id"]))
        payload = {**symbol, "svg": sanitize_svg(symbol.get("svg"))}
        if old and old.payload == payload:
            continue
        if old and old.payload["svg"] == payload["svg"]:
            old.payload = payload
            continue
        asset = store_asset(
            db, payload["svg"].encode(), symbol["name"] + ".svg", "image/svg+xml", "symbol", value.id
        )
        if old:
            db.execute(
                delete(AssetReference).where(
                    AssetReference.owner_type == "symbol",
                    AssetReference.owner_id == digest(value.id + ":" + symbol["id"]),
                )
            )
            old.asset_id, old.payload = asset.id, payload
        else:
            db.add(CustomSymbol(workspace_id=value.id, id=symbol["id"], asset_id=asset.id, payload=payload))
        db.add(
            AssetReference(
                asset_id=asset.id,
                owner_type="symbol",
                owner_id=digest(value.id + ":" + symbol["id"]),
                version="current",
            )
        )
    for old in db.scalars(select(CustomSymbol).where(CustomSymbol.workspace_id == value.id)):
        if old.id not in keep:
            db.execute(
                delete(AssetReference).where(
                    AssetReference.owner_type == "symbol",
                    AssetReference.owner_id == digest(value.id + ":" + old.id),
                )
            )
            db.delete(old)
    value.settings_version += 1
    db.flush()
    return settings_json(db, value)


@router.put("/workspace/settings")
def save_settings(body: dict, request: Request, db: Session = Depends(session, scope="function")):
    owner = workspace(request, db)
    owner = db.scalar(
        select(Workspace)
        .where(Workspace.id == owner.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if_match(request, owner.settings_version)
    return write_settings(db, owner, body)


@router.post("/workspace/migrate")
def migrate_browser(body: dict, request: Request, db: Session = Depends(session, scope="function")):
    from .documents import save_project

    owner = workspace(request, db)
    db.scalar(select(Workspace).where(Workspace.id == owner.id).with_for_update())
    key = body.get("sourceKey")
    require(text(key, 100) and key, "迁移来源标识无效")
    existing = db.scalar(
        select(MigrationRecord).where(
            MigrationRecord.workspace_id == owner.id, MigrationRecord.source_key == key
        )
    )
    if existing:
        return existing.result
    result = {"project": None}
    if body.get("document"):
        project = Project(workspace_id=owner.id, name="迁移项目", revision=0)
        db.add(project)
        db.flush()
        result["project"] = save_project(db, project, body["document"], first=True)
    if owner.settings_version == 0 and body.get("settings"):
        write_settings(db, owner, body["settings"])
    db.add(MigrationRecord(workspace_id=owner.id, source_key=key, result=result))
    db.flush()
    return result
