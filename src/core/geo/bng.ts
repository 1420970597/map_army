import type { LonLat, XY } from './types';
import {
  AIRY_1830,
  BNG_100KM_LETTERS,
  BNG_500KM_LETTERS,
  DEG_TO_RAD,
  RAD_TO_DEG,
  WGS84,
  eccentricitySquared,
  semiMinorAxis,
} from './constants';
import { tmForward, tmInverse, type TransverseMercatorParams } from './transverse-mercator';

/**
 * 英国国家格网（British National Grid, OSGB36 / BNG）。
 *
 * BNG 是英国军方与 Ordnance Survey 使用的平面格网，与 UTM 的差异在于：
 *   - 椭球使用 Airy 1830 而非 WGS84；
 *   - 单点横轴墨卡托：中央子午线 2°W，原点纬度 49°N；
 *   - 缩放因子 k₀ = 0.9996012717，东偏移 400 km，北偏移 −100 km；
 *   - 坐标用两个字母（500 km 方格 + 100 km 方格）加数字表示，例如 `TQ 288 079`。
 *
 * ⚠️ 关于基准转换精度：
 *   WGS84 与 OSGB36 之间的精确转换依赖 OSTN15 网格改正文件（约 10 MB 的 NTv2 网格）。
 *   本项目在浏览器端运行，为了控制体积，采用 7 参数赫尔默特（Helmert）变换近似，
 *   在英国本土的精度约 ±5 米，足以满足战术标图与网格显示需求，
 *   但不适用于测绘级应用。若需要亚米级精度，请改用 OSTN15 网格改正。
 */

/** BNG 中央子午线（2°W） */
const BNG_CENTRAL_MERIDIAN = -2;

/**
 * BNG 自然原点纬度（49°N）。
 *
 * 北坐标是从 49°N 起算的（该处北坐标为 −100 km），而不是从赤道起算；
 * 与 UTM 的"原点在赤道"不同，因此必须显式传入投影参数。
 */
const BNG_ORIGIN_LATITUDE = 49;

/** BNG 中央子午线缩放因子 */
const BNG_SCALE_FACTOR = 0.9996012717;

/** BNG 东向偏移量，单位：米 */
const BNG_FALSE_EASTING = 400000;

/** BNG 北向偏移量，单位：米（原点在 49°N，因此为负值） */
const BNG_FALSE_NORTHING = -100000;

/**
 * WGS84 → OSGB36 的 7 参数赫尔默特变换参数（OSGM02 官方值）。
 *
 * 平移量单位：米；旋转量单位：角秒；尺度改正单位：ppm。
 * 采用"位置矢量（Position Vector）"约定。
 */
const HELMERT_WGS84_TO_OSGB36 = {
  tx: 446.448,
  ty: -125.157,
  tz: 542.06,
  rx: 0.1502,
  ry: 0.247,
  rz: 0.8421,
  /** 尺度改正，单位：ppm */
  scalePpm: -20.4894,
};

/** 角秒 → 弧度 */
const ARCSEC_TO_RAD = DEG_TO_RAD / 3600;

/**
 * 大地坐标（经纬度 + 椭球高）→ 地心直角坐标（ECEF）。
 *
 * @param lon 经度（度）
 * @param lat 纬度（度）
 * @param height 椭球高（米）
 * @param a 椭球长半轴
 * @param b 椭球短半轴
 */
function geodeticToCartesian(lon: number, lat: number, height: number, a: number, b: number) {
  const sinPhi = Math.sin(lat * DEG_TO_RAD);
  const cosPhi = Math.cos(lat * DEG_TO_RAD);
  const sinLambda = Math.sin(lon * DEG_TO_RAD);
  const cosLambda = Math.cos(lon * DEG_TO_RAD);

  const e2 = (a * a - b * b) / (a * a);
  // 卯酉圈曲率半径
  const nu = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);

  return {
    x: (nu + height) * cosPhi * cosLambda,
    y: (nu + height) * cosPhi * sinLambda,
    z: ((1 - e2) * nu + height) * sinPhi,
  };
}

/**
 * 地心直角坐标（ECEF）→ 大地坐标（经纬度 + 椭球高），Bowring 迭代法。
 */
function cartesianToGeodetic(x: number, y: number, z: number, a: number, b: number) {
  const e2 = (a * a - b * b) / (a * a);
  const p = Math.hypot(x, y);
  const longitude = Math.atan2(y, x);

  // Bowring 公式：先按球近似求纬度初值，再迭代修正
  let latitude = Math.atan2(z, p * (1 - e2));
  let height = 0;

  for (let i = 0; i < 6; i += 1) {
    const sinPhi = Math.sin(latitude);
    const nu = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
    height = p / Math.cos(latitude) - nu;
    latitude = Math.atan2(z, p * (1 - (e2 * nu) / (nu + height)));
  }

  return {
    lon: longitude * RAD_TO_DEG,
    lat: latitude * RAD_TO_DEG,
    height,
  };
}

/**
 * 在两个大地基准之间做 7 参数赫尔默特变换。
 *
 * @param point WGS84 经纬度
 * @param direction 变换方向：'toOsgb36' 或 'toWgs84'
 * @returns 目标基准下的经纬度
 */
function helmertTransform(point: LonLat, direction: 'toOsgb36' | 'toWgs84'): LonLat {
  const params = HELMERT_WGS84_TO_OSGB36;
  // 反向变换时所有参数取负
  const sign = direction === 'toOsgb36' ? 1 : -1;

  const sourceEllipsoid = direction === 'toOsgb36' ? WGS84 : AIRY_1830;
  const targetEllipsoid = direction === 'toOsgb36' ? AIRY_1830 : WGS84;

  const sourceB = semiMinorAxis(sourceEllipsoid);
  const targetB = semiMinorAxis(targetEllipsoid);

  const cartesian = geodeticToCartesian(point.lon, point.lat, 0, sourceEllipsoid.a, sourceB);

  const rx = sign * params.rx * ARCSEC_TO_RAD;
  const ry = sign * params.ry * ARCSEC_TO_RAD;
  const rz = sign * params.rz * ARCSEC_TO_RAD;
  const scale = 1 + (sign * params.scalePpm) / 1e6;

  const rotated = {
    x: sign * params.tx + scale * (cartesian.x - rz * cartesian.y + ry * cartesian.z),
    y: sign * params.ty + scale * (rz * cartesian.x + cartesian.y - rx * cartesian.z),
    z: sign * params.tz + scale * (-ry * cartesian.x + rx * cartesian.y + cartesian.z),
  };

  const result = cartesianToGeodetic(rotated.x, rotated.y, rotated.z, targetEllipsoid.a, targetB);

  return { lon: result.lon, lat: result.lat };
}

/** BNG 投影参数（固定不变，直接复用同一个对象避免重复分配） */
const BNG_PARAMS: TransverseMercatorParams = {
  ellipsoid: AIRY_1830,
  centralMeridian: BNG_CENTRAL_MERIDIAN,
  scaleFactor: BNG_SCALE_FACTOR,
  falseEasting: BNG_FALSE_EASTING,
  falseNorthing: BNG_FALSE_NORTHING,
  originLatitude: BNG_ORIGIN_LATITUDE,
};

/** 经纬度（WGS84）→ BNG 平面坐标 */
export function lonLatToBng(point: LonLat): XY {
  const osgb = helmertTransform(point, 'toOsgb36');
  return tmForward(osgb, BNG_PARAMS);
}

/** BNG 平面坐标 → 经纬度（WGS84） */
export function bngToLonLat(point: XY): LonLat {
  const osgb = tmInverse(point, BNG_PARAMS);
  return helmertTransform(osgb, 'toWgs84');
}

/**
 * BNG 平面坐标 → 字母 + 数字的国家格网参考（National Grid Reference）。
 *
 * @param point BNG 平面坐标
 * @param digits 每轴数字位数（0..5），决定精度：5 位=1 米，3 位=100 米，2 位=1 千米
 * @example
 * formatBng({ x: 528000, y: 179000 }, 3) // => "TQ 280 790"
 */
export function formatBng(point: XY, digits = 5): string {
  const clampedDigits = Math.min(5, Math.max(0, Math.floor(digits)));
  if (clampedDigits === 0) {
    return `${bngLetters(point)}`;
  }

  const divisor = Math.pow(10, 5 - clampedDigits);
  const e = Math.floor((point.x % 100000) / divisor)
    .toString()
    .padStart(clampedDigits, '0');
  const n = Math.floor((point.y % 100000) / divisor)
    .toString()
    .padStart(clampedDigits, '0');

  return `${bngLetters(point)} ${e} ${n}`;
}

/**
 * 计算 BNG 平面坐标对应的两个字母（500 km 方格 + 100 km 方格）。
 */
export function bngLetters(point: XY): string {
  // 第一步：确定 500 km 方格（H / N / O / S / T）
  const e500 = Math.floor(point.x / 500000);
  const n500 = Math.floor(point.y / 500000);

  let letter500 = '';
  for (const [letter, [dx, dy]] of Object.entries(BNG_500KM_LETTERS)) {
    if (dx === e500 && dy === n500) {
      letter500 = letter;
      break;
    }
  }
  if (!letter500) {
    throw new RangeError(`该坐标不在英国国家格网范围内：${point.x}, ${point.y}`);
  }

  // 第二步：在 500 km 方格内按 5×5 划分 100 km 方格（跳过字母 I）
  const e100 = Math.floor((point.x % 500000) / 100000);
  const n100 = Math.floor((point.y % 500000) / 100000);
  const index = (4 - n100) * 5 + e100;
  const letter100 = BNG_100KM_LETTERS[index];

  return `${letter500}${letter100}`;
}

/**
 * 解析国家格网参考字符串（支持 "TQ 280 790" 与 "TQ280790" 两种写法）。
 *
 * 解算结果定位在目标格的西南角。
 */
export function parseBng(input: string): XY {
  const compact = input.toUpperCase().replace(/\s+/g, '');
  const match = /^([HN-OST][A-HJ-Z])(\d*)$/.exec(compact);
  if (!match) {
    throw new SyntaxError(`无法解析的英国国家格网坐标：${input}`);
  }

  const [, letters, digitsRaw] = match;
  if (digitsRaw.length % 2 !== 0) {
    throw new SyntaxError(`国家格网坐标的数字位数必须为偶数：${input}`);
  }

  const [offsetE500, offsetN500] = BNG_500KM_LETTERS[letters[0]];

  // 反查 100 km 方格的列、行索引
  const letter100Index = BNG_100KM_LETTERS.indexOf(letters[1]);
  const e100 = letter100Index % 5;
  const n100 = 4 - Math.floor(letter100Index / 5);

  const baseX = offsetE500 * 500000 + e100 * 100000;
  const baseY = offsetN500 * 500000 + n100 * 100000;

  const digits = digitsRaw.length / 2;
  if (digits === 0) {
    return { x: baseX, y: baseY };
  }

  const multiplier = Math.pow(10, 5 - digits);
  return {
    x: baseX + Number(digitsRaw.slice(0, digits)) * multiplier,
    y: baseY + Number(digitsRaw.slice(digits)) * multiplier,
  };
}

/**
 * 便捷方法：国家格网参考字符串 → 经纬度（WGS84）。
 */
export function bngStringToLonLat(input: string): LonLat {
  return bngToLonLat(parseBng(input));
}

/**
 * 便捷方法：经纬度（WGS84）→ 国家格网参考字符串。
 */
export function lonLatToBngString(point: LonLat, digits = 5): string {
  return formatBng(lonLatToBng(point), digits);
}

/**
 * 参考：WGS84 椭球第一偏心率平方。
 * 导出它是为了让调用方在需要自行计算曲率半径等参数时不必重复推导。
 */
export const WGS84_ECCENTRICITY_SQUARED = eccentricitySquared(WGS84);
