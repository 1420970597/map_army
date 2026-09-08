import { describe, expect, it } from 'vitest';

import { SHORTCUTS, type ShortcutSpec } from '@/core/shell/shortcuts';

import { shouldHandleShortcut, shortcutSpecForEvent } from './keyboardLogic';

const custom: readonly ShortcutSpec[] = [
  { id: 'first', combo: 'K', group: '编辑', description: 'first' },
  { id: 'second', combo: 'K', group: '编辑', description: 'second' },
  { id: 'escape', combo: 'Escape', group: '编辑', description: 'escape', allowInInput: true },
];

describe('shortcutSpecForEvent', () => {
  it('找到 Ctrl+Z', () =>
    expect(shortcutSpecForEvent({ key: 'z', ctrlKey: true }, SHORTCUTS)?.id).toBe('edit.undo'));
  it('找到 Ctrl+Shift+Z', () =>
    expect(shortcutSpecForEvent({ key: 'z', ctrlKey: true, shiftKey: true }, SHORTCUTS)?.id).toBe(
      'edit.redo',
    ));
  it('找到 Ctrl+Y', () =>
    expect(shortcutSpecForEvent({ key: 'y', ctrlKey: true }, SHORTCUTS)?.id).toBe('edit.redo'));
  it('找到 Delete', () =>
    expect(shortcutSpecForEvent({ key: 'Delete' }, SHORTCUTS)?.id).toBe('edit.delete'));
  it('找到 Ctrl+A', () =>
    expect(shortcutSpecForEvent({ key: 'a', metaKey: true }, SHORTCUTS)?.id).toBe('select.all'));
  it('找到 Escape', () =>
    expect(shortcutSpecForEvent({ key: 'Escape' }, SHORTCUTS)?.id).toBe('edit.escape'));
  it('找到空格确认', () =>
    expect(shortcutSpecForEvent({ key: ' ' }, SHORTCUTS)?.id).toBe('edit.confirm'));
  it('找到问号帮助', () =>
    expect(shortcutSpecForEvent({ key: '?', shiftKey: true }, SHORTCUTS)?.id).toBe(
      'app.shortcutHelp',
    ));
  it('找到方向平移', () =>
    expect(shortcutSpecForEvent({ key: 'ArrowUp' }, SHORTCUTS)?.id).toBe('view.panUp'));
  it('找到 Ctrl+方向顶点切换', () =>
    expect(shortcutSpecForEvent({ key: 'ArrowRight', ctrlKey: true }, SHORTCUTS)?.id).toBe(
      'edit.nextVertex',
    ));
  it('未知按键不命中', () => expect(shortcutSpecForEvent({ key: 'Q' }, SHORTCUTS)).toBeUndefined());
  it('额外修饰键不命中', () =>
    expect(
      shortcutSpecForEvent({ key: 'z', ctrlKey: true, altKey: true }, SHORTCUTS),
    ).toBeUndefined());
  it('按注册顺序返回第一个匹配项', () =>
    expect(shortcutSpecForEvent({ key: 'k' }, custom)?.id).toBe('first'));
});

describe('shouldHandleShortcut', () => {
  it('非输入焦点允许已匹配快捷键', () => expect(shouldHandleShortcut(custom[0], false)).toBe(true));
  it('输入焦点屏蔽普通快捷键', () => expect(shouldHandleShortcut(custom[0], true)).toBe(false));
  it('输入焦点允许 allowInInput 快捷键', () =>
    expect(shouldHandleShortcut(custom[2], true)).toBe(true));
  it('未知快捷键永不处理', () => expect(shouldHandleShortcut(undefined, false)).toBe(false));
});
