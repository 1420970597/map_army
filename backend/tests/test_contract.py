"""通过真实 MySQL 和 S3 验证 API 的数据、权限与并发契约。"""

import copy
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.db import engine
from backend.app.main import app
from backend.app.models import Feature, Layer


@pytest.fixture
def client():
    with TestClient(app) as client:
        response = client.post("/api/workspaces", json={"name": "集成验收"})
        assert response.status_code == 201, response.text
        yield client


def document():
    return {
        "name": "往返标图",
        "schemaVersion": 1,
        "createdAt": 1,
        "updatedAt": 1,
        "layers": [
            {"id": "layer-a", "name": "甲", "visible": True, "locked": False, "opacity": 1, "order": 0}
        ],
        "features": [
            {
                "id": "feature-a",
                "layerId": "layer-a",
                "sidc": "10031000001211000000",
                "name": "单位",
                "geometry": {"kind": "point", "position": {"lon": 8.5, "lat": 47.4}},
                "textFields": {},
                "createdAt": 1,
                "updatedAt": 1,
            }
        ],
        "nativeMetadata": {"example": {"unknownField": "保留"}},
    }


def test_project_versions_relations_permissions_and_conflicts(client):
    doc = document()
    result = client.post("/api/projects", json={"document": doc})
    assert result.status_code == 201, result.text
    project = result.json()
    assert client.get(f"/api/projects/{project['id']}").json()["document"] == doc
    with Session(engine()) as db:
        assert (
            db.scalar(select(func.count()).select_from(Layer).where(Layer.project_id == project["id"])) == 1
        )
        assert (
            db.scalar(select(func.count()).select_from(Feature).where(Feature.project_id == project["id"]))
            == 1
        )
    doc["name"] = "第二版"
    endpoint = f"/api/projects/{project['id']}"
    assert client.put(endpoint, json={"document": doc}, headers={"If-Match": "1"}).status_code == 200
    assert client.put(endpoint, json={"document": doc}, headers={"If-Match": "1"}).status_code == 409
    assert client.get(endpoint + "?revision=1").json()["document"]["name"] == "往返标图"
    with TestClient(app) as other:
        other.post("/api/workspaces", json={})
        assert other.get(endpoint).status_code == 404
    invalid = copy.deepcopy(doc)
    invalid["features"][0]["layerId"] = "missing"
    assert client.put(endpoint, json={"document": invalid}, headers={"If-Match": "2"}).status_code == 422
    assert client.get(endpoint).json()["revision"] == 2


def test_share_contract_and_concurrent_updates(client):
    share = client.post("/api/shares", json={"document": document()}).json()
    endpoint = "/api/shares/" + share["id"]
    assert client.put(endpoint, json={"document": document()}, headers={"If-Match": "1"}).status_code == 403
    headers = {"Authorization": "Bearer " + share["token"], "If-Match": "1"}
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(
            pool.map(
                lambda _: client.put(endpoint, json={"document": document()}, headers=headers).status_code,
                range(2),
            )
        )
    assert sorted(statuses) == [200, 409]
    assert client.get(endpoint + "?version=1").json()["latestVersion"] == 2
    assert client.post(endpoint + "/copy").json()["id"] != share["id"]


def test_locked_layer_and_geometry_checked_on_server(client):
    doc = document()
    doc["layers"][0]["locked"] = True
    project = client.post("/api/projects", json={"document": doc}).json()
    doc["features"][0]["name"] = "不应写入"
    assert (
        client.put(
            "/api/projects/" + project["id"], json={"document": doc}, headers={"If-Match": "1"}
        ).status_code
        == 409
    )
    doc["features"][0]["geometry"]["position"]["lat"] = 999
    assert client.post("/api/projects", json={"document": doc}).status_code == 422


def test_assets_and_snapshot_reference_protection(client):
    asset = client.post(
        "/api/assets", files={"file": ("note.txt", b"reference-data", "text/plain")}, data={"kind": "file"}
    ).json()
    assert client.get(asset["url"]).content == b"reference-data"
    with TestClient(app) as other:
        other.post("/api/workspaces", json={})
        assert other.get(asset["url"]).status_code == 404
    doc = document()
    doc["nativeMetadata"]["assetUrl"] = asset["url"]
    assert client.post("/api/projects", json={"document": doc}).status_code == 201
    assert client.delete("/api/assets/" + asset["id"]).status_code == 409
    share = client.post("/api/shares", json={"document": doc}).json()
    with TestClient(app) as visitor:
        assert visitor.get(asset["url"] + "?share=" + share["id"] + "&version=1").content == b"reference-data"


def test_settings_favorites_and_custom_symbols_do_not_overwrite_each_other(client):
    data = {
        "preferences": {"language": "de"},
        "symbol": {"symbolMode": "extended"},
        "favorites": ["abc", "abc"],
        "customSymbols": [
            {
                "id": "custom-one",
                "name": "自定义",
                "svg": '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>',
                "createdAt": 1,
                "updatedAt": 1,
            }
        ],
    }
    response = client.put("/api/workspace/settings", json=data, headers={"If-Match": "0"})
    assert response.status_code == 200, response.text
    saved = client.get("/api/workspace/settings").json()
    assert saved["preferences"]["language"] == "de"
    assert saved["favorites"] == ["abc"]
    assert saved["customSymbols"][0]["id"] == "custom-one"
    assert client.put("/api/workspace/settings", json=data, headers={"If-Match": "0"}).status_code == 409


def test_exchange_backend_roundtrip_and_model_job(client):
    from pathlib import Path

    from backend.app.worker import run_one

    export = client.post("/api/exchange/export", json={"document": document(), "format": "json"})
    assert export.status_code == 200, export.text
    asset = export.json()["asset"]
    raw = client.get(asset["url"]).content
    imported = client.post("/api/exchange/import", files={"file": ("project.json", raw, "application/json")})
    assert imported.status_code == 200, imported.text
    assert imported.json()["document"]["features"][0]["name"] == "单位"
    data = Path("public/models/demo-v1/aircraft.glb").read_bytes()
    source = client.post(
        "/api/assets",
        files={"file": ("aircraft.glb", data, "model/gltf-binary")},
        data={"kind": "model-source"},
    ).json()
    job = client.post("/api/model-imports", json={"assetId": source["id"], "name": "自定义飞机"}).json()
    assert job["status"] == "queued"
    for _ in range(20):
        run_one()
        found = next(j for j in client.get("/api/model-imports").json() if j["id"] == job["id"])
        if found["status"] in ("complete", "failed"):
            break
    assert found["status"] == "complete", found
    assert len(found["result"]["sockets"]) == 3
    assert any(m["id"] == found["result"]["id"] for m in client.get("/api/models").json())


def test_browser_migration_idempotent(client):
    payload = {
        "sourceKey": "legacy-browser-v1",
        "document": document(),
        "settings": {"favorites": ["favorite-one"]},
    }
    first = client.post("/api/workspace/migrate", json=payload)
    again = client.post("/api/workspace/migrate", json=payload)
    assert first.status_code == 200, first.text
    assert again.json()["project"]["id"] == first.json()["project"]["id"]
    assert len(client.get("/api/projects").json()) == 1


def test_legacy_share_migration_preserves_old_token(client, tmp_path):
    import json
    import secrets

    from backend.app.auth import digest
    from backend.app.manage import migrate_legacy

    identifier, token = secrets.token_hex(16), secrets.token_urlsafe(32)
    folder = tmp_path / identifier
    folder.mkdir()
    (folder / "meta.json").write_text(json.dumps({"version": 1, "tokenHash": digest(token)}))
    (folder / "1.json").write_text(json.dumps({"document": document(), "version": 1, "updatedAt": 123}))
    migrate_legacy(tmp_path)
    migrate_legacy(tmp_path)
    assert client.get("/api/shares/" + identifier).json()["updatedAt"] == 123
    assert (
        client.put(
            "/api/shares/" + identifier,
            json={"document": document()},
            headers={"Authorization": "Bearer " + token, "If-Match": "1"},
        ).status_code
        == 200
    )
