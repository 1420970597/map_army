import { describe, expect, it } from 'vitest';
import { mapSymbolMarkup } from './symbolMarkup';

describe('地图军标 SVG 包装', () => {
  it('保留内联 SVG，避免数据 URI 在部分浏览器中加载失败', () => {
    const html = mapSymbolMarkup('<svg viewBox="0 0 10 10"><path d="M0 0"/></svg>', 40);
    expect(html).toContain('<svg');
    expect(html).not.toContain('data:image/svg+xml');
    expect(html).toContain('width:40px');
  });
});
