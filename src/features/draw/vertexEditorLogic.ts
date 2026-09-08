/**
 * 顶点编辑器的纯逻辑。
 *
 * 本模块负责判断要素是否可编辑、从文档构造吸附候选、判断拖拽是否产生实际几何变更，
 * 并以注入投影计算 Ctrl 插入所需的最近线段。它不依赖 React 或 Leaflet。
 */

import type { LonLat, Pixel, Projection, SnapCandidate } from '@/core/geo';
import { GeometryKind, Tool, stepVertex, type Layer, type MapFeature } from '@/core/model';

/** 单次拖拽的候选总数上限，避免超大文档拖拽时退化为大量逐帧比较。 */
export const MAX_VERTEX_SNAP_CANDIDATES = 2000;

/** 顶点编辑资格所需的最小输入。 */
export interface VertexEditorEligibilityInput {
  activeTool: Tool;
  selectedIds: readonly string[];
  feature: MapFeature | null | undefined;
  layers: readonly Layer[];
}

/** 吸附候选构建所需的文档数据。 */
export interface VertexSnapCandidateInput {
  feature: MapFeature;
  features: readonly MapFeature[];
  layers: readonly Layer[];
  maxCandidates?: number;
}

/** 最近线段插入目标；index 是新顶点在数组中的插入位置。 */
export interface SegmentInsertTarget {
  /** 新顶点的插入位置。 */
  index: number;
  /** 目标点在线段上的投影，已换回经纬度。 */
  point: LonLat;
  /** 目标点到线段的屏幕距离。 */
  distancePx: number;
}

/** 判断两个经纬度坐标是否精确相同。 */
function sameLonLat(first: LonLat, second: LonLat): boolean {
  return first.lon === second.lon && first.lat === second.lat;
}

/** 判断两个顶点数组是否相同。 */
export function sameVertexPoints(first: readonly LonLat[], second: readonly LonLat[]): boolean {
  return (
    first.length === second.length &&
    first.every((point, index) => sameLonLat(point, second[index]))
  );
}

/**
 * 判断当前选择能否进入顶点编辑状态。
 *
 * 点要素不提供顶点编辑；多选、隐藏图层、锁定图层或非选择工具均不可编辑。
 */
export function isVertexEditorEligible(input: VertexEditorEligibilityInput): boolean {
  const { activeTool, selectedIds, feature, layers } = input;
  if (
    activeTool !== Tool.Select ||
    selectedIds.length !== 1 ||
    feature === null ||
    feature === undefined ||
    feature.geometry.kind === GeometryKind.Point
  ) {
    return false;
  }

  const layer = layers.find((item) => item.id === feature.layerId);
  return layer !== undefined && layer.visible && !layer.locked;
}

/** 返回要素所有可吸附顶点；点要素也作为单个候选顶点参与。 */
export function verticesOfFeature(feature: MapFeature): readonly LonLat[] {
  return feature.geometry.kind === GeometryKind.Point
    ? [feature.geometry.position]
    : feature.geometry.points;
}

/**
 * 构造顶点拖拽的吸附候选。
 *
 * 被编辑要素的顶点标为 self，其他位于可见且未锁定图层的要素标为 feature。
 * 网格交点尚未加入：GridOverlay 当前未暴露可消费的交点数据，待其提供数据接口后在此处增加 grid 分支。
 */
export function buildVertexSnapCandidates({
  feature,
  features,
  layers,
  maxCandidates = MAX_VERTEX_SNAP_CANDIDATES,
}: VertexSnapCandidateInput): SnapCandidate[] {
  const limit = Math.max(0, Math.floor(maxCandidates));
  const candidates: SnapCandidate[] = [];
  const add = (candidate: SnapCandidate): boolean => {
    if (candidates.length >= limit) return false;
    candidates.push({ ...candidate, point: { ...candidate.point } });
    return true;
  };

  for (const [index, point] of verticesOfFeature(feature).entries()) {
    if (!add({ point, source: 'self', featureId: feature.id, index })) return candidates;
  }

  const editableLayerIds = new Set(
    layers.filter((layer) => layer.visible && !layer.locked).map((layer) => layer.id),
  );

  for (const other of features) {
    if (
      other.id === feature.id ||
      other.layerId === feature.layerId ||
      !editableLayerIds.has(other.layerId)
    ) {
      continue;
    }
    for (const [index, point] of verticesOfFeature(other).entries()) {
      if (!add({ point, source: 'feature', featureId: other.id, index })) return candidates;
    }
  }

  return candidates;
}

/** 仅在顶点坐标实际发生变化时才需要把拖拽结果写入文档事务。 */
export function shouldCommitVertexDrag(
  startPoints: readonly LonLat[],
  endPoints: readonly LonLat[],
): boolean {
  return !sameVertexPoints(startPoints, endPoints);
}

/**
 * 查找距离目标最近且未超过阈值的线段插入目标。
 *
 * 计算完全在注入的屏幕投影中进行，避免以经纬度直接比较造成不同缩放级别下的命中偏差。
 * 距离并列时保留最小线段下标，返回的插入位置为该下标加一。
 *
 * @param points 待查找的折线顶点，不会被修改
 * @param target 目标经纬度坐标
 * @param projection 经纬度与屏幕像素坐标之间的投影能力
 * @param maxDistancePx 最大命中距离，单位为像素
 * @returns 命中线段的插入目标；无命中时返回 null
 */
export function nearestSegment(
  points: readonly LonLat[],
  target: LonLat,
  projection: Projection,
  maxDistancePx: number,
  closeLoop = false,
): SegmentInsertTarget | null {
  if (points.length < 2 || !Number.isFinite(maxDistancePx) || maxDistancePx < 0) return null;

  const targetPixel = projection.toPixel(target);
  const segmentCount = closeLoop ? points.length : points.length - 1;
  let nearest: SegmentInsertTarget | null = null;

  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    const start = projection.toPixel(points[segmentIndex]);
    const end = projection.toPixel(points[(segmentIndex + 1) % points.length]);
    const projectedPixel = projectToSegment(targetPixel, start, end);
    const distancePx = Math.hypot(
      targetPixel.x - projectedPixel.x,
      targetPixel.y - projectedPixel.y,
    );

    if (distancePx > maxDistancePx || (nearest !== null && distancePx >= nearest.distancePx))
      continue;

    nearest = {
      index: segmentIndex + 1,
      point: projection.toLonLat(projectedPixel),
      distancePx,
    };
  }

  return nearest;
}

/** 将目标像素投影到有限线段上。 */
function projectToSegment(target: Pixel, start: Pixel, end: Pixel): Pixel {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const squaredLength = deltaX * deltaX + deltaY * deltaY;
  const ratio =
    squaredLength === 0
      ? 0
      : Math.min(
          1,
          Math.max(
            0,
            ((target.x - start.x) * deltaX + (target.y - start.y) * deltaY) / squaredLength,
          ),
        );

  return { x: start.x + deltaX * ratio, y: start.y + deltaY * ratio };
}

/**
 * 计算顶点编辑器下一活动顶点下标。
 *
 * @param current 当前活动下标；null 时视为 0
 * @param delta 循环步进量，可为负数
 * @param length 顶点数量
 * @returns 环绕后的下标；无顶点时返回 null
 */
export function nextActiveVertexIndex(
  current: number | null,
  delta: number,
  length: number,
): number | null {
  if (length <= 0) return null;
  return stepVertex(current ?? 0, delta, length);
}
