import { describe, expect, it } from 'vitest';

import type { LonLat, Projection } from '@/core/geo';
import { GeometryKind, Tool, type Layer, type MapFeature } from '@/core/model';

import {
  MAX_VERTEX_SNAP_CANDIDATES,
  buildVertexSnapCandidates,
  isVertexEditorEligible,
  nearestSegment,
  nextActiveVertexIndex,
  sameVertexPoints,
  shouldCommitVertexDrag,
  verticesOfFeature,
} from './vertexEditorLogic';

const points: LonLat[] = [
  { lon: 100, lat: 20 },
  { lon: 101, lat: 21 },
  { lon: 102, lat: 22 },
];

const identityProjection: Projection = {
  toPixel: (point) => ({ x: point.lon, y: point.lat }),
  toLonLat: (pixel) => ({ lon: pixel.x, lat: pixel.y }),
};

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

describe('vertexEditorLogic', () => {
  it('仅选择工具、单选线要素且图层可编辑时允许顶点编辑', () => {
    const selected = feature('selected', 'editable');
    expect(
      isVertexEditorEligible({
        activeTool: Tool.Select,
        selectedIds: [selected.id],
        feature: selected,
        layers: [editableLayer],
      }),
    ).toBe(true);
  });

  it('多选时不允许顶点编辑', () => {
    const selected = feature('selected', 'editable');
    expect(
      isVertexEditorEligible({
        activeTool: Tool.Select,
        selectedIds: [selected.id, 'other'],
        feature: selected,
        layers: [editableLayer],
      }),
    ).toBe(false);
  });

  it('非选择工具时不允许顶点编辑', () => {
    const selected = feature('selected', 'editable');
    expect(
      isVertexEditorEligible({
        activeTool: Tool.Line,
        selectedIds: [selected.id],
        feature: selected,
        layers: [editableLayer],
      }),
    ).toBe(false);
  });

  it('点要素不允许顶点编辑', () => {
    const selected = feature('selected', 'editable', GeometryKind.Point);
    expect(
      isVertexEditorEligible({
        activeTool: Tool.Select,
        selectedIds: [selected.id],
        feature: selected,
        layers: [editableLayer],
      }),
    ).toBe(false);
  });

  it('隐藏图层的要素不允许顶点编辑', () => {
    const selected = feature('selected', 'hidden');
    expect(
      isVertexEditorEligible({
        activeTool: Tool.Select,
        selectedIds: [selected.id],
        feature: selected,
        layers: [hiddenLayer],
      }),
    ).toBe(false);
  });

  it('锁定图层的要素不允许顶点编辑', () => {
    const selected = feature('selected', 'locked');
    expect(
      isVertexEditorEligible({
        activeTool: Tool.Select,
        selectedIds: [selected.id],
        feature: selected,
        layers: [lockedLayer],
      }),
    ).toBe(false);
  });

  it('从点、线、面要素中提取可吸附顶点', () => {
    expect(verticesOfFeature(feature('point', 'editable', GeometryKind.Point))).toEqual([
      points[0],
    ]);
    expect(verticesOfFeature(feature('line', 'editable'))).toEqual(points.slice(0, 2));
    expect(verticesOfFeature(feature('area', 'editable', GeometryKind.Area))).toEqual(points);
  });

  it('候选包含编辑要素的全部 self 顶点及索引', () => {
    const selected = feature('selected', 'editable', GeometryKind.Area);
    expect(
      buildVertexSnapCandidates({
        feature: selected,
        features: [selected],
        layers: [editableLayer],
      }),
    ).toEqual(
      points.map((point, index) => ({ point, source: 'self', featureId: 'selected', index })),
    );
  });

  it('候选包含可见未锁定其他图层的点、线、面顶点', () => {
    const selected = feature('selected', 'editable');
    const pointFeature = feature('point', 'other', GeometryKind.Point);
    const areaFeature = feature('area', 'other', GeometryKind.Area);
    const candidates = buildVertexSnapCandidates({
      feature: selected,
      features: [selected, pointFeature, areaFeature],
      layers: [editableLayer, { ...editableLayer, id: 'other' }],
    });
    expect(candidates.filter((candidate) => candidate.source === 'feature')).toHaveLength(4);
    expect(
      candidates.some((candidate) => candidate.featureId === 'point' && candidate.index === 0),
    ).toBe(true);
    expect(
      candidates.some((candidate) => candidate.featureId === 'area' && candidate.index === 2),
    ).toBe(true);
  });

  it('候选排除同一要素及同图层中的其他要素', () => {
    const selected = feature('selected', 'editable');
    const candidates = buildVertexSnapCandidates({
      feature: selected,
      features: [selected, feature('same-layer', 'editable')],
      layers: [editableLayer],
    });
    expect(candidates.every((candidate) => candidate.source === 'self')).toBe(true);
  });

  it('候选排除隐藏和锁定图层', () => {
    const selected = feature('selected', 'editable');
    const candidates = buildVertexSnapCandidates({
      feature: selected,
      features: [selected, feature('hidden', 'hidden'), feature('locked', 'locked')],
      layers: [editableLayer, hiddenLayer, lockedLayer],
    });
    expect(candidates.map((candidate) => candidate.featureId)).not.toContain('hidden');
    expect(candidates.map((candidate) => candidate.featureId)).not.toContain('locked');
  });

  it('候选数达到上限后保留 self 候选优先内容', () => {
    const selected = feature('selected', 'editable');
    const candidates = buildVertexSnapCandidates({
      feature: selected,
      features: [selected, feature('other', 'other', GeometryKind.Area)],
      layers: [editableLayer, { ...editableLayer, id: 'other' }],
      maxCandidates: 2,
    });
    expect(candidates).toHaveLength(2);
    expect(candidates.every((candidate) => candidate.source === 'self')).toBe(true);
    expect(MAX_VERTEX_SNAP_CANDIDATES).toBe(2000);
  });

  it('相同顶点数组不会提交拖拽', () => {
    expect(
      shouldCommitVertexDrag(
        points,
        points.map((point) => ({ ...point })),
      ),
    ).toBe(false);
    expect(
      sameVertexPoints(
        points,
        points.map((point) => ({ ...point })),
      ),
    ).toBe(true);
  });

  it('坐标变化时提交拖拽', () => {
    const moved = [...points.slice(0, 1), { lon: 110, lat: 30 }, ...points.slice(2)];
    expect(shouldCommitVertexDrag(points, moved)).toBe(true);
    expect(sameVertexPoints(points, moved)).toBe(false);
  });

  it('活动顶点在首尾间循环，空顶点集不产生目标', () => {
    expect(nextActiveVertexIndex(null, 1, 3)).toBe(1);
    expect(nextActiveVertexIndex(0, -1, 3)).toBe(2);
    expect(nextActiveVertexIndex(2, 1, 3)).toBe(0);
    expect(nextActiveVertexIndex(0, 1, 0)).toBeNull();
  });

  it('命中水平线段并返回投影点与插入位置', () => {
    expect(
      nearestSegment(
        [
          { lon: 0, lat: 0 },
          { lon: 10, lat: 0 },
        ],
        { lon: 4, lat: 3 },
        identityProjection,
        3,
      ),
    ).toEqual({ index: 1, point: { lon: 4, lat: 0 }, distancePx: 3 });
  });

  it('命中竖直线段', () => {
    expect(
      nearestSegment(
        [
          { lon: 2, lat: 0 },
          { lon: 2, lat: 10 },
        ],
        { lon: 5, lat: 7 },
        identityProjection,
        3,
      ),
    ).toEqual({ index: 1, point: { lon: 2, lat: 7 }, distancePx: 3 });
  });

  it('命中斜线段并保留最近投影', () => {
    expect(
      nearestSegment(
        [
          { lon: 0, lat: 0 },
          { lon: 10, lat: 10 },
        ],
        { lon: 8, lat: 6 },
        identityProjection,
        2,
      ),
    ).toEqual({ index: 1, point: { lon: 7, lat: 7 }, distancePx: Math.SQRT2 });
  });

  it('将段外点击投影夹取到最近端点', () => {
    expect(
      nearestSegment(
        [
          { lon: 0, lat: 0 },
          { lon: 10, lat: 0 },
        ],
        { lon: -2, lat: 1 },
        identityProjection,
        3,
      ),
    ).toEqual({ index: 1, point: { lon: 0, lat: 0 }, distancePx: Math.sqrt(5) });
  });

  it('阈值外或无可用段时不命中', () => {
    expect(
      nearestSegment(
        [
          { lon: 0, lat: 0 },
          { lon: 10, lat: 0 },
        ],
        { lon: 5, lat: 4 },
        identityProjection,
        3,
      ),
    ).toBeNull();
    expect(
      nearestSegment([{ lon: 0, lat: 0 }], { lon: 0, lat: 0 }, identityProjection, 3),
    ).toBeNull();
  });

  it('面闭合边命中后在尾部插入', () => {
    expect(
      nearestSegment(
        [
          { lon: 0, lat: 0 },
          { lon: 10, lat: 0 },
          { lon: 10, lat: 10 },
        ],
        { lon: 4, lat: 4 },
        identityProjection,
        1,
        true,
      ),
    ).toEqual({ index: 3, point: { lon: 4, lat: 4 }, distancePx: 0 });
  });

  it('未闭合折线不会命中末首之间的隐式边', () => {
    expect(
      nearestSegment(
        [
          { lon: 0, lat: 0 },
          { lon: 10, lat: 0 },
          { lon: 10, lat: 10 },
        ],
        { lon: 4, lat: 4 },
        identityProjection,
        1,
      ),
    ).toBeNull();
  });

  it('相同距离的多段命中保持首个插入位置', () => {
    expect(
      nearestSegment(
        [
          { lon: 0, lat: 0 },
          { lon: 10, lat: 0 },
          { lon: 10, lat: 10 },
        ],
        { lon: 10, lat: 0 },
        identityProjection,
        0,
      ),
    ).toEqual({ index: 1, point: { lon: 10, lat: 0 }, distancePx: 0 });
  });

  it('退化线段与非法阈值按安全语义处理', () => {
    expect(
      nearestSegment(
        [
          { lon: 2, lat: 2 },
          { lon: 2, lat: 2 },
        ],
        { lon: 2, lat: 3 },
        identityProjection,
        1,
      ),
    ).toEqual({ index: 1, point: { lon: 2, lat: 2 }, distancePx: 1 });
    expect(
      nearestSegment(
        [
          { lon: 0, lat: 0 },
          { lon: 1, lat: 0 },
        ],
        { lon: 0, lat: 0 },
        identityProjection,
        -1,
      ),
    ).toBeNull();
  });
});
