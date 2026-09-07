/**
 * 要素几何的常用计算。
 *
 * 全部基于 WGS84 球面模型（将椭球近似为半径 6371.0088 km 的球体）。
 * 对于战术标图这一量级（通常不超过数百公里），球面近似带来的误差
 * 远小于地图可视化本身的精度要求，却换来极低的运算成本。
 */

import type { LonLat } from '../geo';
import { GeometryKind, type FeatureGeometry, type MapFeature } from './types';

/** 地球平均半径，单位为米 */
const EARTH_RADIUS = 6371008.8;

/** 度量结果 */
export interface MeasureResult {
  /** 总长度，单位为米 */
  length: number;
  /** 各分段长度，单位为米，长度为顶点数减一 */
  segments: number[];
}

/**
 * 计算两点间的大圆距离（Haversine 公式）。
 *
 * 采用 Haversine 而非余弦定理，是因为在两点非常接近时
 * 余弦定理会因浮点误差放大而产生显著偏差。
 *
 * @param a 起点
 * @param b 终点
 * @returns 距离，单位为米
 */
export function haversineDistance(a: LonLat, b: LonLat): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLat = lat2 - lat1;
  const dLon = toRadians(b.lon - a.lon);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 计算两点间的方位角（度，0 为正北，顺时针递增） */
export function bearingOf(a: LonLat, b: LonLat): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLon = toRadians(b.lon - a.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** 计算折线的总长度与各分段长度 */
export function measurePath(points: LonLat[]): MeasureResult {
  const segments: number[] = [];
  let length = 0;

  for (let i = 1; i < points.length; i += 1) {
    const d = haversineDistance(points[i - 1], points[i]);
    segments.push(d);
    length += d;
  }

  return { length, segments };
}

/**
 * 计算多边形的有符号面积（球面过剩法）。
 *
 * @param points 顶点序列，不必显式闭合
 * @returns 面积绝对值，单位为平方米
 */
export function polygonArea(points: LonLat[]): number {
  if (points.length < 3) return 0;

  // 球面多边形面积：对每条边累加经差与纬差构成的三角项
  let total = 0;
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    total +=
      toRadians(p2.lon - p1.lon) * (2 + Math.sin(toRadians(p1.lat)) + Math.sin(toRadians(p2.lat)));
  }

  return Math.abs((total * EARTH_RADIUS * EARTH_RADIUS) / 2);
}

/** 计算顶点序列的几何中心（经纬度算术平均，适用于小范围） */
export function centroidOf(points: LonLat[]): LonLat {
  if (points.length === 0) return { lon: 0, lat: 0 };

  let lon = 0;
  let lat = 0;
  for (const point of points) {
    lon += point.lon;
    lat += point.lat;
  }
  return { lon: lon / points.length, lat: lat / points.length };
}

/** 计算要素的锚点坐标：点要素取自身位置，线/面取几何中心 */
export function anchorOf(feature: MapFeature): LonLat {
  switch (feature.geometry.kind) {
    case GeometryKind.Point:
      return feature.geometry.position;
    case GeometryKind.Line:
    case GeometryKind.Area:
      return centroidOf(feature.geometry.points);
    default:
      return { lon: 0, lat: 0 };
  }
}

/** 包围盒 */
export interface Bounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/** 计算若干要素的包围盒，无要素时返回 null */
export function boundsOf(features: MapFeature[]): Bounds | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  let found = false;

  const visit = (point: LonLat): void => {
    found = true;
    if (point.lon < minLon) minLon = point.lon;
    if (point.lon > maxLon) maxLon = point.lon;
    if (point.lat < minLat) minLat = point.lat;
    if (point.lat > maxLat) maxLat = point.lat;
  };

  for (const feature of features) {
    const geometry: FeatureGeometry = feature.geometry;
    if (geometry.kind === GeometryKind.Point) visit(geometry.position);
    else for (const point of geometry.points) visit(point);
  }

  return found ? { minLon, minLat, maxLon, maxLat } : null;
}

/**
 * 判断点是否落在多边形内部（射线交叉法）。
 *
 * 用于要素的点击命中测试。在经纬度平面上直接做射线法，
 * 对小范围区域足够准确。
 */
export function pointInPolygon(point: LonLat, polygon: LonLat[]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.lat > point.lat !== b.lat > point.lat &&
      point.lon < ((b.lon - a.lon) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lon;
    if (intersects) inside = !inside;
  }

  return inside;
}

/** 角度转弧度 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** 弧度转角度 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * 按人类可读格式格式化距离。
 *
 * 小于 1000 米时以米为单位，否则以公里为单位。
 */
export function formatDistance(meters: number): string {
  if (Math.abs(meters) < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * 按人类可读格式格式化面积。
 *
 * 小于 1 平方公里时以平方米为单位，否则以平方公里为单位。
 */
export function formatArea(squareMeters: number): string {
  if (squareMeters < 1_000_000) return `${Math.round(squareMeters)} m²`;
  return `${(squareMeters / 1_000_000).toFixed(2)} km²`;
}
