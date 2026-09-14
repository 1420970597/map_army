"""实际 AMC、GLB、MySQL 与 S3 验证几何、历史、隔离和挂载契约。"""

import copy
import hashlib
import json

import pytest
from backend.app.main import app
from backend.app.model_assets import inspect_glb
from backend.app.worker import run_one
from backend.mover import geometry
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    with TestClient(app) as c:
        assert c.post("/api/workspaces", json={"name": "Mover 验收"}).status_code == 201
        yield c


def bundle():
    return {"amc": geometry.template("vehicle", "F-L4-11A-1"), "mounts": []}


def test_complete_catalog_geometry_and_lossless_roundtrip():
    entries = geometry.catalog()
    assert {kind: sum(e["kind"] == kind for e in entries) for kind in ("vehicle", "engine", "airfoil")} == {
        "vehicle": 34,
        "engine": 45,
        "airfoil": 12,
    }
    for entry in entries:
        raw = (geometry.DATA / entry["path"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == entry["sha256"]
        if entry["kind"] != "vehicle":
            continue
        source = {"amc": json.loads(raw), "mounts": []}
        data = geometry.glb(source)
        info = inspect_glb(data)
        root, _ = geometry.unpack_glb(data)
        names = {n["extras"]["componentId"] for n in root["nodes"]}
        assert names == set(source["amc"]["geometry"]), entry["id"]
        assert info["meshCount"] == sum(
            geometry.component_kind(g) not in geometry.NON_VISUAL for g in source["amc"]["geometry"].values()
        )
        restored = geometry.import_bundle(geometry.export_bundle(source), "roundtrip.zip")
        assert restored["amc"] == source["amc"]
        assert geometry.glb(restored) == data


def test_wing_units_axes_and_horizontal_symmetry():
    source = {
        "amc": {
            "geometry": {
                "Wing": {
                    "GeometryObjectType": "GeometryWing",
                    "Span": 20,
                    "Root Chord": 4,
                    "Tip Chord": 2,
                    "Thickness Ratio": 0.1,
                    "Reference Point": {"x": 5, "y": 0, "z": -3},
                }
            }
        }
    }
    parts, _ = geometry.meshes(source)
    values = parts[0]["positions"]
    assert min(values[2::3]) == pytest.approx(-10 * 0.3048)
    assert max(values[2::3]) == pytest.approx(10 * 0.3048)
    assert (max(values[1::3]) + min(values[1::3])) / 2 == pytest.approx(3 * 0.3048)
    assert max(values[::3]) == pytest.approx(6 * 0.3048)
    source["amc"]["geometry"]["Wing"]["Sweep Angle"] = 90
    with pytest.raises(ValueError):
        geometry.glb(source)


def test_mount_matrix_roundtrip_preserves_mesh_bytes():
    original = geometry.glb(bundle())
    mounts = [
        {
            "id": "wing",
            "name": "右翼",
            "role": "socket",
            "position": [1, 2, 3],
            "rotation": [15, 30, 45],
            "accepts": [],
        },
        {
            "id": "anchor",
            "name": "安装",
            "role": "anchor",
            "position": [0, 0.2, 0],
            "rotation": [0, 90, 0],
            "accepts": [],
        },
    ]
    data = geometry.with_mounts(original, mounts)
    assert geometry.unpack_glb(data)[1] == geometry.unpack_glb(original)[1]
    read = geometry.read_mounts(data)
    for expected, actual in zip(mounts, read):
        assert actual["position"] == pytest.approx(expected["position"])
        assert actual["rotation"] == pytest.approx(expected["rotation"])
    twice = geometry.with_mounts(data, [mounts[0]])
    assert len(geometry.read_mounts(twice)) == 1
    assert inspect_glb(twice)["hasAttachmentAnchor"] is False


def test_design_versions_cas_permissions_and_export(client):
    value = bundle()
    value["amc"]["unknown-extension"] = {"keep": [1, "text", True]}
    created = client.post("/api/mover/designs", json={"name": "Test design", "bundle": value})
    assert created.status_code == 201, created.text
    design = created.json()
    url = "/api/mover/designs/" + design["id"]
    assert client.get(url).json()["bundle"]["amc"] == value["amc"]
    edited = copy.deepcopy(value)
    edited["amc"]["geometry"]["Wing"]["Span"] = 36
    saved = client.put(url, json={"name": "Test design", "bundle": edited}, headers={"If-Match": "1"})
    assert saved.status_code == 200, saved.text
    assert (
        client.put(url, json={"name": "Old", "bundle": value}, headers={"If-Match": "1"}).status_code == 409
    )
    assert client.get(url + "?revision=1").json()["bundle"]["amc"] == value["amc"]
    exported = client.get(url + "/export?revision=1")
    assert geometry.import_bundle(exported.content, "export.zip")["amc"] == value["amc"]
    broken = copy.deepcopy(edited)
    del broken["amc"]["geometry"]["Wing"]
    assert (
        client.put(url, json={"name": "Bad", "bundle": broken}, headers={"If-Match": "2"}).status_code == 422
    )
    assert client.get(url).json()["revision"] == 2
    with TestClient(app) as other:
        other.post("/api/workspaces", json={})
        assert other.get(url).status_code == 404
        assert other.get(design["sourceUrl"]).status_code == 404


def test_publish_mounts_and_immutable_asset_versions(client):
    value = bundle()
    part = {"id": "afsim-amc-TNK-370-1", "version": "amc-1"}
    value["mounts"] = [
        {
            "id": "right",
            "name": "右翼",
            "role": "socket",
            "position": [0, 0, 3],
            "rotation": [0, 0, 0],
            "accepts": [part["id"]],
        }
    ]
    value["attachments"] = [part]
    result = client.post("/api/mover/designs", json={"name": "挂载测试", "bundle": value})
    assert result.status_code == 201, result.text
    d = result.json()
    url = "/api/mover/designs/" + d["id"]
    response = client.post(url + "/publish", json={"revision": 1, "category": "航空器"})
    assert response.status_code == 202, response.text
    job = response.json()
    run_one(job["id"])
    completed = next(j for j in client.get("/api/model-imports").json() if j["id"] == job["id"])
    assert completed["status"] == "complete", completed
    model = completed["result"]
    source = client.get(model["url"]).content
    assert model["attachments"][0]["id"] == part["id"]
    assert geometry.read_mounts(source)[0]["position"] == [0, 0, 3]
    value["mounts"][0]["position"] = [0, 0, 4]
    assert (
        client.put(url, json={"name": "挂载测试", "bundle": value}, headers={"If-Match": "1"}).status_code
        == 200
    )
    job2 = client.post(url + "/publish", json={"revision": 2, "category": "航空器"}).json()
    run_one(job2["id"])
    assert client.get(model["url"]).content == source
    versions = [m for m in client.get("/api/models").json() if m["id"] == model["id"]]
    assert {m["version"] for m in versions} == {"1", "2"}
    derived = client.get(f"/api/mover/from-model/{model['id']}/1")
    assert derived.status_code == 200, derived.text
    assert derived.json()["mounts"][0]["accepts"] == [part["id"]]
    assert inspect_glb(client.post("/api/mover/preview", json=derived.json()).content)["meshCount"] > 0
