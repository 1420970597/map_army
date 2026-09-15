/**
 * 标图要素剪贴板纯逻辑单测。
 *
 * 以恒等投影验证载荷深拷贝、外部数据校验和点线面整体像素偏移。
 */

import { describe, expect, it } from 'vitest';

import type { Projection } from '../geo';
import { GeometryKind, SymbolKind, TacticalGraphicType, type MapFeature } from './types';
import {
  CLIPBOARD_KIND,
  CLIPBOARD_VERSION,
  materializeClipboard,
  parseClipboard,
  serializeClipboard,
} from './clipboard';

const identityProjection: Projection = {
  toPixel: (point) => ({ x: point.lon, y: point.lat }),
  toLonLat: (pixel) => ({ lon: pixel.x, lat: pixel.y }),
};

/** 创建用于剪贴板测试的点要素。 */
function pointFeature(overrides: Partial<MapFeature> = {}): MapFeature {
  return {
    id: 'source-point',
    layerId: 'source-layer',
    sidc: 'SFGPUCI----K---',
    name: '指挥所',
    geometry: { kind: GeometryKind.Point, position: { lon: 1, lat: 2 } },
    textFields: { uniqueDesignation: 'A' },
    style: { color: '#123456', weight: 2 },
    vertexBearings: [45],
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

/** 创建合法载荷，允许测试按需覆盖。 */
function payload(features: MapFeature[] = [pointFeature()]) {
  return serializeClipboard(features, { 'source-layer': '源图层' }, { lon: 0, lat: 0 }, 10);
}

describe('serializeClipboard', () => {
  it('深拷贝全部可变数据且不修改输入', () => {
    const feature = pointFeature();
    const layerNames = { 'source-layer': '源图层' };
    const anchor = { lon: 0, lat: 0 };
    const result = serializeClipboard([feature], layerNames, anchor, 10);

    result.features[0].textFields.uniqueDesignation = 'B';
    result.features[0].style!.color = '#ffffff';
    result.features[0].vertexBearings![0] = 90;
    result.features[0].geometry = { kind: GeometryKind.Point, position: { lon: 99, lat: 99 } };
    result.layerNames['source-layer'] = '已修改';
    result.anchor.lon = 99;

    expect(feature.textFields.uniqueDesignation).toBe('A');
    expect(feature.style?.color).toBe('#123456');
    expect(feature.vertexBearings).toEqual([45]);
    expect(feature.geometry).toEqual({ kind: GeometryKind.Point, position: { lon: 1, lat: 2 } });
    expect(layerNames['source-layer']).toBe('源图层');
    expect(anchor).toEqual({ lon: 0, lat: 0 });
  });
});

describe('战术图形剪贴板字段', () => {
  it('序列化、解析和实例化保留字段并隔离参数对象', () => {
    const source = pointFeature({
      symbolKind: SymbolKind.MultiPoint,
      graphicType: TacticalGraphicType.AxisOfAdvance,
      graphicParams: { headRatio: 0.2, smooth: true },
    });
    const serialized = payload([source]);
    const parsed = parseClipboard(JSON.stringify(serialized));
    const materialized = materializeClipboard(parsed!, {
      targetLayerId: 'target',
      projection: identityProjection,
    })[0];

    materialized.graphicParams!.headRatio = 0.4;
    expect(parsed?.features[0]).toMatchObject({
      symbolKind: SymbolKind.MultiPoint,
      graphicType: TacticalGraphicType.AxisOfAdvance,
      graphicParams: { headRatio: 0.2, smooth: true },
    });
    expect(source.graphicParams).toEqual({ headRatio: 0.2, smooth: true });
  });

  it('脏图形类型或参数拒绝解析', () => {
    const invalid = payload([
      pointFeature({
        graphicType: 'unknown' as TacticalGraphicType,
        graphicParams: { headRatio: Number.NaN },
      }),
    ]);
    expect(parseClipboard(JSON.stringify(invalid))).toBeNull();
  });
});

describe('parseClipboard', () => {
  it('null 与无效 JSON 返回 null', () => {
    expect(parseClipboard(null)).toBeNull();
    expect(parseClipboard('{invalid')).toBeNull();
  });

  it('错误 kind 或 version 返回 null', () => {
    const valid = payload();
    expect(parseClipboard(JSON.stringify({ ...valid, kind: 'other' }))).toBeNull();
    expect(parseClipboard(JSON.stringify({ ...valid, version: 2 }))).toBeNull();
  });

  it('非法要素结构返回 null', () => {
    const valid = payload();
    const invalid = {
      ...valid,
      features: [
        { ...valid.features[0], geometry: { kind: 'point', position: { lon: 'x', lat: 0 } } },
      ],
    };

    expect(parseClipboard(JSON.stringify(invalid))).toBeNull();
  });

  it('合法载荷返回深拷贝', () => {
    const valid = payload();
    const parsed = parseClipboard(JSON.stringify(valid));

    expect(parsed).toEqual(valid);
    expect(parsed).not.toBe(valid);
    expect(parsed?.features[0]).not.toBe(valid.features[0]);
    expect(parsed?.features[0].textFields).not.toBe(valid.features[0].textFields);
  });

  it('稀疏自动方向在 JSON 往返后保持长度和索引对齐', () => {
    const bearings = [45, 90, 135];
    delete bearings[1];
    const valid = payload([pointFeature({ vertexBearings: bearings })]);
    const parsed = parseClipboard(JSON.stringify(valid));

    expect(parsed?.features[0].vertexBearings).toHaveLength(3);
    expect(parsed?.features[0].vertexBearings?.[0]).toBe(45);
    expect(parsed?.features[0].vertexBearings?.[1]).toBeUndefined();
    expect(parsed?.features[0].vertexBearings?.[2]).toBe(135);
  });
});

describe('materializeClipboard', () => {
  it('生成新 id、指定图层并刷新时间', () => {
    const source = pointFeature({ createdAt: 1, updatedAt: 2 });
    const result = materializeClipboard(payload([source]), {
      targetLayerId: 'target-layer',
      projection: identityProjection,
    })[0];

    expect(result.id).not.toBe(source.id);
    expect(result.id.startsWith('ft_')).toBe(true);
    expect(result.layerId).toBe('target-layer');
    expect(result.createdAt).toBeGreaterThanOrEqual(source.createdAt);
    expect(result.updatedAt).toBe(result.createdAt);
  });

  it('默认偏移 24 像素，并按连续粘贴次数递增', () => {
    const result = materializeClipboard(payload(), {
      targetLayerId: 'target',
      projection: identityProjection,
      pasteCount: 2,
    })[0];

    expect(result.geometry).toEqual({ kind: GeometryKind.Point, position: { lon: 49, lat: 50 } });
  });

  it('使用自定义像素偏移向量', () => {
    const result = materializeClipboard(payload(), {
      targetLayerId: 'target',
      projection: identityProjection,
      offsetPx: { x: 3, y: -4 },
      pasteCount: 2,
    })[0];

    expect(result.geometry).toEqual({ kind: GeometryKind.Point, position: { lon: 7, lat: -6 } });
  });

  it('线和面几何的全部顶点保持整体平移', () => {
    const line = pointFeature({
      geometry: {
        kind: GeometryKind.Line,
        points: [
          { lon: 0, lat: 0 },
          { lon: 1, lat: 1 },
        ],
      },
    });
    const area = pointFeature({
      geometry: {
        kind: GeometryKind.Area,
        points: [
          { lon: 2, lat: 3 },
          { lon: 4, lat: 5 },
          { lon: 6, lat: 7 },
        ],
      },
    });
    const result = materializeClipboard(payload([line, area]), {
      targetLayerId: 'target',
      projection: identityProjection,
      offsetPx: { x: 1, y: 2 },
    });

    expect(result[0].geometry).toEqual({
      kind: GeometryKind.Line,
      points: [
        { lon: 1, lat: 2 },
        { lon: 2, lat: 3 },
      ],
    });
    expect(result[1].geometry).toEqual({
      kind: GeometryKind.Area,
      points: [
        { lon: 3, lat: 5 },
        { lon: 5, lat: 7 },
        { lon: 7, lat: 9 },
      ],
    });
  });

  it('深拷贝样式、文本和顶点方向', () => {
    const source = pointFeature();
    const result = materializeClipboard(payload([source]), {
      targetLayerId: 'target',
      projection: identityProjection,
    })[0];

    result.style!.color = '#ffffff';
    result.textFields.uniqueDesignation = 'B';
    result.vertexBearings![0] = 90;

    expect(source.style?.color).toBe('#123456');
    expect(source.textFields.uniqueDesignation).toBe('A');
    expect(source.vertexBearings).toEqual([45]);
  });

  it('按粘贴次数生成副本名称，空名保持副本', () => {
    const first = materializeClipboard(payload([pointFeature()]), {
      targetLayerId: 'target',
      projection: identityProjection,
    })[0];
    const repeated = materializeClipboard(payload([pointFeature()]), {
      targetLayerId: 'target',
      projection: identityProjection,
      pasteCount: 3,
    })[0];
    const unnamed = materializeClipboard(payload([pointFeature({ name: '' })]), {
      targetLayerId: 'target',
      projection: identityProjection,
      pasteCount: 2,
    })[0];

    expect(first.name).toBe('指挥所 副本');
    expect(repeated.name).toBe('指挥所 副本 (3)');
    expect(unnamed.name).toBe('副本 (2)');
  });

  it('实例化不修改剪贴板载荷', () => {
    const sourcePayload = payload();
    const snapshot = structuredClone(sourcePayload);

    materializeClipboard(sourcePayload, {
      targetLayerId: 'target',
      projection: identityProjection,
      offsetPx: { x: 5, y: 6 },
    });

    expect(sourcePayload).toEqual(snapshot);
  });
});

describe('clipboard constants', () => {
  it('保持稳定的载荷类型与版本', () => {
    expect(CLIPBOARD_KIND).toBe('map-army/clipboard');
    expect(CLIPBOARD_VERSION).toBe(1);
  });
});
