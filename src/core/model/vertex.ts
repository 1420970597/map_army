/**
 * 顶点编辑的纯函数。
 *
 * 本模块只处理 WGS84 经纬度数组与同序的顶点方向数组，不依赖 UI、状态容器或 Leaflet。
 * 所有会产生变更的操作均返回新数组；无效索引的移动操作返回原数组引用，表示未发生变更。
 */

import type { LonLat } from '../geo';
import { bearingOf, toDegrees, toRadians } from './geometry';
import { GeometryKind, type GeometryKind as GeometryKindValue } from './types';

/**
 * 获取指定几何类型的最小合法顶点数。
 *
 * @param kind 几何类型
 * @returns 点、线、面的最小顶点数，分别为 1、2、3
 */
export function minVertexCountOf(kind: GeometryKindValue): number {
  switch (kind) {
    case GeometryKind.Point:
      return 1;
    case GeometryKind.Line:
      return 2;
    case GeometryKind.Area:
      return 3;
  }
}

/**
 * 将插入下标夹取到数组的有效插入范围内。
 *
 * @param index 请求的插入下标
 * @param length 当前数组长度
 * @returns 位于 0 至 length 之间的整数下标
 */
function clampInsertIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return length;
  return Math.min(Math.max(Math.trunc(index), 0), length);
}

/**
 * 判断下标是否指向数组中的一个元素。
 *
 * @param index 待判断下标
 * @param length 数组长度
 * @returns 下标有效时为 true
 */
function isValidIndex(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}

/**
 * 在指定位置插入顶点，并同步在方向平行数组中插入自动方向占位。
 *
 * @param points 原始顶点数组
 * @param index 插入后的目标位置；超出范围时安全夹取
 * @param point 待插入顶点
 * @param bearings 可选的逐顶点方向数组
 * @returns 新的顶点数组及与其等长的方向数组
 */
export function insertVertex(
  points: LonLat[],
  index: number,
  point: LonLat,
  bearings?: number[],
): { points: LonLat[]; bearings: number[] | undefined } {
  const insertIndex = clampInsertIndex(index, points.length);
  const nextPoints = [...points.slice(0, insertIndex), point, ...points.slice(insertIndex)];

  if (bearings === undefined) return { points: nextPoints, bearings: undefined };

  // 模型中的 number[] 以 undefined 表示“自动方向”；空槽在读取时即为 undefined。
  const nextBearings = [
    ...bearings.slice(0, insertIndex),
    ...new Array<number>(1),
    ...bearings.slice(insertIndex),
  ];
  return { points: nextPoints, bearings: nextBearings };
}

/**
 * 移动指定顶点。
 *
 * 无效下标不会修改数组，并原样返回输入数组引用，供调用方识别无变化。
 *
 * @param points 原始顶点数组
 * @param index 待移动顶点的下标
 * @param point 移动后的坐标
 * @returns 有效下标时返回新数组；无效下标时返回原数组
 */
export function moveVertex(points: LonLat[], index: number, point: LonLat): LonLat[] {
  if (!isValidIndex(index, points.length)) return points;
  return points.map((current, currentIndex) => (currentIndex === index ? point : current));
}

/**
 * 删除指定顶点，同时确保结果不会低于调用方指定的最小顶点数。
 *
 * @param points 原始顶点数组
 * @param index 待删除顶点的下标
 * @param minCount 删除后必须保持的最小顶点数
 * @returns 删除后的新数组；索引无效或会低于下限时返回 null
 */
export function deleteVertex(points: LonLat[], index: number, minCount: number): LonLat[] | null {
  if (!isValidIndex(index, points.length) || points.length - 1 < minCount) return null;
  return [...points.slice(0, index), ...points.slice(index + 1)];
}

/**
 * 重置一个顶点的手动方向，同时保持方向数组长度与顶点数组对齐。
 *
 * @param bearings 原始逐顶点方向数组
 * @param index 待重置位置
 * @returns 重置后的新数组；未提供或索引无效时保持原值
 */
export function resetBearing(bearings: number[] | undefined, index: number): number[] | undefined {
  if (bearings === undefined || !isValidIndex(index, bearings.length)) return bearings;
  const nextBearings = [...bearings];
  delete nextBearings[index];
  return nextBearings;
}

/**
 * 重置全部顶点的手动方向。
 *
 * @param bearings 原始逐顶点方向数组，仅为与单点重置 API 对称
 * @returns 始终为 undefined，表示移除整个方向字段
 */
export function resetAllBearings(_bearings: number[] | undefined): undefined {
  return undefined;
}

/**
 * 计算两个方向角的圆周平均值，避免 359° 与 1° 被误算为 180°。
 *
 * @param first 第一个方位角
 * @param second 第二个方位角
 * @returns 归一化至 0 至 360 的平均方位角
 */
function circularMean(first: number, second: number): number {
  const x = Math.cos(toRadians(first)) + Math.cos(toRadians(second));
  const y = Math.sin(toRadians(first)) + Math.sin(toRadians(second));
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/**
 * 计算顶点的默认切线方位角。
 *
 * 首点取指向次点的方向，末点取倒数第二点指向末点的方向；中间点取入边和出边方向的圆周平均。
 * 点数少于两个或索引无效时返回 0，作为安全的正北默认值。
 *
 * @param points 顶点数组
 * @param index 顶点下标
 * @returns 方位角，单位为度，范围为 0 至 360
 */
export function defaultBearingAt(points: LonLat[], index: number): number {
  if (points.length < 2 || !isValidIndex(index, points.length)) return 0;
  if (index === 0) return bearingOf(points[0], points[1]);
  if (index === points.length - 1) return bearingOf(points[index - 1], points[index]);

  return circularMean(
    bearingOf(points[index - 1], points[index]),
    bearingOf(points[index], points[index + 1]),
  );
}

/**
 * 在顶点下标间循环步进。
 *
 * @param index 当前下标
 * @param delta 步进量，可为负数
 * @param length 顶点数量
 * @returns 环绕后的下标；空数组或负长度返回 -1
 */
export function stepVertex(index: number, delta: number, length: number): number {
  if (length <= 0) return -1;
  const safeIndex = Number.isFinite(index) ? Math.trunc(index) : 0;
  const safeDelta = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return (((safeIndex + safeDelta) % length) + length) % length;
}
