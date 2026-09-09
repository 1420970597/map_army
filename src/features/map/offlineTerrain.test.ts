import { describe, expect, it } from 'vitest';
import { offlineElevation, offlineHeightmap } from './offlineTerrain';

describe('内置离线地形', () => {
  it('生成固定尺寸且包含起伏的高程瓦片', () => {
    const tile = offlineHeightmap(1, 0, 1, 8, 8);
    expect(tile).toHaveLength(64);
    expect(tile.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
    expect(new Set(tile).size).toBeGreaterThan(1);
  });

  it('默认中欧视野包含山地高程', () => {
    expect(offlineElevation(8.5, 46.5)).toBeGreaterThan(1000);
    expect(offlineElevation(8.5, 46.5)).not.toBe(offlineElevation(8.5, 0));
  });
});
