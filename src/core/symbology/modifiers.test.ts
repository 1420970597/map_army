import { describe, expect, it } from 'vitest';

import { buildIconExtensions } from './modifiers';

describe('Extended 图标扩展修饰符', () => {
  it('无扩展代码不产生额外图元', () => {
    expect(buildIconExtensions('00', '00')).toEqual([]);
  });

  it('两个扩展代码分别绘制在框架左右两侧', () => {
    const paths = buildIconExtensions('01', '02');
    expect(paths).toHaveLength(2);
    expect(paths[0].d).toContain('19,21');
    expect(paths[1].d).toContain('181,30');
  });
});
