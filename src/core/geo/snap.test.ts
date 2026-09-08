/**
 * 吸附引擎测试：验证像素阈值、来源过滤、排除与稳定优先级。
 */

import { describe, expect, it } from 'vitest';

import type { LonLat } from './types';
import type { Projection, SnapCandidate, SnapOptions } from './snap';
import { snapPoint } from './snap';

const identityProjection: Projection = {
  toPixel: (point) => ({ x: point.lon, y: point.lat }),
  toLonLat: (pixel) => ({ lon: pixel.x, lat: pixel.y }),
};

const origin: LonLat = { lon: 0, lat: 0 };

function options(overrides: Partial<SnapOptions> = {}): SnapOptions {
  return {
    enabled: true,
    thresholdPx: 10,
    ...overrides,
  };
}

describe('snapPoint', () => {
  it('关闭时恒返回 null', () => {
    const candidates: SnapCandidate[] = [{ point: { lon: 1, lat: 1 }, source: 'self' }];

    expect(
      snapPoint(origin, candidates, options({ enabled: false }), identityProjection),
    ).toBeNull();
  });

  it('负阈值时返回 null', () => {
    const candidates: SnapCandidate[] = [{ point: { lon: 1, lat: 1 }, source: 'self' }];

    expect(
      snapPoint(origin, candidates, options({ thresholdPx: -1 }), identityProjection),
    ).toBeNull();
  });

  it('命中阈值内候选并保留原 candidate 和经纬度', () => {
    const candidate: SnapCandidate = {
      point: { lon: 3, lat: 4 },
      source: 'feature',
      featureId: 'feature-1',
      index: 2,
    };

    const result = snapPoint(origin, [candidate], options({ thresholdPx: 5 }), identityProjection);

    expect(result).toEqual({
      point: candidate.point,
      source: 'feature',
      distancePx: 5,
      candidate,
    });
    expect(result?.candidate).toBe(candidate);
    expect(result?.point).toBe(candidate.point);
  });

  it('排除阈值外候选', () => {
    const candidates: SnapCandidate[] = [{ point: { lon: 6, lat: 8 }, source: 'grid' }];

    expect(
      snapPoint(origin, candidates, options({ thresholdPx: 9 }), identityProjection),
    ).toBeNull();
  });

  it('距离恰好等于阈值时可以命中', () => {
    const candidate: SnapCandidate = { point: { lon: 6, lat: 8 }, source: 'grid' };

    expect(
      snapPoint(origin, [candidate], options({ thresholdPx: 10 }), identityProjection),
    ).toMatchObject({
      candidate,
      distancePx: 10,
    });
  });

  it('选择阈值内最近的候选', () => {
    const farther: SnapCandidate = { point: { lon: 6, lat: 0 }, source: 'self' };
    const nearer: SnapCandidate = { point: { lon: 3, lat: 4 }, source: 'grid' };

    expect(snapPoint(origin, [farther, nearer], options(), identityProjection)?.candidate).toBe(
      nearer,
    );
  });

  it('按 sources 限制参与比较的来源', () => {
    const self: SnapCandidate = { point: { lon: 1, lat: 0 }, source: 'self' };
    const feature: SnapCandidate = { point: { lon: 2, lat: 0 }, source: 'feature' };
    const grid: SnapCandidate = { point: { lon: 3, lat: 0 }, source: 'grid' };

    expect(
      snapPoint(
        origin,
        [self, feature, grid],
        options({ sources: ['feature', 'grid'] }),
        identityProjection,
      )?.candidate,
    ).toBe(feature);
  });

  it('exclude 同时匹配 featureId 和 index 时才排除，并选择下一个候选', () => {
    const excluded: SnapCandidate = {
      point: { lon: 1, lat: 0 },
      source: 'self',
      featureId: 'feature-1',
      index: 3,
    };
    const sameFeatureOtherIndex: SnapCandidate = {
      point: { lon: 2, lat: 0 },
      source: 'feature',
      featureId: 'feature-1',
      index: 4,
    };

    expect(
      snapPoint(
        origin,
        [excluded, sameFeatureOtherIndex],
        options({ exclude: { featureId: 'feature-1', index: 3 } }),
        identityProjection,
      )?.candidate,
    ).toBe(sameFeatureOtherIndex);
  });

  it('同距时 self 胜过 feature 和 grid', () => {
    const grid: SnapCandidate = { point: { lon: 3, lat: 4 }, source: 'grid' };
    const feature: SnapCandidate = { point: { lon: -3, lat: 4 }, source: 'feature' };
    const self: SnapCandidate = { point: { lon: 3, lat: -4 }, source: 'self' };

    expect(
      snapPoint(origin, [grid, feature, self], options({ thresholdPx: 5 }), identityProjection)
        ?.candidate,
    ).toBe(self);
  });

  it('同距时 feature 胜过 grid', () => {
    const grid: SnapCandidate = { point: { lon: 3, lat: 4 }, source: 'grid' };
    const feature: SnapCandidate = { point: { lon: -3, lat: 4 }, source: 'feature' };

    expect(
      snapPoint(origin, [grid, feature], options({ thresholdPx: 5 }), identityProjection)
        ?.candidate,
    ).toBe(feature);
  });

  it('exclude 未同时匹配 featureId 和 index 时不会排除候选', () => {
    const candidate: SnapCandidate = {
      point: { lon: 1, lat: 0 },
      source: 'self',
      featureId: 'feature-1',
      index: 3,
    };

    expect(
      snapPoint(
        origin,
        [candidate],
        options({ exclude: { featureId: 'feature-1', index: 4 } }),
        identityProjection,
      )?.candidate,
    ).toBe(candidate);
  });

  it('不修改 candidates 和 options 输入', () => {
    const candidates: SnapCandidate[] = [
      { point: { lon: 3, lat: 4 }, source: 'feature', featureId: 'feature-1', index: 0 },
      { point: { lon: 1, lat: 0 }, source: 'grid' },
    ];
    const inputOptions = options({
      sources: ['feature', 'grid'],
      exclude: { featureId: 'feature-2', index: 1 },
    });
    const candidatesSnapshot = structuredClone(candidates);
    const optionsSnapshot = structuredClone(inputOptions);

    snapPoint(origin, candidates, inputOptions, identityProjection);

    expect(candidates).toEqual(candidatesSnapshot);
    expect(inputOptions).toEqual(optionsSnapshot);
  });

  it('空候选列表返回 null', () => {
    expect(snapPoint(origin, [], options(), identityProjection)).toBeNull();
  });
});
