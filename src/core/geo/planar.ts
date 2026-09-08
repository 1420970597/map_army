/**
 * 局部米制平面转换。
 *
 * 图形生成在以原点纬度固定比例的等距圆柱近似中完成，x 向东、y 向北，
 * 单位均为米；不涉及屏幕像素或地图缩放。
 */

import type { LonLat } from './types';

/** 平面坐标，x 东为正、y 北为正，单位米。 */
export interface Vec2 {
  x: number;
  y: number;
}

/** 以某一经纬度为原点的局部米制平面。 */
export interface LocalPlane {
  readonly origin: LonLat;
  toXY(point: LonLat): Vec2;
  toLonLat(vec: Vec2): LonLat;
}

const LAT_METERS_PER_DEGREE = 110540;
const LON_METERS_PER_DEGREE_AT_EQUATOR = 111320;

/**
 * 计算指定纬度的经纬度米制比例。
 *
 * @param lat 纬度，单位为度
 * @returns 经度与纬度各一度对应的米数
 */
export function metersPerDegreeAt(lat: number): { lonMeters: number; latMeters: number } {
  return {
    lonMeters: LON_METERS_PER_DEGREE_AT_EQUATOR * Math.cos((lat * Math.PI) / 180),
    latMeters: LAT_METERS_PER_DEGREE,
  };
}

/**
 * 创建局部米制平面。
 *
 * 经度米制比例固定在原点纬度，保证往返转换严格互逆；调用者传入的原点
 * 会被复制，避免后续外部修改影响平面含义。
 *
 * @param origin 平面原点
 * @returns 经纬度和局部米制坐标之间的转换能力
 */
export function createLocalPlane(origin: LonLat): LocalPlane {
  const stableOrigin = { lon: origin.lon, lat: origin.lat };
  const { lonMeters, latMeters } = metersPerDegreeAt(stableOrigin.lat);

  return {
    origin: stableOrigin,
    toXY(point): Vec2 {
      return {
        x: (point.lon - stableOrigin.lon) * lonMeters,
        y: (point.lat - stableOrigin.lat) * latMeters,
      };
    },
    toLonLat(vec): LonLat {
      return {
        lon: stableOrigin.lon + vec.x / lonMeters,
        lat: stableOrigin.lat + vec.y / latMeters,
      };
    },
  };
}

/**
 * 计算经纬度点的算术中心。
 *
 * 空数组没有几何中心，返回零经纬度作为安全且确定的退化原点。
 *
 * @param points 经纬度点序列
 * @returns 其经纬度算术平均值
 */
export function centroidOfLonLat(points: readonly LonLat[]): LonLat {
  if (points.length === 0) return { lon: 0, lat: 0 };

  let lon = 0;
  let lat = 0;
  for (const point of points) {
    lon += point.lon;
    lat += point.lat;
  }

  return { lon: lon / points.length, lat: lat / points.length };
}
