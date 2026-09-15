/** 进攻箭头与进攻轴线测试。 */

import { describe, expect, it } from 'vitest';

import type { LonLat } from '../geo';
import { haversineDistance } from '../model';
import { attackArrow, axisOfAdvance } from './arrow';

const straight: LonLat[] = [
  { lon: 116.3, lat: 39.9 },
  { lon: 116.4, lat: 39.9 },
];
const bent: LonLat[] = [
  { lon: 116.3, lat: 39.9 },
  { lon: 116.35, lat: 39.92 },
  { lon: 116.4, lat: 39.94 },
];

function finiteGeometry(value: ReturnType<typeof attackArrow>): boolean {
  return value.outline.every((point) => Number.isFinite(point.lon) && Number.isFinite(point.lat));
}

describe('attackArrow', () => {
  it('生成闭合面并保留控制点锚点', () => {
    const result = attackArrow(straight);
    expect(result.outline[0]).toEqual(result.outline.at(-1));
    expect(result.anchors).toEqual(straight);
  });

  it('箭头尖端精确位于末控制点', () => {
    expect(attackArrow(straight).outline).toContainEqual(straight[1]);
  });

  it('头部在末端前方保持指定的米制投影长度', () => {
    const result = attackArrow(straight, { headRatio: 0.2 });
    const total = haversineDistance(straight[0], straight[1]);
    const base = result.outline[1];
    expect(haversineDistance(base, straight[1]) / total).toBeGreaterThan(0.19);
  });

  it('两点控制轴线可用', () => expect(attackArrow(straight).outline.length).toBeGreaterThan(4));
  it('多点控制轴线可用', () => expect(attackArrow(bent).outline.length).toBeGreaterThan(6));

  it('重复点不产生无效坐标', () => {
    expect(finiteGeometry(attackArrow([straight[0], straight[0], straight[1]]))).toBe(true);
  });

  it('共线多点不产生无效坐标', () => {
    expect(finiteGeometry(attackArrow([...straight, { lon: 116.5, lat: 39.9 }]))).toBe(true);
  });

  it('同输入结果确定', () => expect(attackArrow(bent)).toEqual(attackArrow(bent)));

  it('不修改控制点及其对象', () => {
    const snapshot = structuredClone(bent);
    attackArrow(bent);
    expect(bent).toEqual(snapshot);
  });

  it('不足两点返回最小几何', () => {
    expect(attackArrow([straight[0]])).toEqual({ outline: [straight[0]], anchors: [straight[0]] });
  });

  it('空输入安全返回', () => expect(attackArrow([])).toEqual({ outline: [], anchors: [] }));

  it('跨纬度生成保持有限坐标', () => {
    const polar = straight.map((point) => ({ ...point, lat: point.lat + 20 }));
    expect(finiteGeometry(attackArrow(polar))).toBe(true);
  });
});

describe('axisOfAdvance', () => {
  it('主轮廓保持控制轴线', () => expect(axisOfAdvance(bent).outline).toEqual(bent));
  it('生成两条箭头边', () => expect(axisOfAdvance(straight).parts).toHaveLength(2));

  it('两条箭头边均连接尖端', () => {
    const result = axisOfAdvance(straight);
    expect(result.parts?.[0].at(-1)).toEqual(straight[1]);
    expect(result.parts?.[1][0]).toEqual(straight[1]);
  });

  it('重复点安全退化', () => {
    const result = axisOfAdvance([straight[0], straight[0]]);
    expect(result.parts).toBeUndefined();
    expect(finiteGeometry(result)).toBe(true);
  });

  it('不修改输入', () => {
    const snapshot = structuredClone(straight);
    axisOfAdvance(straight);
    expect(straight).toEqual(snapshot);
  });
});
