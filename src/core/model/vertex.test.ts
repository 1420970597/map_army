/**
 * 顶点编辑纯函数单测。
 *
 * 覆盖最小点数、插入移动删除的不可变性、方向平行数组对齐、方位角环绕与循环步进。
 */

import { describe, expect, it } from 'vitest';

import type { LonLat } from '../geo';
import {
  defaultBearingAt,
  deleteVertex,
  insertVertex,
  minVertexCountOf,
  moveVertex,
  resetAllBearings,
  resetBearing,
  stepVertex,
} from './vertex';
import { GeometryKind } from './types';

const a: LonLat = { lon: 0, lat: 0 };
const b: LonLat = { lon: 1, lat: 0 };
const c: LonLat = { lon: 1, lat: 1 };
const d: LonLat = { lon: 2, lat: 1 };

/** 断言方位角以圆周距离接近预期值 */
function expectBearingClose(actual: number, expected: number, precision = 6): void {
  const difference = Math.abs(((actual - expected + 540) % 360) - 180);
  expect(difference).toBeLessThanOrEqual(10 ** -precision);
}

describe('minVertexCountOf', () => {
  it('点要素最少一个顶点', () => {
    expect(minVertexCountOf(GeometryKind.Point)).toBe(1);
  });

  it('线要素最少两个顶点', () => {
    expect(minVertexCountOf(GeometryKind.Line)).toBe(2);
  });

  it('面要素最少三个顶点', () => {
    expect(minVertexCountOf(GeometryKind.Area)).toBe(3);
  });
});

describe('insertVertex', () => {
  it('在指定位置插入顶点且不修改原数组', () => {
    const points = [a, c];
    const result = insertVertex(points, 1, b);

    expect(result.points).toEqual([a, b, c]);
    expect(result.points).not.toBe(points);
    expect(points).toEqual([a, c]);
  });

  it('将越界下标安全夹取到首尾', () => {
    expect(insertVertex([b], -4, a).points).toEqual([a, b]);
    expect(insertVertex([a], 99, b).points).toEqual([a, b]);
  });

  it('插入顶点时保持方向数组与顶点数组等长并置入自动方向', () => {
    const points = [a, c];
    const bearings = [90, 180];
    const result = insertVertex(points, 1, b, bearings);

    expect(result.points).toEqual([a, b, c]);
    expect(result.bearings).toHaveLength(result.points.length);
    expect(result.bearings).toEqual([90, undefined, 180]);
    expect(bearings).toEqual([90, 180]);
  });
});

describe('moveVertex', () => {
  it('移动顶点返回新数组且不修改原数组', () => {
    const points = [a, b, c];
    const result = moveVertex(points, 1, d);

    expect(result).toEqual([a, d, c]);
    expect(result).not.toBe(points);
    expect(points).toEqual([a, b, c]);
  });

  it('非法索引安全返回原数组引用', () => {
    const points = [a, b];
    expect(moveVertex(points, -1, c)).toBe(points);
    expect(moveVertex(points, 2, c)).toBe(points);
    expect(moveVertex(points, 0.5, c)).toBe(points);
  });
});

describe('deleteVertex', () => {
  it('删除顶点返回新数组且不修改原数组', () => {
    const points = [a, b, c];
    const result = deleteVertex(points, 1, 2);

    expect(result).toEqual([a, c]);
    expect(result).not.toBe(points);
    expect(points).toEqual([a, b, c]);
  });

  it('删除后低于最小顶点数时返回 null', () => {
    expect(deleteVertex([a, b], 1, 2)).toBeNull();
    expect(deleteVertex([a, b, c], 1, 3)).toBeNull();
  });

  it('非法索引返回 null', () => {
    expect(deleteVertex([a, b, c], 3, 2)).toBeNull();
  });
});

describe('resetBearing', () => {
  it('重置单个方向保持数组长度、位置对齐且不修改原数组', () => {
    const bearings = [45, 90, 135];
    const result = resetBearing(bearings, 1);

    expect(result).toEqual([45, undefined, 135]);
    expect(result).toHaveLength(bearings.length);
    expect(result).not.toBe(bearings);
    expect(bearings).toEqual([45, 90, 135]);
  });

  it('无方向数组或非法索引时保持原值', () => {
    const bearings = [45];
    expect(resetBearing(undefined, 0)).toBeUndefined();
    expect(resetBearing(bearings, 1)).toBe(bearings);
  });

  it('重置全部方向时移除整个字段', () => {
    expect(resetAllBearings([45, 90])).toBeUndefined();
    expect(resetAllBearings(undefined)).toBeUndefined();
  });
});

describe('defaultBearingAt', () => {
  it('首点采用指向次点的真实球面方位', () => {
    expectBearingClose(defaultBearingAt([a, b, c], 0), 90);
  });

  it('末点采用倒数次点指向末点的真实球面方位', () => {
    expectBearingClose(defaultBearingAt([a, b, c], 2), 0);
  });

  it('中间点采用前后边的圆周平均方位', () => {
    expectBearingClose(defaultBearingAt([a, b, c], 1), 45);
  });

  it('中间点跨越 359 度与 1 度时平均到正北附近', () => {
    const points = [
      { lon: -0.001, lat: -1 },
      { lon: 0, lat: 0 },
      { lon: 0.001, lat: 1 },
    ];

    expectBearingClose(defaultBearingAt(points, 1), 0, 0);
  });

  it('顶点不足或索引非法时安全返回正北', () => {
    expect(defaultBearingAt([], 0)).toBe(0);
    expect(defaultBearingAt([a], 0)).toBe(0);
    expect(defaultBearingAt([a, b], 2)).toBe(0);
  });
});

describe('stepVertex', () => {
  it('正向步进在末点后环绕到首点', () => {
    expect(stepVertex(2, 1, 3)).toBe(0);
    expect(stepVertex(1, 5, 3)).toBe(0);
  });

  it('反向步进在首点前环绕到末点', () => {
    expect(stepVertex(0, -1, 3)).toBe(2);
    expect(stepVertex(1, -5, 3)).toBe(2);
  });

  it('空数组或负长度返回 -1', () => {
    expect(stepVertex(0, 1, 0)).toBe(-1);
    expect(stepVertex(0, 1, -2)).toBe(-1);
  });
});
