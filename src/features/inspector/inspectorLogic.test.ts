import { describe, expect, it } from 'vitest';

import { GeometryKind, type Layer, type MapFeature } from '@/core/model';

import { canResetVertexBearing, deriveInspectorSelection, targetLayers } from './inspectorLogic';

const layer: Layer = {
  id: 'layer-a',
  name: 'A',
  visible: true,
  locked: false,
  opacity: 1,
  order: 1,
};
const point: MapFeature = {
  id: 'point',
  layerId: layer.id,
  sidc: '10031000001211000000',
  name: '点',
  geometry: { kind: GeometryKind.Point, position: { lon: 0, lat: 0 } },
  textFields: {},
  createdAt: 0,
  updatedAt: 0,
};
const line: MapFeature = {
  ...point,
  id: 'line',
  geometry: {
    kind: GeometryKind.Line,
    points: [
      { lon: 0, lat: 0 },
      { lon: 1, lat: 1 },
    ],
  },
};

describe('deriveInspectorSelection', () => {
  it('空选择返回空模式', () => {
    expect(deriveInspectorSelection([], [point])).toMatchObject({
      mode: 'none',
      selectedIds: [],
      primary: null,
    });
  });

  it('单选保留唯一主选', () => {
    expect(deriveInspectorSelection(['point'], [point, line])).toMatchObject({
      mode: 'single',
      selectedIds: ['point'],
      primary: point,
    });
  });

  it('多选以末位为主选', () => {
    expect(deriveInspectorSelection(['point', 'line'], [point, line])).toMatchObject({
      mode: 'multiple',
      selectedIds: ['point', 'line'],
      primary: line,
    });
  });

  it('过滤重复和不存在的选择', () => {
    expect(
      deriveInspectorSelection(['missing', 'point', 'point', 'line'], [point, line]).selectedIds,
    ).toEqual(['point', 'line']);
  });
});

describe('批量目标与方向重置能力', () => {
  it('保持目标图层顺序及锁定信息', () => {
    const locked = { ...layer, id: 'layer-b', locked: true };
    expect(targetLayers([layer, locked])).toEqual([layer, locked]);
  });

  it('点要素不能重置顶点方向', () => {
    expect(canResetVertexBearing(point)).toBe(false);
    expect(canResetVertexBearing(null)).toBe(false);
  });

  it('线和面可以重置顶点方向', () => {
    expect(canResetVertexBearing(line)).toBe(true);
    expect(
      canResetVertexBearing({ ...line, geometry: { kind: GeometryKind.Area, points: [] } }),
    ).toBe(true);
  });
});
