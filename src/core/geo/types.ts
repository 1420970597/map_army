/**
 * 地理计算基础类型定义。
 *
 * 本模块只描述"数据形状"，不包含任何算法，方便被 UI 层与算法层共同引用。
 */

/** 经纬度坐标（WGS84 大地坐标），单位：度 */
export interface LonLat {
  /** 经度，取值范围 [-180, 180] */
  lon: number;
  /** 纬度，取值范围 [-90, 90] */
  lat: number;
}

/** 平面投影坐标，单位：米 */
export interface XY {
  /** 东向坐标（Easting） */
  x: number;
  /** 北向坐标（Northing） */
  y: number;
}

/** 三维地心直角坐标，单位：米 */
export interface XYZ {
  x: number;
  y: number;
  z: number;
}

/** 参考椭球体参数 */
export interface Ellipsoid {
  /** 长半轴，单位：米 */
  a: number;
  /** 扁率 f = (a - b) / a */
  f: number;
}

/** UTM 投影带信息 */
export interface UtmZone {
  /**
   * 带号，取值范围 1..60。
   * 带 n 覆盖经度 [-180 + 6*(n-1), -180 + 6*n]，中央子午线为 -180 + 6*n - 3。
   */
  number: number;
  /** 半球指示：'N' 北半球，'S' 南半球 */
  hemisphere: 'N' | 'S';
}

/** MGRS 坐标的完整结构化表示 */
export interface MgrsCoordinate {
  /** UTM 带号 1..60 */
  zone: number;
  /** 纬度带字母（C..X，不含 I、O） */
  band: string;
  /** 10 万米方格列字母 */
  col: string;
  /** 10 万米方格行字母 */
  row: string;
  /** 方格内东向米数 0..99999 */
  easting: number;
  /** 方格内北向米数 0..99999 */
  northing: number;
  /** 精度（1 / 10 / 100 / 1000 / 10000 米） */
  precision: number;
}

/** 军网类型：MGRS / UTM / 英国国家格网 */
export type GridType = 'MGRS' | 'UTM' | 'BNG' | 'WGS84' | 'GARS' | 'LV95' | 'LV03' | 'HEX';

/** 网格线的一段折线（用于绘制） */
export interface GridLine {
  /** 折线顶点（经纬度序列） */
  path: LonLat[];
  /** 标签文本，例如 "32U" 或 "450000" */
  label: string;
  /**
   * 层级：0 表示最粗的网格（如 MGRS 的 10 万米格），
   * 数字越大表示越细的网格。用于按缩放级别控制显示密度。
   */
  level: number;
}

/**
 * 网格渲染级别。
 *
 * 与地图缩放级别对应，缩放越大显示越细的网格，
 * 避免在小比例尺下把所有密网格都画出来导致卡顿。
 *
 * 说明：此处使用 `const` 对象而非 `enum`，以兼容 `erasableSyntaxOnly` 编译选项
 * （该选项要求代码中不出现需要运行时语义的 TypeScript 语法）。
 */
export const GridScale = {
  /** 10 万米格（MGRS 的 GZD + 100 km 方格） */
  Square100Km: 0,
  /** 1 万米格 */
  Square10Km: 1,
  /** 1 千米格 */
  Square1Km: 2,
  /** 100 米格 */
  Square100M: 3,
  /** 10 米格 */
  Square10M: 4,
} as const;

/** 网格渲染级别的类型 */
export type GridScale = (typeof GridScale)[keyof typeof GridScale];
