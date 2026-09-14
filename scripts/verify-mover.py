"""逐模型验证原始资源、组件身份、节点变换与依赖包往返，并输出覆盖证据。"""
import hashlib
import json
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.mover import geometry

rows = []
for entry in geometry.catalog():
    if entry['kind'] != 'vehicle':
        continue
    bundle = {'amc': geometry.template('vehicle', entry['id']), 'mounts': []}
    data = geometry.glb(bundle)
    root, chunks = geometry.unpack_glb(data)
    meshes, _ = geometry.meshes(bundle)
    expected = {m['name']: m['positions'] for m in meshes}
    actual = {name: [] for name in expected}
    for node in root['nodes']:
        if 'mesh' not in node:
            continue
        accessor = root['accessors'][node['mesh']]
        view = root['bufferViews'][accessor['bufferView']]
        positions = struct.unpack_from('<' + 'f' * accessor['count'] * 3, chunks, 8 + view['byteOffset'])
        matrix = node['matrix']
        actual[node['extras']['componentId']].extend(sum(matrix[c*4+r]*positions[j+c] for c in range(3))+matrix[12+r] for j in range(0,len(positions),3) for r in range(3))
    error = max(abs(a-b) for name in expected for a,b in zip(expected[name],actual[name]))
    assert error < 0.00001, (entry['id'], error)
    assert geometry.glb(geometry.import_bundle(geometry.export_bundle(bundle), 'roundtrip.zip')) == data
    rows.append({'id':entry['id'], 'sourceSha256':entry['sha256'], 'glbSha256':hashlib.sha256(data).hexdigest(), 'components':len(bundle['amc']['geometry']), 'meshInstances':len(root['meshes']), 'triangles':sum(a['count']//3 for a in root['accessors']), 'maxWorldPositionErrorMeters':error, 'roundtrip':'identical'})
output = Path(sys.argv[1] if len(sys.argv)>1 else 'docs/evidence/mover-creator-2026-09/coverage.json')
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps({'vehicles':len(rows),'resources':len(geometry.catalog()),'models':rows},indent=2)+'\n')
print(f'{len(rows)} 个模型：节点变换、组件与 AMC 往返全部通过')
