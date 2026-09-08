import { describe, expect, it } from 'vitest';

import { GeometryKind, type FeatureGeometry, type MapFeature } from '@/core/model';
import {
  applyLayerOpacity,
  featureHighlightStyleOf,
  featureStyleOf,
  selectedIdSetOf,
} from './featureStyle';

/** 构造具有指定几何的要素。 */
function featureOf(id: string, geometry: FeatureGeometry): MapFeature {
  return {
    id,
    layerId: 'layer-1',
    sidc: '10031000000000000000',
    name: id,
    geometry,
    textFields: {},
    createdAt: 0,
    updatedAt: 0,
  };
}

const point = featureOf('point', {
  kind: GeometryKind.Point,
  position: { lon: 120, lat: 30 },
});
const line = featureOf('line', {
  kind: GeometryKind.Line,
  points: [
    { lon: 120, lat: 30 },
    { lon: 121, lat: 31 },
  ],
});
const area = featureOf('area', {
  kind: GeometryKind.Area,
  points: [
    { lon: 120, lat: 30 },
    { lon: 121, lat: 30 },
    { lon: 121, lat: 31 },
  ],
});

describe('selectedIdSetOf', () => {
  it('未提供选择标识时返回空集合', () => {
    expect(selectedIdSetOf()).toEqual(new Set());
  });

  it('空数组返回空集合', () => {
    expect(selectedIdSetOf([])).toEqual(new Set());
  });

  it('去重重复的选择标识', () => {
    expect(selectedIdSetOf(['point', 'line', 'point'])).toEqual(new Set(['point', 'line']));
  });

  it('正确判定选择集合成员', () => {
    const selectedIds = selectedIdSetOf(['point', 'area']);

    expect(selectedIds.has(point.id)).toBe(true);
    expect(selectedIds.has(line.id)).toBe(false);
    expect(selectedIds.has(area.id)).toBe(true);
  });

  it('接受只读输入且不修改原数组', () => {
    const selectedIds = Object.freeze(['point', 'line'] as const);
    const snapshot = [...selectedIds];

    selectedIdSetOf(selectedIds);

    expect(selectedIds).toEqual(snapshot);
  });
});

describe('选中要素样式', () => {
  it('点要素能由选择集合判定为选中', () => {
    expect(selectedIdSetOf([point.id]).has(point.id)).toBe(true);
  });

  it('线要素选中后使用高亮线宽和不透明度', () => {
    const base = featureStyleOf(line);
    const selected = featureHighlightStyleOf(line);

    expect(selected.weight).toBe(base.weight + 2);
    expect(selected.opacity).toBe(1);
  });

  it('面要素选中后使用高亮填充不透明度', () => {
    const base = featureStyleOf(area);
    const selected = featureHighlightStyleOf(area);

    expect(selected.fillOpacity).toBeGreaterThan(base.fillOpacity);
  });

  it('选中线要素叠加图层透明度后保持高亮属性', () => {
    const style = applyLayerOpacity(featureHighlightStyleOf(line), 0.4);

    expect(style.weight).toBe(featureStyleOf(line).weight + 2);
    expect(style.opacity).toBeCloseTo(0.4, 5);
  });

  it('选中面要素叠加图层透明度后保持高亮填充', () => {
    const style = applyLayerOpacity(featureHighlightStyleOf(area), 0.4);

    expect(style.fillOpacity).toBeCloseTo(0.14, 5);
  });
});
