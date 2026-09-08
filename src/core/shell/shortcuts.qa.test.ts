/**
 * QA 独立验证：快捷键的输入框豁免、allowInInput 与未知键不消费。
 *
 * 工程师侧 `isTypingTarget` 只在 Node 环境（HTMLElement 未定义）下被验证过，
 * 也就是说「输入框豁免」这条需求实际上从未被真正执行过一次。
 * 这里以最小 DOM 替身注入全局 HTMLElement，真实走通标签判定与祖先回溯。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { executeCommand, type CommandContext } from './commands';
import { isTypingTarget, matchCombo, SHORTCUTS } from './shortcuts';

/**
 * 最小 HTMLElement 替身。
 *
 * 只实现 `isTypingTarget` 实际读取的三个成员，
 * 目的不是模拟浏览器，而是让 `instanceof` 判定与祖先回溯在 Node 下可执行。
 */
class FakeHTMLElement {
  tagName = 'DIV';
  isContentEditable = false;
  parentElement: FakeHTMLElement | null = null;
}

/** 构造一个具有指定标签、父节点与可编辑性的元素。 */
function makeElement(
  tagName: string,
  parent: FakeHTMLElement | null = null,
  editable = false,
): EventTarget {
  const element = new FakeHTMLElement();
  element.tagName = tagName;
  element.isContentEditable = editable;
  element.parentElement = parent;
  return element as unknown as EventTarget;
}

/** 在用例执行期间把替身安装到全局，并在结束后还原。 */
function withDom(): void {
  vi.stubGlobal('HTMLElement', FakeHTMLElement);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('QA isTypingTarget 的元素判定', () => {
  it('识别 INPUT / TEXTAREA / SELECT', () => {
    withDom();

    expect(isTypingTarget(makeElement('input'))).toBe(true);
    expect(isTypingTarget(makeElement('textarea'))).toBe(true);
    expect(isTypingTarget(makeElement('select'))).toBe(true);
  });

  it('识别 contentEditable 元素', () => {
    withDom();

    expect(isTypingTarget(makeElement('div', null, true))).toBe(true);
    expect(isTypingTarget(makeElement('div', null, false))).toBe(false);
  });

  it('沿祖先链向上回溯直到输入框容器', () => {
    withDom();
    const input = new FakeHTMLElement();
    input.tagName = 'INPUT';
    const wrapper = new FakeHTMLElement();
    wrapper.tagName = 'DIV';
    wrapper.parentElement = input;
    const inner = new FakeHTMLElement();
    inner.tagName = 'SPAN';
    inner.parentElement = wrapper;

    expect(isTypingTarget(inner as unknown as EventTarget)).toBe(true);
  });

  it('普通容器与 null 目标都不是输入目标', () => {
    withDom();

    expect(isTypingTarget(makeElement('div'))).toBe(false);
    expect(isTypingTarget(makeElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('QA 输入框豁免与 allowInInput', () => {
  /** 记录被调用过的命令标识。 */
  function recordingContext(calls: string[]): CommandContext {
    const record =
      (id: string) =>
      (...args: unknown[]): void => {
        calls.push(`${id}(${args.join(',')})`);
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
      reload: record('reload'),
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

  it('输入框内的 Escape 因 allowInInput 仍然执行', () => {
    const calls: string[] = [];

    expect(executeCommand('edit.escape', recordingContext(calls))).toBe(true);
    expect(calls).toEqual(['escape()']);
  });

  it('带 Shift 的 S 键不匹配吸附快捷键', () => {
    const shortcut = SHORTCUTS.find((item) => item.id === 'edit.toggleSnap');
    if (shortcut === undefined) throw new Error('注册表缺少 edit.toggleSnap');

    expect(matchCombo({ key: 'S', shiftKey: true }, shortcut.combo)).toBe(false);
  });

  it('Ctrl+S 不会被误判为吸附快捷键', () => {
    const shortcut = SHORTCUTS.find((item) => item.id === 'edit.toggleSnap');
    if (shortcut === undefined) throw new Error('注册表缺少 edit.toggleSnap');

    expect(matchCombo({ key: 's', ctrlKey: true }, shortcut.combo)).toBe(false);
  });

  it('未知命令标识不消费事件且不触碰上下文', () => {
    const calls: string[] = [];
    const context = recordingContext(calls);

    expect(executeCommand('edit.notExist', context)).toBe(false);
    expect(executeCommand('', context)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('注册表内每个快捷键都能被执行且不抛错', () => {
    const calls: string[] = [];
    const context = recordingContext(calls);

    for (const shortcut of SHORTCUTS) {
      expect(executeCommand(shortcut.id, context)).toBe(true);
    }

    expect(calls).toHaveLength(SHORTCUTS.length);
  });
});
