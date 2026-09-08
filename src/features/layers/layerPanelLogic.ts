/**
 * 图层面板交互的纯逻辑。
 *
 * 拖放载荷和不透明度事务判断放在此处，避免 UI 事件细节散落在组件中。
 */

import { LayerStatus } from '@/core/model';

/** 要素拖放载荷的 MIME 类型。 */
export const FEATURE_IDS_DRAG_MIME = 'application/x-map-army-feature-ids';
/** 图层排序拖放载荷的 MIME 类型。 */
export const LAYER_ID_DRAG_MIME = 'application/x-map-army-layer-id';

/** 图层状态在界面上的可读描述与下一次切换值。 */
export function layerStatusDisplay(status: LayerStatus | undefined): {
  label: string;
  nextStatus: LayerStatus;
} {
  return status === LayerStatus.Approved
    ? { label: '已核定', nextStatus: LayerStatus.Working }
    : { label: '草稿', nextStatus: LayerStatus.Approved };
}

/** 序列化要素标识的拖放载荷。 */
export function serializeFeatureDragIds(ids: readonly string[]): string {
  return JSON.stringify([...new Set(ids.filter((id) => id.length > 0))]);
}

/** 解析并校验要素标识拖放载荷，非法输入返回 null。 */
export function parseFeatureDragIds(payload: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isNonEmptyString))
      return null;
    return [...new Set(parsed)];
  } catch {
    return null;
  }
}

/** 从 dataTransfer 的可用类型判断本次放置动作。 */
export function dropPayloadKind(types: readonly string[]): 'feature' | 'layer' | null {
  if (types.includes(FEATURE_IDS_DRAG_MIME)) return 'feature';
  if (types.includes(LAYER_ID_DRAG_MIME)) return 'layer';
  return null;
}

/** 不透明度控件事件对事务状态的影响。 */
export function opacityTransactionAction(
  event: 'pointerdown' | 'pointerup' | 'pointercancel' | 'blur' | 'keydown' | 'keyup',
  key?: string,
): 'begin' | 'end' | 'none' {
  if (event === 'pointerdown') return 'begin';
  if (event === 'pointerup' || event === 'pointercancel' || event === 'blur') return 'end';
  if (event === 'keydown' && isRangeAdjustmentKey(key)) return 'begin';
  if (event === 'keyup' && isRangeAdjustmentKey(key)) return 'end';
  return 'none';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isRangeAdjustmentKey(key: string | undefined): boolean {
  return (
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'Home' ||
    key === 'End' ||
    key === 'PageUp' ||
    key === 'PageDown'
  );
}
