/**
 * GeoJSON 互转。
 *
 * GeoJSON 是通用GIS 交换格式，但**不携带军标语义**：
 * 它没有"身份""梯队""司令部"这类概念。本模块把 SIDC 与文本修饰符
 * 写入 feature 的 `properties`，从而在保持通用性的同时不丢失军标信息；
 * 反向转换时若存在这些属性，则还原为完整的军标要素。
 */

import type { LonLat } from '../geo';
import {
  createAreaGeometry,
  createFeature,
  createLineGeometry,
  createPointGeometry,
  GeometryKind,
  SymbolKind,
  TacticalGraphicType,
  type GraphicParams,
  type MapDocument,
  type MapFeature,
} from '../model';

/** GeoJSON 几何对象的最小类型定义，避免引入额外依赖 */
export interface GeoJsonGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | string;
  coordinates: unknown;
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: GeoJsonGeometry;
  properties: Record<string, unknown> | null;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

/** 属性键名：与 2525 字段对应，便于其他系统识别 */
const PROP_KEYS = {
  sidc: 'sidc',
  name: 'name',
  uniqueDesignation: 'uniqueDesignation',
  higherFormation: 'higherFormation',
  additionalInformation: 'additionalInformation',
  staffComments: 'staffComments',
  direction: 'direction',
  layer: 'layer',
  symbolKind: 'symbolKind',
  graphicType: 'graphicType',
  graphicParams: 'graphicParams',
} as const;

/**
 * 把文档导出为 GeoJSON 要素集合。
 *
 * @param document 待导出的文档
 * @returns GeoJSON FeatureCollection
 */
export function documentToGeoJson(document: MapDocument): GeoJsonFeatureCollection {
  const layerNameById = new Map(document.layers.map((layer) => [layer.id, layer.name]));

  return {
    type: 'FeatureCollection',
    features: document.features.map((feature) => toGeoJsonFeature(feature, layerNameById)),
  };
}

/** 把单个要素转换为 GeoJSON 要素 */
function toGeoJsonFeature(feature: MapFeature, layerNames: Map<string, string>): GeoJsonFeature {
  const geometry = feature.geometry;

  const geoGeometry: GeoJsonGeometry =
    geometry.kind === GeometryKind.Point
      ? { type: 'Point', coordinates: [geometry.position.lon, geometry.position.lat] }
      : geometry.kind === GeometryKind.Line
        ? { type: 'LineString', coordinates: geometry.points.map(toPosition) }
        : // Polygon 的 coordinates 需多包一层线性环；此处自动闭合外环
          { type: 'Polygon', coordinates: [closeRing(geometry.points).map(toPosition)] };

  return {
    type: 'Feature',
    geometry: geoGeometry,
    properties: {
      [PROP_KEYS.sidc]: feature.sidc,
      [PROP_KEYS.name]: feature.name,
      [PROP_KEYS.layer]: layerNames.get(feature.layerId) ?? '',
      ...(feature.textFields.uniqueDesignation
        ? { [PROP_KEYS.uniqueDesignation]: feature.textFields.uniqueDesignation }
        : {}),
      ...(feature.textFields.higherFormation
        ? { [PROP_KEYS.higherFormation]: feature.textFields.higherFormation }
        : {}),
      ...(feature.textFields.additionalInformation
        ? { [PROP_KEYS.additionalInformation]: feature.textFields.additionalInformation }
        : {}),
      ...(feature.textFields.staffComments
        ? { [PROP_KEYS.staffComments]: feature.textFields.staffComments }
        : {}),
      ...(feature.direction !== undefined ? { [PROP_KEYS.direction]: feature.direction } : {}),
      ...(feature.symbolKind !== undefined ? { [PROP_KEYS.symbolKind]: feature.symbolKind } : {}),
      ...(feature.graphicType !== undefined
        ? { [PROP_KEYS.graphicType]: feature.graphicType }
        : {}),
      ...(feature.graphicParams !== undefined
        ? { [PROP_KEYS.graphicParams]: { ...feature.graphicParams } }
        : {}),
    },
  };
}

/**
 * 从 GeoJSON 要素集合导入文档。
 *
 * 图层按属性中的 `layer` 字段归并，同名图层复用，缺失时归入默认图层。
 *
 * @param collection GeoJSON 要素集合
 * @param documentName 文档名称
 * @param defaultLayerId 未指定图层时使用的图层标识
 * @returns 导入结果，包含文档与被跳过要素的数量
 */
export function geoJsonToDocument(
  collection: GeoJsonFeatureCollection,
  documentName: string,
  defaultLayerId: string,
): { document: MapDocument; skipped: number } {
  const now = Date.now();
  let skipped = 0;
  const features: MapFeature[] = [];

  for (const item of collection.features ?? []) {
    const feature = fromGeoJsonFeature(item, defaultLayerId);
    if (feature) features.push(feature);
    else skipped += 1;
  }

  return {
    document: {
      name: documentName,
      // 导入的图层信息在此处不重建，统一归入默认图层；
      // 调用方若需要按 layer 属性拆分，可在导入后调用 splitByLayerProperty
      layers: [
        {
          id: defaultLayerId,
          name: '导入的要素',
          visible: true,
          locked: false,
          opacity: 1,
          order: 0,
        },
      ],
      features,
      createdAt: now,
      updatedAt: now,
    },
    skipped,
  };
}

/** 把 GeoJSON 要素转换为军标要素，几何不支持时返回 null */
function fromGeoJsonFeature(item: GeoJsonFeature, defaultLayerId: string): MapFeature | null {
  const props = item.properties ?? {};
  const sidc = typeof props[PROP_KEYS.sidc] === 'string' ? (props[PROP_KEYS.sidc] as string) : null;

  // 缺少 SIDC 时回退到一个合法的默认符号，保证要素仍可被渲染与后续编辑
  const resolvedSidc = sidc ?? '10031000000000000000';
  const name = typeof props[PROP_KEYS.name] === 'string' ? (props[PROP_KEYS.name] as string) : '';

  const geometry = item.geometry;
  let featureGeometry: MapFeature['geometry'];
  const coordinates = geometry?.coordinates;

  if (geometry?.type === 'Point' && Array.isArray(coordinates) && coordinates.length >= 2) {
    featureGeometry = createPointGeometry(Number(coordinates[0]), Number(coordinates[1]));
  } else if (
    (geometry?.type === 'LineString' || geometry?.type === 'Polygon') &&
    Array.isArray(coordinates)
  ) {
    // Polygon 的第一环即外环，LineString 的坐标序列可直接使用
    const ring = geometry.type === 'Polygon' ? (coordinates[0] as unknown[]) : coordinates;
    const points = readPositions(ring);
    if (points.length < 2) return null;

    featureGeometry =
      geometry.type === 'Polygon' && points.length >= 3
        ? createAreaGeometry(points)
        : createLineGeometry(points);
  } else {
    return null;
  }

  return createFeature({
    layerId: defaultLayerId,
    sidc: resolvedSidc,
    name,
    geometry: featureGeometry,
    textFields: {
      uniqueDesignation: stringOrUndefined(props[PROP_KEYS.uniqueDesignation]),
      higherFormation: stringOrUndefined(props[PROP_KEYS.higherFormation]),
      additionalInformation: stringOrUndefined(props[PROP_KEYS.additionalInformation]),
      staffComments: stringOrUndefined(props[PROP_KEYS.staffComments]),
    },
    direction:
      typeof props[PROP_KEYS.direction] === 'number'
        ? (props[PROP_KEYS.direction] as number)
        : undefined,
    ...graphicFieldsOf(props),
  });
}

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

/** 从外部 GeoJSON 属性宽容恢复战术图形字段。 */
function graphicFieldsOf(
  properties: Record<string, unknown>,
): Pick<MapFeature, 'symbolKind' | 'graphicType' | 'graphicParams'> {
  const symbolKind =
    properties[PROP_KEYS.symbolKind] === SymbolKind.Single ||
    properties[PROP_KEYS.symbolKind] === SymbolKind.MultiPoint
      ? (properties[PROP_KEYS.symbolKind] as MapFeature['symbolKind'])
      : undefined;
  const rawType = properties[PROP_KEYS.graphicType];
  const graphicType = Object.values(TacticalGraphicType).includes(rawType as TacticalGraphicType)
    ? (rawType as MapFeature['graphicType'])
    : undefined;
  const graphicParams = graphicParamsOf(properties[PROP_KEYS.graphicParams]);
  return { symbolKind, graphicType, graphicParams };
}

/** 仅保留已知且有限的图形参数。 */
function graphicParamsOf(value: unknown): GraphicParams | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const result: GraphicParams = {};
  for (const key of GRAPHIC_PARAM_KEYS) {
    const item = source[key];
    if (key === 'smooth') {
      if (typeof item === 'boolean') result.smooth = item;
    } else if (typeof item === 'number' && Number.isFinite(item)) {
      result[key] = item;
    }
  }
  return Object.keys(result).length === 0 ? undefined : result;
}

/** 读取坐标序列，跳过非法项 */
function readPositions(input: unknown): LonLat[] {
  if (!Array.isArray(input)) return [];

  const points: LonLat[] = [];
  for (const item of input) {
    if (Array.isArray(item) && item.length >= 2) {
      const lon = Number(item[0]);
      const lat = Number(item[1]);
      if (Number.isFinite(lon) && Number.isFinite(lat)) points.push({ lon, lat });
    }
  }
  return points;
}

/** 值转为经纬度数组表示 [经度, 纬度] */
function toPosition(point: LonLat): [number, number] {
  return [point.lon, point.lat];
}

/** 闭合坐标环：首尾不重合时追加首点 */
function closeRing(points: LonLat[]): LonLat[] {
  if (points.length === 0) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first.lon === last.lon && first.lat === last.lat) return points;
  return [...points, first];
}

/** 仅当值为字符串时返回，否则返回 undefined */
function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
