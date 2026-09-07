import type { GridLine, GridType, LonLat } from './types';
import { WGS84 } from './constants';
import {
  UTM_FALSE_EASTING,
  UTM_SCALE_FACTOR,
  UTM_FALSE_NORTHING_SOUTH,
  utmCentralMeridian,
  utmZoneNumber,
} from './utm';
import { tmForward, tmInverse } from './transverse-mercator';
import { isSouthernBand, lonLatToMgrs, mgrsLatBand } from './mgrs';
import { bngToLonLat, lonLatToBng } from './bng';

/**
 * 军网网格线生成器。
 *
 * 职责：给定地图视口与期望的格网间距，输出一组可直接绘制的折线（含标注）。
 * 该模块是纯计算，不依赖任何地图库，便于单元测试与在 Worker 中复用。
 *
 * 性能策略：
 *   1. 按 UTM 带切分，避免跨带时投影误差放大；
 *   2. 每条线按固定采样点数离散化，而不是按像素——缩放时视觉误差可忽略；
 *   3. 设置总线条数上限，防止小间距 + 大视口时产生海量线条拖垮渲染。
 */

/** 视口地理边界，单位：度 */
export interface GeoBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** 网格生成请求 */
export interface GridRequest {
  /** 视口边界 */
  bounds: GeoBounds;
  /** 网格类型 */
  type: GridType;
  /** 格网间距，单位：米 */
  spacingMeters: number;
}

/** 单条网格线的最大采样点数 */
const SAMPLES_PER_LINE = 48;

/** 单次生成的最大线条数（超过则认为是"间距过小 / 视口过大"，直接放弃） */
const MAX_LINES = 400;

/** 允许的格网间距档位（米） */
export const GRID_SPACINGS: readonly number[] = [
  100000, 50000, 10000, 5000, 1000, 500, 100, 50, 10,
];

/**
 * 根据地图缩放级别推荐格网间距。
 *
 * 目标：让屏幕上相邻网格线的间距大致保持在 60~200 像素之间，
 * 既不会因为太密而糊成一片，也不会因为太疏而失去参考价值。
 *
 * @param zoom Leaflet 缩放级别（世界在 zoom=0 时宽 256 px）
 * @param latitude 视口中心纬度（高纬度处经线收敛，需要相应放大间距）
 */
export function suggestSpacing(zoom: number, latitude = 0): number {
  // 每像素代表的实际米数（赤道处）
  const metersPerPixel = (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
  const targetMeters = metersPerPixel * 120;

  // 选取不小于目标值的最小档位
  const suitable = GRID_SPACINGS.filter((s) => s >= targetMeters);
  return suitable.length > 0 ? suitable[suitable.length - 1] : GRID_SPACINGS[0];
}

/**
 * 计算与给定视口相交的 UTM 带号列表。
 *
 * 视口跨越 180° 经线时，先把东边界加 360° 归一化后再计算。
 */
function zonesIntersecting(bounds: GeoBounds): number[] {
  const west = bounds.west;
  let east = bounds.east;
  if (east < west) east += 360;

  const first = utmZoneNumber(west);
  const last = utmZoneNumber(east);

  const zones: number[] = [];
  for (let z = first; z <= last; z += 1) {
    zones.push(((z - 1) % 60) + 1);
    // 防止极端视口导致死循环
    if (zones.length > 60) break;
  }
  // 保证带号有序且不重复
  return Array.from(new Set(zones)).sort((a, b) => a - b);
}

/**
 * 把经度规范化到某一带的合理区间内。
 *
 * 处理跨 180° 经线的情形：把经度平移到距中央子午线最近的等价值。
 */
function normalizeLongitude(lon: number, centralMeridian: number): number {
  let value = lon;
  while (value - centralMeridian > 180) value -= 360;
  while (value - centralMeridian < -180) value += 360;
  return value;
}

/** 生成 UTM / MGRS 网格线（两者共用 UTM 投影底面） */
function generateUtmBasedGrid(request: GridRequest, label: 'utm' | 'mgrs'): GridLine[] {
  const { bounds, spacingMeters } = request;
  const spacing = Math.max(1, spacingMeters);
  const zones = zonesIntersecting(bounds);

  // 估算线条总数，超限则直接放弃，避免卡顿
  const estimated = (360 / 6) * (20000000 / spacing) * zones.length * 0.02;
  if (estimated > MAX_LINES * 10) return [];

  const lines: GridLine[] = [];
  const southern = bounds.north < 0;

  for (const zoneNumber of zones) {
    const centralMeridian = utmCentralMeridian(zoneNumber);

    // 该带在视口内的经度范围
    const zoneWest = -183 + 6 * zoneNumber;
    const zoneEast = zoneWest + 6;
    let west = Math.max(bounds.west, zoneWest - 0.5);
    let east = Math.min(
      bounds.east < bounds.west ? bounds.east + 360 : bounds.east,
      zoneEast + 0.5,
    );
    if (east <= west) continue;

    west = normalizeLongitude(west, centralMeridian);
    east = normalizeLongitude(east, centralMeridian);

    const south = Math.max(bounds.south, -80);
    const north = Math.min(bounds.north, 84);
    if (north <= south) continue;

    const falseNorthing = southern ? UTM_FALSE_NORTHING_SOUTH : 0;

    /** 带内投影正算 */
    const project = (p: LonLat) =>
      tmForward(p, {
        ellipsoid: WGS84,
        centralMeridian,
        scaleFactor: UTM_SCALE_FACTOR,
        falseEasting: UTM_FALSE_EASTING,
        falseNorthing,
      });

    /** 带内投影反算 */
    const unproject = (x: number, y: number) =>
      tmInverse(
        { x, y },
        {
          ellipsoid: WGS84,
          centralMeridian,
          scaleFactor: UTM_SCALE_FACTOR,
          falseEasting: UTM_FALSE_EASTING,
          falseNorthing,
        },
      );

    // 由四个角点估算带内坐标范围（取并集以覆盖视口的凸包）
    const corners = [
      project({ lon: west, lat: south }),
      project({ lon: east, lat: south }),
      project({ lon: west, lat: north }),
      project({ lon: east, lat: north }),
      project({ lon: centralMeridian, lat: south }),
      project({ lon: centralMeridian, lat: north }),
    ];
    const minX = Math.min(...corners.map((c) => c.x));
    const maxX = Math.max(...corners.map((c) => c.x));
    const minY = Math.min(...corners.map((c) => c.y));
    const maxY = Math.max(...corners.map((c) => c.y));

    const startX = Math.floor(minX / spacing) * spacing;
    const endX = Math.ceil(maxX / spacing) * spacing;
    const startY = Math.floor(minY / spacing) * spacing;
    const endY = Math.ceil(maxY / spacing) * spacing;

    if ((endX - startX) / spacing + (endY - startY) / spacing > MAX_LINES) continue;

    const midY = (minY + maxY) / 2;
    const midX = (minX + maxX) / 2;

    // 纵向线（东向坐标恒定）
    for (let x = startX; x <= endX; x += spacing) {
      const path: LonLat[] = [];
      for (let i = 0; i <= SAMPLES_PER_LINE; i += 1) {
        const y = minY + ((maxY - minY) * i) / SAMPLES_PER_LINE;
        path.push(unproject(x, y));
      }
      const text =
        label === 'utm'
          ? gridLabel('x', x, southern)
          : mgrsLineLabel(unproject(x, midY), 'x', x, spacing);
      lines.push({ path, label: text, level: 0 });
      if (lines.length > MAX_LINES) return lines;
    }

    // 横向线（北向坐标恒定）
    for (let y = startY; y <= endY; y += spacing) {
      const path: LonLat[] = [];
      for (let i = 0; i <= SAMPLES_PER_LINE; i += 1) {
        const x = minX + ((maxX - minX) * i) / SAMPLES_PER_LINE;
        path.push(unproject(x, y));
      }
      const text =
        label === 'utm'
          ? gridLabel('y', y, southern)
          : mgrsLineLabel(unproject(midX, y), 'y', y, spacing);
      lines.push({ path, label: text, level: 0 });
      if (lines.length > MAX_LINES) return lines;
    }
  }

  return lines;
}

/**
 * 生成 UTM 网格线的标注文本。
 *
 * 直接标注带内米数，例如 "450000"；南半球的北坐标含
 * 10 000 000 m 偏移，标注时去掉以便阅读。
 */
function gridLabel(axis: 'x' | 'y', value: number, southern: boolean): string {
  const display = axis === 'y' && southern ? value - UTM_FALSE_NORTHING_SOUTH : value;
  return String(Math.round(display));
}

/**
 * 生成 MGRS 网格线的标注文本，遵循军用地图的标注习惯：
 *
 * - **100 km 方格线**：标注方格识别字母（纵线为列字母、横线为行字母），
 *   例如 "4U"、"XJ" 中的单个字母——这才是方格线的"名字"；
 * - **次级网格线**（10 km / 1 km 等）：标注方格内的两位公里数，
 *   例如 1 km 间距下 45 km 处标注 "45"、10 km 间距下标注 "10""20"…。
 *
 * 此前的实现把标注算成"方格内序号"，当间距为 100 km 时所有线都落在
 * 方格原点，序号恒为 0，导致满屏 "0"。
 */
function mgrsLineLabel(mid: LonLat, axis: 'x' | 'y', value: number, spacing: number): string {
  if (spacing >= 100000) {
    // 100 km 方格线：用线的中点坐标反查方格识别字母
    const coord = lonLatToMgrs(mid, 100000);
    return axis === 'x' ? coord.col : coord.row;
  }
  const local = ((value % 100000) + 100000) % 100000;
  return String(Math.round(local / 1000) % 100).padStart(2, '0');
}

/** 生成 BNG 网格线 */
function generateBngGrid(request: GridRequest): GridLine[] {
  const { bounds, spacingMeters } = request;
  const spacing = Math.max(1, spacingMeters);

  const corners = [
    lonLatToBng({ lon: bounds.west, lat: bounds.south }),
    lonLatToBng({ lon: bounds.east, lat: bounds.south }),
    lonLatToBng({ lon: bounds.west, lat: bounds.north }),
    lonLatToBng({ lon: bounds.east, lat: bounds.north }),
  ];

  const minX = Math.min(...corners.map((c) => c.x));
  const maxX = Math.max(...corners.map((c) => c.x));
  const minY = Math.min(...corners.map((c) => c.y));
  const maxY = Math.max(...corners.map((c) => c.y));

  if ((maxX - minX) / spacing + (maxY - minY) / spacing > MAX_LINES) return [];

  const lines: GridLine[] = [];
  const startX = Math.floor(minX / spacing) * spacing;
  const endX = Math.ceil(maxX / spacing) * spacing;
  const startY = Math.floor(minY / spacing) * spacing;
  const endY = Math.ceil(maxY / spacing) * spacing;

  for (let x = startX; x <= endX; x += spacing) {
    const path: LonLat[] = [];
    for (let i = 0; i <= SAMPLES_PER_LINE; i += 1) {
      path.push(bngToLonLat({ x, y: minY + ((maxY - minY) * i) / SAMPLES_PER_LINE }));
    }
    lines.push({ path, label: String(Math.round(x)), level: 0 });
    if (lines.length > MAX_LINES) return lines;
  }

  for (let y = startY; y <= endY; y += spacing) {
    const path: LonLat[] = [];
    for (let i = 0; i <= SAMPLES_PER_LINE; i += 1) {
      path.push(bngToLonLat({ x: minX + ((maxX - minX) * i) / SAMPLES_PER_LINE, y }));
    }
    lines.push({ path, label: String(Math.round(y)), level: 0 });
    if (lines.length > MAX_LINES) return lines;
  }

  return lines;
}

/**
 * 生成指定类型的军网网格线。
 *
 * @param request 视口边界、网格类型与间距
 * @returns 可直接绘制的折线数组
 */
export function generateGrid(request: GridRequest): GridLine[] {
  switch (request.type) {
    case 'MGRS':
      return generateUtmBasedGrid(request, 'mgrs');
    case 'UTM':
      return generateUtmBasedGrid(request, 'utm');
    case 'BNG':
      return generateBngGrid(request);
    default:
      return [];
  }
}

/**
 * 生成 MGRS 带（GZD，6°×8°）的粗网格。
 *
 * 用于极小比例尺下只显示带边界，避免画出密密麻麻的 100 km 方格。
 */
export function generateMgrsZoneGrid(bounds: GeoBounds): GridLine[] {
  const zones = zonesIntersecting(bounds);
  const lines: GridLine[] = [];

  for (const zoneNumber of zones) {
    const west = -180 + 6 * (zoneNumber - 1);
    const east = west + 6;
    const path: LonLat[] = [];
    for (let lat = -80; lat <= 84; lat += 4) {
      path.push({ lon: west, lat });
    }
    lines.push({ path, label: String(zoneNumber), level: 0 });
    // 最后一条带再补上东边界，保证闭合
    if (zoneNumber === zones[zones.length - 1]) {
      lines.push({
        path: Array.from({ length: 42 }, (_, i) => ({ lon: east, lat: -80 + i * 4 })),
        label: String(zoneNumber),
        level: 0,
      });
    }
  }

  // 纬度带横线（每 8°）
  for (let lat = -80; lat <= 84; lat += 8) {
    const band = mgrsLatBand(lat + 0.1);
    lines.push({
      path: [
        { lon: bounds.west, lat },
        { lon: bounds.east, lat },
      ],
      label: band,
      level: 0,
    });
  }

  return lines;
}

/** 判断某个纬度带是否位于南半球（转发自 mgrs 模块，便于外部统一引用） */
export { isSouthernBand };
