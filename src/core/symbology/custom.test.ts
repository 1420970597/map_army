import { describe, expect, it } from 'vitest';
import { createCustomSymbol, customSymbolMatches, sanitizeCustomSvg } from './custom';
import { militarySvg } from './military';

describe('自定义军标', () => {
  it('创建时生成稳定 id 并清理脚本', () => {
    const symbol = createCustomSymbol({
      name: '侦察标记',
      svg: '<svg><script>alert(1)</script><path d="M0 0"/></svg>',
    });
    expect(symbol.id).toMatch(/^custom_/);
    expect(symbol.svg).not.toContain('script');
  });

  it('拒绝非 SVG 内容并支持搜索', () => {
    expect(() => sanitizeCustomSvg('text')).toThrow();
    const symbol = createCustomSymbol({ name: '炮兵观察哨', nameEn: 'Observer', svg: '<svg/>' });
    expect(customSymbolMatches(symbol, 'observer')).toBe(true);
  });

  it('冷门但结构合法的 SIDC 仍生成可见 SVG', () => {
    expect(militarySvg('10045000009999000000')).toContain('<svg');
    expect(militarySvg('10031000001211000000')).toContain('<svg');
  });
});
