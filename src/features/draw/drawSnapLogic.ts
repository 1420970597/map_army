/**
 * 绘制期吸附的纯逻辑。
 *
 * 绘制与顶点编辑共用 `core/geo/snap` 的 `snapPoint`，差别只在候选来源：
 *
 * - 顶点编辑期间，"自身"是被拖要素的其余顶点，并要排除正在拖动的那一个；
 * - 绘制期间，没有正在编辑的要素，"自身"是**草稿已采集的顶点**，
 *   其余候选来自文档中位于可见且未锁定图层上的要素。
 *
 * 本模块不依赖 React 与 Leaflet，投影由调用方注入，便于在恒等投影下单测。
 */

import type { LonLat, Projection, SnapCandidate, SnapResult } from '@/core/geo';
import { snapPoint } from '@/core/geo';
import type { Layer, MapFeature } from '@/core/model';

import { verticesOfFeature } from './vertexEditorLogic';

/** 草稿顶点在候选中使用的要素标识；它不是文档中的真实要素。 */
export const DRAFT_FEATURE_ID = 'draft';

/** 绘制期候选总数上限，避免超大文档在 mousemove 中退化为大量逐帧比较。 */
export const MAX_DRAW_SNAP_CANDIDATES = 2000;

/** 构造绘制期吸附候选所需的输入。 */
export interface DrawSnapInput {
  /** 当前草稿已采集的顶点，按采集顺序排列。 */
  draft: readonly LonLat[];
  /** 文档中的全部要素；是否参与吸附由所属图层决定。 */
  features: readonly MapFeature[];
  /** 文档中的全部图层。 */
  layers: readonly Layer[];
  /** 需要从要素候选中排除的要素标识，例如绘制前正在编辑的要素。 */
  currentFeatureId?: string;
  /** 候选总数上限；默认 `MAX_DRAW_SNAP_CANDIDATES`。 */
  maxCandidates?: number;
}

/** 一次绘制吸附决策所需的输入。 */
export interface DrawSnapDecisionInput {
  /** 待吸附的原始经纬度坐标，通常为鼠标位置。 */
  origin: LonLat;
  /** 可供比较的吸附候选点。 */
  candidates: readonly SnapCandidate[];
  /** 是否启用吸附，对应 `useEditStore.snapEnabled`。 */
  enabled: boolean;
  /** 吸附阈值，单位为屏幕像素，对应 `useEditStore.snapThresholdPx`。 */
  thresholdPx: number;
  /** 经纬度与屏幕像素之间的投影能力。 */
  projection: Projection;
}

/**
 * 构造绘制期的吸附候选。
 *
 * 草稿顶点以 `self` 排在前面，使同等距离下优先吸附到本次绘制已采集的顶点
 * （例如闭合面时回到起点）；随后是位于可见且未锁定图层上的要素顶点，来源为 `feature`。
 * 图层缺失、隐藏或锁定的要素均不参与，坐标会被复制，调用方后续修改输入不影响结果。
 *
 * @param input 草稿、要素与图层数据。
 * @returns 按顺序排列的吸附候选；达到上限时提前返回。
 */
export function buildDrawSnapCandidates({
  draft,
  features,
  layers,
  currentFeatureId,
  maxCandidates = MAX_DRAW_SNAP_CANDIDATES,
}: DrawSnapInput): SnapCandidate[] {
  const limit = Math.max(0, Math.floor(maxCandidates));
  const candidates: SnapCandidate[] = [];
  const add = (candidate: SnapCandidate): boolean => {
    if (candidates.length >= limit) return false;
    candidates.push({ ...candidate, point: { ...candidate.point } });
    return true;
  };

  for (const [index, point] of draft.entries()) {
    if (!add({ point, source: 'self', featureId: DRAFT_FEATURE_ID, index })) return candidates;
  }

  const snappableLayerIds = new Set(
    layers.filter((layer) => layer.visible && !layer.locked).map((layer) => layer.id),
  );

  for (const item of features) {
    if (item.id === currentFeatureId || !snappableLayerIds.has(item.layerId)) continue;
    for (const [index, point] of verticesOfFeature(item).entries()) {
      if (!add({ point, source: 'feature', featureId: item.id, index })) return candidates;
    }
  }

  return candidates;
}

/**
 * 计算绘制期的吸附结果。
 *
 * 与顶点编辑共用同一开关与阈值；关闭吸附或阈值内无候选时返回 null，
 * 调用方据此回落到原始鼠标坐标。
 *
 * @param input 原始坐标、候选、开关、阈值与投影。
 * @returns 命中的吸附结果；未命中或禁用时返回 null。
 */
export function resolveDrawSnap({
  origin,
  candidates,
  enabled,
  thresholdPx,
  projection,
}: DrawSnapDecisionInput): SnapResult | null {
  if (!enabled) return null;
  return snapPoint(origin, candidates, { enabled, thresholdPx }, projection);
}

/**
 * 判断两次吸附结果是否指向同一个目标。
 *
 * 绘制期的指示器只关心"命中了谁"，因此只比较坐标与候选来源，
 * 不比较随鼠标变化的像素距离，避免同一目标下每帧重复移动指示器。
 */
export function sameDrawSnapTarget(first: SnapResult | null, second: SnapResult | null): boolean {
  if (first === null || second === null) return first === second;
  return (
    first.point.lon === second.point.lon &&
    first.point.lat === second.point.lat &&
    first.source === second.source &&
    first.candidate.featureId === second.candidate.featureId &&
    first.candidate.index === second.candidate.index
  );
}
