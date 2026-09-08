/**
 * Leaflet 投影适配器：将地图实例的 layerPoint 坐标与核心层的经纬度/像素接口衔接。
 *
 * 所有屏幕像素换算集中在此处，避免 core 层依赖 Leaflet。
 */

import type * as L from 'leaflet';

import type { Projection } from '@/core/geo/snap';

/**
 * 适配器所需的最小 Leaflet 地图能力。
 *
 * 使用 layerPoint 作为唯一像素基准，地图平移时不会引入 containerPoint 的偏移误差。
 */
export interface LeafletProjectionMap {
  latLngToLayerPoint(latlng: L.LatLngExpression): L.Point;
  layerPointToLatLng(point: L.PointExpression): L.LatLng;
}

/**
 * 为指定 Leaflet 地图创建经纬度与 layerPoint 间的投影适配器。
 *
 * @param map 当前 Leaflet 地图实例。
 * @returns 可注入 core 几何逻辑的投影能力。
 */
export function createLeafletProjection(map: LeafletProjectionMap): Projection {
  return {
    toPixel(point) {
      const layerPoint = map.latLngToLayerPoint([point.lat, point.lon]);
      return { x: layerPoint.x, y: layerPoint.y };
    },
    toLonLat(pixel) {
      const latLng = map.layerPointToLatLng([pixel.x, pixel.y]);
      return { lon: latLng.lng, lat: latLng.lat };
    },
  };
}
