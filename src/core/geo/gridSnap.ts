/** 按光标附近的格网坐标直接生成交点，避免枚举整个视口的密集网格。 */
import type { LonLat, GridType } from './types';
import type { SnapCandidate } from './snap';
import { lonLatToUtm, utmToLonLat } from './utm';
import { lonLatToBng, bngToLonLat } from './bng';
import { lonLatToSwiss, swissToLonLat } from './extended';
import { suggestSpacing } from './grid';

/** 返回光标四周格网节点。 */
export function nearbyGridPoints(
  point: LonLat,
  type: GridType | 'none',
  zoom: number,
  hexEdgeMeters = 10000,
): SnapCandidate[] {
  if (type === 'none') return [];
  if (type === 'HEX') {
    const radius = Math.max(0.001, hexEdgeMeters / 111320);
    const dy = Math.sqrt(3) * radius;
    // 与 extendedGrid 使用相同的 pointy-top 六边形列/行坐标，确保吸附点
    // 与屏幕上实际绘制的六个顶点重合；奇数列向上偏移半个行距。
    const column = Math.round(point.lon / (radius * 1.5));
    const parity = ((column % 2) + 2) % 2;
    const row = Math.round((point.lat - (parity ? dy / 2 : 0)) / dy);
    const center = { lon: column * radius * 1.5, lat: row * dy + (parity ? dy / 2 : 0) };
    return Array.from({ length: 6 }, (_, index) => {
      const angle = (index * Math.PI) / 3;
      return {
        source: 'grid' as const,
        point: {
          lon: center.lon + radius * Math.cos(angle),
          lat: center.lat + radius * Math.sin(angle),
        },
      };
    });
  }
  const spacing = suggestSpacing(zoom, point.lat);
  const utm = lonLatToUtm(point);
  let step = spacing;
  let projected = { x: utm.x, y: utm.y };
  let inverse = (x: number, y: number) => utmToLonLat({ x, y }, utm.zone);
  if (type === 'BNG') {
    projected = lonLatToBng(point);
    inverse = (x, y) => bngToLonLat({ x, y });
  }
  if (type === 'LV95' || type === 'LV03') {
    projected = lonLatToSwiss(point, type);
    inverse = (x, y) => swissToLonLat({ x, y }, type);
  }
  if (type === 'WGS84' || type === 'GARS') {
    step =
      type === 'GARS'
        ? spacing > 30000
          ? 0.5
          : spacing > 12000
            ? 0.25
            : 1 / 12
        : ([0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30].find((s) => s * 111320 >= spacing) ??
          30);
    projected = { x: point.lon, y: point.lat };
    inverse = (lon, lat) => ({ lon, lat });
  }
  return [0, 1].flatMap((i) =>
    [0, 1].map((j) => ({
      source: 'grid' as const,
      point: inverse(
        (Math.floor(projected.x / step) + i) * step,
        (Math.floor(projected.y / step) + j) * step,
      ),
    })),
  );
}
