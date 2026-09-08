import { describe, expect, it } from 'vitest';

import type { LonLat, Projection, SnapCandidate } from '@/core/geo';
import { GeometryKind, type Layer, type MapFeature } from '@/core/model';

import {
  DRAFT_FEATURE_ID,
  MAX_DRAW_SNAP_CANDIDATES,
  buildDrawSnapCandidates,
  resolveDrawSnap,
  sameDrawSnapTarget,
  type DrawSnapInput,
} from './drawSnapLogic';

/** 恒等投影：一个经纬度单位视为一个像素，便于直接推算距离。 */
const identityProjection: Projection = {
  toPixel: (point) => ({ x: point.lon, y: point.lat }),
  toLonLat: (pixel) => ({ lon: pixel.x, lat: pixel.y }),
};

const points: LonLat[] = [
  { lon: 100, lat: 20 },
  { lon: 101, lat: 21 },
  { lon: 102, lat: 22 },
];

const editableLayer: Layer = {
  id: 'editable',
  name: '可编辑',
  visible: true,
  locked: false,
  opacity: 1,
  order: 0,
};

const lockedLayer: Layer = { ...editableLayer, id: 'locked', locked: true };
const hiddenLayer: Layer = { ...editableLayer, id: 'hidden', visible: false };

function feature(id: string, layerId: string, kind: GeometryKind = GeometryKind.Line): MapFeature {
  const geometry =
    kind === GeometryKind.Point
      ? { kind, position: points[0] }
      : { kind, points: kind === GeometryKind.Area ? points : points.slice(0, 2) };
  return {
    id,
    layerId,
    sidc: 'SFGPUCI----K---',
    name: id,
    geometry,
    textFields: {},
    createdAt: 1,
    updatedAt: 1,
  };
}

function build(overrides: Partial<DrawSnapInput> = {}): SnapCandidate[] {
  return buildDrawSnapCandidates({
    draft: [],
    features: [],
    layers: [editableLayer, lockedLayer, hiddenLayer],
    ...overrides,
  });
}

describe('drawSnapLogic / buildDrawSnapCandidates', () => {
  it('无草稿且无要素时不产生候选', () => {
    expect(build()).toEqual([]);
  });

  it('草稿顶点作为 self 候选，下标即采集顺序', () => {
    const draft: LonLat[] = [
      { lon: 10, lat: 1 },
      { lon: 11, lat: 2 },
    ];
    expect(build({ draft })).toEqual([
      { point: { lon: 10, lat: 1 }, source: 'self', featureId: DRAFT_FEATURE_ID, index: 0 },
      { point: { lon: 11, lat: 2 }, source: 'self', featureId: DRAFT_FEATURE_ID, index: 1 },
    ]);
  });

  it('可见且未锁定图层上的要素顶点作为 feature 候选', () => {
    const candidates = build({ features: [feature('f1', 'editable')] });
    expect(candidates).toEqual([
      { point: points[0], source: 'feature', featureId: 'f1', index: 0 },
      { point: points[1], source: 'feature', featureId: 'f1', index: 1 },
    ]);
  });

  it('锁定图层上的要素不参与吸附', () => {
    expect(build({ features: [feature('f1', 'locked')] })).toEqual([]);
  });

  it('隐藏图层上的要素不参与吸附', () => {
    expect(build({ features: [feature('f1', 'hidden')] })).toEqual([]);
  });

  it('图层不存在的要素不参与吸附', () => {
    expect(build({ features: [feature('f1', 'missing')] })).toEqual([]);
  });

  it('点要素贡献单个候选，面要素贡献全部顶点', () => {
    expect(build({ features: [feature('p', 'editable', GeometryKind.Point)] })).toHaveLength(1);
    expect(build({ features: [feature('a', 'editable', GeometryKind.Area)] })).toHaveLength(3);
  });

  it('currentFeatureId 指定的要素被排除，草稿顶点不受影响', () => {
    const draft: LonLat[] = [{ lon: 10, lat: 1 }];
    const candidates = build({
      draft,
      features: [feature('f1', 'editable')],
      currentFeatureId: 'f1',
    });
    expect(candidates).toEqual([
      { point: { lon: 10, lat: 1 }, source: 'self', featureId: DRAFT_FEATURE_ID, index: 0 },
    ]);
  });

  it('草稿中重复的坐标仍按下标各生成一个候选', () => {
    const duplicated: LonLat[] = [
      { lon: 10, lat: 1 },
      { lon: 10, lat: 1 },
    ];
    const candidates = build({ draft: duplicated });
    expect(candidates).toHaveLength(2);
    expect(candidates.map((candidate) => candidate.index)).toEqual([0, 1]);
  });

  it('草稿候选排在要素候选之前', () => {
    const candidates = build({
      draft: [{ lon: 10, lat: 1 }],
      features: [feature('f1', 'editable')],
    });
    expect(candidates[0].source).toBe('self');
    expect(candidates[1].source).toBe('feature');
  });

  it('候选坐标是副本，修改输入不影响已构建的候选', () => {
    const draft: LonLat[] = [{ lon: 10, lat: 1 }];
    const candidates = build({ draft });
    draft[0].lon = 999;
    expect(candidates[0].point).toEqual({ lon: 10, lat: 1 });
  });

  it('候选数量达到上限后停止收集', () => {
    const many: LonLat[] = Array.from({ length: 50 }, (_, index) => ({
      lon: index,
      lat: index,
    }));
    expect(build({ draft: many, maxCandidates: 5 })).toHaveLength(5);
  });

  it('默认上限为 MAX_DRAW_SNAP_CANDIDATES 且为非负整数', () => {
    expect(MAX_DRAW_SNAP_CANDIDATES).toBeGreaterThan(0);
    const many: LonLat[] = Array.from({ length: MAX_DRAW_SNAP_CANDIDATES + 10 }, () => ({
      lon: 0,
      lat: 0,
    }));
    expect(build({ draft: many })).toHaveLength(MAX_DRAW_SNAP_CANDIDATES);
  });

  it('上限为 0 时不产生候选', () => {
    expect(build({ draft: points, maxCandidates: 0 })).toEqual([]);
  });
});

describe('drawSnapLogic / resolveDrawSnap', () => {
  const candidates: SnapCandidate[] = [
    { point: { lon: 100, lat: 20 }, source: 'self', featureId: DRAFT_FEATURE_ID, index: 0 },
    { point: { lon: 101, lat: 20 }, source: 'feature', featureId: 'f1', index: 0 },
  ];

  it('阈值内命中最近的候选', () => {
    const result = resolveDrawSnap({
      origin: { lon: 100.5, lat: 20 },
      candidates,
      enabled: true,
      thresholdPx: 10,
      projection: identityProjection,
    });
    expect(result?.point).toEqual({ lon: 100, lat: 20 });
    expect(result?.distancePx).toBeCloseTo(0.5);
    expect(result?.candidate.featureId).toBe(DRAFT_FEATURE_ID);
  });

  it('超出阈值时不命中', () => {
    expect(
      resolveDrawSnap({
        origin: { lon: 110, lat: 20 },
        candidates,
        enabled: true,
        thresholdPx: 5,
        projection: identityProjection,
      }),
    ).toBeNull();
  });

  it('关闭吸附时不命中，与顶点编辑共用同一开关语义', () => {
    expect(
      resolveDrawSnap({
        origin: { lon: 100, lat: 20 },
        candidates,
        enabled: false,
        thresholdPx: 10,
        projection: identityProjection,
      }),
    ).toBeNull();
  });

  it('无候选时不命中', () => {
    expect(
      resolveDrawSnap({
        origin: { lon: 100, lat: 20 },
        candidates: [],
        enabled: true,
        thresholdPx: 10,
        projection: identityProjection,
      }),
    ).toBeNull();
  });

  it('等距时优先 self 候选', () => {
    const result = resolveDrawSnap({
      origin: { lon: 100.5, lat: 20 },
      candidates: [
        { point: { lon: 100, lat: 20 }, source: 'feature', featureId: 'f1', index: 0 },
        { point: { lon: 101, lat: 20 }, source: 'self', featureId: DRAFT_FEATURE_ID, index: 0 },
      ],
      enabled: true,
      thresholdPx: 10,
      projection: identityProjection,
    });
    expect(result?.source).toBe('self');
  });

  it('阈值随注入的投影缩放，非恒等投影下按像素比较', () => {
    const scaled: Projection = {
      toPixel: (point) => ({ x: point.lon * 10, y: point.lat * 10 }),
      toLonLat: (pixel) => ({ lon: pixel.x / 10, lat: pixel.y / 10 }),
    };
    // 经纬度距离 0.5，缩放后为 5 像素，仍在阈值内
    expect(
      resolveDrawSnap({
        origin: { lon: 100.5, lat: 20 },
        candidates,
        enabled: true,
        thresholdPx: 6,
        projection: scaled,
      }),
    ).not.toBeNull();
    expect(
      resolveDrawSnap({
        origin: { lon: 100.5, lat: 20 },
        candidates,
        enabled: true,
        thresholdPx: 4,
        projection: scaled,
      }),
    ).toBeNull();
  });
});

describe('drawSnapLogic / sameDrawSnapTarget', () => {
  const base: SnapCandidate = {
    point: { lon: 100, lat: 20 },
    source: 'self',
    featureId: DRAFT_FEATURE_ID,
    index: 0,
  };
  const resultOf = (candidate: SnapCandidate, distancePx: number) => ({
    point: candidate.point,
    source: candidate.source,
    distancePx,
    candidate,
  });

  it('同一目标即使像素距离变化也视为相同', () => {
    expect(sameDrawSnapTarget(resultOf(base, 1), resultOf(base, 8))).toBe(true);
  });

  it('命中不同候选时视为不同', () => {
    const other: SnapCandidate = { ...base, index: 1 };
    expect(sameDrawSnapTarget(resultOf(base, 1), resultOf(other, 1))).toBe(false);
  });

  it('一侧为 null 时视为不同，两侧为 null 时视为相同', () => {
    expect(sameDrawSnapTarget(null, resultOf(base, 1))).toBe(false);
    expect(sameDrawSnapTarget(resultOf(base, 1), null)).toBe(false);
    expect(sameDrawSnapTarget(null, null)).toBe(true);
  });
});
