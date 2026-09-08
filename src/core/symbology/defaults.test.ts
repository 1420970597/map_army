import { describe, expect, it } from 'vitest';

import { DEFAULT_SYMBOL_DEFAULTS, normalizeSymbolDefaults } from './defaults';

describe('normalizeSymbolDefaults', () => {
  it('缺失输入时返回默认值', () => {
    expect(normalizeSymbolDefaults(undefined)).toEqual(DEFAULT_SYMBOL_DEFAULTS);
  });

  it('非对象输入时返回默认值', () => {
    expect(normalizeSymbolDefaults('invalid')).toEqual(DEFAULT_SYMBOL_DEFAULTS);
  });

  it('接受合法字段', () => {
    expect(normalizeSymbolDefaults({ lineWeight: 4, fillColor: '#12ab34', fontSize: 18, fontFamily: 'serif' })).toEqual({
      lineWeight: 4,
      fillColor: '#12AB34',
      fontSize: 18,
      fontFamily: 'serif',
    });
  });

  it('将过小线宽夹取到下界', () => {
    expect(normalizeSymbolDefaults({ lineWeight: 0 }).lineWeight).toBe(1);
  });

  it('将过大线宽夹取到上界', () => {
    expect(normalizeSymbolDefaults({ lineWeight: 12 }).lineWeight).toBe(8);
  });

  it('将过小字号夹取到下界', () => {
    expect(normalizeSymbolDefaults({ fontSize: 1 }).fontSize).toBe(10);
  });

  it('将过大字号夹取到上界', () => {
    expect(normalizeSymbolDefaults({ fontSize: 100 }).fontSize).toBe(72);
  });

  it('拒绝非有限线宽', () => {
    expect(normalizeSymbolDefaults({ lineWeight: Infinity }).lineWeight).toBe(DEFAULT_SYMBOL_DEFAULTS.lineWeight);
  });

  it('拒绝非有限字号', () => {
    expect(normalizeSymbolDefaults({ fontSize: Number.NaN }).fontSize).toBe(DEFAULT_SYMBOL_DEFAULTS.fontSize);
  });

  it('非法颜色回退默认值', () => {
    expect(normalizeSymbolDefaults({ fillColor: 'blue' }).fillColor).toBe(DEFAULT_SYMBOL_DEFAULTS.fillColor);
  });

  it('接受带空白的合法颜色', () => {
    expect(normalizeSymbolDefaults({ fillColor: ' #abcdef ' }).fillColor).toBe('#ABCDEF');
  });

  it('拒绝未列入白名单的字体', () => {
    expect(normalizeSymbolDefaults({ fontFamily: 'url(unsafe)' }).fontFamily).toBe(DEFAULT_SYMBOL_DEFAULTS.fontFamily);
  });

  it('接受白名单字体并去除空白', () => {
    expect(normalizeSymbolDefaults({ fontFamily: '  monospace  ' }).fontFamily).toBe('monospace');
  });
});
