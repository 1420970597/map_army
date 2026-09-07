/**
 * 标图文档的数据模型。
 *
 * 原站把一次标图的全部内容称为一份**文档（document）**，
 * 文档由若干**图层（layer）**组成，每个图层承载若干**要素（feature）**。
 * 本模型沿用这一结构，并使其可以直接序列化为 MilX 交换格式。
 */

import type { LonLat } from '../geo';
import type { Sidc } from '../symbology';

/**
 * 网格类型复用测绘模块的定义，避免同一概念出现两份不一致的取值
 * （此处不再单独定义 GridType，统一由 `@/core/geo` 提供）。
 */
export type { GridType } from '../geo';

/** 几何类型 */
export const GeometryKind = {
  /** 点：单个坐标，用于单位符号、装备、设施 */
  Point: 'point',
  /** 线：有序坐标序列，用于进攻轴线、行军路线、边界的一部分 */
  Line: 'line',
  /** 面：闭合坐标序列，用于作战地域、目标区域、禁飞区 */
  Area: 'area',
} as const;
export type GeometryKind = (typeof GeometryKind)[keyof typeof GeometryKind];

/** 点几何 */
export interface PointGeometry {
  kind: typeof GeometryKind.Point;
  /** 符号锚点经纬度 */
  position: LonLat;
}

/** 线几何 */
export interface LineGeometry {
  kind: typeof GeometryKind.Line;
  /** 折线顶点序列，至少两个点 */
  points: LonLat[];
}

/** 面几何 */
export interface AreaGeometry {
  kind: typeof GeometryKind.Area;
  /** 外环顶点序列，至少三个点，渲染时自动闭合 */
  points: LonLat[];
}

/** 任意几何 */
export type FeatureGeometry = PointGeometry | LineGeometry | AreaGeometry;

/**
 * 文本修饰符。
 *
 * 对应 MIL-STD-2525 的若干文本字段，用于在符号四周标注番号、部队代号等信息。
 */
export interface FeatureTextFields {
  /** 唯一标识（Field T），显示在符号右侧 */
  uniqueDesignation?: string;
  /** 上级编成（Field M），显示在符号左侧 */
  higherFormation?: string;
  /** 附加信息（Field H），显示在符号右下方 */
  additionalInformation?: string;
  /** 参谋注记（Field G），显示在符号左下方 */
  staffComments?: string;
}

/** 要素的样式覆盖项，未指定的字段回退到图层默认样式 */
export interface FeatureStyle {
  /** 颜色（十六进制） */
  color?: string;
  /** 线宽 */
  weight?: number;
  /** 不透明度，0 ~ 1 */
  opacity?: number;
  /** 虚线样式，如 "8 6" */
  dashArray?: string;
}

/**
 * 标图要素。
 *
 * 一个要素 = 几何 + 符号（SIDC）+ 文本修饰符 + 所属图层。
 * `sidc` 以字符串形式保存而非结构化对象，好处是序列化与比较都极其廉价，
 * 需要按字段访问时再调用符号引擎解析。
 */
export interface MapFeature {
  /** 全局唯一标识 */
  id: string;
  /** 所属图层标识 */
  layerId: string;
  /** 20 位 SIDC 字符串 */
  sidc: string;
  /** 显示名称 */
  name: string;
  /** 几何 */
  geometry: FeatureGeometry;
  /** 文本修饰符 */
  textFields: FeatureTextFields;
  /** 样式覆盖 */
  style?: FeatureStyle;
  /** 机动方向方位角（度），仅点要素有意义 */
  direction?: number;
  /** 创建时间戳（毫秒） */
  createdAt: number;
  /** 最后修改时间戳（毫秒） */
  updatedAt: number;
}

/** 图层 */
export interface Layer {
  /** 全局唯一标识 */
  id: string;
  /** 图层名称 */
  name: string;
  /** 是否可见 */
  visible: boolean;
  /** 是否锁定（锁定后不可编辑） */
  locked: boolean;
  /** 不透明度，0 ~ 1 */
  opacity: number;
  /** 排序序号，数值越大越靠上 */
  order: number;
}

/**
 * 标图文档。
 *
 * 这是应用的顶层数据对象，也是导入导出的基本单元。
 */
export interface MapDocument {
  /** 文档名称 */
  name: string;
  /** 图层列表，按 order 降序渲染 */
  layers: Layer[];
  /** 要素列表 */
  features: MapFeature[];
  /** 文档创建时间戳 */
  createdAt: number;
  /** 文档最后修改时间戳 */
  updatedAt: number;
}

/** 可用工具 */
export const Tool = {
  /** 选择/移动 */
  Select: 'select',
  /** 放置点符号 */
  Symbol: 'symbol',
  /** 绘制折线 */
  Line: 'line',
  /** 绘制多边形 */
  Area: 'area',
  /** 量距 */
  Measure: 'measure',
  /** 删除要素 */
  Delete: 'delete',
} as const;
export type Tool = (typeof Tool)[keyof typeof Tool];

/** 底图类型 */
export const BaseMapType = {
  /** 街道图 */
  Streets: 'streets',
  /** 地形图 */
  Topo: 'topo',
  /** 卫星影像 */
  Satellite: 'satellite',
} as const;
export type BaseMapType = (typeof BaseMapType)[keyof typeof BaseMapType];

/**
 * 生成要素所需的 SIDC 结构（供新建要素时使用）。
 *
 * 之所以在此处重新导出类型，是为了让上层模块只依赖 model 而不必
 * 直接依赖 symbology 的内部类型。
 */
export type { Sidc };
