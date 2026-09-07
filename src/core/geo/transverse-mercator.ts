import type { Ellipsoid, LonLat, XY } from './types';
import {
  DEG_TO_RAD,
  RAD_TO_DEG,
  eccentricitySquared,
  rectifyingRadius,
  thirdFlattening,
} from './constants';

/**
 * 横轴墨卡托（Transverse Mercator）投影正算 / 反算。
 *
 * 实现采用 Krüger 级数（Karney, C.F.F. 2011《Transverse Mercator with an
 * accuracy of a few nanometers》），展开到 n 的 6 阶。
 * 相比传统的 Redfearn 级数，Krüger 级数在离中央子午线 ±3.5° 范围内
 * 精度可达纳米级，足以支撑 MGRS 1 米甚至 0.1 米的定位精度要求。
 *
 * 之所以自己实现而不依赖 proj4，原因有三：
 *   1. 只需要横轴墨卡托一种投影，无需引入完整的投影库；
 *   2. 便于在浏览器中对网格线做高性能批量换算；
 *   3. 纯函数实现，易于编写确定性的单元测试。
 */

/** Krüger 级数展开项数量（n 的 6 阶） */
const KRUGER_ORDER = 6;

/**
 * 等角纬度反算的最大迭代次数。
 *
 * 收敛率约为 1 − e² ≈ 0.0067（见 inverseConformalTangent 的推导），
 * 即每次迭代约获得 2.2 个十进制有效位，10 次远超双精度所需。
 */
const MAX_ITERATIONS = 10;

/** 迭代收敛阈值（相对量，约为双精度 epsilon 的 200 倍） */
const ITERATION_TOLERANCE = 1e-12;

/** 缓存已计算过的椭球系数，避免每次投影都重新展开级数 */
interface KrugerCoefficients {
  /** 正算系数 α[0..5] */
  alpha: Float64Array;
  /** 反算系数 β[0..5] */
  beta: Float64Array;
  /** 归化半径 A */
  rectifyingRadius: number;
  /** 第一偏心率 e */
  e: number;
}

const coefficientCache = new WeakMap<Ellipsoid, KrugerCoefficients>();

/**
 * 计算（并缓存）指定椭球的 Krüger 级数系数。
 *
 * 系数只与椭球有关，与具体坐标无关，因此用 WeakMap 按椭球对象缓存，
 * 在保证不内存泄漏的前提下消除重复计算。
 */
function getCoefficients(ellipsoid: Ellipsoid): KrugerCoefficients {
  const cached = coefficientCache.get(ellipsoid);
  if (cached) return cached;

  const n = thirdFlattening(ellipsoid);
  const n2 = n * n;
  const n3 = n2 * n;
  const n4 = n2 * n2;
  const n5 = n4 * n;
  const n6 = n3 * n3;

  // 正算系数 α：由克拉索夫斯基方法推导，展开到 n^6
  const alpha = new Float64Array(KRUGER_ORDER);
  alpha[0] =
    n / 2 - (2 * n2) / 3 + (5 * n3) / 16 + (41 * n4) / 180 - (127 * n5) / 288 + (7891 * n6) / 37800;
  alpha[1] =
    (13 * n2) / 48 - (3 * n3) / 5 + (557 * n4) / 1440 + (281 * n5) / 630 - (1983433 * n6) / 1935360;
  alpha[2] = (61 * n3) / 240 - (103 * n4) / 140 + (15061 * n5) / 26880 + (167603 * n6) / 181440;
  alpha[3] = (49561 * n4) / 161280 - (179 * n5) / 168 + (6601661 * n6) / 7257600;
  alpha[4] = (34729 * n5) / 80640 - (3418889 * n6) / 1995840;
  alpha[5] = (212378941 * n6) / 319334400;

  // 反算系数 β：α 的级数反演结果
  const beta = new Float64Array(KRUGER_ORDER);
  beta[0] =
    n / 2 - (2 * n2) / 3 + (37 * n3) / 96 - n4 / 360 - (81 * n5) / 512 + (96199 * n6) / 604800;
  beta[1] = n2 / 48 + n3 / 15 - (437 * n4) / 1440 + (46 * n5) / 105 - (1118711 * n6) / 3870720;
  beta[2] = (17 * n3) / 480 - (37 * n4) / 840 - (209 * n5) / 4480 + (5569 * n6) / 90720;
  beta[3] = (4397 * n4) / 161280 - (11 * n5) / 504 - (830251 * n6) / 7257600;
  beta[4] = (4583 * n5) / 161280 - (108847 * n6) / 3991680;
  beta[5] = (20648693 * n6) / 638668800;

  const coefficients: KrugerCoefficients = {
    alpha,
    beta,
    rectifyingRadius: rectifyingRadius(ellipsoid),
    e: Math.sqrt(eccentricitySquared(ellipsoid)),
  };

  coefficientCache.set(ellipsoid, coefficients);
  return coefficients;
}

/**
 * 大地纬度 → 等角纬度（Conformal Latitude）的正切值 τ′。
 *
 * 等角纬度是保角投影的中间变量：把椭球面上的点映射到"等角球面"上，
 * 之后的所有级数展开都在球面上进行，从而保证投影的保角性质。
 */
function conformalTangent(tau: number, e: number): number {
  // σ = sinh(e · atanh(e·τ / √(1+τ²)))
  const sigma = Math.sinh(e * Math.atanh((e * tau) / Math.sqrt(1 + tau * tau)));
  // τ′ = τ·√(1+σ²) − σ·√(1+τ²)
  return tau * Math.sqrt(1 + sigma * sigma) - sigma * Math.sqrt(1 + tau * tau);
}

/**
 * 等角纬度正切值 τ′ → 大地纬度正切值 τ（不动点迭代）。
 *
 * 变换 τ′ = τ·√(1+σ²) − σ·√(1+τ²) 没有闭式反函数，需要迭代求解。
 *
 * 这里刻意采用"不动点迭代"而非牛顿法：
 *
 *     τ ← τ + (τ′ − τ′(τ))
 *
 * 其收敛性由 dτ′/dτ 决定。对小的偏心率（WGS84 的 e² ≈ 0.0067），
 * 在全纬度范围内恒有 dτ′/dτ ≈ 1 − e² ≈ 0.9933，
 * 因此迭代误差以 1 − dτ′/dτ ≈ 0.0067 的比率衰减——
 * 每次迭代获得约 2.2 个十进制有效位，且**收敛率几乎与纬度无关**，
 * 在高纬度（τ 很大）也不会退化。
 *
 * 实践中曾尝试过 Newton 法，但 τ′(τ) 的解析导数含高阶小量，
 * 一旦导数表达式有细微偏差，迭代在高纬度会直接发散（τ 越大越严重）。
 * 不动点迭代虽然线性收敛，但胜在形式简单、没有可写错的导数项，
 * 10 次迭代即可达到双精度极限，是本场景下的更优选择。
 */
function inverseConformalTangent(tauPrime: number, e: number): number {
  // 初值取 τ′/(1−e²)：这是忽略高阶小量后的解析近似，已非常接近真值
  let tau = tauPrime / (1 - e * e);
  const tolerance = ITERATION_TOLERANCE * Math.max(1, Math.abs(tauPrime));

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const hypotenuseTau = Math.sqrt(1 + tau * tau);
    const sigma = Math.sinh(e * Math.atanh((e * tau) / hypotenuseTau));

    // 当前 τ 对应的 τ′（即正算公式）
    const tauPrimeApprox = tau * Math.sqrt(1 + sigma * sigma) - sigma * hypotenuseTau;

    const deltaTau = tauPrime - tauPrimeApprox;
    tau += deltaTau;

    if (Math.abs(deltaTau) < tolerance) break;
  }

  return tau;
}

/** 横轴墨卡托投影的构造参数 */
export interface TransverseMercatorParams {
  /** 参考椭球 */
  ellipsoid: Ellipsoid;
  /** 中央子午线经度，单位：度 */
  centralMeridian: number;
  /** 中央子午线缩放因子 */
  scaleFactor: number;
  /** 东向偏移量（False Easting），单位：米 */
  falseEasting: number;
  /** 北向偏移量（False Northing），单位：米 */
  falseNorthing: number;
  /**
   * 自然原点纬度（Latitude of natural origin），单位：度，默认 0。
   *
   * UTM 的原点在赤道上，因此为 0；而英国国家格网（BNG）的原点在 49°N，
   * 北坐标是从该纬度起算的，必须传入 49 才能得到正确结果。
   */
  originLatitude?: number;
}

/** 子午线弧长缓存：椭球 + 纬度 → 从赤道起算的弧长（米） */
const meridianArcCache = new Map<string, number>();

/**
 * 计算从赤道到指定纬度（经差为 0）的子午线弧长，单位：米。
 *
 * 等价于 Krüger 归一化坐标在该处的取值 A·ξ(φ, 0)。
 * 当投影的自然原点不在赤道上时（如 BNG 的 49°N），
 * 需要用该值把北坐标的原点从赤道平移到原点纬度。
 *
 * 结果按「椭球 + 纬度」缓存：网格生成时会以同一原点纬度反复调用，
 * 缓存可以避免每个点都重新展开一次级数。
 */
export function meridianArcToLatitude(lat: number, ellipsoid: Ellipsoid): number {
  const key = `${ellipsoid.a}|${ellipsoid.f}|${lat}`;
  const cached = meridianArcCache.get(key);
  if (cached !== undefined) return cached;

  const { alpha, rectifyingRadius: A, e } = getCoefficients(ellipsoid);
  const tau = Math.tan(lat * DEG_TO_RAD);
  const tauPrime = conformalTangent(tau, e);

  // 经差为 0 时 ξ′ = atan(τ′)，且 cosh(2j·η′) = cosh(0) = 1
  const xiPrime = Math.atan(tauPrime);
  let xi = xiPrime;
  for (let j = 1; j <= KRUGER_ORDER; j += 1) {
    xi += alpha[j - 1] * Math.sin(2 * j * xiPrime);
  }

  const value = A * xi;
  meridianArcCache.set(key, value);
  return value;
}

/** 横轴墨卡托投影正算：经纬度 → 平面坐标 */
export function tmForward(point: LonLat, params: TransverseMercatorParams): XY {
  const {
    ellipsoid,
    centralMeridian,
    scaleFactor,
    falseEasting,
    falseNorthing,
    originLatitude = 0,
  } = params;
  const { alpha, rectifyingRadius: A, e } = getCoefficients(ellipsoid);
  // 原点不在赤道上时，需要扣掉赤道到原点纬度的那段子午线弧长
  const arcOffset = originLatitude === 0 ? 0 : meridianArcToLatitude(originLatitude, ellipsoid);

  const phi = point.lat * DEG_TO_RAD;
  let dLambda = (point.lon - centralMeridian) * DEG_TO_RAD;
  // 将经差规范到 [-π, π]，保证跨 180° 经线的计算结果正确
  while (dLambda > Math.PI) dLambda -= 2 * Math.PI;
  while (dLambda < -Math.PI) dLambda += 2 * Math.PI;

  const tau = Math.tan(phi);
  const tauPrime = conformalTangent(tau, e);
  const cosLambda = Math.cos(dLambda);
  const sinLambda = Math.sin(dLambda);

  // 球面归一化坐标 ξ′（对应子午线弧长方向）与 η′（对应经差方向）
  const xiPrime = Math.atan2(tauPrime, cosLambda);
  const etaPrime = Math.asinh(sinLambda / Math.hypot(tauPrime, cosLambda));

  let xi = xiPrime;
  let eta = etaPrime;
  for (let j = 1; j <= KRUGER_ORDER; j += 1) {
    const factor = 2 * j;
    xi += alpha[j - 1] * Math.sin(factor * xiPrime) * Math.cosh(factor * etaPrime);
    eta += alpha[j - 1] * Math.cos(factor * xiPrime) * Math.sinh(factor * etaPrime);
  }

  const scale = A * scaleFactor;
  return {
    x: falseEasting + scale * eta,
    y: falseNorthing + scale * xi - scaleFactor * arcOffset,
  };
}

/** 横轴墨卡托投影反算：平面坐标 → 经纬度 */
export function tmInverse(point: XY, params: TransverseMercatorParams): LonLat {
  const {
    ellipsoid,
    centralMeridian,
    scaleFactor,
    falseEasting,
    falseNorthing,
    originLatitude = 0,
  } = params;
  const { beta, rectifyingRadius: A, e } = getCoefficients(ellipsoid);
  const arcOffset = originLatitude === 0 ? 0 : meridianArcToLatitude(originLatitude, ellipsoid);

  const scale = A * scaleFactor;
  // 先把北坐标还原成"从赤道起算"的形式，再归一化
  const xi = ((point.y - falseNorthing) / scaleFactor + arcOffset) / A;
  const eta = (point.x - falseEasting) / scale;

  let xiPrime = xi;
  let etaPrime = eta;
  for (let j = 1; j <= KRUGER_ORDER; j += 1) {
    const factor = 2 * j;
    xiPrime -= beta[j - 1] * Math.sin(factor * xi) * Math.cosh(factor * eta);
    etaPrime -= beta[j - 1] * Math.cos(factor * xi) * Math.sinh(factor * eta);
  }

  const sinXiPrime = Math.sin(xiPrime);
  const cosXiPrime = Math.cos(xiPrime);
  const sinhEtaPrime = Math.sinh(etaPrime);

  const tauPrime = sinXiPrime / Math.hypot(sinhEtaPrime, cosXiPrime);
  const dLambda = Math.atan2(sinhEtaPrime, cosXiPrime);
  const tau = inverseConformalTangent(tauPrime, e);

  let lon = centralMeridian + dLambda * RAD_TO_DEG;
  // 经度规范回 [-180, 180]
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;

  return {
    lon,
    lat: Math.atan(tau) * RAD_TO_DEG,
  };
}
