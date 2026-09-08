/** 局部米制平面转换测试。 */

import { describe, expect, it } from 'vitest';

import { centroidOfLonLat, createLocalPlane, metersPerDegreeAt } from './planar';

describe('createLocalPlane', () => {
  it('原点转换为零米坐标', () => {
    const origin = { lon: 116.4, lat: 39.9 };

    expect(createLocalPlane(origin).toXY(origin)).toEqual({ x: 0, y: 0 });
  });

  it('x 轴向东为正', () => {
    const plane = createLocalPlane({ lon: 0, lat: 0 });

    expect(plane.toXY({ lon: 1, lat: 0 }).x).toBeCloseTo(111320, 8);
  });

  it('y 轴向北为正', () => {
    const plane = createLocalPlane({ lon: 0, lat: 0 });

    expect(plane.toXY({ lon: 0, lat: 1 }).y).toBeCloseTo(110540, 8);
  });

  it('北纬六十度的经度米数按余弦收缩', () => {
    const { lonMeters } = metersPerDegreeAt(60);

    expect(lonMeters).toBeCloseTo(55660, 8);
  });

  it('纬度米数不随原点纬度变化', () => {
    expect(metersPerDegreeAt(-45).latMeters).toBe(110540);
    expect(metersPerDegreeAt(60).latMeters).toBe(110540);
  });

  it('经纬度到平面的往返误差小于一纳度', () => {
    const plane = createLocalPlane({ lon: 116.4, lat: 39.9 });
    const point = { lon: 116.438125, lat: 39.876543 };

    const result = plane.toLonLat(plane.toXY(point));

    expect(result.lon).toBeCloseTo(point.lon, 9);
    expect(result.lat).toBeCloseTo(point.lat, 9);
  });

  it('平面坐标到经纬度的往返误差小于一纳米', () => {
    const plane = createLocalPlane({ lon: -74.006, lat: 40.7128 });
    const vector = { x: 1234.567, y: -987.654 };

    const result = plane.toXY(plane.toLonLat(vector));

    expect(result.x).toBeCloseTo(vector.x, 9);
    expect(result.y).toBeCloseTo(vector.y, 9);
  });

  it('同纬度平移后保留局部向量', () => {
    const first = createLocalPlane({ lon: 0, lat: 30 });
    const second = createLocalPlane({ lon: 100, lat: 30 });

    const firstOffset = first.toXY({ lon: 0.01, lat: 30.02 });
    const secondOffset = second.toXY({ lon: 100.01, lat: 30.02 });

    expect(firstOffset.x).toBeCloseTo(secondOffset.x, 8);
    expect(firstOffset.y).toBeCloseTo(secondOffset.y, 8);
  });

  it('复制原点，外部修改不会影响已创建平面', () => {
    const origin = { lon: 10, lat: 20 };
    const plane = createLocalPlane(origin);
    origin.lon = 50;
    origin.lat = 60;

    expect(plane.origin).toEqual({ lon: 10, lat: 20 });
    expect(plane.toXY({ lon: 10.01, lat: 20 })).toMatchObject({ x: expect.any(Number), y: 0 });
  });
});

describe('centroidOfLonLat', () => {
  it('计算多个点的算术中心', () => {
    expect(
      centroidOfLonLat([
        { lon: 100, lat: 10 },
        { lon: 106, lat: 16 },
        { lon: 103, lat: 13 },
      ]),
    ).toEqual({ lon: 103, lat: 13 });
  });

  it('空数组返回确定的零原点且不修改输入', () => {
    const points: { lon: number; lat: number }[] = [];

    expect(centroidOfLonLat(points)).toEqual({ lon: 0, lat: 0 });
    expect(points).toEqual([]);
  });
});
