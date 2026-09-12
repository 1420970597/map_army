import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { createDocument, createFeature, createLayer } from '../model';
import { documentToAfsim, exportAfsimArchive, type AfsimExportResult } from './afsimExport';
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

async function reimport(result: AfsimExportResult, entry = 'main.txt') {
  return afsimFilesToDocument(
    result.files.map((file) => ({
      path: file.path,
      size: new TextEncoder().encode(file.content).length,
      readText: async () => file.content,
    })),
    entry,
  );
}

function platforms(result: AfsimExportResult) {
  return result.files
    .filter((file) => file.path.startsWith('platforms/'))
    .map((file) => file.content)
    .join('\n');
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
      'map_army_scenario.afproj',
      'README.txt',
    ]);
    expect(result.files.find((file) => file.path === 'main.txt')?.content).toContain(
      'include_once platforms/blue.txt',
    );
    expect(result.files.find((file) => file.path === 'platforms/blue.txt')?.content).toContain(
      'platform Alpha_1 WSF_PLATFORM',
    );
    expect(result.files.find((file) => file.path === 'platforms/blue.txt')?.content).toContain(
      'position 31.25N 121.5E',
    );

    const sources: AfsimSourceFile[] = result.files.map((file) => ({
      path: file.path,
      size: file.content.length,
      readText: async () => file.content,
    }));
    const imported = await afsimFilesToDocument(sources, 'main.txt');
    expect(imported.document.features).toHaveLength(1);
    expect(imported.document.features[0].name).toBe('Alpha 1');
    expect(imported.document.features[0].geometry).toEqual({
      kind: 'point',
      position: { lat: 31.25, lon: 121.5 },
    });
    expect(imported.skipped).toBe(0);
    expect(imported.document.features[0].sidc).toBe('10231000001100000000');
    expect(imported.document.features[0].direction).toBe(90);
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

  it('半球格式覆盖南纬西经、极点、日期变更线及极小坐标', async () => {
    const doc = sampleDocument();
    doc.features = [
      { lat: -12.5, lon: -179.99999999 },
      { lat: 90, lon: 180 },
      { lat: -90, lon: -180 },
      { lat: 1e-8, lon: -1e-8 },
      { lat: 0, lon: 0 },
    ].map((position, index) =>
      createFeature({
        layerId: doc.layers[0].id,
        name: `point-${index}`,
        sidc: '10031000001211000000',
        geometry: { kind: 'point', position },
      }),
    );
    const output = documentToAfsim(doc);
    expect(platforms(output)).toContain('position 12.5S 179.99999999W');
    expect(platforms(output)).toContain('position 90N 180E');
    expect(platforms(output)).toContain('position 0.00000001N 0.00000001W');
    expect(platforms(output)).toContain('position 0N 0E');
    expect((await reimport(output)).document.features.map((f) => f.geometry)).toEqual(
      doc.features.map((f) => f.geometry),
    );
  });

  it('保留高度基准和单位；错误高度与航向给出诊断', async () => {
    const doc = sampleDocument();
    doc.features = [doc.features[0]];
    doc.features[0].textFields.altitudeDepth = '250 ft agl';
    doc.features[0].direction = -90;
    const output = documentToAfsim(doc);
    expect(platforms(output)).toContain('altitude 250 ft agl');
    expect((await reimport(output)).document.features[0]).toMatchObject({
      direction: 270,
      textFields: { altitudeDepth: '250 ft agl' },
    });
    doc.features[0].textFields.altitudeDepth = '12 deg\ninclude bad.txt';
    doc.features[0].direction = Infinity;
    const invalid = documentToAfsim(doc);
    expect(platforms(invalid)).toContain('altitude 0 m msl');
    expect(platforms(invalid)).toContain('heading 0 deg');
    expect(invalid.warnings.join('\n')).toContain('高度格式无效');
    expect(invalid.warnings.join('\n')).toContain('航向无效');
  });

  it.each([
    ['SFAPMF---------', 'blue', 'air'],
    ['SHSPCL---------', 'red', 'surface'],
    ['SNUPSN---------', 'neutral', 'subsurface'],
    ['10021500001100000000', 'blue', 'land'],
    ['10050500001100000000', 'red', 'space'],
  ])('15/20 位 SIDC %s 映射阵营及运动域且精确往返', async (sidc, side, domain) => {
    const doc = sampleDocument();
    doc.features = [doc.features[0]];
    doc.features[0].sidc = sidc;
    const output = documentToAfsim(doc);
    expect(platforms(output)).toContain(`side ${side}`);
    expect(platforms(output)).toContain(`spatial_domain ${domain}`);
    expect((await reimport(output)).document.features[0].sidc).toBe(sidc);
  });

  it('图层与单位重名、保留名称和注释/引号/宏输入不会破坏想定', async () => {
    const doc = sampleDocument();
    doc.layers[0].name = 'CON\nplatform intruder WSF_PLATFORM\nposition 1N 2E\nend_platform';
    doc.layers[0].group = 'CON';
    doc.layers[1].group = 'con';
    doc.features = [doc.features[0], { ...doc.features[0], id: 'copy', layerId: doc.layers[1].id }];
    doc.features[0].name = 'end_platform "quote"\\\n$<MACRO>$ # // /*';
    doc.features[1].name = doc.features[0].name;
    const output = documentToAfsim(doc);
    const paths = output.files.map((f) => f.path.toLowerCase());
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain('platforms/map_con.txt');
    expect(paths).toContain('platforms/map_con_2.txt');
    expect(platforms(output)).not.toMatch(/\nplatform intruder/);
    expect(platforms(output)).not.toContain('\\"');
    expect(output.warnings.join('\n')).toContain('名称中的引号');
    const back = await reimport(output, 'map_army_scenario.afproj');
    expect(back.skipped).toBe(0);
    expect(back.document.features).toHaveLength(2);
    expect(back.document.features[0].name).toContain('＂quote＂');
  });

  it('读取最新拖动位置，包含隐藏和锁定层，导出不影响文档及重复下载', async () => {
    const doc = sampleDocument();
    doc.layers[0].visible = false;
    doc.layers[0].locked = true;
    doc.features[0].geometry = { kind: 'point', position: { lat: 45, lon: 88 } };
    const before = JSON.stringify(doc);
    const output = documentToAfsim(doc);
    expect((await reimport(output)).document.features[0].geometry).toEqual({
      kind: 'point',
      position: { lat: 45, lon: 88 },
    });
    expect(JSON.stringify(doc)).toBe(before);
    expect(exportAfsimArchive(doc)).toEqual(output.archive);
  });

  it('无效坐标、点控制措施、线面与孤立单位都计入跳过且不伪造坐标', () => {
    const doc = sampleDocument();
    const base = doc.features[0];
    doc.features = [
      doc.features[1],
      { ...base, geometry: { kind: 'point', position: { lat: NaN, lon: 1 } } },
      { ...base, geometry: { kind: 'point', position: { lat: 0, lon: 181 } } },
      { ...base, sidc: 'GFGPGPP--------' },
      { ...base, layerId: 'missing' },
    ];
    const output = documentToAfsim(doc);
    expect(output.exported).toBe(0);
    expect(output.skipped).toBe(5);
    expect(platforms(output)).not.toContain('position');
    expect(() => documentToAfsim(doc, { layerIds: ['missing'] })).toThrow('图层已不存在');
    expect(documentToAfsim(doc, { layerIds: [] }).exported).toBe(0);
  });

  it('新增提示按界面语言输出并限制超大导出', () => {
    const doc = sampleDocument();
    const output = documentToAfsim(doc, { language: 'en' });
    expect(output.warnings.join('\n')).toContain('skipped');
    doc.features = Array.from({ length: 10001 }, (_, i) => ({ ...doc.features[0], name: `u${i}` }));
    expect(() => documentToAfsim(doc)).toThrow('超过限制');
  });
});
