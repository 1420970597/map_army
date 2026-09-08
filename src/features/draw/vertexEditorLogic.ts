/**
 * 顶点编辑器的纯逻辑。
 *
 * 本模块负责判断要素是否可编辑、从文档构造吸附候选，以及判断拖拽是否产生实际几何变更。
 * 它不依赖 React 或 Leaflet，便于在无 DOM 环境下验证编辑策略。
 */

import type { LonLat, SnapCandidate } from '@/core/geo';
import { GeometryKind, Tool, type Layer, type MapFeature } from '@/core/model';

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
