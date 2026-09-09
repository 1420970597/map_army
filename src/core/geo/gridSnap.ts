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
): SnapCandidate[] {
  if (type === 'none' || type === 'HEX') return [];
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
