/**
 * 多选集合的不可变操作：负责去重、顺序保持与范围选择计算。
 */

/**
 * 切换指定标识在选择集合中的状态。
 *
 * @param ids 当前选择集合。
 * @param id 需要切换的标识。
 * @returns 去重后的新选择集合。
 */
export function toggleInSelection(ids: readonly string[], id: string): string[] {
  const uniqueIds = unique(ids);

  return uniqueIds.includes(id)
    ? uniqueIds.filter((currentId) => currentId !== id)
    : [...uniqueIds, id];
}

/**
 * 向选择集合追加尚未存在的标识。
 *
 * @param ids 当前选择集合。
 * @param added 待追加的标识集合。
 * @returns 去重且保持首次出现顺序的新选择集合。
 */
export function addToSelection(ids: readonly string[], added: readonly string[]): string[] {
  return unique([...ids, ...added]);
}

/**
 * 从选择集合中移除指定标识。
 *
 * @param ids 当前选择集合。
 * @param removed 待移除的标识集合。
 * @returns 去重且保留其余首次出现顺序的新选择集合。
 */
export function removeFromSelection(ids: readonly string[], removed: readonly string[]): string[] {
  const removedIds = new Set(removed);

  return unique(ids).filter((id) => !removedIds.has(id));
}

/**
 * 计算两个端点之间按全量标识自然顺序排列的选择范围。
 *
 * @param allIds 全量标识的自然顺序。
 * @param anchorId 范围起点标识。
 * @param targetId 范围终点标识。
 * @returns 包含两个端点的去重范围；任一端点缺失时返回空数组。
 */
export function rangeSelection(
  allIds: readonly string[],
  anchorId: string,
  targetId: string,
): string[] {
  const anchorIndex = allIds.indexOf(anchorId);
  const targetIndex = allIds.indexOf(targetId);

  if (anchorIndex === -1 || targetIndex === -1) {
    return [];
  }

  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);

  return unique(allIds.slice(start, end + 1));
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
