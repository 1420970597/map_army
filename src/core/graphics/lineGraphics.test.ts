/** 线状战术图形测试。 */

import { describe, expect, it } from 'vitest';

import { centroidOfLonLat, createLocalPlane, type LonLat } from '../geo';
import { haversineDistance } from '../model';
import { boundary, defenceLine, phaseLine } from './lineGraphics';

const line: LonLat[] = [
  { lon: 116.3, lat: 39.9 },
  { lon: 116.4, lat: 39.9 },
];
const bent: LonLat[] = [line[0], { lon: 116.35, lat: 39.93 }, line[1]];

function allFinite(geometry: { outline: LonLat[]; parts?: LonLat[][] }): boolean {
  return [...geometry.outline, ...(geometry.parts ?? []).flat()].every(
    (point) => Number.isFinite(point.lon) && Number.isFinite(point.lat),
  );
}

function dotOfSegmentAndPart(part: LonLat[]): number {
  const plane = createLocalPlane(centroidOfLonLat([...line, ...part]));
  const axis = plane.toXY(line[1]);
  const origin = plane.toXY(line[0]);
  const strokeStart = plane.toXY(part[0]);
  const strokeEnd = plane.toXY(part[1]);
  return (
    (axis.x - origin.x) * (strokeEnd.x - strokeStart.x) +
    (axis.y - origin.y) * (strokeEnd.y - strokeStart.y)
  );
}

describe('defenceLine', () => {
  it('保留控制轴线和锚点', () => {
    const result = defenceLine(line);
    expect(result.outline).toEqual(line);
    expect(result.anchors).toEqual(line);
  });

  it('在右侧生成多个防御齿', () => expect(defenceLine(line).parts?.length).toBeGreaterThan(2));

  it('防御齿垂直控制轴线', () => {
    for (const tooth of defenceLine(line).parts ?? [])
      expect(Math.abs(dotOfSegmentAndPart(tooth))).toBeLessThan(1);
  });

  it('防御齿默认朝控制轴线右侧', () => {
    const result = defenceLine(line);
    expect((result.parts ?? []).every((part) => part[1].lat <= part[0].lat)).toBe(true);
  });

  it('齿长遵从米制比例', () => {
    const result = defenceLine(line, { toothRatio: 0.1 });
    const total = haversineDistance(line[0], line[1]);
    expect(haversineDistance(result.parts![0][0], result.parts![0][1]) / total).toBeCloseTo(0.1, 2);
  });

  it('重复点不产生 NaN', () =>
    expect(allFinite(defenceLine([line[0], line[0], line[1]]))).toBe(true));
  it('不足两点返回最小几何', () => expect(defenceLine([line[0]]).parts).toBeUndefined());
  it('不修改输入', () => {
    const snapshot = structuredClone(bent);
    defenceLine(bent);
    expect(bent).toEqual(snapshot);
  });
});

describe('boundary', () => {
  it('保留控制轴线', () => expect(boundary(bent).outline).toEqual(bent));
  it('生成横向短杠', () => expect(boundary(line).parts?.length).toBeGreaterThan(2));

  it('横向短杠垂直控制轴线', () => {
    for (const tick of boundary(line).parts ?? [])
      expect(Math.abs(dotOfSegmentAndPart(tick))).toBeLessThan(1);
  });

  it('横杠长度遵从米制比例', () => {
    const result = boundary(line, { tickRatio: 0.1 });
    const total = haversineDistance(line[0], line[1]);
    expect(haversineDistance(result.parts![0][0], result.parts![0][1]) / total).toBeCloseTo(0.1, 2);
  });

  it('间距覆盖会影响短杠数量', () => {
    expect(boundary(line, { tickSpacingRatio: 0.5 }).parts!.length).toBeLessThan(
      boundary(line, { tickSpacingRatio: 0.1 }).parts!.length,
    );
  });

  it('共线重复输入安全', () => expect(allFinite(boundary([line[0], line[0], line[1]]))).toBe(true));
});

describe('phaseLine', () => {
  it('生成两端翼展及两个标签', () => {
    const result = phaseLine(line);
    expect(result.parts).toHaveLength(2);
    expect(result.labels).toHaveLength(2);
  });

  it('翼展延伸经过两端控制点', () => {
    const result = phaseLine(line);
    for (const [index, wing] of (result.parts ?? []).entries()) {
      const point = line[index];
      expect(haversineDistance(wing[0], point)).toBeCloseTo(haversineDistance(wing[1], point), 2);
    }
  });

  it('翼展长度遵从米制比例', () => {
    const result = phaseLine(line, { phaseWingRatio: 0.4 });
    const total = haversineDistance(line[0], line[1]);
    expect(haversineDistance(result.parts![0][0], result.parts![0][1]) / total).toBeCloseTo(0.4, 2);
  });

  it('退化输入不产生 NaN', () => {
    expect(allFinite(phaseLine([line[0], line[0]]))).toBe(true);
    expect(phaseLine([])).toEqual({ outline: [], anchors: [] });
  });

  it('同输入输出确定且不修改输入', () => {
    const snapshot = structuredClone(bent);
    expect(phaseLine(bent)).toEqual(phaseLine(bent));
    expect(bent).toEqual(snapshot);
  });
});
