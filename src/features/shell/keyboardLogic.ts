import { matchCombo, type KeyEventLike, type ShortcutSpec } from '@/core/shell/shortcuts';

/** 返回第一个与事件匹配的快捷键声明，保留注册表顺序作为优先级。 */
export function shortcutSpecForEvent(
  event: KeyEventLike,
  shortcuts: readonly ShortcutSpec[],
): ShortcutSpec | undefined {
  return shortcuts.find((shortcut) => matchCombo(event, shortcut.combo));
}

/** 判断已匹配的快捷键是否可在当前焦点环境中执行。 */
export function shouldHandleShortcut(
  shortcut: ShortcutSpec | undefined,
  typingTarget: boolean,
): shortcut is ShortcutSpec {
  return shortcut !== undefined && (!typingTarget || shortcut.allowInInput === true);
}
