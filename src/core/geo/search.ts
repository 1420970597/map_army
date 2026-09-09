/** 按明确格式解析坐标，十进制度约定为纬度、经度。 */
import type { LonLat } from './types';
import { bngStringToLonLat } from './bng';
import { mgrsStringToLonLat } from './mgrs';
import { utmToLonLat } from './utm';
import { garsToLonLat, swissToLonLat } from './extended';

/** 返回合法坐标，无法识别或超出地理范围时返回 null。 */
export function parseCoordinateSearch(input: string): LonLat | null {
  const value = input.trim().toUpperCase();
  const valid = (point: LonLat) =>
    Number.isFinite(point.lon) &&
    Number.isFinite(point.lat) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lon) <= 180
      ? point
      : null;
  try {
    const decimal = value.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
    if (decimal) return valid({ lat: Number(decimal[1]), lon: Number(decimal[2]) });
    const utm = value.match(
      /^(?:UTM\s*)?(\d{1,2})\s*([NS])\s+(\d+(?:\.\d+)?)E?\s+(\d+(?:\.\d+)?)N?$/,
    );
    if (utm) {
      const zone = Number(utm[1]),
        x = Number(utm[3]),
        y = Number(utm[4]);
      if (zone < 1 || zone > 60 || x < 100000 || x > 900000 || y > 10000000) return null;
      return valid(utmToLonLat({ x, y }, { number: zone, hemisphere: utm[2] as 'N' | 'S' }));
    }
    const swiss = value.match(/^(LV95|LV03)\s+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)$/);
    if (swiss)
      return valid(
        swissToLonLat({ x: Number(swiss[2]), y: Number(swiss[3]) }, swiss[1] as 'LV95' | 'LV03'),
      );
    const compact = value.replace(/\s/g, '');
    if (/^\d{3}[A-Z]{2}[1-4]?[1-9]?$/.test(compact)) return valid(garsToLonLat(compact));
    if (/^\d{1,2}[A-Z]{3}\d*$/.test(compact)) return valid(mgrsStringToLonLat(compact));
    if (/^[A-Z]{2}\d*$/.test(compact)) return valid(bngStringToLonLat(compact));
    const dms = value.match(
      /^(\d{1,2})[°\s]+(\d{1,2})['′\s]+(\d+(?:\.\d+)?)["″\s]*([NS])[,\s]+(\d{1,3})[°\s]+(\d{1,2})['′\s]+(\d+(?:\.\d+)?)["″\s]*([EW])$/,
    );
    if (dms && [2, 3, 6, 7].every((i) => Number(dms[i]) < 60))
      return valid({
        lat:
          (Number(dms[1]) + Number(dms[2]) / 60 + Number(dms[3]) / 3600) *
          (dms[4] === 'S' ? -1 : 1),
        lon:
          (Number(dms[5]) + Number(dms[6]) / 60 + Number(dms[7]) / 3600) *
          (dms[8] === 'W' ? -1 : 1),
      });
  } catch {
    return null;
  }
  return null;
}
