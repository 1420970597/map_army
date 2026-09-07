import type { Ellipsoid } from './types';

/**
 * 常用参考椭球体与数学常量。
 *
 * 所有测地计算统一使用弧度制，对外接口使用角度制，
 * 转换只在模块边界进行，避免中间过程反复换算造成精度损失。
 */

/** 圆周率 π */
export const PI = Math.PI;

/** 角度转弧度系数 */
export const DEG_TO_RAD = PI / 180;

/** 弧度转角度系数 */
export const RAD_TO_DEG = 180 / PI;

/** WGS84 椭球（GPS 与本项目默认椭球） */
export const WGS84: Ellipsoid = {
  a: 6378137.0,
  f: 1 / 298.257223563,
};

/** Airy 1830 椭球（英国国家格网 BNG 使用） */
export const AIRY_1830: Ellipsoid = {
  a: 6377563.396,
  f: 1 / 299.3249646,
};

/** GRS80 椭球 */
export const GRS80: Ellipsoid = {
  a: 6378137.0,
  f: 1 / 298.257222101,
};

/** 由长半轴与扁率推算短半轴 */
export function semiMinorAxis(ellipsoid: Ellipsoid): number {
  return ellipsoid.a * (1 - ellipsoid.f);
}

/** 第一偏心率平方 e² = f(2 - f) */
export function eccentricitySquared(ellipsoid: Ellipsoid): number {
  return ellipsoid.f * (2 - ellipsoid.f);
}

/** 第三扁率 n = f / (2 - f)，Krüger 级数展开的核心参数 */
export function thirdFlattening(ellipsoid: Ellipsoid): number {
  return ellipsoid.f / (2 - ellipsoid.f);
}

/**
 * 归化半径 A（Rectifying Radius）。
 *
 * 定义为子午线周长 / 2π，即"与椭球等周长的圆球半径"。
 * Krüger 级数用它把椭球上的测地坐标归一化为米制坐标。
 */
export function rectifyingRadius(ellipsoid: Ellipsoid): number {
  const n = thirdFlattening(ellipsoid);
  const n2 = n * n;
  const n4 = n2 * n2;
  const n6 = n4 * n2;
  const n8 = n4 * n4;
  return (ellipsoid.a / (1 + n)) * (1 + n2 / 4 + n4 / 64 + n6 / 256 + (25 * n8) / 16384);
}

/**
 * MGRS 纬度带字母表。
 *
 * 每个带跨越 8° 纬度；字母 I 与 O 被跳过（避免与数字 1、0 混淆）；
 * 最后的 X 带跨越 12° 以覆盖到北极。
 */
export const MGRS_LAT_BANDS = 'CDEFGHJKLMNPQRSTUVWX' as const;

/**
 * MGRS 10 万米方格的列字母分组。
 *
 * 每 3 个 UTM 带循环一次，三组各 8 个字母，合计覆盖带内 0..800 km 的东向范围。
 * 索引 0 用于带号 ≡ 1 (mod 3)，索引 1 用于 ≡ 2，索引 2 用于 ≡ 0。
 */
export const MGRS_COL_SETS: readonly string[] = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'];

/**
 * MGRS 10 万米方格的行字母表（每 100 km 一个，每 2000 km 循环一次）。
 * 同样跳过 I 与 O，因此是 20 个字母而非 22 个。
 */
export const MGRS_ROW_SET = 'ABCDEFGHJKLMNPQRSTUV' as const;

/**
 * BNG 500 km 方格字母。
 *
 * 英国本土及周边只使用 H、N、O、S、T 五个方格，值为 [东向索引, 北向索引]，
 * 各自乘以 500 km 即为该方格西南角的国家格网坐标。
 *
 * 布局（东向 0~500 km 为第 0 列，北向 0~500 km 为第 0 行）：
 *
 * ```
 *            │ E 0~500 km │ E 500~1000 km
 *  N 1000~   │     H      │       —
 *  N  500~   │     N      │       O
 *  N    0~   │     S      │       T
 * ```
 *
 * 用三个真实坐标校验过：
 *   - 伦敦（E 530 km, N 180 km）→ T
 *   - 纽卡斯尔（E 424 km, N 565 km）→ N
 *   - 斯诺多尼亚（E 261 km, N 352 km）→ S
 */
export const BNG_500KM_LETTERS: Readonly<Record<string, [number, number]>> = {
  S: [0, 0], // 英格兰中南部与南威尔士
  T: [1, 0], // 英格兰东南部（含伦敦）
  N: [0, 1], // 英格兰北部与北威尔士（含纽卡斯尔）
  O: [1, 1], // 英格兰东北部海域
  H: [0, 2], // 苏格兰
};

/**
 * BNG 100 km 方格字母表（5×5 网格，跳过 I，共 25 个字母）。
 *
 * ⚠️ 排列顺序是 **A 在顶部、V 在底部**（与常见的"从下往上"直觉相反）：
 *
 * ```
 *  N 400~500 km │ A B C D E
 *  N 300~400 km │ F G H J K
 *  N 200~300 km │ L M N O P
 *  N 100~200 km │ Q R S T U
 *  N   0~100 km │ V W X Y Z
 * ```
 *
 * 该顺序已用伦敦验证：伦敦在方格内的北坐标约 180 km → 落在 "Q R S T U" 行，
 * 东坐标约 30 km → 第 0 列 → 组合得到 **TQ**，与真实值一致。
 */
export const BNG_100KM_LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ' as const;
