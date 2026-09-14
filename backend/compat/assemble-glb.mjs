/** 合并自包含 GLB，安装矩阵为挂点世界变换乘安装锚点逆矩阵。 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments } from '@gltf-transform/functions';
import { Matrix4 } from 'three';
async function main() {
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
try {
  const input = JSON.parse(Buffer.concat(chunks));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(Buffer.from(input.base, 'base64'));
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  for (const part of input.parts) {
    const socket = doc.getRoot().listNodes().find(n => n.getExtras().socketId === part.socketId && n.getExtras().mapArmyNodeRole === 'attachmentSocket');
    if (!socket) throw new Error('挂点不存在');
    const source = await io.readBinary(Buffer.from(part.data, 'base64'));
    const sourceScene = source.getRoot().getDefaultScene() ?? source.getRoot().listScenes()[0];
    const anchor = source.getRoot().listNodes().find(n => n.getExtras().mapArmyNodeRole === 'attachmentAnchor');
    if (!anchor) throw new Error('部件缺少安装锚点');
    const inverse = new Matrix4().fromArray(anchor.getWorldMatrix());
    if (Math.abs(inverse.determinant()) < 1e-12) throw new Error('安装锚点变换不可逆');
    const placement = new Matrix4().fromArray(socket.getWorldMatrix()).multiply(inverse.invert()).toArray();
    const mapping = mergeDocuments(doc, source);
    const container = doc.createNode(part.name).setMatrix(placement).setExtras({ assemblySocket: part.socketId });
    scene.addChild(container);
    for (const child of sourceScene.listChildren()) container.addChild(mapping.get(child));
    for (const n of source.getRoot().listNodes()) {
      const mapped = mapping.get(n);
      const extra = { ...mapped.getExtras() };
      delete extra.mapArmyNodeRole; delete extra.socketId; delete extra.mapArmyMount;
      delete extra.instanceId; delete extra.componentId;
      delete extra.moverSourceNode;
      mapped.setExtras(extra);
    }
    for (const s of source.getRoot().listScenes()) mapping.get(s).dispose();
  }
  // GLB 只允许一个二进制缓冲区，合并后统一所有 accessor/image 的归属。
  const buffers = doc.getRoot().listBuffers();
  const buffer = buffers[0] ?? doc.createBuffer();
  for (const accessor of doc.getRoot().listAccessors()) accessor.setBuffer(buffer);
  for (const unused of buffers.slice(1)) unused.dispose();
  process.stdout.write(await io.writeBinary(doc));
} catch (error) {
  process.stderr.write(error.message);
  process.exitCode = 1;
}
}
void main();
