import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { validateBytes } from 'gltf-validator';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';

const results = [];
const names = ['aircraft', 'tank', 'sensor', 'vehicle'];
const afsimManifest = JSON.parse(await readFile(new URL('../../public/models/afsim/manifest.json', import.meta.url), 'utf8'));
for (const item of afsimManifest.items ?? []) if (item.status === 'embedded') names.push(`afsim/${item.name}`);
for (const name of names) {
  const path = new URL(name.startsWith('afsim/') ? `../../public/models/afsim/${name.slice(6)}.glb` : `../../public/models/demo-v1/${name}.glb`, import.meta.url);
  const bytes = await readFile(path);
  const validation = await validateBytes(bytes, { uri: path.pathname });
  assert.equal(validation.issues.numErrors, 0, `${name} 格式无效`);
  assert.equal(validation.issues.numWarnings, 0, `${name} 格式警告`);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const box = new Box3().setFromObject(gltf.scene);
  const dimensions = box.getSize(new Vector3()).toArray();
  const nodes = [];
  let triangles = 0;
  gltf.scene.traverse((node) => {
    if (node.isMesh) triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    if (node.userData.mapArmyNodeRole) nodes.push({ ...node.userData, position: node.getWorldPosition(new Vector3()).toArray() });
  });
  assert.ok(triangles > 100 && triangles < 80000);
  assert.ok(bytes.length < 5 * 1024 * 1024);
  if (name === 'aircraft') {
    assert.deepEqual(nodes.map((node) => node.socketId).sort(), ['center', 'left_wing', 'right_wing']);
    assert.ok(Math.abs(dimensions[0] - 11.8) < 0.01 && Math.abs(dimensions[2] - 13.6) < 0.01, '轴向或米制尺寸不符');
    assert.ok(nodes.find((node) => node.socketId === 'left_wing').position[0] > 0, '左侧应为 +X');
    assert.ok(nodes.find((node) => node.socketId === 'center').position[2] > 0, '机腹前挂点应在 +Z');
  } else if (name === 'tank' || name === 'sensor') {
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].mapArmyNodeRole, 'attachmentAnchor');
    assert.ok(nodes[0].position.every((value) => Math.abs(value) < 0.0001));
    assert.ok(box.max.y < 0.001, '部件应位于安装锚点下方');
  }
  results.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), triangles, dimensionsMeters: dimensions, nodes, issues: validation.issues });
}
await writeFile(new URL('./validation.json', import.meta.url), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results.map(({ name, bytes, triangles, issues }) => ({ name, bytes, triangles, errors: issues.numErrors, warnings: issues.numWarnings })), null, 2));
