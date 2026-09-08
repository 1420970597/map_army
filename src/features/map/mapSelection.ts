/**
 * 地图点击选择策略。
 *
 * 该模块只根据当前选择、要素标识与修饰键计算下一个选择集合，
 * 不依赖 React、Leaflet 或 Zustand，便于脱离地图 DOM 验证交互语义。
 */

import { toggleInSelection } from '@/core/model';

/** 地图点击事件中与选择相关的修饰键。 */
export interface SelectionClickModifiers {
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/**
 * 计算点击要素后的选择集合。
 *
 * 普通点击替换当前选择；按住 Ctrl 或 Cmd 点击时切换目标要素。
 */
export function selectionAfterFeatureClick(
  current: readonly string[],
  id: string,
  modifiers: SelectionClickModifiers,
): string[] {
  return modifiers.ctrlKey || modifiers.metaKey ? toggleInSelection(current, id) : [id];
}

/** 点击地图空白处后清空选择。 */
export function selectionAfterBlankClick(): string[] {
  return [];
}
