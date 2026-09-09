/**
 * 导入导出的单元测试。
 *
 * 核心性质是**往返一致性**：文档 → 文本 → 文档，语义不应丢失。
 * 此外验证宽容解析：损坏数据被跳过而非导致整体失败。
 */

import { describe, expect, it } from 'vitest';

import {
  createAreaGeometry,
  createDocument,
  createFeature,
  createLineGeometry,
  createPointGeometry,
  GeometryKind,
  SymbolKind,
  TacticalGraphicType,
  type MapDocument,
} from '../model';
import { deserializeMilxly, serializeMilxly } from './milxly';
import { documentToGeoJson, geoJsonToDocument } from './geojson';
import { toSafeFilename } from './download';

/** 构造一份包含三类几何的示例文档 */
function sampleDocument(): MapDocument {
  const document = createDocument('测试标图');
  const layerId = document.layers[0].id;

  return {
    ...document,
    features: [
      createFeature({
        layerId,
        sidc: '10031000001211000000',
        name: '步兵连',
        geometry: createPointGeometry(8.5, 47.4),
        textFields: { uniqueDesignation: 'A-1', higherFormation: '第1旅' },
        direction: 45,
      }),
      createFeature({
        layerId,
        sidc: '10061500001101000000',
        name: '进攻轴线',
        geometry: createLineGeometry([
          { lon: 8.0, lat: 47.0 },
          { lon: 9.0, lat: 47.5 },
        ]),
      }),
      createFeature({
        layerId,
        sidc: '10031000000000000000',
        name: '集结地域',
        geometry: createAreaGeometry([
          { lon: 8.2, lat: 47.2 },
          { lon: 8.6, lat: 47.2 },
          { lon: 8.4, lat: 47.5 },
        ]),
      }),
    ],
  };
}

describe('serializeMilxly / deserializeMilxly', () => {
  it('往返保留自定义军标快照', () => {
    const original = {
      ...sampleDocument(),
      features: [
        {
          ...sampleDocument().features[0],
          customSymbolId: 'custom_demo',
          customSymbolSvg: '<svg/>',
        },
      ],
    };
    expect(deserializeMilxly(serializeMilxly(original)).document.features[0]).toMatchObject({
      customSymbolId: 'custom_demo',
      customSymbolSvg: '<svg/>',
    });
  });
  it('往返转换应完整保留文档内容', () => {
    const original = sampleDocument();
    const restored = deserializeMilxly(serializeMilxly(original));

    expect(restored.skipped).toBe(0);
    expect(restored.document.name).toBe(original.name);
    expect(restored.document.features).toHaveLength(original.features.length);
    expect(restored.document.layers).toHaveLength(original.layers.length);
  });

  it('往返转换应保留要素的全部字段', () => {
    const original = sampleDocument();
    original.features[1].vertexBearings = [10, 20];
    original.features[1].symbolKind = SymbolKind.MultiPoint;
    original.features[1].graphicType = TacticalGraphicType.AxisOfAdvance;
    original.features[1].graphicParams = { headRatio: 0.2, smooth: true };
    const restored = deserializeMilxly(serializeMilxly(original));
    const [point, line, area] = restored.document.features;

    expect(point.geometry.kind).toBe(GeometryKind.Point);
    expect(point.textFields.uniqueDesignation).toBe('A-1');
    expect(point.textFields.higherFormation).toBe('第1旅');
    expect(point.direction).toBe(45);
    expect(line.geometry.kind).toBe(GeometryKind.Line);
    expect(line.vertexBearings).toEqual([10, 20]);
    expect(line.symbolKind).toBe(SymbolKind.MultiPoint);
    expect(line.graphicType).toBe(TacticalGraphicType.AxisOfAdvance);
    expect(line.graphicParams).toEqual({ headRatio: 0.2, smooth: true });
    expect(area.geometry.kind).toBe(GeometryKind.Area);
    expect(restored.document.schemaVersion).toBe(original.schemaVersion);
  });

  it('脏战术图形字段不会阻断 MilX 导入', () => {
    const text = JSON.stringify({
      format: 'milxly',
      version: 1,
      document: {
        features: [
          {
            id: 'f1',
            sidc: '10062500001101000000',
            geometry: {
              kind: 'line',
              points: [
                { lon: 1, lat: 2 },
                { lon: 3, lat: 4 },
              ],
            },
            symbolKind: 'unexpected',
            graphicType: 'unexpected',
            graphicParams: { headRatio: 'bad', arbitrary: 1 },
          },
        ],
      },
    });
    const result = deserializeMilxly(text);

    expect(result.skipped).toBe(0);
    expect(result.document.features[0].symbolKind).toBeUndefined();
    expect(result.document.features[0].graphicType).toBeUndefined();
    expect(result.document.features[0].graphicParams).toBeUndefined();
  });

  it('输出应是带缩进的可读 JSON', () => {
    const text = serializeMilxly(sampleDocument());
    expect(text).toContain('\n  ');
    expect(text).toContain('"format": "milxly"');
  });

  it('非 JSON 文本应抛出错误', () => {
    expect(() => deserializeMilxly('这不是 JSON')).toThrow(/JSON/);
  });

  it('格式标识不符时应抛出错误', () => {
    expect(() => deserializeMilxly('{"format":"other"}')).toThrow(/格式标识/);
  });

  it('版本高于支持范围时应抛出错误', () => {
    expect(() => deserializeMilxly('{"format":"milxly","version":99}')).toThrow(/版本/);
  });

  it('结构损坏的要素应被跳过而非导致整体失败', () => {
    const text = JSON.stringify({
      format: 'milxly',
      version: 1,
      document: {
        name: '部分损坏',
        layers: [{ id: 'l1', name: 'L1' }],
        features: [
          {
            id: 'ok',
            sidc: '10031000001211000000',
            geometry: { kind: 'point', position: { lon: 1, lat: 2 } },
          },
          { id: 'bad', sidc: '10031000001211000000', geometry: { kind: 'point' } },
          { nope: true },
        ],
      },
    });

    const result = deserializeMilxly(text);
    expect(result.document.features).toHaveLength(1);
    expect(result.skipped).toBe(2);
  });

  it('缺少图层时应补充默认图层并接管要素', () => {
    const text = JSON.stringify({
      format: 'milxly',
      version: 1,
      document: {
        name: '无图层',
        layers: [],
        features: [
          {
            id: 'f1',
            sidc: '10031000001211000000',
            geometry: { kind: 'point', position: { lon: 1, lat: 2 } },
          },
        ],
      },
    });

    const result = deserializeMilxly(text);
    expect(result.document.layers).toHaveLength(1);
    expect(result.document.features[0].layerId).toBe(result.document.layers[0].id);
  });
});

describe('documentToGeoJson', () => {
  it('应输出合法的 FeatureCollection', () => {
    const geojson = documentToGeoJson(sampleDocument());

    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(3);
  });

  it('点要素应转为 Point 并携带 SIDC', () => {
    const geojson = documentToGeoJson(sampleDocument());

    expect(geojson.features[0].geometry.type).toBe('Point');
    expect(geojson.features[0].properties?.sidc).toBe('10031000001211000000');
  });

  it('线要素应转为 LineString', () => {
    const geojson = documentToGeoJson(sampleDocument());
    expect(geojson.features[1].geometry.type).toBe('LineString');
  });

  it('面要素应转为 Polygon 且外环自动闭合', () => {
    const geojson = documentToGeoJson(sampleDocument());
    const polygon = geojson.features[2].geometry;

    expect(polygon.type).toBe('Polygon');
    const ring = (polygon.coordinates as number[][])[0];
    // 原始 3 个顶点，闭合后应为 4 个
    expect(ring).toHaveLength(4);
    expect(ring[0]).toEqual(ring[3]);
  });
});

describe('战术图形 GeoJSON 属性', () => {
  it('往返保留战术图形字段和参数', () => {
    const original = sampleDocument();
    original.features[1].symbolKind = SymbolKind.MultiPoint;
    original.features[1].graphicType = TacticalGraphicType.AxisOfAdvance;
    original.features[1].graphicParams = { headRatio: 0.25, smooth: true };
    const result = geoJsonToDocument(documentToGeoJson(original), '还原', 'lyr_default');

    expect(result.document.features[1]).toMatchObject({
      symbolKind: SymbolKind.MultiPoint,
      graphicType: TacticalGraphicType.AxisOfAdvance,
      graphicParams: { headRatio: 0.25, smooth: true },
    });
  });

  it('脏 GeoJSON 图形字段被安全忽略', () => {
    const result = geoJsonToDocument(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [10, 20] },
            properties: {
              graphicType: 'unknown',
              graphicParams: { headRatio: 'bad', arbitrary: 1 },
            },
          },
        ],
      },
      '脏字段',
      'lyr_default',
    );
    expect(result.document.features[0].graphicType).toBeUndefined();
    expect(result.document.features[0].graphicParams).toBeUndefined();
  });
});

describe('geoJsonToDocument', () => {
  it('应能把导出的 GeoJSON 还原为文档', () => {
    const original = sampleDocument();
    const geojson = documentToGeoJson(original);
    const result = geoJsonToDocument(geojson, '还原', 'lyr_default');

    expect(result.skipped).toBe(0);
    expect(result.document.features).toHaveLength(3);
    expect(result.document.features[0].sidc).toBe('10031000001211000000');
    expect(result.document.features[0].textFields.uniqueDesignation).toBe('A-1');
  });

  it('缺少 SIDC 的要素应回退到默认符号而非被丢弃', () => {
    const result = geoJsonToDocument(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [10, 20] },
            properties: { name: '无名单位' },
          },
        ],
      },
      '无 SIDC',
      'lyr_default',
    );

    expect(result.document.features).toHaveLength(1);
    expect(result.document.features[0].sidc).toHaveLength(20);
  });

  it('不支持的几何类型应被跳过', () => {
    const result = geoJsonToDocument(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'MultiPolygon', coordinates: [] },
            properties: {},
          },
        ],
      },
      '不支持',
      'lyr_default',
    );

    expect(result.document.features).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });
});

describe('toSafeFilename', () => {
  it('应把文件系统不允许的字符替换为下划线', () => {
    // 替换而非删除，可以保留原文的断词位置，文件名仍然可读
    expect(toSafeFilename('a/b:c*d?e"f<g>h|i', '.milxly')).toBe('a_b_c_d_e_f_g_h_i.milxly');
  });

  it('空名称应回退到默认名', () => {
    expect(toSafeFilename('   ', '.geojson')).toBe('未命名标图.geojson');
  });

  it('已带扩展名时不应重复追加', () => {
    expect(toSafeFilename('任务.milxly', '.milxly')).toBe('任务.milxly');
  });
});
