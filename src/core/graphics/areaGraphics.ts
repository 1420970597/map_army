/**
 * 集结地域与走廊生成器。
 *
 * 形状在局部米制平面中构造；输出只包含经纬度几何，不包含渲染样式。
 */

import { centroidOfLonLat, createLocalPlane, type LonLat, type Vec2 } from '../geo';
import type { GraphicParams } from '../model';
import { metaOfGraphic } from './meta';
import type { GraphicGeometry } from './types';
import {
  add,
  hatch45,
  length,
  normalize,
  perpendicular,
  scale,
  sub,
  variableOffsetPolyline,
} from './vec';

const EPSILON = 1e-6;

function copyPoints(points: readonly LonLat[]): LonLat[] {
  return points
    .filter((point) => Number.isFinite(point.lon) && Number.isFinite(point.lat))
    .map((point) => ({ lon: point.lon, lat: point.lat }));
}

function compact(points: readonly LonLat[]): LonLat[] {
  const result: LonLat[] = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (
      previous === undefined ||
      Math.hypot(point.lon - previous.lon, point.lat - previous.lat) > Number.EPSILON
    ) {
      result.push({ ...point });
    }
  }
  return result;
}

function pathLength(points: readonly Vec2[]): number {
  let result = 0;
  for (let index = 1; index < points.length; index += 1) {
    result += length(sub(points[index], points[index - 1]));
  }
  return result;
}

function lastDirection(points: readonly Vec2[]): Vec2 {
  for (let index = points.length - 1; index > 0; index -= 1) {
    const direction = normalize(sub(points[index], points[index - 1]));
    if (length(direction) > EPSILON) return direction;
  }
  return { x: 0, y: 0 };
}

function ratio(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, value!) : fallback;
}

function minimum(points: readonly LonLat[]): GraphicGeometry {
  const anchors = copyPoints(points);
  return { outline: anchors.map((point) => ({ ...point })), anchors };
}

/**
 * 生成集结地域闭合轮廓和 45 度斜线阴影。
 *
 * 阴影的间距为控制地域包围尺度的指定比例，低于三点时返回最小可用几何。
 *
 * @param controlPoints 地域边界控制点
 * @param params 阴影间距比例覆盖
 * @returns 闭合地域、内部斜线和控制点锚点
 */
export function assemblyArea(
  controlPoints: readonly LonLat[],
  params?: GraphicParams,
): GraphicGeometry {
  const anchors = copyPoints(controlPoints);
  const polygon = compact(anchors);
  if (polygon.length < 3) return minimum(anchors);

  const plane = createLocalPlane(centroidOfLonLat(polygon));
  const ring = polygon.map(plane.toXY);
  const perimeter = pathLength([...ring, ring[0]]);
  if (perimeter <= EPSILON) return minimum(anchors);
  const defaults = metaOfGraphic('assemblyArea').defaultParams;
  const spacing = perimeter * ratio(params?.hatchSpacingRatio, defaults.hatchSpacingRatio);
  const outline = [...polygon.map((point) => ({ ...point })), { ...polygon[0] }];

  return {
    outline,
    parts: hatch45(ring, spacing > EPSILON ? spacing : perimeter).map((part) =>
      part.map(plane.toLonLat),
    ),
    anchors,
  };
}

/**
 * 生成中心线两侧等距的走廊面。
 *
 * `corridorWidthMeters` 为正时优先采用绝对宽度，否则使用 `widthRatio × 轴线总长`。
 *
 * @param controlPoints 走廊中心线控制点
 * @param params 走廊宽度覆盖
 * @returns 闭合走廊面、入口方向箭头和控制点锚点
 */
export function corridor(
  controlPoints: readonly LonLat[],
  params?: GraphicParams,
): GraphicGeometry {
  const anchors = copyPoints(controlPoints);
  const centerline = compact(anchors);
  if (centerline.length < 2) return minimum(anchors);

  const plane = createLocalPlane(centroidOfLonLat(centerline));
  const axis = centerline.map(plane.toXY);
  const total = pathLength(axis);
  const direction = lastDirection(axis);
  if (total <= EPSILON || length(direction) <= EPSILON) return minimum(anchors);

  const defaults = metaOfGraphic('corridor').defaultParams;
  const absolute = params?.corridorWidthMeters;
  const width =
    Number.isFinite(absolute) && absolute! > EPSILON
      ? absolute!
      : total * ratio(params?.widthRatio, defaults.widthRatio);
  const { left, right } = variableOffsetPolyline(
    axis,
    axis.map(() => width),
  );
  const outlineXY = [...left, ...right.reverse(), left[0]];
  const entrance = axis[0];
  const normal = perpendicular(direction);
  const arrowDepth = Math.min(width, total * 0.2);
  const arrowBase = add(entrance, scale(direction, arrowDepth));
  const arrowWing = Math.max(width * 0.25, EPSILON);
  const parts =
    arrowDepth > EPSILON
      ? [
          [
            plane.toLonLat(add(arrowBase, scale(normal, arrowWing))),
            plane.toLonLat(entrance),
            plane.toLonLat(add(arrowBase, scale(normal, -arrowWing))),
          ],
        ]
      : undefined;

  return { outline: outlineXY.map(plane.toLonLat), parts, anchors };
}
