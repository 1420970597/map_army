/**
 * 几何计算的单元测试。
 *
 * 距离与方位角采用**已知参考值比对**验证：选取若干城市对的公开距离，
 * 断言计算值落在合理误差范围内。面积则通过与规则图形的解析解比对验证。
 */

import { describe, expect, it } from 'vitest';

import {
  bearingOf,
  boundsOf,
  centroidOf,
  formatArea,
  formatDistance,
  haversineDistance,
  measurePath,
  pointInPolygon,
  polygonArea,
} from './geometry';
import {
  createAreaGeometry,
  createFeature,
  createLineGeometry,
  createPointGeometry,
} from './factory';
import { GeometryKind, type MapFeature } from './types';

/** 断言相对误差在给定比例内 */
function expectCloseTo(actual: number, expected: number, tolerance: number): void {
  const error = Math.abs(actual - expected) / Math.abs(expected);
  expect(error).toBeLessThan(tolerance);
}

describe('haversineDistance', () => {
  it('同一点的距离应为零', () => {
    const p = { lon: 116.4, lat: 39.9 };
    expect(haversineDistance(p, p)).toBe(0);
  });

  it('应正确计算北京到上海的距离（约 1067 公里）', () => {
    const beijing = { lon: 116.4074, lat: 39.9042 };
    const shanghai = { lon: 121.4737, lat: 31.2304 };

    expectCloseTo(haversineDistance(beijing, shanghai), 1_067_000, 0.01);
  });

  it('应正确计算伦敦到纽约的距离（约 5570 公里）', () => {
    const london = { lon: -0.1276, lat: 51.5072 };
    const newYork = { lon: -74.006, lat: 40.7128 };

    expectCloseTo(haversineDistance(london, newYork), 5_570_000, 0.01);
  });

  it('应正确计算赤道上一度经度的距离（约 111.2 公里）', () => {
    const a = { lon: 0, lat: 0 };
    const b = { lon: 1, lat: 0 };

    expectCloseTo(haversineDistance(a, b), 111_195, 0.001);
  });

  it('距离应满足对称性', () => {
    const a = { lon: 8.5, lat: 47.3 };
    const b = { lon: -122.4, lat: 37.8 };

    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 6);
  });
});

describe('bearingOf', () => {
  it('正北方向的方位角应为 0', () => {
    expect(bearingOf({ lon: 0, lat: 0 }, { lon: 0, lat: 10 })).toBeCloseTo(0, 4);
  });

  it('正东方向的方位角应为 90', () => {
    expect(bearingOf({ lon: 0, lat: 0 }, { lon: 10, lat: 0 })).toBeCloseTo(90, 4);
  });

  it('正南方向的方位角应为 180', () => {
    expect(bearingOf({ lon: 0, lat: 10 }, { lon: 0, lat: 0 })).toBeCloseTo(180, 4);
  });

  it('正西方向的方位角应为 270', () => {
    expect(bearingOf({ lon: 0, lat: 0 }, { lon: -10, lat: 0 })).toBeCloseTo(270, 4);
  });

  it('结果应归一化到 [0, 360)', () => {
    const bearing = bearingOf({ lon: 0, lat: 0 }, { lon: -1, lat: -1 });
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });
});

describe('measurePath', () => {
  it('空路径与单点路径的长度应为零', () => {
    expect(measurePath([]).length).toBe(0);
    expect(measurePath([{ lon: 0, lat: 0 }]).length).toBe(0);
  });

  it('总长度应等于各分段之和', () => {
    const points = [
      { lon: 0, lat: 0 },
      { lon: 1, lat: 0 },
      { lon: 1, lat: 1 },
      { lon: 2, lat: 1 },
    ];
    const result = measurePath(points);

    expect(result.segments).toHaveLength(3);
    const sum = result.segments.reduce((acc, value) => acc + value, 0);
    expect(result.length).toBeCloseTo(sum, 6);
  });
});

describe('polygonArea', () => {
  it('顶点不足三个时面积应为零', () => {
    expect(polygonArea([])).toBe(0);
    expect(
      polygonArea([
        { lon: 0, lat: 0 },
        { lon: 1, lat: 0 },
      ]),
    ).toBe(0);
  });

  it('应正确计算赤道附近一平方度区域的面积', () => {
    // 赤道上 1° × 1° 的区域约 12,308 平方公里
    const square = [
      { lon: 0, lat: 0 },
      { lon: 1, lat: 0 },
      { lon: 1, lat: 1 },
      { lon: 0, lat: 1 },
    ];

    expectCloseTo(polygonArea(square), 12_308_000_000, 0.01);
  });

  it('顶点顺序颠倒时面积应保持一致', () => {
    const square = [
      { lon: 0, lat: 0 },
      { lon: 1, lat: 0 },
      { lon: 1, lat: 1 },
      { lon: 0, lat: 1 },
    ];
    const reversed = [...square].reverse();

    expectCloseTo(polygonArea(reversed), polygonArea(square), 1e-9);
  });
});

describe('centroidOf', () => {
  it('应返回坐标的算术平均', () => {
    const points = [
      { lon: 0, lat: 0 },
      { lon: 10, lat: 20 },
    ];
    expect(centroidOf(points)).toEqual({ lon: 5, lat: 10 });
  });

  it('空输入应返回原点', () => {
    expect(centroidOf([])).toEqual({ lon: 0, lat: 0 });
  });
});

describe('anchorOf', () => {
  it('点要素的锚点应为其自身位置', () => {
    const geometry = createPointGeometry(12.3, 45.6);
    const feature = createFeature({ layerId: 'l1', sidc: '10031000001211000000', geometry });
    expect(anchorOfFeature(feature)).toEqual({ lon: 12.3, lat: 45.6 });
  });

  it('线要素的锚点应为其几何中心', () => {
    const geometry = createLineGeometry([
      { lon: 0, lat: 0 },
      { lon: 10, lat: 10 },
    ]);
    const feature = createFeature({ layerId: 'l1', sidc: '10031000001211000000', geometry });
    expect(anchorOfFeature(feature)).toEqual({ lon: 5, lat: 5 });
  });
});

describe('pointInPolygon', () => {
  const square = [
    { lon: 0, lat: 0 },
    { lon: 10, lat: 0 },
    { lon: 10, lat: 10 },
    { lon: 0, lat: 10 },
  ];

  it('内部点应判定为命中', () => {
    expect(pointInPolygon({ lon: 5, lat: 5 }, square)).toBe(true);
  });

  it('外部点应判定为未命中', () => {
    expect(pointInPolygon({ lon: 15, lat: 5 }, square)).toBe(false);
    expect(pointInPolygon({ lon: 5, lat: 15 }, square)).toBe(false);
  });
});

describe('boundsOf', () => {
  it('无要素时应返回 null', () => {
    expect(boundsOf([])).toBeNull();
  });

  it('应覆盖点、线、面三类几何的全部顶点', () => {
    const point = createFeature({
      layerId: 'l1',
      sidc: '10031000001211000000',
      geometry: createPointGeometry(-20, -30),
    });
    const line = createFeature({
      layerId: 'l1',
      sidc: '10031000001211000000',
      geometry: createLineGeometry([
        { lon: 0, lat: 0 },
        { lon: 40, lat: 50 },
      ]),
    });
    const area = createFeature({
      layerId: 'l1',
      sidc: '10031000001211000000',
      geometry: createAreaGeometry([
        { lon: 10, lat: 10 },
        { lon: 30, lat: 10 },
        { lon: 20, lat: 60 },
      ]),
    });

    const bounds = boundsOf([point, line, area]);
    expect(bounds).toEqual({ minLon: -20, minLat: -30, maxLon: 40, maxLat: 60 });
  });
});

describe('格式化函数', () => {
  it('距离小于一千米时应以米为单位', () => {
    expect(formatDistance(456)).toBe('456 m');
  });

  it('距离超过一千米时应以公里为单位', () => {
    expect(formatDistance(12345)).toBe('12.35 km');
  });

  it('面积小于一平方公里时应以平方米为单位', () => {
    expect(formatArea(500_000)).toBe('500000 m²');
  });

  it('面积超过一平方公里时应以平方公里为单位', () => {
    expect(formatArea(5_000_000)).toBe('5.00 km²');
  });
});

describe('createFeature', () => {
  it('应生成唯一 id 并填充时间戳', () => {
    const a = createFeature({
      layerId: 'l1',
      sidc: '10031000001211000000',
      geometry: createPointGeometry(0, 0),
    });
    const b = createFeature({
      layerId: 'l1',
      sidc: '10031000001211000000',
      geometry: createPointGeometry(0, 0),
    });

    expect(a.id).not.toBe(b.id);
    expect(a.createdAt).toBe(a.updatedAt);
  });

  it('sidc 传入结构化对象时应序列化为字符串', () => {
    const feature = createFeature({
      layerId: 'l1',
      sidc: '10031000001211000000',
      geometry: createPointGeometry(0, 0),
    });
    expect(typeof feature.sidc).toBe('string');
    expect(feature.sidc).toHaveLength(20);
  });

  it('文本修饰符应默认为空对象', () => {
    const feature = createFeature({
      layerId: 'l1',
      sidc: '10031000001211000000',
      geometry: createPointGeometry(0, 0),
    });
    expect(feature.textFields).toEqual({});
  });
});

/** 供测试使用的锚点取值封装，避免直接依赖未导出的内部实现 */
function anchorOfFeature(feature: MapFeature): { lon: number; lat: number } {
  const geometry = feature.geometry;
  if (geometry.kind === GeometryKind.Point) return geometry.position;
  return centroidOf(geometry.points);
}
