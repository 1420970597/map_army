import type { LonLat, MgrsCoordinate } from './types';
import { MGRS_COL_SETS, MGRS_LAT_BANDS, MGRS_ROW_SET, WGS84 } from './constants';
import {
  UTM_FALSE_NORTHING_SOUTH,
  UTM_SCALE_FACTOR,
  UTM_FALSE_EASTING,
  utmCentralMeridian,
  utmParams,
} from './utm';
import { tmForward, tmInverse } from './transverse-mercator';

/**
 * 军用格网参考系统（Military Grid Reference System, MGRS）。
 *
 * MGRS 建立在 UTM 之上，用"带号 + 纬度带字母 + 10 万米方格字母对 + 方格内米数"
 * 的方式表达位置，例如 `33UXP0500449998` 可写作 `33U XP 05004 49998`。
 * 相比裸 UTM 坐标，MGRS 更短、更易口头传递，是北约军队的标准定位格式。
 *
 * 实现要点：
 *   1. 纬度带字母每 8° 一个，X 带为 12°，I/O 两个字母被跳过；
 *   2. 10 万米方格的列字母按带号分三组循环，行字母每 2000 km 循环一次；
 *   3. 挪威西南海岸（带 32V 西扩）与斯瓦尔巴群岛（31X/33X/35X/37X）有专门的例外规则。
 */

/** 10 万米方格边长，单位：米 */
const SQUARE_100KM = 100000;

/** 行字母循环周期，单位：米 */
const ROW_CYCLE = 2000000;

/**
 * 计算指定纬度所属的 MGRS 纬度带字母。
 *
 * 纬度带自 -80° 起每 8° 一档，字母序列为 C..X（跳过 I 与 O），
 * 最后的 X 带扩展到 84°；超过 84° 的极区属于 UPS（通用极球面投影）范畴，
 * 本实现统一归入 X 带并给出提示性注释。
 */
export function mgrsLatBand(lat: number): string {
  const clamped = Math.min(90, Math.max(-80, lat));
  const index = Math.min(MGRS_LAT_BANDS.length - 1, Math.floor((clamped + 80) / 8));
  return MGRS_LAT_BANDS[index];
}

/**
 * 纬度带字母 → 该带的南边界纬度（单位：度）。
 */
export function mgrsBandSouthLatitude(band: string): number {
  const index = MGRS_LAT_BANDS.indexOf(band.toUpperCase());
  if (index < 0) {
    throw new RangeError(`非法的 MGRS 纬度带字母：${band}`);
  }
  return index * 8 - 80;
}

/**
 * 根据经纬度确定 MGRS 使用的 UTM 带号（含例外区域处理）。
 *
 * 例外规则（依据 MGRS 规范）：
 *   - 挪威西南海岸（纬度 56°N~64°N、经度 3°E~12°E）统一归入带 32，
 *     即把带 32 向西扩展 3°，避免把狭长的挪威海岸线切分到两个带中。
 *   - 斯瓦尔巴群岛（纬度 72°N~84°N）改用带 31/33/35/37，
 *     跳过 32/34/36，使每个带覆盖 12° 而非 6°。
 */
function mgrsZoneNumber(lon: number, lat: number): number {
  let zone = Math.min(60, Math.max(1, Math.floor(((lon + 180) % 360) / 6) + 1));

  // 挪威西南海岸例外
  if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) {
    zone = 32;
  }

  // 斯瓦尔巴群岛例外
  if (lat >= 72 && lat < 84) {
    if (lon >= 0 && lon < 9) zone = 31;
    else if (lon >= 9 && lon < 21) zone = 33;
    else if (lon >= 21 && lon < 33) zone = 35;
    else if (lon >= 33 && lon < 42) zone = 37;
  }

  return zone;
}

/**
 * 计算 10 万米方格的列字母。
 *
 * 列字母按带号分三组循环使用：带号 ≡ 1 (mod 3) 用 A~H，≡ 2 用 J~R，≡ 0 用 S~Z。
 * 这样相邻带的相同东向位置不会使用相同字母，降低口头传递时的混淆概率。
 */
function columnLetter(zone: number, easting: number): string {
  const setIndex = (zone - 1) % 3;
  // ⚠️ 注意 −1：字母集的**第一个**字母对应东向 100 000~200 000 m，
  // 而不是 0~100 000 m。原因是 6° 的投影带在赤道上最宽处也只覆盖
  // 东向约 167 000~833 000 m，东向 0~100 000 m 的区域落在带外，
  // 根本不存在，因此不分配字母。
  const index = Math.floor(easting / SQUARE_100KM) - 1;
  const set = MGRS_COL_SETS[setIndex];
  return set[Math.min(set.length - 1, Math.max(0, index))];
}

/**
 * 计算 10 万米方格的行字母。
 *
 * 行字母采用 **AA 方案（MGRS-New）**，这是 WGS84 及现代大地基准使用的方案：
 * 赤道以北第一行的行字母在**奇数带为 A、偶数带为 F**（即偶数带整体偏移 5 个字母）。
 * 之后每向北 100 km 递增一个字母，按 20 个字母的序列循环。
 *
 * 之所以让相邻带错开，是为了避免相邻带在相同北坐标上使用相同字母，
 * 减少口头传递时的混淆（与列字母每 3 带循环是同样的设计意图）。
 *
 * 另有 AL 方案（MGRS-Old）用于较旧的大地基准，其奇数带起 L、偶数带起 R，
 * 本项目只支持 WGS84，因此不实现。
 */
function rowLetter(zone: number, northing: number): string {
  const index = rowLetterIndex(zone, northing);
  return MGRS_ROW_SET[index];
}

/**
 * 计算行字母在 20 字母序列中的下标。
 *
 * @param zone UTM 带号（决定奇偶偏移量）
 * @param northing 带内北向坐标（南半球含 10 000 000 m 偏移，
 *                 由于该偏移是行循环周期 2 000 000 m 的整数倍，不影响取模结果）
 */
function rowLetterIndex(zone: number, northing: number): number {
  // 偶数带起始字母为 F（下标 5），奇数带为 A（下标 0）
  const parityOffset = zone % 2 === 0 ? 5 : 0;
  const rowNumber = Math.floor(northing / SQUARE_100KM);
  return (
    (((rowNumber + parityOffset) % MGRS_ROW_SET.length) + MGRS_ROW_SET.length) % MGRS_ROW_SET.length
  );
}

/**
 * 列字母 → 该列西边界的东向坐标（单位：米）。
 *
 * 是 columnLetter 的逆运算，注意要 +1 还原被减掉的偏移。
 */
function columnBaseEasting(zone: number, letter: string): number {
  const setIndex = (zone - 1) % 3;
  return (MGRS_COL_SETS[setIndex].indexOf(letter.toUpperCase()) + 1) * SQUARE_100KM;
}

/**
 * 行字母 → 该行南边界的北向坐标（单位：米）。
 *
 * 由于行字母每 2000 km 循环一次，需要结合纬度带确定使用第几个循环，
 * 使得解算结果的纬度落在给定纬度带内。
 */
function rowBaseNorthing(zone: number, band: string, letter: string): number {
  const rowIndex = MGRS_ROW_SET.indexOf(letter.toUpperCase());
  if (rowIndex < 0) {
    throw new RangeError(`非法的 MGRS 行字母：${letter}`);
  }

  // 由行字母反推行号：抵消偶数带的 5 字母偏移后取模
  const parityOffset = zone % 2 === 0 ? 5 : 0;
  const rowNumber =
    (((rowIndex - parityOffset) % MGRS_ROW_SET.length) + MGRS_ROW_SET.length) % MGRS_ROW_SET.length;

  // 以纬度带中心纬度在带内的北向坐标作为"锚点"。
  //
  // ⚠️ 关键：锚点必须使用与编码时**相同的半球约定**。南半球的北坐标含
  // 10 000 000 m 偏移，若这里一律按北半球计算，锚点会少 10 000 000 m；
  // 由于 10 000 000 恰好是行循环周期 2 000 000 的 5 倍，行字母查表结果
  // 虽然不受影响，但反算出的基准北坐标会整整差一个偏移，导致纬度解算错误。
  const southern = isSouthernBand(band);
  const bandSouth = mgrsBandSouthLatitude(band);
  // X 带跨 12°（其余带跨 8°），因此中心纬度要加 6° 而不是 4°
  const bandCenterLat = bandSouth + (band.toUpperCase() === 'X' ? 6 : 4);
  const anchor = tmForward(
    { lon: utmCentralMeridian(zone), lat: bandCenterLat },
    utmParams({ number: zone, hemisphere: southern ? 'S' : 'N' }),
  ).y;

  // 在锚点 ±1000 km 范围内选取正确的行循环
  let base = rowNumber * SQUARE_100KM;
  while (base + ROW_CYCLE / 2 < anchor) base += ROW_CYCLE;
  while (base > anchor + ROW_CYCLE / 2) base -= ROW_CYCLE;
  return base;
}

/**
 * 经纬度 → MGRS 坐标（结构化）。
 *
 * @param point 经纬度
 * @param precision 精度（1/10/100/1000/10000 米），默认 1 米
 */
export function lonLatToMgrs(point: LonLat, precision = 1): MgrsCoordinate {
  const zone = mgrsZoneNumber(point.lon, point.lat);
  const band = mgrsLatBand(point.lat);
  const southern = point.lat < 0;

  const projected = tmForward(point, {
    ellipsoid: WGS84,
    centralMeridian: utmCentralMeridian(zone),
    scaleFactor: UTM_SCALE_FACTOR,
    falseEasting: UTM_FALSE_EASTING,
    falseNorthing: southern ? UTM_FALSE_NORTHING_SOUTH : 0,
  });

  const eastingInSquare = Math.floor(projected.x % SQUARE_100KM);
  const northingInSquare = Math.floor(projected.y % SQUARE_100KM);

  return {
    zone,
    band,
    col: columnLetter(zone, projected.x),
    row: rowLetter(zone, projected.y),
    // 按精度取整：精度为 10 米时，米数需要是 10 的整数倍
    easting: Math.floor(eastingInSquare / precision) * precision,
    northing: Math.floor(northingInSquare / precision) * precision,
    precision,
  };
}

/**
 * MGRS 坐标（结构化）→ 经纬度。
 *
 * 解算结果定位在目标格的西南角；若需要格中心，可自行加上 precision/2。
 */
export function mgrsToLonLat(coord: MgrsCoordinate): LonLat {
  const southern = MGRS_LAT_BANDS.indexOf(coord.band.toUpperCase()) < MGRS_LAT_BANDS.indexOf('N');

  const easting = columnBaseEasting(coord.zone, coord.col) + coord.easting;
  const northing = rowBaseNorthing(coord.zone, coord.band, coord.row) + coord.northing;

  return tmInverse(
    { x: easting, y: northing },
    utmParams({ number: coord.zone, hemisphere: southern ? 'S' : 'N' }),
  );
}

/**
 * 把结构化 MGRS 坐标格式化为标准字符串。
 *
 * 数字位数由精度决定：1 米→5 位，10 米→4 位，100 米→3 位，
 * 1000 米→2 位，10000 米→1 位，100000 米→0 位。
 *
 * @example
 * formatMgrs({ zone: 33, band: 'U', col: 'X', row: 'P', easting: 5004, northing: 49998, precision: 1 })
 * // => "33UXP0500449998"
 */
export function formatMgrs(coord: MgrsCoordinate, spaced = false): string {
  const digits = precisionToDigits(coord.precision);
  const e = String(Math.floor(coord.easting / coord.precision)).padStart(digits, '0');
  const n = String(Math.floor(coord.northing / coord.precision)).padStart(digits, '0');
  const head = `${coord.zone}${coord.band}${coord.col}${coord.row}`;

  if (!spaced || digits === 0) return head + e + n;
  // 分组书写更利于人工核对：33U XP 05004 49998
  return `${coord.zone}${coord.band} ${coord.col}${coord.row} ${e} ${n}`;
}

/** 精度（米）→ 单轴数字位数 */
function precisionToDigits(precision: number): number {
  return Math.max(0, 5 - Math.round(Math.log10(precision)));
}

/** 数字位数 → 精度（米） */
function digitsToPrecision(digits: number): number {
  return Math.pow(10, 5 - digits);
}

/**
 * 解析 MGRS 字符串。
 *
 * 支持带空格（"33U XP 05004 49998"）与不带空格（"33UXP0500449998"）两种写法，
 * 数字部分必须是偶数位，且每轴不超过 5 位。
 */
export function parseMgrs(input: string): MgrsCoordinate {
  const compact = input.toUpperCase().replace(/\s+/g, '');

  // 带号 1~2 位 + 纬度带字母 + 列字母 + 行字母 + 0~10 位数字
  const match = /^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z])([A-HJ-NP-V])(\d{0,10})$/.exec(compact);
  if (!match) {
    throw new SyntaxError(`无法解析的 MGRS 坐标：${input}`);
  }

  const [, zoneRaw, band, col, row, digitsRaw] = match;

  const zone = Number(zoneRaw);
  if (zone < 1 || zone > 60) {
    throw new RangeError(`MGRS 带号超出范围：${zone}`);
  }
  if (digitsRaw.length % 2 !== 0) {
    throw new SyntaxError(`MGRS 坐标的数字位数必须为偶数：${input}`);
  }

  const digits = digitsRaw.length / 2;
  const precision = digitsToPrecision(digits);
  const easting = digits === 0 ? 0 : Number(digitsRaw.slice(0, digits)) * precision;
  const northing = digits === 0 ? 0 : Number(digitsRaw.slice(digits)) * precision;

  return { zone, band, col, row, easting, northing, precision };
}

/**
 * 便捷方法：经纬度 → MGRS 字符串。
 *
 * @param point 经纬度
 * @param precision 精度（米），默认 1 米
 * @param spaced 是否按 "33U XP 05004 49998" 分组书写
 */
export function lonLatToMgrsString(point: LonLat, precision = 1, spaced = false): string {
  return formatMgrs(lonLatToMgrs(point, precision), spaced);
}

/**
 * 便捷方法：MGRS 字符串 → 经纬度。
 */
export function mgrsStringToLonLat(input: string): LonLat {
  return mgrsToLonLat(parseMgrs(input));
}

/** 判断某个纬度带字母是否位于南半球（带字母在 'N' 之前即为南半球） */
export function isSouthernBand(band: string): boolean {
  return MGRS_LAT_BANDS.indexOf(band.toUpperCase()) < MGRS_LAT_BANDS.indexOf('N');
}

/**
 * MGRS 坐标 → 同一点的 UTM 平面坐标（用于与 UTM 网格叠加层对齐绘制）。
 *
 * @returns 带内平面坐标，以及该坐标所属的 UTM 半球
 */
export function mgrsToUtm(coord: MgrsCoordinate): { x: number; y: number; hemisphere: 'N' | 'S' } {
  return {
    x: columnBaseEasting(coord.zone, coord.col) + coord.easting,
    y: rowBaseNorthing(coord.zone, coord.band, coord.row) + coord.northing,
    hemisphere: isSouthernBand(coord.band) ? 'S' : 'N',
  };
}
