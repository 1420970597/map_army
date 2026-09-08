import { describe, expect, it } from 'vitest';

import {
  addToSelection,
  rangeSelection,
  removeFromSelection,
  toggleInSelection,
} from './selection';

describe('toggleInSelection', () => {
  it('追加尚未选择的标识', () => {
    expect(toggleInSelection(['alpha', 'bravo'], 'charlie')).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('移除已经选择的标识', () => {
    expect(toggleInSelection(['alpha', 'bravo', 'charlie'], 'bravo')).toEqual(['alpha', 'charlie']);
  });

  it('先对重复输入去重，再切换标识', () => {
    expect(toggleInSelection(['alpha', 'bravo', 'alpha'], 'charlie')).toEqual([
      'alpha',
      'bravo',
      'charlie',
    ]);
  });

  it('不修改输入数组', () => {
    const ids = ['alpha', 'bravo'];

    toggleInSelection(ids, 'charlie');

    expect(ids).toEqual(['alpha', 'bravo']);
  });
});

describe('addToSelection', () => {
  it('按首次出现顺序稳定地追加新标识', () => {
    expect(addToSelection(['alpha', 'bravo'], ['bravo', 'charlie', 'delta'])).toEqual([
      'alpha',
      'bravo',
      'charlie',
      'delta',
    ]);
  });

  it('合并两侧重复标识', () => {
    expect(addToSelection(['alpha', 'alpha'], ['bravo', 'bravo', 'alpha'])).toEqual([
      'alpha',
      'bravo',
    ]);
  });

  it('使最后一个新追加项位于末尾作为 primary', () => {
    const selection = addToSelection(['alpha'], ['bravo', 'charlie']);

    expect(selection.at(-1)).toBe('charlie');
  });
});

describe('removeFromSelection', () => {
  it('移除多个标识并保持其余顺序', () => {
    expect(removeFromSelection(['alpha', 'bravo', 'charlie', 'delta'], ['bravo', 'delta'])).toEqual(
      ['alpha', 'charlie'],
    );
  });

  it('对重复输入去重且不修改输入数组', () => {
    const ids = ['alpha', 'bravo', 'alpha', 'charlie'];
    const removed = ['bravo', 'bravo'];

    expect(removeFromSelection(ids, removed)).toEqual(['alpha', 'charlie']);
    expect(ids).toEqual(['alpha', 'bravo', 'alpha', 'charlie']);
    expect(removed).toEqual(['bravo', 'bravo']);
  });
});

describe('rangeSelection', () => {
  it('正向选择时按 allIds 的自然顺序返回范围', () => {
    expect(rangeSelection(['alpha', 'bravo', 'charlie', 'delta'], 'bravo', 'delta')).toEqual([
      'bravo',
      'charlie',
      'delta',
    ]);
  });

  it('逆向选择时仍按 allIds 的自然顺序返回范围', () => {
    expect(rangeSelection(['alpha', 'bravo', 'charlie', 'delta'], 'delta', 'bravo')).toEqual([
      'bravo',
      'charlie',
      'delta',
    ]);
  });

  it('相同端点仅返回该端点', () => {
    expect(rangeSelection(['alpha', 'bravo', 'charlie'], 'bravo', 'bravo')).toEqual(['bravo']);
  });

  it('任一端点缺失时返回空数组', () => {
    expect(rangeSelection(['alpha', 'bravo'], 'alpha', 'charlie')).toEqual([]);
  });

  it('空列表返回空数组', () => {
    expect(rangeSelection([], 'alpha', 'bravo')).toEqual([]);
  });

  it('范围内重复 allIds 去重并保持首次出现顺序', () => {
    expect(rangeSelection(['alpha', 'bravo', 'bravo', 'charlie'], 'alpha', 'charlie')).toEqual([
      'alpha',
      'bravo',
      'charlie',
    ]);
  });
});
