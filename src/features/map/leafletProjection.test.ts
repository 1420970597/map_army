/**
 * Leaflet 投影适配器测试：验证 layerPoint 基准下的双向坐标转换。
 */

import type * as L from 'leaflet';
import { describe, expect, it } from 'vitest';

import type { LonLat } from '@/core/geo/types';

import { createLeafletProjection, type LeafletProjectionMap } from './leafletProjection';

interface FakeMapOptions {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

interface FakeMap extends LeafletProjectionMap {
  readonly layerCalls: L.LatLngExpression[];
  readonly inverseCalls: L.PointExpression[];
}

function createFakeMap(options: FakeMapOptions): FakeMap {
  const layerCalls: L.LatLngExpression[] = [];
  const inverseCalls: L.PointExpression[] = [];

  return {
    layerCalls,
    inverseCalls,
    latLngToLayerPoint(latlng) {
      layerCalls.push(latlng);
      const [lat, lon] = latLngValues(latlng);
      return {
        x: lon * options.scaleX + options.offsetX,
        y: lat * options.scaleY + options.offsetY,
      } as L.Point;
    },
    layerPointToLatLng(point) {
      inverseCalls.push(point);
      const [x, y] = pointValues(point);
      return {
        lng: (x - options.offsetX) / options.scaleX,
        lat: (y - options.offsetY) / options.scaleY,
      } as L.LatLng;
    },
  };
}

function latLngValues(latlng: L.LatLngExpression): [number, number] {
  if (Array.isArray(latlng)) {
    return [latlng[0], latlng[1]];
  }
  return [latlng.lat, latlng.lng];
}

function pointValues(point: L.PointExpression): [number, number] {
  if (Array.isArray(point)) {
    return [point[0], point[1]];
  }
  return [point.x, point.y];
}

describe('createLeafletProjection', () => {
  it('通过 latLngToLayerPoint 转换经纬度到像素', () => {
    const map = createFakeMap({ scaleX: 4, scaleY: -3, offsetX: 0, offsetY: 0 });
    const projection = createLeafletProjection(map);

    expect(projection.toPixel({ lon: 12.5, lat: -8 })).toEqual({ x: 50, y: 24 });
    expect(map.layerCalls).toEqual([[-8, 12.5]]);
  });

  it('通过 layerPointToLatLng 转换像素到经纬度', () => {
    const map = createFakeMap({ scaleX: 4, scaleY: -3, offsetX: 0, offsetY: 0 });
    const projection = createLeafletProjection(map);

    expect(projection.toLonLat({ x: 50, y: 24 })).toEqual({ lon: 12.5, lat: -8 });
    expect(map.inverseCalls).toEqual([[50, 24]]);
  });

  it('保留非零 layerPoint 偏移', () => {
    const projection = createLeafletProjection(
      createFakeMap({ scaleX: 2, scaleY: -5, offsetX: 320, offsetY: 180 }),
    );

    expect(projection.toPixel({ lon: 10, lat: 6 })).toEqual({ x: 340, y: 150 });
    expect(projection.toLonLat({ x: 340, y: 150 })).toEqual({ lon: 10, lat: 6 });
  });

  it('不会修改输入经纬度或像素对象', () => {
    const projection = createLeafletProjection(
      createFakeMap({ scaleX: 7, scaleY: -11, offsetX: 13, offsetY: -17 }),
    );
    const lonLat: LonLat = { lon: 3.25, lat: -4.5 };
    const pixel = { x: 35.75, y: 32.5 };
    const lonLatSnapshot = structuredClone(lonLat);
    const pixelSnapshot = structuredClone(pixel);

    projection.toPixel(lonLat);
    projection.toLonLat(pixel);

    expect(lonLat).toEqual(lonLatSnapshot);
    expect(pixel).toEqual(pixelSnapshot);
  });

  it('可连续转换多个点且保持各点独立', () => {
    const projection = createLeafletProjection(
      createFakeMap({ scaleX: 10, scaleY: -10, offsetX: 100, offsetY: 200 }),
    );
    const points: LonLat[] = [
      { lon: 0, lat: 0 },
      { lon: 1.5, lat: -2 },
      { lon: -4, lat: 3.25 },
    ];

    expect(points.map((point) => projection.toPixel(point))).toEqual([
      { x: 100, y: 200 },
      { x: 115, y: 220 },
      { x: 60, y: 167.5 },
    ]);
  });

  it('为每个地图实例创建独立适配器，不缓存旧地图', () => {
    const firstMap = createFakeMap({ scaleX: 1, scaleY: 1, offsetX: 10, offsetY: 20 });
    const secondMap = createFakeMap({ scaleX: 2, scaleY: 3, offsetX: -10, offsetY: -20 });
    const firstProjection = createLeafletProjection(firstMap);
    const secondProjection = createLeafletProjection(secondMap);

    expect(firstProjection.toPixel({ lon: 1, lat: 2 })).toEqual({ x: 11, y: 22 });
    expect(secondProjection.toPixel({ lon: 1, lat: 2 })).toEqual({ x: -8, y: -14 });
    expect(firstMap.layerCalls).toHaveLength(1);
    expect(secondMap.layerCalls).toHaveLength(1);
  });

  it('输出为普通 Pixel 和 LonLat 对象', () => {
    const projection = createLeafletProjection(
      createFakeMap({ scaleX: 2, scaleY: -3, offsetX: 5, offsetY: 7 }),
    );
    const pixel = projection.toPixel({ lon: 4, lat: 6 });
    const lonLat = projection.toLonLat(pixel);

    expect(Object.getPrototypeOf(pixel)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(lonLat)).toBe(Object.prototype);
    expect(Object.keys(pixel).sort()).toEqual(['x', 'y']);
    expect(Object.keys(lonLat).sort()).toEqual(['lat', 'lon']);
  });

  it('往返转换误差小于半个像素', () => {
    const projection = createLeafletProjection(
      createFakeMap({ scaleX: 13.7, scaleY: -9.3, offsetX: 123.4, offsetY: -87.6 }),
    );
    const source: LonLat = { lon: 116.397128, lat: 39.916527 };
    const pixel = projection.toPixel(source);
    const result = projection.toLonLat(pixel);
    const roundTripPixel = projection.toPixel(result);

    expect(Math.hypot(roundTripPixel.x - pixel.x, roundTripPixel.y - pixel.y)).toBeLessThan(0.5);
  });
});
