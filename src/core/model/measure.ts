/**
 * 量测工具的辅助计算。
 *
 * 量距与量面积只做即时显示、不产生要素，其计算过程应当是
 * 可单测的纯函数，因此与 DOM/Leaflet 无关的部分集中在本模块，
 * `DrawHandler` 只负责把结果渲染成地图上的标注。
 */

import type { LonLat } from '../geo';
import { bearingOf, haversineDistance } from './geometry';

/** 单条线段的量测结果 */
export interface SegmentMeasure {
  /** 段序号，从 0 开始 */
  index: number;
  /** 起点 */
  from: LonLat;
  /** 终点 */
  to: LonLat;
  /** 线段中点，用于放置分段标注 */
  mid: LonLat;
  /** 段长，单位为米 */
  distance: number;
  /** 方位角（度，0 为正北，顺时针递增） */
  bearing: number;
}

/**
 * 计算折线每一段的长度、方位角与中点。
 *
 * 段数为顶点数减一，顶点不足两个时返回空数组。
 *
 * 中点取两端点的经纬度算术平均：量测通常发生在战术尺度（数十公里内），
 * 此时算术平均与球面中点之差远小于一个像素，无需引入更复杂的插值。
 */
export function measureSegments(points: LonLat[]): SegmentMeasure[] {
  const segments: SegmentMeasure[] = [];

  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    segments.push({
      index: i - 1,
      from,
      to,
      mid: { lon: (from.lon + to.lon) / 2, lat: (from.lat + to.lat) / 2 },
      distance: haversineDistance(from, to),
      bearing: bearingOf(from, to),
    });
  }

  return segments;
}

/**
 * 格式化方位角。
 *
 * 先归一化到 [0, 360)，再保留一位小数。归一化是必要的：
 * `bearingOf` 已保证非负，但调用方可能传入外部来源的角度值。
 *
 * 非有限数（NaN、Infinity）返回 `--`，避免把无效值画到地图上。
 */
export function formatBearing(degrees: number): string {
  if (!Number.isFinite(degrees)) return '--';

  const normalized = ((degrees % 360) + 360) % 360;
  return `${normalized.toFixed(1)}°`;
}
