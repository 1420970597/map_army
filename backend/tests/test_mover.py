"""实际 AMC、GLB、MySQL 与 S3 验证几何、历史、隔离和挂载契约。"""

import copy
import hashlib
import io
import json
import zipfile

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
        assert info["meshCount"] == len(geometry.commands(source)[0])
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
    part = {"id": "afsim-amc-TNK-370-1", "version": "amc-2"}
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


def test_invalid_imports_and_dependencies_are_recoverable(client):
    assert client.post("/api/mover/import", files={"file": ("broken.zip", b"broken")}).status_code == 422
    for invalid in [[], None, {"engine": []}, {"engine": {"bad": 1}}, {"airfoil": {"bad": {}}}]:
        value = bundle()
        value["dependencies"] = invalid
        assert client.post("/api/mover/preview", json=value).status_code == 422
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("maparmy-design.json", "[]")
    assert (
        client.post("/api/mover/import", files={"file": ("invalid.zip", output.getvalue())}).status_code
        == 422
    )


def test_parent_mount_follows_geometry_and_assembly_export(client):
    value = bundle()
    part = {"id": "afsim-amc-TNK-370-1", "version": "amc-2"}
    value["attachments"] = [part]
    value["mounts"] = [
        {
            "id": "right",
            "name": "右翼",
            "role": "socket",
            "parent": "Wing::1",
            "position": [0, -0.4, 2],
            "rotation": [0, 0, 0],
            "scale": [1, 1, 1],
            "accepts": [part["id"]],
        }
    ]
    before = geometry.glb(value)
    position = geometry.read_mounts(before)[0]["position"]
    value["amc"]["geometry"]["Wing"]["Reference Point"]["x"] += 10
    after = geometry.glb(value)
    moved = geometry.read_mounts(after)[0]["position"]
    assert moved[0] - position[0] == pytest.approx(3.048)
    assert moved[1:] == pytest.approx(position[1:])
    value["assembly"] = [{"socketId": "right", **part}]
    response = client.post("/api/mover/preview", json=value)
    assert response.status_code == 200, response.text
    assembled = response.content
    assert inspect_glb(assembled)["meshCount"] > inspect_glb(after)["meshCount"]
    root, _ = geometry.unpack_glb(assembled)
    assert any(n.get("extras", {}).get("assemblySocket") == "right" for n in root["nodes"])
    assert len(geometry.read_mounts(assembled)) == 1
    exported = geometry.export_bundle(value)
    restored = geometry.import_bundle(exported, "assembly.zip")
    assert restored["assembly"] == value["assembly"]
    assert client.post("/api/mover/preview", json=restored).content == assembled
    design = client.post("/api/mover/designs", json={"name": "装配导出", "bundle": value}).json()
    job = client.post(
        "/api/mover/designs/" + design["id"] + "/publish", json={"revision": 1, "category": "Aircraft"}
    ).json()
    run_one(job["id"])
    completed = next(j for j in client.get("/api/model-imports").json() if j["id"] == job["id"])
    model = completed["result"]
    exported_scene = client.post(
        "/api/mover/assembly-export",
        json={
            "modelId": model["id"],
            "assetVersion": model["version"],
            "attachments": [
                {"socketId": "right", "attachmentId": part["id"], "assetVersion": part["version"]}
            ],
        },
    )
    assert exported_scene.status_code == 200, exported_scene.text
    assert inspect_glb(exported_scene.content)["meshCount"] == inspect_glb(assembled)["meshCount"]


def test_glb_scaled_and_reflected_mount_roundtrip():
    value = bundle()
    mount = {
        "id": "scaled",
        "name": "缩放",
        "role": "socket",
        "position": [1, 2, 3],
        "rotation": [10, 20, 30],
        "scale": [-2, 3, 4],
        "accepts": [],
    }
    original = geometry.with_mounts(geometry.glb(value), [mount])
    restored = geometry.read_mounts(original)
    assert restored[0]["scale"] == pytest.approx(mount["scale"])
    assert restored[0]["rotation"] == pytest.approx(mount["rotation"])
    output = geometry.with_mounts(original, restored)
    assert geometry.read_mounts(output)[0]["scale"] == pytest.approx(mount["scale"])


def test_custom_engines_gear_and_shape_options():
    for entry in geometry.catalog():
        if entry["kind"] != "engine":
            continue
        engine = geometry.template("engine", entry["id"])
        value = {
            "amc": {"geometry": {"Engine": {"EngineType": engine["engine_type"], "EngineModel": entry["id"]}}}
        }
        assert geometry.meshes(value)[0][0]["positions"]
    value = {
        "amc": {
            "VehicleType": "Aircraft",
            "geometry": {
                "Gear": {
                    "GeometryObjectType": "GeometryLandingGear",
                    "Uncompressed Length": 5,
                    "Strut Diam": 0.25,
                    "Tire Diam": 1.5,
                    "Tire Width": 0.6,
                    "Max Angle": 90,
                    "Symmetrical": True,
                }
            },
        }
    }
    assert len(geometry.meshes(value, instances=True)[0]) == 2
    value["amc"]["VehicleType"] = "Weapon"
    with pytest.raises(ValueError, match="Aircraft"):
        geometry.glb(value)
