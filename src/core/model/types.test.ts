/** 战术图形模型扩展的兼容性测试。 */

import { describe, expect, it } from 'vitest';

import { GeometryKind, SymbolKind, TacticalGraphicType, Tool, type MapFeature } from './index';

function ordinaryFeature(): MapFeature {
  return {
    id: 'feature-1',
    layerId: 'layer-1',
    sidc: '10031000001211000000',
    name: '普通要素',
    geometry: { kind: GeometryKind.Point, position: { lon: 116.4, lat: 39.9 } },
    textFields: {},
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('战术图形模型字段', () => {
  it('既有要素构造不需要新增字段', () => {
    const feature = ordinaryFeature();

    expect(feature.symbolKind).toBeUndefined();
    expect(feature.graphicType).toBeUndefined();
    expect(feature.graphicParams).toBeUndefined();
  });

  it('支持带参数的多点战术图形', () => {
    const feature: MapFeature = {
      ...ordinaryFeature(),
      geometry: {
        kind: GeometryKind.Line,
        points: [
          { lon: 116.4, lat: 39.9 },
          { lon: 116.5, lat: 40 },
        ],
      },
      symbolKind: SymbolKind.MultiPoint,
      graphicType: TacticalGraphicType.AttackArrow,
      graphicParams: { widthRatio: 0.25, smooth: true },
    };

    expect(feature).toMatchObject({
      symbolKind: 'multiPoint',
      graphicType: 'attackArrow',
      graphicParams: { widthRatio: 0.25, smooth: true },
    });
  });

  it('包含单点与七种战术图形的稳定值', () => {
    expect(SymbolKind).toEqual({ Single: 'single', MultiPoint: 'multiPoint' });
    expect(Object.values(TacticalGraphicType)).toEqual([
      'attackArrow',
      'axisOfAdvance',
      'defenceLine',
      'assemblyArea',
      'boundary',
      'corridor',
      'phaseLine',
    ]);
  });

  it('提供独立的战术图形工具值', () => {
    expect(Tool.TacticalGraphic).toBe('tacticalGraphic');
    expect(new Set(Object.values(Tool)).size).toBe(Object.values(Tool).length);
  });
});
