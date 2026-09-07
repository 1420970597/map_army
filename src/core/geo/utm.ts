import type { LonLat, UtmZone, XY } from './types';
import { WGS84 } from './constants';
import { tmForward, tmInverse, type TransverseMercatorParams } from './transverse-mercator';

/**
 * 通用横轴墨卡托（UTM）投影。
 *
 * UTM 把地球按经度每 6° 划分为 60 个投影带，每带使用独立的横轴墨卡托投影：
 *   - 中央子午线缩放因子 k₀ = 0.9996（使带边缘的投影变形控制在 1‰ 以内）
 *   - 东向偏移量 500 000 m（保证带内东向坐标恒为正）
 *   - 北半球北向偏移量 0 m，南半球 10 000 000 m（同理保证非负）
 */

/** UTM 中央子午线缩放因子 */
export const UTM_SCALE_FACTOR = 0.9996;

/** UTM 东向偏移量，单位：米 */
export const UTM_FALSE_EASTING = 500000;

/** 南半球 UTM 北向偏移量，单位：米 */
export const UTM_FALSE_NORTHING_SOUTH = 10000000;

/**
 * 根据经度计算所在的 UTM 带号（1..60）。
 *
 * 带 n 覆盖 [-180 + 6(n-1), -180 + 6n)，例如：
 *   - 带 1：-180° ~ -174°
 *   - 带 31：0° ~ 6°
 *   - 带 60：174° ~ 180°
 */
export function utmZoneNumber(lon: number): number {
  let normalized = lon;
  // 经度规范化到 [-180, 180)
  while (normalized >= 180) normalized -= 360;
  while (normalized < -180) normalized += 360;

  const zone = Math.floor((normalized + 180) / 6) + 1;
  // 180° 处由于浮点误差可能算出 61，需要夹紧
  return Math.min(60, Math.max(1, zone));
}

/**
 * 由带号计算中央子午线经度（单位：度）。
 *
 * 带 n 的中央子午线 = -183 + 6n，例如带 31 的中央子午线为 3°。
 */
export function utmCentralMeridian(zoneNumber: number): number {
  return -183 + 6 * zoneNumber;
}

/**
 * 组装指定带的 UTM 投影参数。
 *
 * @param zone 投影带信息
 * @param ellipsoid 参考椭球，默认 WGS84
 */
export function utmParams(zone: UtmZone, ellipsoid = WGS84): TransverseMercatorParams {
  return {
    ellipsoid,
    centralMeridian: utmCentralMeridian(zone.number),
    scaleFactor: UTM_SCALE_FACTOR,
    falseEasting: UTM_FALSE_EASTING,
    falseNorthing: zone.hemisphere === 'S' ? UTM_FALSE_NORTHING_SOUTH : 0,
  };
}

/**
 * 根据经纬度推导所在的 UTM 带（含半球）。
 *
 * 注意：南半球的判定以纬度 0 为界。实际应用中若用户手动指定了带号，
 * 应以手动指定为准（因为带边界附近存在刻意的跨带覆盖区）。
 */
export function utmZoneOf(point: LonLat): UtmZone {
  return {
    number: utmZoneNumber(point.lon),
    hemisphere: point.lat >= 0 ? 'N' : 'S',
  };
}

/** UTM 正算：经纬度 → 带内平面坐标 */
export function lonLatToUtm(point: LonLat, zone?: UtmZone): XY & { zone: UtmZone } {
  const resolvedZone = zone ?? utmZoneOf(point);
  const projected = tmForward(point, utmParams(resolvedZone));
  return { ...projected, zone: resolvedZone };
}

/** UTM 反算：带内平面坐标 → 经纬度 */
export function utmToLonLat(point: XY, zone: UtmZone): LonLat {
  return tmInverse(point, utmParams(zone));
}

/**
 * 把 UTM 坐标格式化为便于人工阅读的字符串。
 *
 * @example
 * formatUtm({ x: 323424, y: 4306480 }, { number: 18, hemisphere: 'N' })
 * // => "18N 323424E 4306480N"
 */
export function formatUtm(point: XY, zone: UtmZone, decimals = 0): string {
  return [
    `${zone.number}${zone.hemisphere}`,
    `${point.x.toFixed(decimals)}E`,
    `${point.y.toFixed(decimals)}N`,
  ].join(' ');
}
