/**
 * 量测辅助计算单元测试。
 */

import { describe, expect, it } from 'vitest';

import type { LonLat } from '../geo';
import { formatArea } from './geometry';
import { formatBearing, measureSegments } from './measure';

describe('measureSegments', () => {
  it('空数组应返回空数组', () => {
    expect(measureSegments([])).toEqual([]);
  });

  it('单点应返回空数组', () => {
    expect(measureSegments([{ lon: 0, lat: 0 }])).toEqual([]);
  });

  it('两点的中点应是两端经纬度的算术平均', () => {
    const segments = measureSegments([
      { lon: 0, lat: 0 },
      { lon: 10, lat: 20 },
    ]);

    expect(segments).toHaveLength(1);
    expect(segments[0].index).toBe(0);
    expect(segments[0].from).toEqual({ lon: 0, lat: 0 });
    expect(segments[0].to).toEqual({ lon: 10, lat: 20 });
    expect(segments[0].mid).toEqual({ lon: 5, lat: 10 });
  });

  it('应正确计算每段长度，且总长等于各段之和', () => {
    const points: LonLat[] = [
      { lon: 0, lat: 0 },
      { lon: 1, lat: 0 },
      { lon: 1, lat: 1 },
      { lon: 2, lat: 1 },
    ];
    const segments = measureSegments(points);

    expect(segments).toHaveLength(3);
    const total = segments.reduce((sum, segment) => sum + segment.distance, 0);
    expect(total).toBeCloseTo(segments[0].distance + segments[1].distance + segments[2].distance, 6);
    // 每段距离均为正
    segments.forEach((segment) => expect(segment.distance).toBeGreaterThan(0));
  });

  it('方位角应在 [0, 360) 区间', () => {
    const segments = measureSegments([
      { lon: 0, lat: 0 },
      { lon: 1, lat: 1 },
      { lon: 2, lat: 0 },
    ]);
    segments.forEach((segment) => {
      expect(segment.bearing).toBeGreaterThanOrEqual(0);
      expect(segment.bearing).toBeLessThan(360);
    });
  });

  it('正北方向的两点方位角应接近 0', () => {
    const segments = measureSegments([
      { lon: 0, lat: 0 },
      { lon: 0, lat: 1 },
    ]);
    expect(segments[0].bearing).toBeCloseTo(0, 1);
  });

  it('正东方向的两点方位角应接近 90', () => {
    const segments = measureSegments([
      { lon: 0, lat: 0 },
      { lon: 1, lat: 0 },
    ]);
    expect(segments[0].bearing).toBeCloseTo(90, 1);
  });
});

describe('formatBearing', () => {
  it('应保留一位小数并补 ° 符号', () => {
    expect(formatBearing(45)).toBe('45.0°');
    expect(formatBearing(123.456)).toBe('123.5°');
  });

  it('应将负角度归一化到 [0, 360)', () => {
    expect(formatBearing(-30)).toBe('330.0°');
    expect(formatBearing(-360)).toBe('0.0°');
  });

  it('应将超过 360 的角度归一化到 [0, 360)', () => {
    expect(formatBearing(370)).toBe('10.0°');
    expect(formatBearing(720)).toBe('0.0°');
  });

  it('非有限数应返回占位符', () => {
    expect(formatBearing(Number.NaN)).toBe('--');
    expect(formatBearing(Number.POSITIVE_INFINITY)).toBe('--');
  });
});

describe('formatArea 边界', () => {
  it('零面积应显示 0 m²', () => {
    expect(formatArea(0)).toBe('0 m²');
  });

  it('刚好 1 km² 边界应进入 km² 分支', () => {
    expect(formatArea(1_000_000)).toBe('1.00 km²');
  });

  it('刚低于 1 km² 时应仍以 m² 显示', () => {
    expect(formatArea(999_999)).toBe('999999 m²');
  });
});
