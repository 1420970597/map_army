/**
 * 多选集合与框选命中的纯函数：负责去重、顺序保持和几何范围判定。
 */

import type { LonLat } from '../geo';
import type { Bounds } from './geometry';
import { GeometryKind, type MapFeature } from './types';

/** 框选命中模式。 */
export type SelectMode = 'inside' | 'intersect';

/**
 * 判断要素是否命中经纬度包围盒。
 *
 * 点要素按中心点判定；线和面在 `inside` 模式下要求全部顶点位于框内，
 * 在 `intersect` 模式下允许顶点命中或要素自身包围盒与框相交。
 *
 * @param feature 待判定的地图要素。
 * @param bounds 选择框，支持经纬度边界乱序。
 * @param mode 命中模式。
 * @returns 要素是否命中选择框。
 */
export function hitTestBounds(feature: MapFeature, bounds: Bounds, mode: SelectMode): boolean {
  const normalized = normalizeBounds(bounds);

  if (feature.geometry.kind === GeometryKind.Point) {
    return pointInBounds(feature.geometry.position, normalized);
  }

  const points = feature.geometry.points;
  if (points.length === 0) return false;

  if (mode === 'inside') {
    return points.every((point) => pointInBounds(point, normalized));
  }

  return (
    points.some((point) => pointInBounds(point, normalized)) || boundsIntersect(points, normalized)
  );
}

/**
 * 返回命中选择框的要素标识，并保持输入要素顺序。
 *
 * @param features 待判定的地图要素。
 * @param bounds 选择框，支持经纬度边界乱序。
 * @param mode 命中模式。
 * @returns 按输入顺序排列的命中要素标识。
 */
export function featuresInBounds(
  features: readonly MapFeature[],
  bounds: Bounds,
  mode: SelectMode,
): string[] {
  return features
    .filter((feature) => hitTestBounds(feature, bounds, mode))
    .map((feature) => feature.id);
}

function normalizeBounds(bounds: Bounds): Bounds {
  return {
    minLon: Math.min(bounds.minLon, bounds.maxLon),
    minLat: Math.min(bounds.minLat, bounds.maxLat),
    maxLon: Math.max(bounds.minLon, bounds.maxLon),
    maxLat: Math.max(bounds.minLat, bounds.maxLat),
  };
}

function pointInBounds(point: LonLat, bounds: Bounds): boolean {
  return (
    point.lon >= bounds.minLon &&
    point.lon <= bounds.maxLon &&
    point.lat >= bounds.minLat &&
    point.lat <= bounds.maxLat
  );
}

function boundsIntersect(points: readonly LonLat[], bounds: Bounds): boolean {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const point of points) {
    minLon = Math.min(minLon, point.lon);
    minLat = Math.min(minLat, point.lat);
    maxLon = Math.max(maxLon, point.lon);
    maxLat = Math.max(maxLat, point.lat);
  }

  return (
    minLon <= bounds.maxLon &&
    maxLon >= bounds.minLon &&
    minLat <= bounds.maxLat &&
    maxLat >= bounds.minLat
  );
}

/**
 * 切换指定标识在选择集合中的状态。
 *
 * @param ids 当前选择集合。
 * @param id 需要切换的标识。
 * @returns 去重后的新选择集合。
 */
export function toggleInSelection(ids: readonly string[], id: string): string[] {
  const uniqueIds = unique(ids);

  return uniqueIds.includes(id)
    ? uniqueIds.filter((currentId) => currentId !== id)
    : [...uniqueIds, id];
}

/**
 * 向选择集合追加尚未存在的标识。
 *
 * @param ids 当前选择集合。
 * @param added 待追加的标识集合。
 * @returns 去重且保持首次出现顺序的新选择集合。
 */
export function addToSelection(ids: readonly string[], added: readonly string[]): string[] {
  return unique([...ids, ...added]);
}

/**
 * 从选择集合中移除指定标识。
 *
 * @param ids 当前选择集合。
 * @param removed 待移除的标识集合。
 * @returns 去重且保留其余首次出现顺序的新选择集合。
 */
export function removeFromSelection(ids: readonly string[], removed: readonly string[]): string[] {
  const removedIds = new Set(removed);

  return unique(ids).filter((id) => !removedIds.has(id));
}

/**
 * 计算两个端点之间按全量标识自然顺序排列的选择范围。
 *
 * @param allIds 全量标识的自然顺序。
 * @param anchorId 范围起点标识。
 * @param targetId 范围终点标识。
 * @returns 包含两个端点的去重范围；任一端点缺失时返回空数组。
 */
export function rangeSelection(
  allIds: readonly string[],
  anchorId: string,
  targetId: string,
): string[] {
  const anchorIndex = allIds.indexOf(anchorId);
  const targetIndex = allIds.indexOf(targetId);

  if (anchorIndex === -1 || targetIndex === -1) {
    return [];
  }

  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);

  return unique(allIds.slice(start, end + 1));
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
