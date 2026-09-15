/**
 * 文档对象的构造工厂。
 *
 * 集中管理 id 生成与默认值，避免上层各处散落 `Math.random()`，
 * 也让「一份空文档长什么样」有唯一答案。
 */

import { formatSidc } from '../symbology';
import type { Sidc } from '../symbology';
import {
  GeometryKind,
  LayerKind,
  LayerStatus,
  type AreaGeometry,
  type FeatureGeometry,
  type FeatureStyle,
  type FeatureTextFields,
  type GraphicParams,
  type Layer,
  type LineGeometry,
  type MapDocument,
  type MapFeature,
  type PointGeometry,
  type SymbolKind,
  type TacticalGraphicType,
} from './types';
import { CURRENT_SCHEMA_VERSION } from './migrate';

/** id 前缀，便于在调试时区分对象类型 */
const ID_PREFIX = {
  layer: 'lyr',
  feature: 'ft',
} as const;

/**
 * 生成带前缀的唯一标识。
 *
 * 采用「时间戳 + 随机串」而非纯随机数：时间戳保证同一毫秒内创建的
 * 对象大致有序，随机串保证跨会话不冲突。
 */
export function createId(prefix: string): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${random}`;
}

/** 创建点几何 */
export function createPointGeometry(lon: number, lat: number): PointGeometry {
  return { kind: GeometryKind.Point, position: { lon, lat } };
}

/** 创建线几何 */
export function createLineGeometry(points: { lon: number; lat: number }[]): LineGeometry {
  return { kind: GeometryKind.Line, points: [...points] };
}

/** 创建面几何 */
export function createAreaGeometry(points: { lon: number; lat: number }[]): AreaGeometry {
  return { kind: GeometryKind.Area, points: [...points] };
}

/** 创建要素的参数 */
export interface CreateFeatureParams {
  /** 所属图层标识 */
  layerId: string;
  /** 符号标识，可传结构化对象或 20 位字符串 */
  sidc: Sidc | string;
  /** 显示名称，省略时取符号的中文名 */
  name?: string;
  /** 几何 */
  geometry: FeatureGeometry;
  /** 文本修饰符 */
  textFields?: FeatureTextFields;
  /** 样式覆盖 */
  style?: FeatureStyle;
  /** 机动方向方位角 */
  direction?: number;
  /** 符号形态 */
  symbolKind?: SymbolKind;
  /** 战术图形种类 */
  graphicType?: TacticalGraphicType;
  /** 战术图形参数 */
  graphicParams?: GraphicParams;
}

/**
 * 创建要素。
 *
 * `createdAt` 与 `updatedAt` 取同一时刻，符合"新建即未修改"的语义。
 */
export function createFeature(params: CreateFeatureParams): MapFeature {
  const sidc = typeof params.sidc === 'string' ? params.sidc : formatSidc(params.sidc);
  const now = Date.now();

  return {
    id: createId(ID_PREFIX.feature),
    layerId: params.layerId,
    sidc,
    name: params.name ?? '',
    geometry: params.geometry,
    textFields: params.textFields ?? {},
    style: params.style,
    direction: params.direction,
    symbolKind: params.symbolKind,
    graphicType: params.graphicType,
    graphicParams: params.graphicParams === undefined ? undefined : { ...params.graphicParams },
    createdAt: now,
    updatedAt: now,
  };
}

/** 创建图层的参数 */
export interface CreateLayerParams {
  /** 图层名称 */
  name: string;
  /** 排序序号，数值越大越靠上；省略时取当前最大序号加一 */
  order?: number;
  /** 是否可见，默认 true */
  visible?: boolean;
  /** 不透明度，默认 1 */
  opacity?: number;
  /** 图层工作状态，默认正在标绘 */
  status?: Layer['status'];
  /** 图层种类，默认要素图层 */
  kind?: Layer['kind'];
  /** 兵棋分组标识 */
  group?: string;
}

/** 创建图层 */
export function createLayer(params: CreateLayerParams): Layer {
  return {
    id: createId(ID_PREFIX.layer),
    name: params.name,
    visible: params.visible ?? true,
    locked: false,
    opacity: params.opacity ?? 1,
    order: params.order ?? 0,
    status: params.status ?? LayerStatus.Working,
    kind: params.kind ?? LayerKind.Feature,
    group: params.group,
  };
}

/**
 * 创建一份空白文档，并附带一个默认图层。
 *
 * @param name 文档名称
 */
export function createDocument(name = '未命名标图'): MapDocument {
  const now = Date.now();
  const defaultLayer = createLayer({ name: '默认图层', order: 0 });

  return {
    name,
    layers: [defaultLayer],
    features: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

/**
 * 复制要素并生成新的 id 与时间戳。
 *
 * @param feature 源要素
 * @param overrides 需要覆盖的字段
 */
export function cloneFeature(feature: MapFeature, overrides: Partial<MapFeature> = {}): MapFeature {
  const now = Date.now();
  const source = { ...feature, ...overrides };

  return {
    ...source,
    geometry: cloneGeometry(source.geometry),
    textFields: { ...source.textFields },
    style: source.style ? { ...source.style } : undefined,
    vertexBearings: source.vertexBearings ? [...source.vertexBearings] : undefined,
    graphicParams: source.graphicParams ? { ...source.graphicParams } : undefined,
    id: createId(ID_PREFIX.feature),
    createdAt: now,
    updatedAt: now,
  };
}

/** 深复制几何中的全部可变坐标，避免副本与源要素共享嵌套引用。 */
function cloneGeometry(geometry: FeatureGeometry): FeatureGeometry {
  if (geometry.kind === GeometryKind.Point) {
    return { ...geometry, position: { ...geometry.position } };
  }

  return { ...geometry, points: geometry.points.map((point) => ({ ...point })) };
}
