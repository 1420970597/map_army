import { describe, expect, it } from 'vitest';
import { GRID_SPACINGS, generateGrid, generateMgrsZoneGrid, suggestSpacing } from './grid';
import type { GeoBounds } from './grid';

/** 中欧的一个小视口，用于测试网格生成 */
const ALPS: GeoBounds = { west: 7.0, south: 46.5, east: 9.0, north: 47.5 };

describe('格网间距推荐', () => {
  it('缩放级别越大，推荐间距越小', () => {
    let previous = Infinity;
    for (let zoom = 3; zoom <= 18; zoom += 1) {
      const spacing = suggestSpacing(zoom);
      expect(spacing).toBeLessThanOrEqual(previous);
      previous = spacing;
    }
  });

  it('应始终返回预设档位之一', () => {
    for (let zoom = 0; zoom <= 20; zoom += 1) {
      expect(GRID_SPACINGS).toContain(suggestSpacing(zoom));
    }
  });

  it('高纬度处经线收敛，应相应放大间距', () => {
    expect(suggestSpacing(12, 70)).toBeGreaterThanOrEqual(suggestSpacing(12, 0));
  });
});

describe('网格线生成', () => {
  it('应生成 MGRS 网格线', () => {
    const lines = generateGrid({ bounds: ALPS, type: 'MGRS', spacingMeters: 10000 });
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.path.length).toBeGreaterThan(1);
      expect(typeof line.label).toBe('string');
    }
  });

  it('应生成 UTM 网格线，且标注为米数', () => {
    const lines = generateGrid({ bounds: ALPS, type: 'UTM', spacingMeters: 10000 });
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.label).toMatch(/^\d+$/);
    }
  });

  it('应生成 BNG 网格线', () => {
    const london: GeoBounds = { west: -0.5, south: 51.3, east: 0.3, north: 51.8 };
    const lines = generateGrid({ bounds: london, type: 'BNG', spacingMeters: 10000 });
    expect(lines.length).toBeGreaterThan(0);
  });

  it('所有折线顶点都应是合法经纬度', () => {
    const lines = generateGrid({ bounds: ALPS, type: 'MGRS', spacingMeters: 1000 });
    for (const line of lines) {
      for (const p of line.path) {
        expect(Number.isFinite(p.lon)).toBe(true);
        expect(Number.isFinite(p.lat)).toBe(true);
        expect(p.lat).toBeGreaterThanOrEqual(-90);
        expect(p.lat).toBeLessThanOrEqual(90);
      }
    }
  });

  it('间距过小时不应产生海量线条（性能保护）', () => {
    // 全球视口 + 10 米间距，理论上会有上亿条线，必须被上限拦住
    const world: GeoBounds = { west: -180, south: -80, east: 180, north: 84 };
    const lines = generateGrid({ bounds: world, type: 'MGRS', spacingMeters: 10 });
    expect(lines.length).toBeLessThanOrEqual(400);
  });

  it('间距越大线条越少', () => {
    const coarse = generateGrid({ bounds: ALPS, type: 'MGRS', spacingMeters: 100000 });
    const fine = generateGrid({ bounds: ALPS, type: 'MGRS', spacingMeters: 10000 });
    expect(coarse.length).toBeLessThan(fine.length);
  });
});

describe('MGRS 带（GZD）粗网格', () => {
  it('应生成带边界与纬度带横线', () => {
    const lines = generateMgrsZoneGrid({ west: 0, south: 40, east: 24, north: 56 });
    expect(lines.length).toBeGreaterThan(0);
    // 纬度带横线的标注应为单个字母
    const bandLines = lines.filter((l) => /^[A-Z]$/.test(l.label));
    expect(bandLines.length).toBeGreaterThan(0);
  });
});
