/**
 * 快捷键注册表及无副作用的组合键匹配工具。
 */

/** 快捷键所属功能分组。 */
export type ShortcutGroup = '文档' | '编辑' | '选择' | '视图' | '应用';

/** 单个快捷键的声明。 */
export interface ShortcutSpec {
  id: string;
  combo: string;
  group: ShortcutGroup;
  description: string;
  allowInInput?: boolean;
}

/** 与浏览器键盘事件兼容的最小事件形状。 */
export interface KeyEventLike {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/** 编辑器内置快捷键。 */
export const SHORTCUTS: readonly ShortcutSpec[] = [
  { id: 'edit.undo', combo: 'Ctrl+Z', group: '编辑', description: '撤销' },
  { id: 'edit.redo', combo: 'Ctrl+Shift+Z', group: '编辑', description: '重做' },
  { id: 'edit.redo', combo: 'Ctrl+Y', group: '编辑', description: '重做' },
  { id: 'edit.copy', combo: 'Ctrl+C', group: '编辑', description: '复制' },
  { id: 'edit.paste', combo: 'Ctrl+V', group: '编辑', description: '粘贴' },
  { id: 'edit.delete', combo: 'Delete', group: '编辑', description: '删除所选内容' },
  { id: 'select.all', combo: 'Ctrl+A', group: '选择', description: '全选' },
  {
    id: 'edit.escape',
    combo: 'Escape',
    group: '编辑',
    description: '取消当前操作',
    allowInInput: true,
  },
  { id: 'app.fullscreen', combo: 'F11', group: '应用', description: '切换全屏' },
  { id: 'app.reload', combo: 'Ctrl+F5', group: '应用', description: '重新加载' },
  { id: 'view.zoomIn', combo: 'Z', group: '视图', description: '放大视图' },
  { id: 'view.zoomOut', combo: 'X', group: '视图', description: '缩小视图' },
  { id: 'view.panUp', combo: 'ArrowUp', group: '视图', description: '向上平移视图' },
  { id: 'view.panDown', combo: 'ArrowDown', group: '视图', description: '向下平移视图' },
  { id: 'view.panLeft', combo: 'ArrowLeft', group: '视图', description: '向左平移视图' },
  { id: 'view.panRight', combo: 'ArrowRight', group: '视图', description: '向右平移视图' },
  { id: 'view.north', combo: 'N', group: '视图', description: '视图朝北' },
  { id: 'edit.confirm', combo: 'Space', group: '编辑', description: '确认当前操作' },
  {
    id: 'edit.toggleSnap',
    combo: 'S',
    group: '编辑',
    description: '切换吸附（绘制与顶点编辑均生效）',
  },
  {
    id: 'edit.previousVertex',
    combo: 'Ctrl+ArrowLeft',
    group: '编辑',
    description: '选择上一个顶点',
  },
  { id: 'edit.nextVertex', combo: 'Ctrl+ArrowRight', group: '编辑', description: '选择下一个顶点' },
  { id: 'select.box', combo: 'B', group: '选择', description: '框选' },
  { id: 'app.shortcutHelp', combo: '?', group: '应用', description: '显示快捷键帮助' },
];

type ModifierName = 'ctrl' | 'shift' | 'alt' | 'meta';

interface ParsedCombo {
  key: string;
  modifiers: ReadonlySet<ModifierName>;
}

const MODIFIER_NAMES: ReadonlySet<string> = new Set(['ctrl', 'shift', 'alt', 'meta']);

function normalizeKey(value: string): string {
  const normalized = value.toLowerCase();
  const key = normalized.trim();

  if (key === 'space' || key === 'spacebar' || normalized === ' ') {
    return 'space';
  }

  return key;
}

function parseCombo(combo: string): ParsedCombo {
  const modifiers = new Set<ModifierName>();
  let key = '';

  for (const token of combo.split('+')) {
    const normalized = token.trim().toLowerCase();
    if (MODIFIER_NAMES.has(normalized)) {
      modifiers.add(normalized as ModifierName);
    } else if (normalized) {
      key = normalizeKey(token);
    }
  }

  return { key, modifiers };
}

function hasExactModifiers(event: KeyEventLike, combo: ParsedCombo): boolean {
  const expectsCtrl = combo.modifiers.has('ctrl');
  const expectsMeta = combo.modifiers.has('meta');
  const expectsShift = combo.modifiers.has('shift') || combo.key === '?';
  const expectsAlt = combo.modifiers.has('alt');
  const hasCtrl = event.ctrlKey === true;
  const hasMeta = event.metaKey === true;

  if (expectsCtrl) {
    if ((!hasCtrl && !hasMeta) || (hasCtrl && hasMeta)) {
      return false;
    }
  } else if (expectsMeta) {
    if (!hasMeta || hasCtrl) {
      return false;
    }
  } else if (hasCtrl || hasMeta) {
    return false;
  }

  return (event.shiftKey === true) === expectsShift && (event.altKey === true) === expectsAlt;
}

/**
 * 判断键盘事件是否与组合键完全匹配。
 * Ctrl 在 Windows/Linux 的 Ctrl 与 macOS 的 Meta 上等价。
 */
export function matchCombo(event: KeyEventLike, combo: string): boolean {
  const parsed = parseCombo(combo);
  return (
    parsed.key.length > 0 &&
    hasExactModifiers(event, parsed) &&
    normalizeKey(event.key) === parsed.key
  );
}

/** 判断目标元素或其祖先是否为文本输入区域。 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined') {
    return false;
  }

  let current: EventTarget | null = target;
  while (current instanceof HTMLElement) {
    const tagName = current.tagName.toUpperCase();
    if (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT' ||
      current.isContentEditable
    ) {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}

function normalizeCombo(combo: string): string {
  const parsed = parseCombo(combo);
  const modifierOrder: readonly ModifierName[] = ['ctrl', 'shift', 'alt', 'meta'];
  const modifiers = modifierOrder.filter((modifier) => parsed.modifiers.has(modifier));
  return [...modifiers, parsed.key].join('+');
}

/** 返回存在重复组合键声明的标准化组合键列表。 */
export function findConflicts(specs: readonly ShortcutSpec[]): string[] {
  const counts = new Map<string, number>();

  for (const spec of specs) {
    const combo = normalizeCombo(spec.combo);
    counts.set(combo, (counts.get(combo) ?? 0) + 1);
  }

  return [...counts.entries()].filter(([, count]) => count > 1).map(([combo]) => combo);
}
