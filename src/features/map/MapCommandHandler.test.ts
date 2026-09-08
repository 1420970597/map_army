import { describe, expect, it } from 'vitest';

import type { Projection } from '@/core/geo';
import { GeometryKind, type Layer, type MapFeature, serializeClipboard } from '@/core/model';

import { createClipboardPayload, pasteFeatures } from './mapCommandLogic';

const projection: Projection = {
  toPixel: (point) => ({ x: point.lon, y: point.lat }),
  toLonLat: (pixel) => ({ lon: pixel.x, lat: pixel.y }),
};

const feature = (id = 'feature-1'): MapFeature => ({
  id,
  layerId: 'source',
  sidc: 'SFGPUCI----K---',
  name: '单位',
  geometry: { kind: GeometryKind.Point, position: { lon: 1, lat: 2 } },
  textFields: {},
  createdAt: 1,
  updatedAt: 1,
});

const source: Layer = {
  id: 'source',
  name: '源图层',
  visible: true,
  locked: false,
  opacity: 1,
  order: 0,
};
const target: Layer = {
  id: 'target',
  name: '目标图层',
  visible: true,
  locked: false,
  opacity: 1,
  order: 1,
};

describe('createClipboardPayload', () => {
  it('无选择返回 null', () =>
    expect(
      createClipboardPayload({
        selectedIds: [],
        features: [feature()],
        layers: [source],
        anchor: { lon: 0, lat: 0 },
        zoom: 8,
      }),
    ).toBeNull());
  it('缺失要素返回 null', () =>
    expect(
      createClipboardPayload({
        selectedIds: ['missing'],
        features: [feature()],
        layers: [source],
        anchor: { lon: 0, lat: 0 },
        zoom: 8,
      }),
    ).toBeNull());
  it('按选择顺序复制要素', () =>
    expect(
      createClipboardPayload({
        selectedIds: ['b', 'a'],
        features: [feature('a'), feature('b')],
        layers: [source],
        anchor: { lon: 3, lat: 4 },
        zoom: 9,
      })?.features.map((item) => item.id),
    ).toEqual(['b', 'a']));
  it('携带图层名快照', () =>
    expect(
      createClipboardPayload({
        selectedIds: ['feature-1'],
        features: [feature()],
        layers: [source],
        anchor: { lon: 0, lat: 0 },
        zoom: 8,
      })?.layerNames,
    ).toEqual({ source: '源图层' }));
  it('深拷贝要素', () => {
    const result = createClipboardPayload({
      selectedIds: ['feature-1'],
      features: [feature()],
      layers: [source],
      anchor: { lon: 0, lat: 0 },
      zoom: 8,
    });
    expect(result?.features[0]).not.toBe(feature());
  });
});

describe('pasteFeatures', () => {
  const payload = serializeClipboard([feature()], { source: '源图层' }, { lon: 0, lat: 0 }, 8);

  it('无载荷返回 null', () => expect(pasteFeatures(null, target, projection, 1)).toBeNull());
  it('缺失目标图层返回 null', () =>
    expect(pasteFeatures(payload, undefined, projection, 1)).toBeNull());
  it('锁定目标图层返回 null', () =>
    expect(pasteFeatures(payload, { ...target, locked: true }, projection, 1)).toBeNull());
  it('指定目标图层', () =>
    expect(pasteFeatures(payload, target, projection, 1)?.[0].layerId).toBe('target'));
  it('使用首次 24 像素偏移', () =>
    expect(pasteFeatures(payload, target, projection, 1)?.[0].geometry).toEqual({
      kind: GeometryKind.Point,
      position: { lon: 25, lat: 26 },
    }));
  it('连续粘贴按次数递增', () =>
    expect(pasteFeatures(payload, target, projection, 3)?.[0].geometry).toEqual({
      kind: GeometryKind.Point,
      position: { lon: 73, lat: 74 },
    }));
});
