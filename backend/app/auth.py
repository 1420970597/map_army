"""私有工作空间凭证与公开分享编辑令牌相互独立。"""

import hashlib
import secrets

from fastapi import HTTPException, Request
from sqlalchemy import select

from .models import Workspace

COOKIE = "map_army_workspace"


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def credential():
    return secrets.token_urlsafe(32)


def optional_workspace(request: Request, db):
    token = request.headers.get("X-Workspace-Token") or request.cookies.get(COOKIE)
    if not token:
        return None
    return db.scalar(select(Workspace).where(Workspace.token_hash == digest(token)))


def workspace(request, db):
    result = optional_workspace(request, db)
    if not result:
        raise HTTPException(401, "请连接工作空间")
    return result
