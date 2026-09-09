import { describe, expect, it } from 'vitest';

import { PREFERENCES_STORAGE_KEY, usePreferencesStore } from './usePreferencesStore';

describe('地图偏好设置', () => {
  it('包含可持久化的六边形网格默认值', () => {
    const state = usePreferencesStore.getState();
    expect(PREFERENCES_STORAGE_KEY).toBe('map-army.prefs.v1');
    expect(state.hexEdgeMeters).toBeGreaterThan(0);
    expect(state.hexColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(state.hexOpacity).toBeGreaterThanOrEqual(0);
    expect(state.hexOpacity).toBeLessThanOrEqual(1);
    expect(state.hexLineWidth).toBeGreaterThan(0);
    expect(typeof state.hexLabels).toBe('boolean');
  });

  it('更新网格配置时立即反映到状态', () => {
    const original = usePreferencesStore.getState();
    original.update({ hexEdgeMeters: 25000, hexLabels: false });
    expect(usePreferencesStore.getState()).toMatchObject({
      hexEdgeMeters: 25000,
      hexLabels: false,
    });
    original.update({ hexEdgeMeters: 10000, hexLabels: true });
  });
});
