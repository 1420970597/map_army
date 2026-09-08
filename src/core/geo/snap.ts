/**
 * 吸附引擎：在注入的屏幕投影下，按像素距离从候选点中选出最适合的吸附目标。
 *
 * 本模块保持纯逻辑与零运行时依赖，不接触 Leaflet、React 或 DOM。
 */

import type { LonLat } from './types';

/** 屏幕像素坐标。 */
export interface Pixel {
  x: number;
  y: number;
}

/** 经纬度与屏幕像素坐标之间的投影能力。 */
export interface Projection {
  toPixel(point: LonLat): Pixel;
  toLonLat(pixel: Pixel): LonLat;
}

/** 吸附候选点的来源类型。 */
export type SnapSource = 'self' | 'feature' | 'grid';

/** 可参与吸附计算的候选点。 */
export interface SnapCandidate {
  point: LonLat;
  source: SnapSource;
  featureId?: string;
  index?: number;
}

/** 一次成功吸附的计算结果。 */
export interface SnapResult {
  point: LonLat;
  source: SnapSource;
  distancePx: number;
  candidate: SnapCandidate;
}

/** 吸附计算的开关、阈值、来源及自身顶点排除条件。 */
export interface SnapOptions {
  thresholdPx: number;
  enabled: boolean;
  sources?: SnapSource[];
  exclude?: { featureId: string; index: number };
}

/** 默认吸附阈值，单位为屏幕像素。 */
export const SNAP_THRESHOLD_PX = 10;

const SOURCE_PRIORITY: Readonly<Record<SnapSource, number>> = {
  self: 3,
  feature: 2,
  grid: 1,
};

/**
 * 在候选点中寻找阈值内距离最近的吸附目标。
 *
 * 距离相同的候选按 self、feature、grid 的顺序优先；所有输入均不会被修改。
 *
 * @param origin 当前待吸附的经纬度坐标。
 * @param candidates 可供比较的吸附候选点。
 * @param options 吸附配置。
 * @param projection 经纬度到屏幕像素的投影能力。
 * @returns 命中的吸附结果；未命中或禁用时返回 null。
 */
export function snapPoint(
  origin: LonLat,
  candidates: readonly SnapCandidate[],
  options: SnapOptions,
  projection: Projection,
): SnapResult | null {
  if (!options.enabled || options.thresholdPx < 0) {
    return null;
  }

  const enabledSources = options.sources;
  const originPixel = projection.toPixel(origin);
  const thresholdSquared = options.thresholdPx * options.thresholdPx;
  let best: SnapResult | null = null;

  for (const candidate of candidates) {
    if (enabledSources !== undefined && !enabledSources.includes(candidate.source)) {
      continue;
    }

    if (
      options.exclude !== undefined &&
      candidate.featureId === options.exclude.featureId &&
      candidate.index === options.exclude.index
    ) {
      continue;
    }

    const candidatePixel = projection.toPixel(candidate.point);
    const deltaX = candidatePixel.x - originPixel.x;
    const deltaY = candidatePixel.y - originPixel.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;

    if (distanceSquared > thresholdSquared) {
      continue;
    }

    const distancePx = Math.sqrt(distanceSquared);
    if (
      best === null ||
      distancePx < best.distancePx ||
      (distancePx === best.distancePx &&
        SOURCE_PRIORITY[candidate.source] > SOURCE_PRIORITY[best.source])
    ) {
      best = {
        point: candidate.point,
        source: candidate.source,
        distancePx,
        candidate,
      };
    }
  }

  return best;
}
