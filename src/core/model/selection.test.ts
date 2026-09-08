import { describe, expect, it } from 'vitest';

import type { Bounds } from './geometry';
import { GeometryKind, type MapFeature } from './types';
import {
  addToSelection,
  featuresInBounds,
  hitTestBounds,
  rangeSelection,
  removeFromSelection,
  toggleInSelection,
} from './selection';

const selectionBounds: Bounds = {
  minLon: 0,
  minLat: 0,
  maxLon: 10,
  maxLat: 10,
};

function pointFeature(id: string, lon: number, lat: number): MapFeature {
  return createFeature(id, { kind: GeometryKind.Point, position: { lon, lat } });
}

function lineFeature(id: string, points: { lon: number; lat: number }[]): MapFeature {
  return createFeature(id, { kind: GeometryKind.Line, points });
}

function areaFeature(id: string, points: { lon: number; lat: number }[]): MapFeature {
  return createFeature(id, { kind: GeometryKind.Area, points });
}

function createFeature(id: string, geometry: MapFeature['geometry']): MapFeature {
  return {
    id,
    layerId: 'layer-1',
    sidc: 'SFGPUCI----K---',
    name: id,
    geometry,
    textFields: {},
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('hitTestBounds', () => {
  it('将乱序 bounds 标准化后判断点要素', () => {
    const reversedBounds: Bounds = { minLon: 10, minLat: 10, maxLon: 0, maxLat: 0 };

    expect(hitTestBounds(pointFeature('point', 5, 5), reversedBounds, 'inside')).toBe(true);
  });

  it('命中选择框内部的点', () => {
    expect(hitTestBounds(pointFeature('inside', 5, 5), selectionBounds, 'inside')).toBe(true);
  });

  it('将边界上的点视为命中', () => {
    expect(hitTestBounds(pointFeature('boundary', 0, 10), selectionBounds, 'intersect')).toBe(true);
  });

  it('不命中选择框外的点', () => {
    expect(hitTestBounds(pointFeature('outside', 11, 5), selectionBounds, 'intersect')).toBe(false);
  });

  it('线的 inside 要求所有顶点在框内，而 intersect 接受相交', () => {
    const line = lineFeature('crossing-line', [
      { lon: -5, lat: 5 },
      { lon: 15, lat: 5 },
    ]);

    expect(hitTestBounds(line, selectionBounds, 'inside')).toBe(false);
    expect(hitTestBounds(line, selectionBounds, 'intersect')).toBe(true);
  });

  it('面任一顶点在框内时 intersect 命中', () => {
    const area = areaFeature('area-vertex', [
      { lon: 5, lat: 5 },
      { lon: 15, lat: 5 },
      { lon: 15, lat: 15 },
    ]);

    expect(hitTestBounds(area, selectionBounds, 'intersect')).toBe(true);
  });

  it('要素包围盒与选择框相交时即使所有顶点在外也在 intersect 命中', () => {
    const area = areaFeature('surrounding-area', [
      { lon: -5, lat: -5 },
      { lon: 15, lat: -5 },
      { lon: 15, lat: 15 },
      { lon: -5, lat: 15 },
    ]);

    expect(hitTestBounds(area, selectionBounds, 'intersect')).toBe(true);
  });

  it('空线不命中', () => {
    expect(hitTestBounds(lineFeature('empty-line', []), selectionBounds, 'intersect')).toBe(false);
  });

  it('空面不命中', () => {
    expect(hitTestBounds(areaFeature('empty-area', []), selectionBounds, 'intersect')).toBe(false);
  });

  it('不修改输入 feature 和 bounds', () => {
    const feature = lineFeature('immutable-line', [
      { lon: -5, lat: 5 },
      { lon: 15, lat: 5 },
    ]);
    const reversedBounds: Bounds = { minLon: 10, minLat: 10, maxLon: 0, maxLat: 0 };
    const featureSnapshot = structuredClone(feature);
    const boundsSnapshot = structuredClone(reversedBounds);

    hitTestBounds(feature, reversedBounds, 'intersect');

    expect(feature).toEqual(featureSnapshot);
    expect(reversedBounds).toEqual(boundsSnapshot);
  });
});

describe('featuresInBounds', () => {
  it('按输入要素顺序返回命中的标识', () => {
    const features = [
      pointFeature('third', 3, 3),
      pointFeature('outside', 20, 20),
      pointFeature('first', 1, 1),
    ];

    expect(featuresInBounds(features, selectionBounds, 'inside')).toEqual(['third', 'first']);
  });

  it('无命中时返回空数组', () => {
    expect(
      featuresInBounds([pointFeature('outside', -1, -1)], selectionBounds, 'intersect'),
    ).toEqual([]);
  });
});

describe('toggleInSelection', () => {
  it('追加尚未选择的标识', () => {
    expect(toggleInSelection(['alpha', 'bravo'], 'charlie')).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('移除已经选择的标识', () => {
    expect(toggleInSelection(['alpha', 'bravo', 'charlie'], 'bravo')).toEqual(['alpha', 'charlie']);
  });

  it('先对重复输入去重，再切换标识', () => {
    expect(toggleInSelection(['alpha', 'bravo', 'alpha'], 'charlie')).toEqual([
      'alpha',
      'bravo',
      'charlie',
    ]);
  });

  it('不修改输入数组', () => {
    const ids = ['alpha', 'bravo'];

    toggleInSelection(ids, 'charlie');

    expect(ids).toEqual(['alpha', 'bravo']);
  });
});

describe('addToSelection', () => {
  it('按首次出现顺序稳定地追加新标识', () => {
    expect(addToSelection(['alpha', 'bravo'], ['bravo', 'charlie', 'delta'])).toEqual([
      'alpha',
      'bravo',
      'charlie',
      'delta',
    ]);
  });

  it('合并两侧重复标识', () => {
    expect(addToSelection(['alpha', 'alpha'], ['bravo', 'bravo', 'alpha'])).toEqual([
      'alpha',
      'bravo',
    ]);
  });

  it('使最后一个新追加项位于末尾作为 primary', () => {
    const selection = addToSelection(['alpha'], ['bravo', 'charlie']);

    expect(selection.at(-1)).toBe('charlie');
  });
});

describe('removeFromSelection', () => {
  it('移除多个标识并保持其余顺序', () => {
    expect(removeFromSelection(['alpha', 'bravo', 'charlie', 'delta'], ['bravo', 'delta'])).toEqual(
      ['alpha', 'charlie'],
    );
  });

  it('对重复输入去重且不修改输入数组', () => {
    const ids = ['alpha', 'bravo', 'alpha', 'charlie'];
    const removed = ['bravo', 'bravo'];

    expect(removeFromSelection(ids, removed)).toEqual(['alpha', 'charlie']);
    expect(ids).toEqual(['alpha', 'bravo', 'alpha', 'charlie']);
    expect(removed).toEqual(['bravo', 'bravo']);
  });
});

describe('rangeSelection', () => {
  it('正向选择时按 allIds 的自然顺序返回范围', () => {
    expect(rangeSelection(['alpha', 'bravo', 'charlie', 'delta'], 'bravo', 'delta')).toEqual([
      'bravo',
      'charlie',
      'delta',
    ]);
  });

  it('逆向选择时仍按 allIds 的自然顺序返回范围', () => {
    expect(rangeSelection(['alpha', 'bravo', 'charlie', 'delta'], 'delta', 'bravo')).toEqual([
      'bravo',
      'charlie',
      'delta',
    ]);
  });

  it('相同端点仅返回该端点', () => {
    expect(rangeSelection(['alpha', 'bravo', 'charlie'], 'bravo', 'bravo')).toEqual(['bravo']);
  });

  it('任一端点缺失时返回空数组', () => {
    expect(rangeSelection(['alpha', 'bravo'], 'alpha', 'charlie')).toEqual([]);
  });

  it('空列表返回空数组', () => {
    expect(rangeSelection([], 'alpha', 'bravo')).toEqual([]);
  });

  it('范围内重复 allIds 去重并保持首次出现顺序', () => {
    expect(rangeSelection(['alpha', 'bravo', 'bravo', 'charlie'], 'alpha', 'charlie')).toEqual([
      'alpha',
      'bravo',
      'charlie',
    ]);
  });
});
