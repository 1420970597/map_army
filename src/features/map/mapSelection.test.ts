import { describe, expect, it } from 'vitest';

import { selectionAfterBlankClick, selectionAfterFeatureClick } from './mapSelection';

describe('selectionAfterFeatureClick', () => {
  it('普通点击以目标要素替换当前选择', () => {
    expect(selectionAfterFeatureClick(['alpha', 'bravo'], 'charlie', {})).toEqual(['charlie']);
  });

  it('Ctrl 点击追加未选择的要素', () => {
    expect(selectionAfterFeatureClick(['alpha'], 'bravo', { ctrlKey: true })).toEqual([
      'alpha',
      'bravo',
    ]);
  });

  it('Ctrl 点击移除已选择的要素', () => {
    expect(selectionAfterFeatureClick(['alpha', 'bravo'], 'bravo', { ctrlKey: true })).toEqual([
      'alpha',
    ]);
  });

  it('Cmd 点击追加未选择的要素', () => {
    expect(selectionAfterFeatureClick(['alpha'], 'bravo', { metaKey: true })).toEqual([
      'alpha',
      'bravo',
    ]);
  });

  it('Cmd 点击移除已选择的要素', () => {
    expect(selectionAfterFeatureClick(['alpha', 'bravo'], 'bravo', { metaKey: true })).toEqual([
      'alpha',
    ]);
  });

  it('同时按住 Ctrl 和 Cmd 时仍切换目标要素', () => {
    expect(
      selectionAfterFeatureClick(['alpha'], 'alpha', { ctrlKey: true, metaKey: true }),
    ).toEqual([]);
  });

  it('修饰键切换前清理当前选择中的重复标识', () => {
    expect(
      selectionAfterFeatureClick(['alpha', 'bravo', 'alpha'], 'charlie', { ctrlKey: true }),
    ).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('不修改输入选择数组', () => {
    const current = Object.freeze(['alpha', 'bravo'] as const);

    selectionAfterFeatureClick(current, 'charlie', { ctrlKey: true });

    expect(current).toEqual(['alpha', 'bravo']);
  });
});

describe('selectionAfterBlankClick', () => {
  it('点击空白处返回空选择', () => {
    expect(selectionAfterBlankClick()).toEqual([]);
  });
});
