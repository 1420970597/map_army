/** GARS 与瑞士格网换算，瑞士多项式取自 swisstopo 官方近似公式。 */
import type { GridLine, LonLat, XY } from './types';
import { lonLatToUtm, utmToLonLat } from './utm';
import type { GeoBounds } from './grid';
import geomagnetism from 'geomagnetism';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** GARS 编码，精度为 30、15 或 5 角分。 */
export function lonLatToGars(point: LonLat, minutes: 30 | 15 | 5 = 5): string {
  if (!Number.isFinite(point.lon) || !Number.isFinite(point.lat) || Math.abs(point.lat) > 90)
    throw new Error('GARS 坐标超出范围');
  const lon = (((point.lon + 180) % 360) + 360) % 360;
  const lat = Math.min(179.999999999, point.lat + 90);
  const col = Math.floor(lon * 2);
  const row = Math.floor(lat * 2);
  let value = String(col + 1).padStart(3, '0') + LETTERS[Math.floor(row / 24)] + LETTERS[row % 24];
  if (minutes === 30) return value;
  const x = (lon - col / 2) * 4;
  const y = (lat - row / 2) * 4;
  value += (y >= 1 ? 1 : 3) + (x >= 1 ? 1 : 0);
  if (minutes === 5)
    value +=
      (2 - Math.min(2, Math.floor((y % 1) * 3))) * 3 + Math.min(2, Math.floor((x % 1) * 3)) + 1;
  return value;
}

/** GARS 返回格网单元中心，便于跳转到所给精度覆盖的区域。 */
export function garsToLonLat(value: string): LonLat {
  const match = value
    .toUpperCase()
    .replace(/\s/g, '')
    // GARS 两个纬度字母都使用 24 字母表（排除 I、O）。
    .match(/^(\d{3})([A-HJ-NP-Z])([A-HJ-NP-Z])([1-4])?([1-9])?$/);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 720) throw new Error('GARS 格式无效');
  const row = LETTERS.indexOf(match[2]) * 24 + LETTERS.indexOf(match[3]);
  if (row >= 360) throw new Error('GARS 纬度带无效');
  let lon = (Number(match[1]) - 1) / 2 - 180;
  let lat = row / 2 - 90;
  let step = 0.5;
  if (match[4]) {
    const quad = Number(match[4]);
    step = 0.25;
    lon += quad % 2 === 0 ? step : 0;
    lat += quad <= 2 ? step : 0;
  }
  if (match[5]) {
    const cell = Number(match[5]) - 1;
    step /= 3;
    lon += (cell % 3) * step;
    lat += (2 - Math.floor(cell / 3)) * step;
  }
  return { lon: lon + step / 2, lat: lat + step / 2 };
}

/** WGS84 到 LV95；输出米，瑞士境内误差约一米。 */
export function lonLatToSwiss(point: LonLat, type: 'LV95' | 'LV03' = 'LV95'): XY {
  const a = (point.lat * 3600 - 169028.66) / 10000;
  const b = (point.lon * 3600 - 26782.5) / 10000;
  return {
    x:
      2600072.37 +
      211455.93 * b -
      10938.51 * b * a -
      0.36 * b * a * a -
      44.54 * b ** 3 -
      (type === 'LV03' ? 2000000 : 0),
    y:
      1200147.07 +
      308807.95 * a +
      3745.25 * b * b +
      76.63 * a * a -
      194.56 * b * b * a +
      119.79 * a ** 3 -
      (type === 'LV03' ? 1000000 : 0),
  };
}

/** LV95 或 LV03 到 WGS84。 */
export function swissToLonLat(point: XY, type: 'LV95' | 'LV03' = 'LV95'): LonLat {
  const y = (point.x - (type === 'LV95' ? 2600000 : 600000)) / 1000000;
  const x = (point.y - (type === 'LV95' ? 1200000 : 200000)) / 1000000;
  return {
    lon:
      ((2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y ** 3) * 100) /
      36,
    lat:
      ((16.9023892 +
        3.238272 * x -
        0.270978 * y * y -
        0.002528 * x * x -
        0.0447 * y * y * x -
        0.014 * x ** 3) *
        100) /
      36,
  };
}

/** 返回 WMM2025 磁偏角及当前 UTM 网格的子午线收敛角。 */
export function northAngles(
  point: LonLat,
  date = new Date(),
): { declination: number; convergence: number; gm: number } {
  const declination = geomagnetism.model(date).point([point.lat, point.lon]).decl;
  const utm = lonLatToUtm(point);
  const north = utmToLonLat({ x: utm.x, y: utm.y + 100 }, utm.zone);
  const radians = Math.PI / 180;
  const convergence =
    Math.atan2((north.lon - point.lon) * Math.cos(point.lat * radians), north.lat - point.lat) /
    radians;
  return { declination, convergence, gm: declination - convergence };
}

/** 生成经纬、GARS、瑞士或六边形网格，限制单次输出以保持交互响应。 */
export function extendedGrid(type: string, bounds: GeoBounds, spacing: number): GridLine[] {
  const lines: GridLine[] = [];
  const south = Math.max(-85, bounds.south),
    north = Math.min(85, bounds.north);
  const west = bounds.west,
    east = Math.min(west + 360, bounds.east < west ? bounds.east + 360 : bounds.east);
  if (type === 'LV95' || type === 'LV03') {
    const box = {
      west: Math.max(5.9, west),
      east: Math.min(10.6, east),
      south: Math.max(45.7, south),
      north: Math.min(47.9, north),
    };
    if (box.west >= box.east || box.south >= box.north) return [];
    const a = lonLatToSwiss({ lon: box.west, lat: box.south }, type),
      b = lonLatToSwiss({ lon: box.east, lat: box.north }, type);
    for (let x = Math.floor(a.x / spacing) * spacing; x <= b.x && lines.length < 300; x += spacing)
      lines.push({
        path: [swissToLonLat({ x, y: a.y }, type), swissToLonLat({ x, y: b.y }, type)],
        label: String(Math.round(x)),
        level: 1,
      });
    for (let y = Math.floor(a.y / spacing) * spacing; y <= b.y && lines.length < 600; y += spacing)
      lines.push({
        path: [swissToLonLat({ x: a.x, y }, type), swissToLonLat({ x: b.x, y }, type)],
        label: String(Math.round(y)),
        level: 1,
      });
    return lines;
  }
  let step =
    type === 'GARS'
      ? spacing > 30000
        ? 0.5
        : spacing > 12000
          ? 0.25
          : 1 / 12
      : ([0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30].find(
          (value) => value * 111320 >= spacing,
        ) ?? 30);
  while ((east - west + north - south) / step > 400) step *= 2;
  if (type === 'HEX') {
    const radius = Math.max(step, (east - west) / 30);
    const dy = Math.sqrt(3) * radius;
    let col = 0;
    for (
      let lon = Math.floor(west / (1.5 * radius)) * 1.5 * radius;
      lon < east + radius;
      lon += radius * 1.5, col++
    ) {
      for (
        let lat = Math.floor(south / dy) * dy + ((col % 2) * dy) / 2;
        lat < north + radius && lines.length < 1200;
        lat += dy
      ) {
        const path = Array.from({ length: 7 }, (_, i) => ({
          lon: lon + radius * Math.cos((i * Math.PI) / 3),
          lat: lat + radius * Math.sin((i * Math.PI) / 3),
        }));
        lines.push({ path, label: '', level: 1 });
      }
    }
    return lines;
  }
  for (let lon = Math.ceil(west / step) * step; lon <= east; lon += step)
    lines.push({
      path: [
        { lon, lat: south },
        { lon, lat: north },
      ],
      label: `${(((((lon + 180) % 360) + 360) % 360) - 180).toFixed(3)}°`,
      level: 1,
    });
  for (let lat = Math.ceil(south / step) * step; lat <= north; lat += step)
    lines.push({
      path: [
        { lon: west, lat },
        { lon: east, lat },
      ],
      label:
        type === 'GARS'
          ? lonLatToGars({ lon: (west + east) / 2, lat }, step >= 0.5 ? 30 : step >= 0.25 ? 15 : 5)
          : `${lat.toFixed(3)}°`,
      level: 1,
    });
  return lines;
}
