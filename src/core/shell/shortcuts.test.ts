import { describe, expect, it } from 'vitest';
import { SHORTCUTS, findConflicts, isTypingTarget, matchCombo } from './shortcuts';

describe('matchCombo', () => {
  it('匹配 Ctrl+Z，且键名大小写不敏感', () => {
    expect(matchCombo({ key: 'z', ctrlKey: true }, 'Ctrl+Z')).toBe(true);
    expect(matchCombo({ key: 'Z', ctrlKey: true }, 'Ctrl+Z')).toBe(true);
  });

  it('在 macOS 上将 Meta 视为 Ctrl 的等价修饰键', () => {
    expect(matchCombo({ key: 'z', metaKey: true }, 'Ctrl+Z')).toBe(true);
    expect(matchCombo({ key: 'z', ctrlKey: true, metaKey: true }, 'Ctrl+Z')).toBe(false);
  });

  it('匹配 Ctrl+Shift+Z，并拒绝缺失或额外修饰键', () => {
    expect(matchCombo({ key: 'z', ctrlKey: true, shiftKey: true }, 'Ctrl+Shift+Z')).toBe(true);
    expect(matchCombo({ key: 'z', ctrlKey: true }, 'Ctrl+Shift+Z')).toBe(false);
    expect(
      matchCombo({ key: 'z', ctrlKey: true, shiftKey: true, altKey: true }, 'Ctrl+Shift+Z'),
    ).toBe(false);
  });

  it('匹配 Ctrl+ArrowLeft', () => {
    expect(matchCombo({ key: 'ArrowLeft', ctrlKey: true }, 'Ctrl+ArrowLeft')).toBe(true);
    expect(matchCombo({ key: 'ArrowRight', ctrlKey: true }, 'Ctrl+ArrowLeft')).toBe(false);
  });

  it('匹配无修饰键的功能键与空格键', () => {
    expect(matchCombo({ key: 'F11' }, 'F11')).toBe(true);
    expect(matchCombo({ key: ' ' }, 'Space')).toBe(true);
    expect(matchCombo({ key: 'Spacebar' }, 'Space')).toBe(true);
  });

  it('匹配单字符 Z 且拒绝任何修饰键', () => {
    expect(matchCombo({ key: 'z' }, 'Z')).toBe(true);
    expect(matchCombo({ key: 'z', shiftKey: true }, 'Z')).toBe(false);
    expect(matchCombo({ key: 'z', ctrlKey: true }, 'Z')).toBe(false);
  });

  it('匹配问号时必须按下 Shift', () => {
    expect(matchCombo({ key: '?', shiftKey: true }, '?')).toBe(true);
    expect(matchCombo({ key: '/', shiftKey: true }, '?')).toBe(false);
    expect(matchCombo({ key: '?', shiftKey: false }, '?')).toBe(false);
  });

  it('拒绝额外的 Alt、Ctrl、Meta 或 Shift 修饰键', () => {
    expect(matchCombo({ key: 'z', altKey: true }, 'Ctrl+Z')).toBe(false);
    expect(matchCombo({ key: 'z', ctrlKey: true, shiftKey: true }, 'Ctrl+Z')).toBe(false);
    expect(matchCombo({ key: 'z', metaKey: true, shiftKey: true }, 'Ctrl+Z')).toBe(false);
    expect(matchCombo({ key: 'z', altKey: true }, 'Z')).toBe(false);
  });

  it('拒绝不同按键', () => {
    expect(matchCombo({ key: 'x', ctrlKey: true }, 'Ctrl+Z')).toBe(false);
    expect(matchCombo({ key: 'ArrowRight' }, 'ArrowLeft')).toBe(false);
  });
});

describe('findConflicts', () => {
  it('内置 SHORTCUTS 不存在组合键冲突', () => {
    expect(findConflicts(SHORTCUTS)).toEqual([]);
  });

  it('检测 Ctrl+Z 与大小写不同的 ctrl+z 冲突', () => {
    expect(
      findConflicts([
        { id: 'a', combo: 'Ctrl+Z', group: '编辑', description: 'a' },
        { id: 'b', combo: 'ctrl+z', group: '编辑', description: 'b' },
      ]),
    ).toEqual(['ctrl+z']);
  });

  it('按修饰键规范顺序归一后检测冲突', () => {
    expect(
      findConflicts([
        { id: 'a', combo: 'Shift+Ctrl+Z', group: '编辑', description: 'a' },
        { id: 'b', combo: 'ctrl+shift+z', group: '编辑', description: 'b' },
      ]),
    ).toEqual(['ctrl+shift+z']);
  });

  it('不把不同修饰键组合误判为冲突', () => {
    expect(
      findConflicts([
        { id: 'a', combo: 'Ctrl+Z', group: '编辑', description: 'a' },
        { id: 'b', combo: 'Alt+Z', group: '编辑', description: 'b' },
      ]),
    ).toEqual([]);
  });
});

describe('isTypingTarget', () => {
  it('在 Node 环境 HTMLElement 未定义时安全返回 false', () => {
    expect(typeof HTMLElement).toBe('undefined');
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({} as EventTarget)).toBe(false);
  });
});

describe('SHORTCUTS', () => {
  it('覆盖核心快捷键 id，并保证 id 与 combo 组合唯一', () => {
    const requiredIds = [
      'edit.undo',
      'edit.redo',
      'edit.copy',
      'edit.paste',
      'edit.delete',
      'edit.escape',
      'edit.confirm',
      'edit.toggleSnap',
      'edit.previousVertex',
      'edit.nextVertex',
      'select.all',
      'select.box',
      'view.zoomIn',
      'view.zoomOut',
      'view.panUp',
      'view.panDown',
      'view.panLeft',
      'view.panRight',
      'view.north',
      'app.fullscreen',
      'app.reload',
      'app.shortcutHelp',
    ];
    for (const id of requiredIds) {
      expect(SHORTCUTS.some((shortcut) => shortcut.id === id)).toBe(true);
    }

    const idAndCombo = SHORTCUTS.map(
      (shortcut) => `${shortcut.id}\u0000${shortcut.combo.toLowerCase()}`,
    );
    expect(new Set(idAndCombo).size).toBe(idAndCombo.length);
  });
});
