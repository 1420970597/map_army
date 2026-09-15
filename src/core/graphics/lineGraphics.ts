/**
 * 防御线、分界线与相位线生成器。
 *
 * 几何在控制点中心的局部米制平面中计算。防御线的齿默认朝控制轴线右侧，
 * 即按控制点顺序行进时的右手侧视为敌侧。
 */

import { centroidOfLonLat, createLocalPlane, type LonLat, type Vec2 } from '../geo';
import type { GraphicParams } from '../model';
import { metaOfGraphic } from './meta';
import type { GraphicGeometry } from './types';
import { add, length, normalize, perpendicular, samplePolyline, scale, sub } from './vec';

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

function directionAt(points: readonly Vec2[], point: Vec2): Vec2 {
  let best: Vec2 = { x: 0, y: 0 };
  let bestDistance = Infinity;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segment = sub(end, start);
    const segmentLength = length(segment);
    if (segmentLength <= EPSILON) continue;
    const ratio = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * segment.x + (point.y - start.y) * segment.y) / segmentLength ** 2,
      ),
    );
    const projected = add(start, scale(segment, ratio));
    const distance = length(sub(point, projected));
    if (distance < bestDistance) {
      best = normalize(segment);
      bestDistance = distance;
    }
  }
  return best;
}

function ratio(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, value!) : fallback;
}

function minimum(points: readonly LonLat[]): GraphicGeometry {
  const anchors = copyPoints(points);
  return { outline: anchors.map((point) => ({ ...point })), anchors };
}

function validAxis(points: readonly LonLat[]): { anchors: LonLat[]; compact: LonLat[] } | null {
  const anchors = copyPoints(points);
  const compactPoints = compact(anchors);
  return compactPoints.length >= 2 ? { anchors, compact: compactPoints } : null;
}

/**
 * 生成防御线与右侧防御齿。
 *
 * 齿沿控制轴线右法线伸出，长度和间距均相对于总轴线长度计算。
 *
 * @param controlPoints 防御线控制点
 * @param params 齿长和间距参数覆盖
 * @returns 主轴线、右侧齿和控制点锚点
 */
export function defenceLine(
  controlPoints: readonly LonLat[],
  params?: GraphicParams,
): GraphicGeometry {
  const axisData = validAxis(controlPoints);
  if (axisData === null) return minimum(controlPoints);
  const { anchors, compact: compactPoints } = axisData;
  const plane = createLocalPlane(centroidOfLonLat(compactPoints));
  const axis = compactPoints.map(plane.toXY);
  const total = pathLength(axis);
  if (total <= EPSILON) return minimum(anchors);

  const defaults = metaOfGraphic('defenceLine').defaultParams;
  const toothLength = total * ratio(params?.toothRatio, defaults.toothRatio);
  const spacing = total * ratio(params?.toothSpacingRatio, defaults.toothSpacingRatio);
  const samples = samplePolyline(axis, spacing > EPSILON ? spacing : total);
  const parts = samples.map((sample) => {
    const direction = directionAt(axis, sample);
    const right = scale(perpendicular(direction), -1);
    return [plane.toLonLat(sample), plane.toLonLat(add(sample, scale(right, toothLength)))];
  });

  return { outline: anchors.map((point) => ({ ...point })), parts, anchors };
}

/**
 * 生成分界线与横向短杠。
 *
 * 每个短杠以轴线采样点为中心，沿法线两侧等长延伸。
 *
 * @param controlPoints 分界线控制点
 * @param params 短杠长度和间距参数覆盖
 * @returns 主轴线、横向短杠和控制点锚点
 */
export function boundary(
  controlPoints: readonly LonLat[],
  params?: GraphicParams,
): GraphicGeometry {
  const axisData = validAxis(controlPoints);
  if (axisData === null) return minimum(controlPoints);
  const { anchors, compact: compactPoints } = axisData;
  const plane = createLocalPlane(centroidOfLonLat(compactPoints));
  const axis = compactPoints.map(plane.toXY);
  const total = pathLength(axis);
  if (total <= EPSILON) return minimum(anchors);

  const defaults = metaOfGraphic('boundary').defaultParams;
  const tickLength = total * ratio(params?.tickRatio, defaults.tickRatio);
  const spacing = total * ratio(params?.tickSpacingRatio, defaults.tickSpacingRatio);
  const samples = samplePolyline(axis, spacing > EPSILON ? spacing : total);
  const parts = samples.map((sample) => {
    const normal = normalize(perpendicular(directionAt(axis, sample)));
    return [
      plane.toLonLat(add(sample, scale(normal, tickLength / 2))),
      plane.toLonLat(add(sample, scale(normal, -tickLength / 2))),
    ];
  });

  return { outline: anchors.map((point) => ({ ...point })), parts, anchors };
}

/**
 * 生成相位线、端部翼展和标签锚点。
 *
 * 两端翼展沿各自端点的法线双向延长，总长度为总轴线长度乘以 phaseWingRatio。
 *
 * @param controlPoints 相位线控制点
 * @param params 翼展比例覆盖
 * @returns 主轴线、两端翼展、标签和控制点锚点
 */
export function phaseLine(
  controlPoints: readonly LonLat[],
  params?: GraphicParams,
): GraphicGeometry {
  const axisData = validAxis(controlPoints);
  if (axisData === null) return minimum(controlPoints);
  const { anchors, compact: compactPoints } = axisData;
  const plane = createLocalPlane(centroidOfLonLat(compactPoints));
  const axis = compactPoints.map(plane.toXY);
  const total = pathLength(axis);
  if (total <= EPSILON) return minimum(anchors);

  const defaults = metaOfGraphic('phaseLine').defaultParams;
  const wingLength = total * ratio(params?.phaseWingRatio, defaults.phaseWingRatio);
  const start = axis[0];
  const end = axis.at(-1)!;
  const startNormal = normalize(perpendicular(directionAt(axis, start)));
  const endNormal = normalize(perpendicular(directionAt(axis, end)));
  const wing = (point: Vec2, normal: Vec2): LonLat[] => [
    plane.toLonLat(add(point, scale(normal, wingLength / 2))),
    plane.toLonLat(add(point, scale(normal, -wingLength / 2))),
  ];

  return {
    outline: anchors.map((point) => ({ ...point })),
    parts: [wing(start, startNormal), wing(end, endNormal)],
    labels: [
      { text: 'PL', position: { ...compactPoints[0] } },
      { text: 'PL', position: { ...compactPoints.at(-1)! } },
    ],
    anchors,
  };
}
