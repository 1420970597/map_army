/** 用外部示例校验静态部署；只读取用户本地资料，不将源文本复制到仓库。 */
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const root = resolve(process.argv[2] ?? '/root/afsim/demo');
const server = await createServer({ server: { middlewareMode: true } });
try {
  const { afsimFilesToDocument } = await server.ssrLoadModule('/src/core/io/afsim.ts');
  const files = [];
  for (const path of await readdir(root, { recursive: true })) {
    const fullPath = resolve(root, path);
    const info = await stat(fullPath);
    if (info.isFile())
      files.push({ path, size: info.size, readText: () => readFile(fullPath, 'utf8') });
  }
  for (const entry of [
    '0_sensor/main.txt',
    '0_sensor/sensor_demo.afproj',
    'simple_scenario/simple_scenario.txt',
  ]) {
    const result = await afsimFilesToDocument(files, entry);
    const features = result.document.features;
    assert.equal(result.skipped, 0, result.warnings.join('\n'));
    assert.equal(features.length, entry.startsWith('0_sensor') ? 6 : 1);
    if (entry.startsWith('0_sensor')) {
      assert.equal(features.filter((feature) => feature.sidc[3] === '3').length, 3);
      assert.equal(features.filter((feature) => feature.sidc[3] === '6').length, 3);
      const fighter = features.find((feature) => feature.name === 'f35c-2');
      assert.equal(fighter.geometry.kind, 'point');
      assert.ok(Math.abs(fighter.geometry.position.lat - 24.88821111) < 1e-7);
      assert.ok(Math.abs(fighter.geometry.position.lon - 135.01069167) < 1e-7);
    } else
      assert.deepEqual(features[0].geometry, { kind: 'point', position: { lat: 1.05, lon: 1.05 } });
    console.log(
      `${entry}: ${features.length} 单位，${result.sources.length} 源文件，${result.skipped} 跳过`,
    );
  }
} finally {
  await server.close();
}
