"""项目的 CRUD、修订和恢复；读取不会改变当前版本。"""

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import workspace
from .db import session
from .documents import document_of, save_project, share_assets
from .models import Project, ProjectVersion, Workspace
from .validation import require
from .workspaces import if_match

router = APIRouter(prefix="/api/projects")


class DocumentInput(BaseModel):
    document: dict
    unlockedLayerIds: list[str] = Field(default_factory=list, max_length=2000)
    clientId: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")


def owned_project(db, request, project_id, lock=False):
    owner = workspace(request, db)
    statement = select(Project).where(
        Project.id == project_id, Project.workspace_id == owner.id, Project.deleted.is_(False)
    )
    if lock:
        statement = statement.with_for_update()
    result = db.scalar(statement)
    require(result is not None, "项目不存在", 404)
    return result


@router.get("")
def list_projects(request: Request, db: Session = Depends(session, scope="function")):
    owner = workspace(request, db)
    return [
        {"id": p.id, "name": p.name, "revision": p.revision, "updatedAt": p.updated_at}
        for p in db.scalars(
            select(Project)
            .where(Project.workspace_id == owner.id, Project.deleted.is_(False))
            .order_by(Project.updated_at.desc())
        )
    ]


@router.post("", status_code=201)
def create_project(body: DocumentInput, request: Request, db: Session = Depends(session, scope="function")):
    owner = workspace(request, db)
    # 同一客户端草稿 ID 重试创建时返回原项目，避免响应丢失导致重复入库。
    if body.clientId:
        db.scalar(select(Workspace).where(Workspace.id == owner.id).with_for_update())
        existing = db.get(Project, body.clientId)
        if existing:
            require(existing.workspace_id == owner.id and not existing.deleted, "项目标识不可用", 409)
            return {
                "id": existing.id,
                "revision": existing.revision,
                "document": document_of(db, existing),
                "updatedAt": existing.updated_at,
            }
    value = Project(workspace_id=owner.id, name="新项目", revision=0)
    if body.clientId:
        value.id = body.clientId
    db.add(value)
    db.flush()
    return save_project(db, value, body.document, first=True, permitted=share_assets(db, request))


@router.get("/{project_id}")
def get_project(
    project_id: str,
    request: Request,
    revision: int | None = None,
    db: Session = Depends(session, scope="function"),
):
    project = owned_project(db, request, project_id)
    document = document_of(db, project)
    if revision is not None:
        version = db.get(ProjectVersion, (project.id, revision))
        require(version is not None, "项目修订不存在", 404)
        document = version.document
    return {
        "id": project.id,
        "revision": revision or project.revision,
        "latestRevision": project.revision,
        "document": document,
        "updatedAt": project.updated_at,
    }


@router.put("/{project_id}")
def update_project(
    project_id: str, body: DocumentInput, request: Request, db: Session = Depends(session, scope="function")
):
    project = owned_project(db, request, project_id, lock=True)
    if_match(request, project.revision)
    return save_project(db, project, body.document, unlocked=body.unlockedLayerIds)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, request: Request, db: Session = Depends(session, scope="function")):
    project = owned_project(db, request, project_id, lock=True)
    if_match(request, project.revision)
    project.deleted = True
    db.flush()
    return Response(status_code=204)


@router.get("/{project_id}/versions")
def versions(project_id: str, request: Request, db: Session = Depends(session, scope="function")):
    project = owned_project(db, request, project_id)
    return [
        {"revision": v.revision, "createdAt": v.created_at, "name": v.document["name"]}
        for v in db.scalars(
            select(ProjectVersion)
            .where(ProjectVersion.project_id == project.id)
            .order_by(ProjectVersion.revision.desc())
        )
    ]


@router.post("/{project_id}/versions/{revision}/restore")
def restore(
    project_id: str, revision: int, request: Request, db: Session = Depends(session, scope="function")
):
    project = owned_project(db, request, project_id, lock=True)
    if_match(request, project.revision)
    version = db.get(ProjectVersion, (project.id, revision))
    require(version is not None, "项目修订不存在", 404)
    return save_project(db, project, version.document, first=True)
