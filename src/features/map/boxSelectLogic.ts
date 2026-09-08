/**
 * 框选交互的纯逻辑。
 *
 * 保持像素阈值、经纬度范围归一化与选择集合语义可独立测试，
 * Leaflet 事件与命令式矩形更新留在 BoxSelect 组件中。
 */

import type { LonLat, Pixel } from '@/core/geo';
import { addToSelection, type Bounds } from '@/core/model';

/** 被认定为框选拖拽的最小欧氏位移，单位为屏幕像素。 */
export const BOX_SELECT_MIN_DRAG_PX = 5;

/** 框选的起止屏幕坐标。 */
export interface PixelRect {
  start: Pixel;
  end: Pixel;
}

/**
 * 判断鼠标移动是否达到框选拖拽阈值。
 *
 * @param rect 起止屏幕坐标。
 * @returns 位移大于或等于阈值时返回 true。
 */
export function isBoxSelectDrag(rect: PixelRect): boolean {
  const deltaX = rect.end.x - rect.start.x;
  const deltaY = rect.end.y - rect.start.y;
  return Math.hypot(deltaX, deltaY) >= BOX_SELECT_MIN_DRAG_PX;
}

/**
 * 将框选对角经纬度坐标转换为标准化包围盒。
 *
 * @param a 第一个对角坐标。
 * @param b 第二个对角坐标。
 * @returns min/max 坐标已归一化的包围盒。
 */
export function lonLatBoundsFromCorners(a: LonLat, b: LonLat): Bounds {
  return {
    minLon: Math.min(a.lon, b.lon),
    minLat: Math.min(a.lat, b.lat),
    maxLon: Math.max(a.lon, b.lon),
    maxLat: Math.max(a.lat, b.lat),
  };
}

/**
 * 根据框选命中结果生成下一份选择集合。
 *
 * @param ids 当前已选标识。
 * @param hitIds 框选命中标识。
 * @param append true 时追加，false 时替换。
 * @returns 去重且保持顺序的新选择集合。
 */
export function selectionForBox(
  ids: readonly string[],
  hitIds: readonly string[],
  append: boolean,
): string[] {
  return append ? addToSelection(ids, hitIds) : [...new Set(hitIds)];
}
