/**
 * QA 独立验证：键盘事件到命令执行的豁免链路。
 *
 * 核心层只提供 `matchCombo` / `isTypingTarget`，`features` 层负责组合二者；
 * 真正决定「输入框里按 S 会不会切吸附」的是这里的 `shouldHandleShortcut`。
 * 本文件用最小 DOM 替身把它端到端跑通，避免豁免逻辑只停留在核心层单测里。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { executeCommand, type CommandContext } from '@/core/shell/commands';
import { isTypingTarget, SHORTCUTS, type KeyEventLike } from '@/core/shell/shortcuts';

import { shouldHandleShortcut, shortcutSpecForEvent } from './keyboardLogic';

/** 最小 HTMLElement 替身，仅实现 `isTypingTarget` 读取的成员。 */
class FakeHTMLElement {
  tagName = 'DIV';
  isContentEditable = false;
  parentElement: FakeHTMLElement | null = null;
}

/** 构造输入类元素。 */
function inputElement(tagName = 'INPUT'): EventTarget {
  const element = new FakeHTMLElement();
  element.tagName = tagName;
  return element as unknown as EventTarget;
}

/** 构造非输入类元素。 */
function plainElement(): EventTarget {
  return new FakeHTMLElement() as unknown as EventTarget;
}

/**
 * 模拟一次 window keydown 的完整判定，返回被执行的命令标识。
 *
 * @param event 键盘事件
 * @param target 事件目标元素
 * @returns 实际执行的命令标识；被豁免或未命中时返回 null
 */
function dispatch(event: KeyEventLike, target: EventTarget): string | null {
  vi.stubGlobal('HTMLElement', FakeHTMLElement);
  const shortcut = shortcutSpecForEvent(event, SHORTCUTS);
  if (!shouldHandleShortcut(shortcut, isTypingTarget(target))) return null;
  return shortcut.id;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('QA 输入框豁免端到端', () => {
  it('输入框内按下 S 不会触发切换吸附', () => {
    expect(dispatch({ key: 's' }, inputElement())).toBeNull();
  });

  it('输入框内按下 Z 不会触发视图缩放', () => {
    expect(dispatch({ key: 'z' }, inputElement())).toBeNull();
  });

  it('输入框内按下 Delete 不会删除所选要素', () => {
    expect(dispatch({ key: 'Delete' }, inputElement())).toBeNull();
  });

  it('文本域内按下 Ctrl+Z 不会触发撤销', () => {
    expect(dispatch({ key: 'z', ctrlKey: true }, inputElement('TEXTAREA'))).toBeNull();
  });

  it('输入框内按下 Escape 因 allowInInput 仍然命中', () => {
    expect(dispatch({ key: 'Escape' }, inputElement())).toBe('edit.escape');
  });

  it('非输入元素上按下 S 正常触发切换吸附', () => {
    expect(dispatch({ key: 's' }, plainElement())).toBe('edit.toggleSnap');
  });

  it('未知按键在任何焦点下都不命中', () => {
    expect(dispatch({ key: 'q' }, plainElement())).toBeNull();
    expect(dispatch({ key: 'q' }, inputElement())).toBeNull();
  });
});

describe('QA 命令执行的副作用边界', () => {
  /** 构造记录调用轨迹的命令上下文。 */
  function recordingContext(calls: string[]): CommandContext {
    const noop = (): void => {
      // 仅用于验证命令是否被调用，不产生副作用。
    };
    const record = (id: string) => (): void => {
      calls.push(id);
    };
    return {
      undo: record('undo'),
      redo: record('redo'),
      copy: record('copy'),
      paste: record('paste'),
      deleteSelection: record('deleteSelection'),
      selectAll: record('selectAll'),
      escape: record('escape'),
      toggleFullscreen: record('toggleFullscreen'),
      reload: noop,
      zoomBy: record('zoomBy'),
      panBy: record('panBy'),
      resetNorth: record('resetNorth'),
      confirm: record('confirm'),
      toggleSnap: record('toggleSnap'),
      stepVertex: record('stepVertex'),
      activateBoxSelect: record('activateBoxSelect'),
      toggleShortcutHelp: record('toggleShortcutHelp'),
    };
  }

  it('未命中快捷键时完全不调用命令', () => {
    const calls: string[] = [];
    const context = recordingContext(calls);

    dispatch({ key: 'q' }, plainElement());

    expect(calls).toEqual([]);
    // 显式确认上下文可用，排除"因为上下文坏了才没调用"的假阳性。
    expect(executeCommand('edit.undo', context)).toBe(true);
    expect(calls).toEqual(['undo']);
  });

  it('顶点切换命令按方向传递增量', () => {
    const deltas: number[] = [];
    const context: CommandContext = {
      ...recordingContext([]),
      stepVertex: (delta) => {
        deltas.push(delta);
      },
    };

    executeCommand('edit.nextVertex', context);
    executeCommand('edit.previousVertex', context);

    expect(deltas).toEqual([1, -1]);
  });
});
