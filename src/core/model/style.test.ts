import { describe, expect, it } from 'vitest';

import { mergeStyleWithDefaults, styleFromSymbolDefaults } from './style';

const defaults = { lineWeight: 4, fillColor: '#123456' };

describe('styleFromSymbolDefaults', () => {
  it('映射默认颜色', () => {
    expect(styleFromSymbolDefaults(defaults).color).toBe('#123456');
  });

  it('映射默认线宽', () => {
    expect(styleFromSymbolDefaults(defaults).weight).toBe(4);
  });

  it('不引入无关样式字段', () => {
    expect(styleFromSymbolDefaults(defaults)).toEqual({ color: '#123456', weight: 4 });
  });
});

describe('mergeStyleWithDefaults', () => {
  it('没有覆盖时使用默认样式', () => {
    expect(mergeStyleWithDefaults(defaults)).toEqual({ color: '#123456', weight: 4 });
  });

  it('要素级颜色优先', () => {
    expect(mergeStyleWithDefaults(defaults, { color: '#ABCDEF' }).color).toBe('#ABCDEF');
  });

  it('要素级线宽优先', () => {
    expect(mergeStyleWithDefaults(defaults, { weight: 7 }).weight).toBe(7);
  });

  it('保留要素级透明度', () => {
    expect(mergeStyleWithDefaults(defaults, { opacity: 0.5 }).opacity).toBe(0.5);
  });

  it('保留要素级虚线', () => {
    expect(mergeStyleWithDefaults(defaults, { dashArray: '8 6' }).dashArray).toBe('8 6');
  });

  it('同时覆盖多个字段', () => {
    expect(mergeStyleWithDefaults(defaults, { color: '#FFFFFF', weight: 2, opacity: 0.8 })).toEqual(
      {
        color: '#FFFFFF',
        weight: 2,
        opacity: 0.8,
      },
    );
  });
});
