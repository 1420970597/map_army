/**
 * 标图要素剪贴板纯逻辑。
 *
 * 本模块负责剪贴板载荷的序列化、校验和粘贴实例化，不依赖浏览器剪贴板或地图 UI。
 */

import type { LonLat, Pixel, Projection } from '../geo';
import { createId } from './factory';
import {
  SymbolKind,
  TacticalGraphicType,
  type FeatureGeometry,
  type FeatureStyle,
  type FeatureTextFields,
  type GraphicParams,
  type MapFeature,
} from './types';

/** 剪贴板载荷类型标识 */
export const CLIPBOARD_KIND = 'map-army/clipboard';

/** 剪贴板载荷格式版本 */
export const CLIPBOARD_VERSION = 1;

/** 默认粘贴偏移距离，单位为像素 */
export const DEFAULT_PASTE_OFFSET_PX = 24;

/**
 * 可序列化的标图剪贴板载荷。
 */
export interface ClipboardPayload {
  /** 载荷类型标识 */
  kind: typeof CLIPBOARD_KIND;
  /** 载荷格式版本 */
  version: typeof CLIPBOARD_VERSION;
  /** 被复制的要素快照 */
  features: MapFeature[];
  /** 源图层标识到图层名称的映射 */
  layerNames: Record<string, string>;
  /** 复制时的地图缩放级别 */
  zoom: number;
  /** 复制时的锚点坐标 */
  anchor: LonLat;
}

/**
 * 将剪贴板载荷实例化到目标图层时的参数。
 */
export interface MaterializeParams {
  /** 目标图层标识 */
  targetLayerId: string;
  /** 经纬度与像素坐标的双向投影 */
  projection: Projection;
  /** 单次粘贴的基础像素偏移向量 */
  offsetPx?: Pixel;
  /** 连续粘贴次数，用于递增偏移 */
  pasteCount?: number;
}

/** 判断值是否为普通对象记录。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 判断值是否为有限数值。 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 深拷贝经纬度坐标。 */
function cloneLonLat(point: LonLat): LonLat {
  return { lon: point.lon, lat: point.lat };
}

/** 深拷贝要素的可变数据。 */
function cloneFeature(feature: MapFeature): MapFeature {
  const geometry =
    feature.geometry.kind === 'point'
      ? { ...feature.geometry, position: cloneLonLat(feature.geometry.position) }
      : { ...feature.geometry, points: feature.geometry.points.map(cloneLonLat) };

  return {
    ...feature,
    geometry,
    textFields: { ...feature.textFields },
    style: feature.style === undefined ? undefined : { ...feature.style },
    vertexBearings: feature.vertexBearings === undefined ? undefined : [...feature.vertexBearings],
    graphicParams: feature.graphicParams === undefined ? undefined : { ...feature.graphicParams },
  };
}

/** 判断值是否为有限经纬度坐标。 */
function isLonLat(value: unknown): value is LonLat {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.lon) &&
    value.lon >= -180 &&
    value.lon <= 180 &&
    isFiniteNumber(value.lat) &&
    value.lat >= -90 &&
    value.lat <= 90
  );
}

/** 判断值是否为字符串映射对象。 */
function isLayerNames(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((name) => typeof name === 'string');
}

/** 判断值是否为文本修饰符对象。 */
function isTextFields(value: unknown): value is FeatureTextFields {
  return isRecord(value) && Object.values(value).every((field) => typeof field === 'string');
}

/** 判断值是否为样式覆盖对象。 */
function isStyle(value: unknown): value is FeatureStyle {
  if (!isRecord(value)) return false;
  return (
    (value.color === undefined || typeof value.color === 'string') &&
    (value.weight === undefined || isFiniteNumber(value.weight)) &&
    (value.opacity === undefined || isFiniteNumber(value.opacity)) &&
    (value.dashArray === undefined || typeof value.dashArray === 'string')
  );
}

/** 判断值是否为点、线或面的合法几何结构。 */
function isGeometry(value: unknown): value is FeatureGeometry {
  if (!isRecord(value)) return false;
  if (value.kind === 'point') return isLonLat(value.position);
  return (
    (value.kind === 'line' || value.kind === 'area') &&
    Array.isArray(value.points) &&
    value.points.every(isLonLat)
  );
}

/** 判断逐顶点方向数组是否只含合法手动方向或自动方向占位。 */
const GRAPHIC_PARAM_KEYS = [
  'widthRatio',
  'headRatio',
  'toothRatio',
  'toothSpacingRatio',
  'tickRatio',
  'tickSpacingRatio',
  'hatchSpacingRatio',
  'corridorWidthMeters',
  'phaseWingRatio',
  'smooth',
] as const;

/** 判断图形参数是否为可安全复制的有限数值与布尔值。 */
function isGraphicParams(value: unknown): value is GraphicParams {
  if (!isRecord(value)) return false;
  return GRAPHIC_PARAM_KEYS.every((key) => {
    const item = value[key];
    return (
      item === undefined || (key === 'smooth' ? typeof item === 'boolean' : isFiniteNumber(item))
    );
  });
}

/** 判断值是否为已知符号形态。 */
function isSymbolKind(value: unknown): value is MapFeature['symbolKind'] {
  return value === SymbolKind.Single || value === SymbolKind.MultiPoint;
}

/** 判断值是否为已知战术图形种类。 */
function isGraphicType(value: unknown): value is MapFeature['graphicType'] {
  return Object.values(TacticalGraphicType).includes(value as TacticalGraphicType);
}

function isVertexBearings(value: unknown): value is unknown[] {
  return (
    Array.isArray(value) &&
    value.every((bearing) => bearing === undefined || bearing === null || isFiniteNumber(bearing))
  );
}

/** 把 JSON 中的 null 自动方向占位还原为稀疏数组槽位。 */
function normalizeVertexBearings(bearings: unknown[]): number[] {
  const normalized = new Array<number>(bearings.length);
  for (let index = 0; index < bearings.length; index += 1) {
    const bearing = bearings[index];
    if (isFiniteNumber(bearing)) normalized[index] = bearing;
  }
  return normalized;
}

/** 已完成基础结构校验、但方向数组仍可能含 JSON null 的外部要素。 */
type ParsedMapFeature = Omit<MapFeature, 'vertexBearings'> & { vertexBearings?: unknown[] };

/** 判断值是否为可安全复制的标图要素。 */
function isMapFeature(value: unknown): value is ParsedMapFeature {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.layerId === 'string' &&
    typeof value.sidc === 'string' &&
    typeof value.name === 'string' &&
    isGeometry(value.geometry) &&
    isTextFields(value.textFields) &&
    (value.style === undefined || isStyle(value.style)) &&
    (value.direction === undefined || isFiniteNumber(value.direction)) &&
    (value.vertexBearings === undefined || isVertexBearings(value.vertexBearings)) &&
    (value.symbolKind === undefined || isSymbolKind(value.symbolKind)) &&
    (value.graphicType === undefined || isGraphicType(value.graphicType)) &&
    (value.graphicParams === undefined || isGraphicParams(value.graphicParams)) &&
    isFiniteNumber(value.createdAt) &&
    isFiniteNumber(value.updatedAt)
  );
}

/** 规范化已经过结构校验的要素可选数组字段。 */
function normalizeMapFeature(feature: ParsedMapFeature): MapFeature {
  const { vertexBearings, ...baseFeature } = feature;
  const normalized = {
    ...baseFeature,
    graphicParams:
      baseFeature.graphicParams === undefined ? undefined : { ...baseFeature.graphicParams },
  };
  if (vertexBearings === undefined) return normalized;
  return {
    ...normalized,
    vertexBearings: normalizeVertexBearings(vertexBearings),
  };
}

/**
 * 将要素序列化为与运行时状态隔离的剪贴板载荷。
 *
 * @param features 待复制的要素
 * @param layerNames 源图层名称映射
 * @param anchor 复制锚点
 * @param zoom 复制时缩放级别
 * @returns 可安全保存或 JSON 序列化的剪贴板载荷
 */
export function serializeClipboard(
  features: readonly MapFeature[],
  layerNames: Readonly<Record<string, string>>,
  anchor: LonLat,
  zoom: number,
): ClipboardPayload {
  return {
    kind: CLIPBOARD_KIND,
    version: CLIPBOARD_VERSION,
    features: features.map(cloneFeature),
    layerNames: { ...layerNames },
    anchor: cloneLonLat(anchor),
    zoom,
  };
}

/**
 * 解析并校验 JSON 剪贴板内容。
 *
 * @param raw 外部获得的 JSON 文本
 * @returns 合法且已深拷贝的剪贴板载荷；内容无效时返回 null
 */
export function parseClipboard(raw: string | null): ClipboardPayload | null {
  if (raw === null) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(value)) return null;
  const { kind, version, features, layerNames, zoom, anchor } = value;
  if (
    kind !== CLIPBOARD_KIND ||
    version !== CLIPBOARD_VERSION ||
    !Array.isArray(features) ||
    !features.every(isMapFeature) ||
    !isLayerNames(layerNames) ||
    !isFiniteNumber(zoom) ||
    !isLonLat(anchor)
  ) {
    return null;
  }

  return serializeClipboard(features.map(normalizeMapFeature), layerNames, anchor, zoom);
}

/** 将一个经纬度坐标按像素偏移平移。 */
function offsetPoint(point: LonLat, projection: Projection, offset: Pixel): LonLat {
  const pixel = projection.toPixel(point);
  return projection.toLonLat({ x: pixel.x + offset.x, y: pixel.y + offset.y });
}

/** 根据粘贴次数生成显示名称。 */
function pastedName(name: string, pasteCount: number): string {
  const baseName = name.length === 0 ? '副本' : `${name} 副本`;
  return pasteCount >= 2 ? `${baseName} (${pasteCount})` : baseName;
}

/** 规范化连续粘贴次数。 */
function normalizedPasteCount(pasteCount: number | undefined): number {
  if (pasteCount === undefined || !Number.isFinite(pasteCount)) return 1;
  return Math.max(1, Math.trunc(pasteCount));
}

/**
 * 将剪贴板载荷复制为目标图层中的新要素。
 *
 * @param payload 已校验的剪贴板载荷
 * @param params 目标图层、投影与偏移参数
 * @returns 带有新标识、更新时间和整体像素偏移的新要素数组
 */
export function materializeClipboard(
  payload: ClipboardPayload,
  params: MaterializeParams,
): MapFeature[] {
  const pasteCount = normalizedPasteCount(params.pasteCount);
  const baseOffset = params.offsetPx ?? {
    x: DEFAULT_PASTE_OFFSET_PX,
    y: DEFAULT_PASTE_OFFSET_PX,
  };
  const offset = { x: baseOffset.x * pasteCount, y: baseOffset.y * pasteCount };
  const now = Date.now();

  return payload.features.map((source) => {
    const feature = cloneFeature(source);
    const geometry =
      feature.geometry.kind === 'point'
        ? {
            ...feature.geometry,
            position: offsetPoint(feature.geometry.position, params.projection, offset),
          }
        : {
            ...feature.geometry,
            points: feature.geometry.points.map((point) =>
              offsetPoint(point, params.projection, offset),
            ),
          };

    return {
      ...feature,
      id: createId('ft'),
      layerId: params.targetLayerId,
      name: pastedName(feature.name, pasteCount),
      geometry,
      createdAt: now,
      updatedAt: now,
    };
  });
}
