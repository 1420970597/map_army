/** 检查器多选面板的派生状态。 */

import { GeometryKind, type Layer, type MapFeature } from '@/core/model';

export interface InspectorSelectionState {
  selectedIds: string[];
  primary: MapFeature | null;
  mode: 'none' | 'single' | 'multiple';
}

/** 根据选择顺序清理不存在或重复的要素，并取队列末位为主选。 */
export function deriveInspectorSelection(
  selectedIds: readonly string[],
  features: readonly MapFeature[],
): InspectorSelectionState {
  const featuresById = new Map(features.map((feature) => [feature.id, feature]));
  const seen = new Set<string>();
  const ids = selectedIds.filter((id) => !seen.has(id) && seen.add(id) && featuresById.has(id));
  const primaryId = ids.at(-1);
  const primary = primaryId ? (featuresById.get(primaryId) ?? null) : null;

  return {
    selectedIds: ids,
    primary,
    mode: ids.length === 0 ? 'none' : ids.length === 1 ? 'single' : 'multiple',
  };
}

/** 返回可供批量移动选择的图层，以文档顺序保留锁定状态。 */
export function targetLayers(layers: readonly Layer[]): readonly Layer[] {
  return layers;
}

/** 只有线和面可提供顶点方向重置。 */
export function canResetVertexBearing(feature: MapFeature | null): boolean {
  return feature !== null && feature.geometry.kind !== GeometryKind.Point;
}
