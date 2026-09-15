/** 区域战术图形测试。 */

import { describe, expect, it } from 'vitest';

import type { LonLat } from '../geo';
import { haversineDistance } from '../model';
import { assemblyArea, corridor } from './areaGraphics';

const square: LonLat[] = [
  { lon: 116.3, lat: 39.9 },
  { lon: 116.4, lat: 39.9 },
  { lon: 116.4, lat: 40 },
  { lon: 116.3, lat: 40 },
];
const centerline: LonLat[] = [
  { lon: 116.3, lat: 39.9 },
  { lon: 116.4, lat: 39.9 },
];

function allFinite(geometry: { outline: LonLat[]; parts?: LonLat[][] }): boolean {
  return [...geometry.outline, ...(geometry.parts ?? []).flat()].every(
    (point) => Number.isFinite(point.lon) && Number.isFinite(point.lat),
  );
}

describe('assemblyArea', () => {
  it('按控制点生成闭合地域并保留锚点', () => {
    const result = assemblyArea(square);
    expect(result.outline[0]).toEqual(result.outline.at(-1));
    expect(result.anchors).toEqual(square);
  });

  it('生成 45 度阴影线', () => {
    const result = assemblyArea(square);
    expect(result.parts!.length).toBeGreaterThan(0);
    expect(result.parts!.every((part) => part.length === 2)).toBe(true);
  });

  it('更大阴影间距会减少阴影数量', () => {
    expect(assemblyArea(square, { hatchSpacingRatio: 0.3 }).parts!.length).toBeLessThan(
      assemblyArea(square, { hatchSpacingRatio: 0.05 }).parts!.length,
    );
  });

  it('不足三点返回最小几何', () => expect(assemblyArea(centerline).parts).toBeUndefined());
  it('重复点不会产生无效坐标', () =>
    expect(allFinite(assemblyArea([...square, square[0]]))).toBe(true));

  it('输出确定且不修改输入', () => {
    const snapshot = structuredClone(square);
    expect(assemblyArea(square)).toEqual(assemblyArea(square));
    expect(square).toEqual(snapshot);
  });
});

describe('corridor', () => {
  it('生成闭合走廊轮廓并保留锚点', () => {
    const result = corridor(centerline);
    expect(result.outline[0]).toEqual(result.outline.at(-1));
    expect(result.anchors).toEqual(centerline);
  });

  it('绝对米制宽度优先于比例宽度', () => {
    const result = corridor(centerline, { corridorWidthMeters: 800, widthRatio: 0.8 });
    expect(haversineDistance(result.outline[0], result.outline.at(-2)!) / 2).toBeCloseTo(400, -1);
  });

  it('比例宽度遵从局部米制语义', () => {
    const result = corridor(centerline, { widthRatio: 0.1 });
    const length = haversineDistance(centerline[0], centerline[1]);
    expect(haversineDistance(result.outline[0], result.outline.at(-2)!) / length).toBeCloseTo(
      0.1,
      2,
    );
  });

  it('包含入口方向箭头笔画', () => expect(corridor(centerline).parts).toHaveLength(1));
  it('多点中心线可用', () =>
    expect(corridor([...centerline, { lon: 116.45, lat: 39.93 }]).outline.length).toBeGreaterThan(
      5,
    ));
  it('重复点安全', () =>
    expect(allFinite(corridor([centerline[0], centerline[0], centerline[1]]))).toBe(true));
  it('不足两点返回最小几何', () =>
    expect(corridor([centerline[0]])).toEqual({
      outline: [centerline[0]],
      anchors: [centerline[0]],
    }));

  it('同输入输出确定且不修改输入', () => {
    const snapshot = structuredClone(centerline);
    expect(corridor(centerline)).toEqual(corridor(centerline));
    expect(centerline).toEqual(snapshot);
  });
});
