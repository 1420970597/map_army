/**
 * 图层排序规则。
 *
 * 全应用统一约定：**order 越大越靠上**——order 最大的图层压盖在其他图层之上，
 * 图层面板也按 order 降序展示，使列表顺序与地图压盖顺序一一对应。
 *
 * 拖拽排序本质上只改变图层在展示序列中的位置，因此这里实现为与 UI 无关的
 * 纯函数，便于单测覆盖"拖到自己""id 不存在""仅一个图层"等边界情况。
 */

import type { Layer } from './types';

/**
 * 按展示顺序排序（order 降序，最上层排在最前）。
 *
 * @param layers 图层列表，不会被修改
 * @returns 排序后的新数组
 */
export function sortLayersByDisplay(layers: Layer[]): Layer[] {
  return [...layers].sort((a, b) => b.order - a.order);
}

/**
 * 把 sourceId 图层移动到 targetId 图层所在的展示位置。
 *
 * 移动后会重排全部图层的 order，使其在 `[0, count-1]` 上连续且互不相同，
 * 仍然保持"越大越靠上"。顺便也消除了历史数据里可能出现的并列 order。
 *
 * 若两个 id 相同，或任一 id 不在列表中，则原样返回入参引用——
 * 调用方可据此判定"没有变化，无需提交一次历史记录"。
 *
 * @param layers 当前图层列表
 * @param sourceId 被拖动的图层标识
 * @param targetId 放置位置上的图层标识
 */
export function reorderLayers(layers: Layer[], sourceId: string, targetId: string): Layer[] {
  if (sourceId === targetId) return layers;

  const ordered = sortLayersByDisplay(layers);
  const from = ordered.findIndex((layer) => layer.id === sourceId);
  const to = ordered.findIndex((layer) => layer.id === targetId);
  if (from < 0 || to < 0) return layers;

  // 先摘除再插入：插入下标即目标图层在**结果**序列中的最终位置。
  // 例如 [A,B,C,D] 把 A 拖到 C，得到 [B,C,A,D]，A 落在下标 2。
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);

  // 展示序列首位最靠上，order 取最大值，之后依次递减
  return ordered.map((layer, index) => ({ ...layer, order: ordered.length - 1 - index }));
}
