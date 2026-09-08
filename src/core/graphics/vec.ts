/**
 * 战术图形使用的二维向量与折线基元。
 *
 * 所有函数运行于局部米制平面，不涉及样式、投影或 UI；退化输入会返回稳定的
 * 零向量或最小几何，避免将 NaN 传播到图形生成器。
 */

import type { Vec2 } from '../geo';

const EPSILON = 1e-9;

/** 两个向量相加。 */
export function add(first: Vec2, second: Vec2): Vec2 {
  return { x: first.x + second.x, y: first.y + second.y };
}

/** 从第一个向量减去第二个向量。 */
export function sub(first: Vec2, second: Vec2): Vec2 {
  return { x: first.x - second.x, y: first.y - second.y };
}

/** 向量数乘。 */
export function scale(vector: Vec2, factor: number): Vec2 {
  return { x: vector.x * factor, y: vector.y * factor };
}

/** 向量长度。 */
export function length(vector: Vec2): number {
  return Math.hypot(vector.x, vector.y);
}

/**
 * 单位化向量；零向量返回零向量。
 *
 * @param vector 待单位化向量
 * @returns 单位向量或稳定的零向量
 */
export function normalize(vector: Vec2): Vec2 {
  const magnitude = length(vector);
  if (!Number.isFinite(magnitude) || magnitude <= EPSILON) return { x: 0, y: 0 };
  return { x: vector.x / magnitude, y: vector.y / magnitude };
}

/** 向量左侧垂线方向。 */
export function perpendicular(vector: Vec2): Vec2 {
  return { x: vector.y === 0 ? 0 : -vector.y, y: vector.x === 0 ? 0 : vector.x };
}

/** 向量点积。 */
export function dot(first: Vec2, second: Vec2): number {
  return first.x * second.x + first.y * second.y;
}

/** 在两个向量间按比例线性插值。 */
export function lerp(first: Vec2, second: Vec2, ratio: number): Vec2 {
  return add(first, scale(sub(second, first), ratio));
}

/**
 * 去除连续重复点并复制结果，保证后续折线算法不修改输入。
 */
function compactPolyline(points: readonly Vec2[]): Vec2[] {
  const result: Vec2[] = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (previous === undefined || length(sub(point, previous)) > EPSILON) {
      result.push({ x: point.x, y: point.y });
    }
  }
  return result;
}

/**
 * 计算某顶点的稳定左法线。共线和折返场景优先使用可用邻边。
 */
function normalAt(points: readonly Vec2[], index: number): Vec2 {
  const previous = index > 0 ? normalize(sub(points[index], points[index - 1])) : { x: 0, y: 0 };
  const next =
    index < points.length - 1 ? normalize(sub(points[index + 1], points[index])) : { x: 0, y: 0 };
  const blended = normalize(add(perpendicular(previous), perpendicular(next)));

  if (length(blended) > EPSILON) return blended;
  if (length(next) > EPSILON) return normalize(perpendicular(next));
  if (length(previous) > EPSILON) return normalize(perpendicular(previous));
  return { x: 0, y: 0 };
}

/**
 * 将折线沿其左法线等距偏移。
 *
 * @param points 原始折线
 * @param distance 偏移距离，正数朝左、负数朝右
 * @returns 新的偏移折线
 */
export function offsetPolyline(points: readonly Vec2[], distance: number): Vec2[] {
  const compact = compactPolyline(points);
  if (compact.length <= 1 || !Number.isFinite(distance)) return compact;

  return compact.map((point, index) => add(point, scale(normalAt(compact, index), distance)));
}

/**
 * 生成两侧宽度可变的折线偏移结果。
 *
 * 宽度按顶点顺序读取，不足的项使用最后一个可用宽度；负宽度按零处理。
 *
 * @param points 原始中心线
 * @param widths 各顶点的全宽
 * @returns 左右边界折线
 */
export function variableOffsetPolyline(
  points: readonly Vec2[],
  widths: readonly number[],
): { left: Vec2[]; right: Vec2[] } {
  const compact = compactPolyline(points);
  if (compact.length <= 1) return { left: compact, right: compact.map((point) => ({ ...point })) };

  const fallbackWidth = widths.at(-1) ?? 0;
  const halfWidthAt = (index: number): number => {
    const width = widths[index] ?? fallbackWidth;
    return Number.isFinite(width) ? Math.max(width, 0) / 2 : 0;
  };

  return {
    left: compact.map((point, index) =>
      add(point, scale(normalAt(compact, index), halfWidthAt(index))),
    ),
    right: compact.map((point, index) =>
      add(point, scale(normalAt(compact, index), -halfWidthAt(index))),
    ),
  };
}

/**
 * 按指定间距采样折线，保留首尾点。
 *
 * @param points 原始折线
 * @param spacing 采样间距；非正或非有限值时仅返回去重后的顶点
 * @returns 新的采样点序列
 */
export function samplePolyline(points: readonly Vec2[], spacing: number): Vec2[] {
  const compact = compactPolyline(points);
  if (compact.length <= 1 || !Number.isFinite(spacing) || spacing <= EPSILON) return compact;

  const result: Vec2[] = [{ ...compact[0] }];
  let distanceToNext = spacing;
  let cursor = compact[0];

  for (let index = 1; index < compact.length; index += 1) {
    const segmentEnd = compact[index];
    let segment = sub(segmentEnd, cursor);
    let segmentLength = length(segment);

    while (segmentLength + EPSILON >= distanceToNext) {
      const point = lerp(cursor, segmentEnd, distanceToNext / segmentLength);
      result.push(point);
      cursor = point;
      segment = sub(segmentEnd, cursor);
      segmentLength = length(segment);
      distanceToNext = spacing;
    }

    distanceToNext -= segmentLength;
    cursor = segmentEnd;
  }

  const last = compact.at(-1)!;
  if (length(sub(result.at(-1)!, last)) > EPSILON) result.push({ ...last });
  return result;
}

/**
 * 对折线内角做圆角采样。首尾点始终保留，重复或共线点不会产生无效坐标。
 *
 * @param points 原始折线
 * @param radius 最大圆角半径
 * @param segments 每个圆角的采样段数
 * @returns 圆角化后的折线
 */
export function roundPolyline(points: readonly Vec2[], radius: number, segments = 4): Vec2[] {
  const compact = compactPolyline(points);
  if (compact.length <= 2 || !Number.isFinite(radius) || radius <= EPSILON) return compact;

  const result: Vec2[] = [{ ...compact[0] }];
  const steps = Math.max(1, Math.trunc(segments));

  for (let index = 1; index < compact.length - 1; index += 1) {
    const previous = compact[index - 1];
    const current = compact[index];
    const next = compact[index + 1];
    const incoming = normalize(sub(previous, current));
    const outgoing = normalize(sub(next, current));
    const turn = Math.abs(incoming.x * outgoing.y - incoming.y * outgoing.x);

    if (length(incoming) <= EPSILON || length(outgoing) <= EPSILON || turn <= EPSILON) {
      result.push({ ...current });
      continue;
    }

    const distance = Math.min(
      radius,
      length(sub(previous, current)) / 2,
      length(sub(next, current)) / 2,
    );
    const start = add(current, scale(incoming, distance));
    const end = add(current, scale(outgoing, distance));
    result.push(start);
    for (let step = 1; step < steps; step += 1) result.push(lerp(start, end, step / steps));
    result.push(end);
  }

  result.push({ ...compact.at(-1)! });
  return result;
}

/**
 * 在多边形内生成 45 度斜线填充。支持凹多边形，每一对交点生成一条线段。
 *
 * @param polygon 多边形顶点，可闭合也可不闭合
 * @param spacing 相邻斜线的正交间距
 * @returns 位于多边形内的 45 度线段
 */
export function hatch45(polygon: readonly Vec2[], spacing: number): Vec2[][] {
  const ring = compactPolyline(polygon);
  if (ring.length < 3 || !Number.isFinite(spacing) || spacing <= EPSILON) return [];

  const closed = length(sub(ring[0], ring.at(-1)!)) <= EPSILON ? ring.slice(0, -1) : ring;
  if (closed.length < 3) return [];

  const constants = closed.map((point) => point.y - point.x);
  const minimum = Math.min(...constants);
  const maximum = Math.max(...constants);
  const first = Math.ceil(minimum / spacing) * spacing;
  const lines: Vec2[][] = [];

  for (let constant = first; constant <= maximum + EPSILON; constant += spacing) {
    const intersections: number[] = [];
    for (let index = 0; index < closed.length; index += 1) {
      const start = closed[index];
      const end = closed[(index + 1) % closed.length];
      const startConstant = start.y - start.x;
      const endConstant = end.y - end.x;
      const crosses =
        (startConstant <= constant && constant < endConstant) ||
        (endConstant <= constant && constant < startConstant);
      if (!crosses) continue;

      const ratio = (constant - startConstant) / (endConstant - startConstant);
      intersections.push(start.x + (end.x - start.x) * ratio);
    }

    intersections.sort((firstX, secondX) => firstX - secondX);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const startX = intersections[index];
      const endX = intersections[index + 1];
      if (endX - startX > EPSILON) {
        lines.push([
          { x: startX, y: startX + constant },
          { x: endX, y: endX + constant },
        ]);
      }
    }
  }

  return lines;
}
