/**
 * 进攻箭头与进攻轴线生成器。
 *
 * 所有长度均在控制点中心建立的局部米制平面中计算，因此不依赖地图缩放。
 */

import { centroidOfLonLat, createLocalPlane, type LonLat, type Vec2 } from '../geo';
import type { GraphicParams } from '../model';
import { metaOfGraphic } from './meta';
import type { GraphicGeometry } from './types';
import { add, length, normalize, perpendicular, scale, sub, variableOffsetPolyline } from './vec';

const EPSILON = 1e-6;

function isFinitePoint(point: LonLat): boolean {
  return Number.isFinite(point.lon) && Number.isFinite(point.lat);
}

function copyPoints(points: readonly LonLat[]): LonLat[] {
  return points.filter(isFinitePoint).map((point) => ({ lon: point.lon, lat: point.lat }));
}

function compactPoints(points: readonly LonLat[]): LonLat[] {
  const result: LonLat[] = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (
      previous === undefined ||
      Math.hypot(point.lon - previous.lon, point.lat - previous.lat) > Number.EPSILON
    ) {
      result.push({ lon: point.lon, lat: point.lat });
    }
  }
  return result;
}

function pathLength(points: readonly Vec2[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += length(sub(points[index], points[index - 1]));
  }
  return total;
}

function lastDirection(points: readonly Vec2[]): Vec2 {
  for (let index = points.length - 1; index > 0; index -= 1) {
    const direction = normalize(sub(points[index], points[index - 1]));
    if (length(direction) > EPSILON) return direction;
  }
  return { x: 0, y: 0 };
}

function safeRatio(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, value!) : fallback;
}

function minimumGeometry(controlPoints: readonly LonLat[]): GraphicGeometry {
  const anchors = copyPoints(controlPoints);
  return { outline: anchors.map((point) => ({ ...point })), anchors };
}

/**
 * 生成闭合进攻箭头面。
 *
 * 宽度与头部长度分别相对控制轴线总长计算；重复点或不足两点时退化为最小折线。
 *
 * @param controlPoints 由尾部指向箭头尖端的控制轴线
 * @param params 宽度与头部比例覆盖
 * @returns 闭合箭头面和控制点锚点
 */
export function attackArrow(
  controlPoints: readonly LonLat[],
  params?: GraphicParams,
): GraphicGeometry {
  const anchors = copyPoints(controlPoints);
  const compact = compactPoints(anchors);
  if (compact.length < 2) return minimumGeometry(anchors);

  const plane = createLocalPlane(centroidOfLonLat(compact));
  const axis = compact.map(plane.toXY);
  const total = pathLength(axis);
  const direction = lastDirection(axis);
  if (total <= EPSILON || length(direction) <= EPSILON) return minimumGeometry(anchors);

  const defaults = metaOfGraphic('attackArrow').defaultParams;
  const width = total * safeRatio(params?.widthRatio, defaults.widthRatio);
  const headLength = Math.min(
    total * 0.9,
    total * safeRatio(params?.headRatio, defaults.headRatio),
  );
  const tip = axis.at(-1)!;
  const headBase = sub(tip, scale(direction, headLength));
  const body = [...axis.slice(0, -1), headBase];
  const widths = body.map((_, index) => (index === 0 ? 0 : width));
  const { left, right } = variableOffsetPolyline(body, widths);
  const headNormal = perpendicular(direction);
  const headWidth = Math.max(width * 1.5, EPSILON);
  const headLeft = add(headBase, scale(headNormal, headWidth / 2));
  const headRight = add(headBase, scale(headNormal, -headWidth / 2));
  const outlineXY = [
    body[0],
    ...left.slice(1),
    headLeft,
    tip,
    headRight,
    ...right.slice(1).reverse(),
    body[0],
  ];

  return { outline: outlineXY.map(plane.toLonLat), anchors };
}

/**
 * 生成进攻轴线及其末端两条箭头边。
 *
 * 主轮廓保持为控制轴线，附加笔画不表达填充语义。
 *
 * @param controlPoints 由起点指向进攻方向的控制轴线
 * @param params 箭头头部比例覆盖
 * @returns 轴线、箭头边和控制点锚点
 */
export function axisOfAdvance(
  controlPoints: readonly LonLat[],
  params?: GraphicParams,
): GraphicGeometry {
  const anchors = copyPoints(controlPoints);
  const compact = compactPoints(anchors);
  if (compact.length < 2) return minimumGeometry(anchors);

  const plane = createLocalPlane(centroidOfLonLat(compact));
  const axis = compact.map(plane.toXY);
  const total = pathLength(axis);
  const direction = lastDirection(axis);
  if (total <= EPSILON || length(direction) <= EPSILON) return minimumGeometry(anchors);

  const defaults = metaOfGraphic('axisOfAdvance').defaultParams;
  const headLength = Math.min(
    total * 0.9,
    total * safeRatio(params?.headRatio, defaults.headRatio),
  );
  const tip = axis.at(-1)!;
  const base = sub(tip, scale(direction, headLength));
  const normal = perpendicular(direction);
  const wing = Math.max(headLength * 0.55, EPSILON);
  const left = add(base, scale(normal, wing));
  const right = add(base, scale(normal, -wing));

  return {
    outline: anchors.map((point) => ({ ...point })),
    parts: [
      [plane.toLonLat(left), plane.toLonLat(tip)],
      [plane.toLonLat(tip), plane.toLonLat(right)],
    ],
    anchors,
  };
}
