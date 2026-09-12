import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { createDocument, createFeature, createLayer } from '../model';
import { documentToAfsim, exportAfsimArchive } from './afsimExport';
import { afsimFilesToDocument, type AfsimSourceFile } from './afsim';

function sampleDocument() {
  const document = createDocument('演训态势');
  const blue = createLayer({ name: '蓝军 / 甲', order: 0, group: 'blue' });
  const red = createLayer({ name: '红军', order: 1, group: 'red' });
  document.layers = [blue, red];
  document.features = [
    createFeature({
      layerId: blue.id,
      name: 'Alpha 1',
      sidc: '10231000001100000000',
      geometry: { kind: 'point', position: { lat: 31.25, lon: 121.5 } },
      direction: 90,
      textFields: { type: 'WSF_AIR_MOVER', altitudeDepth: '1200 m' },
    }),
    createFeature({
      layerId: red.id,
      name: 'line is unsupported',
      sidc: '10261000001100000000',
      geometry: {
        kind: 'line',
        points: [
          { lat: 31, lon: 121 },
          { lat: 32, lon: 122 },
        ],
      },
    }),
  ];
  return document;
}

describe('AFSIM 想定导出', () => {
  it('生成标准入口、平台目录和项目文件，并可被导入器回读', async () => {
    const result = documentToAfsim(sampleDocument());
    expect(result.exported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.entry).toBe('main.txt');
    expect(result.files.map((file) => file.path)).toEqual([
      'main.txt',
      'platforms/blue.txt',
      'platforms/red.txt',
      '演训态势.afproj',
      'README.txt',
    ]);
    expect(result.files.find((file) => file.path === 'main.txt')?.content).toContain(
      'include_once platforms/blue.txt',
    );
    expect(result.files.find((file) => file.path === 'platforms/blue.txt')?.content).toContain(
      'platform Alpha_1 WSF_PLATFORM',
    );
    expect(result.files.find((file) => file.path === 'platforms/blue.txt')?.content).toContain(
      'position 31.25 121.5',
    );

    const sources: AfsimSourceFile[] = result.files.map((file) => ({
      path: file.path,
      size: file.content.length,
      readText: async () => file.content,
    }));
    const imported = await afsimFilesToDocument(sources, 'main.txt');
    expect(imported.document.features).toHaveLength(1);
    expect(imported.document.features[0].name).toBe('Alpha_1');
    expect(imported.document.features[0].geometry).toEqual({
      kind: 'point',
      position: { lat: 31.25, lon: 121.5 },
    });
    expect(imported.skipped).toBe(0);
  });

  it('打包为可展开的 ZIP，并支持只导出指定图层', () => {
    const document = sampleDocument();
    const layerId = document.layers[1].id;
    const result = documentToAfsim(document, { layerIds: [layerId], name: 'red-export' });
    const archive = exportAfsimArchive(document, { layerIds: [layerId], name: 'red-export' });
    expect(archive).toEqual(result.archive);
    const entries = unzipSync(archive);
    expect(Object.keys(entries)).toEqual([
      'main.txt',
      'platforms/red.txt',
      'red-export.afproj',
      'README.txt',
    ]);
    expect(strFromU8(entries['main.txt'])).not.toContain('blue.txt');
    expect(result.warnings.join('\n')).toContain('line is unsupported');
  });
});
