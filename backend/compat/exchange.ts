/** 服务端格式适配器复用现有算法；只通过标准输入输出交换 JSON。 */
import { readFileSync } from 'node:fs';
import { parseMapFile, exportMilxArchive } from '../../src/core/io/files';
import { documentToMilxXml, milxExportWarnings } from '../../src/core/io/milxNative';
import { serializeMilxly } from '../../src/core/io/milxly';
import { documentToGeoJson } from '../../src/core/io/geojson';
import { documentToKml } from '../../src/core/io/kml';
import { afsimFilesToDocument } from '../../src/core/io/afsim';
import { documentToAfsim } from '../../src/core/io/afsimExport';
import { EQUIPMENT_MODELS } from '../../src/core/model/equipment3d';
import { AFSIM_MODEL_CATALOG } from '../../src/core/model/afsimCatalog';
import { listCatalog } from '../../src/core/symbology/catalog';

async function main() {
  if (process.argv.includes('--catalog'))
    return { models: EQUIPMENT_MODELS, afsim: AFSIM_MODEL_CATALOG, symbols: listCatalog() };
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (input.action === 'import')
    return parseMapFile(new Uint8Array(Buffer.from(input.data, 'base64')), input.name);
  if (input.action === 'afsim-import')
    return afsimFilesToDocument(
      input.files.map((f: { path: string; content: string }) => ({ path: f.path, size: Buffer.byteLength(f.content), readText: async () => f.content })),
      input.entry,
    );
  if (input.action !== 'export') throw new Error('未知文件操作');
  const doc = input.document;
  const format = input.format;
  if (format === 'afsim') {
    const result = documentToAfsim(doc, input.options ?? {});
    return { ...result, archive: undefined, data: Buffer.from(result.archive).toString('base64'), mime: 'application/zip', extension: 'zip' };
  }
  const warnings = ['milxlyz', 'milxly', 'milx'].includes(format) ? milxExportWarnings(doc) : [];
  if (format === 'kml' && doc.features.some((f: { equipment3d?: unknown }) => f.equipment3d))
    warnings.push('KML 不保留三维装配；如需继续编辑装配，请另存项目 JSON');
  if (format === 'milxlyz') return { data: Buffer.from(exportMilxArchive(doc)).toString('base64'), mime: 'application/milxlyz', extension: format, warnings };
  const text = format === 'json' ? serializeMilxly(doc) : format === 'geojson' ? JSON.stringify(documentToGeoJson(doc), null, 2) : format === 'kml' ? documentToKml(doc) : documentToMilxXml(doc);
  return { data: Buffer.from(text).toString('base64'), mime: ['json', 'geojson'].includes(format) ? 'application/json' : 'application/xml', extension: format, warnings };
}
main().then(result => process.stdout.write(JSON.stringify(result))).catch(error => {
  process.stdout.write(JSON.stringify({ error: error instanceof Error ? error.message : '文件处理失败' }));
  process.exitCode = 1;
});
