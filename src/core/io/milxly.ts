/**
 * MilX 图层文件的读写。
 *
 * 原站使用 `.milxly`（图层）与 `.milxlyz`（压缩图层）作为交换格式。
 * 本复刻版实现等价物：
 *
 * - `.milxly` —— UTF-8 的 JSON 文本，便于人工检视与版本控制；
 * - `.milxlyz` —— 同一份 JSON 经 gzip 压缩后的二进制，用于减小体积。
 *
 * 之所以选择 JSON 而非 XML：同等信息量下 JSON 体积更小、解析更快，
 * 且天然支持后续字段扩展；文件头部的 `format` 与 `version` 字段
 * 保证未来可以做格式迁移。
 */

import { createDocument } from '../model/factory';
import {
  LayerKind,
  LayerStatus,
  SymbolKind,
  TacticalGraphicType,
  type GraphicParams,
  type MapDocument,
  type MapFeature,
} from '../model/types';

/** 文件格式标识 */
export const MILXLY_FORMAT = 'milxly';

/** 当前格式版本 */
export const MILXLY_VERSION = 1;

/** 序列化后的文件外层结构 */
export interface MilxlyFile {
  /** 格式标识，恒为 'milxly' */
  format: typeof MILXLY_FORMAT;
  /** 格式版本 */
  version: number;
  /** 导出时间戳（ISO 8601） */
  exportedAt: string;
  /** 文档内容 */
  document: MapDocument;
}

/**
 * 把文档序列化为 MilX 图层文件（JSON 文本）。
 *
 * @param document 待导出的文档
 * @returns JSON 字符串
 */
export function serializeMilxly(document: MapDocument): string {
  const file: MilxlyFile = {
    format: MILXLY_FORMAT,
    version: MILXLY_VERSION,
    exportedAt: new Date().toISOString(),
    document,
  };

  return JSON.stringify(file, null, 2);
}

/**
 * 从 MilX 图层文件解析出文档。
 *
 * 解析采用**宽容策略**：缺失的可选字段补默认值，结构错误的要素被跳过
 * 而不是导致整份文件加载失败——标图文件常常来自不同版本的实现，
 * 严格校验反而会让用户在关键时刻打不开图。
 *
 * @param text 文件内容
 * @returns 解析结果，包含文档与被跳过要素的数量
 * @throws 当文件内容根本不是本格式时抛出错误
 */
export function deserializeMilxly(text: string): {
  document: MapDocument;
  skipped: number;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('文件不是合法的 JSON，无法作为标图文件载入');
  }

  if (!isRecord(parsed)) {
    throw new Error('文件内容不是对象，无法作为标图文件载入');
  }
  if (parsed.format !== MILXLY_FORMAT) {
    throw new Error(`文件格式标识为 "${String(parsed.format)}"，不是 ${MILXLY_FORMAT}`);
  }
  if (typeof parsed.version !== 'number' || parsed.version > MILXLY_VERSION) {
    throw new Error(
      `文件版本 ${String(parsed.version)} 高于本程序支持的 ${MILXLY_VERSION}，请升级后重试`,
    );
  }

  const raw = isRecord(parsed.document) ? parsed.document : {};
  const layers = Array.isArray(raw.layers) ? raw.layers.filter(isRecord) : [];
  const rawFeatures = Array.isArray(raw.features) ? raw.features : [];

  let skipped = 0;
  const features: MapFeature[] = [];
  for (const item of rawFeatures) {
    const feature = reviveFeature(item);
    if (feature) features.push(feature);
    else skipped += 1;
  }

  const document: MapDocument = {
    name: typeof raw.name === 'string' ? raw.name : '未命名标图',
    layers: layers.map((layer, index) => ({
      id: typeof layer.id === 'string' ? layer.id : `lyr_imported_${index}`,
      name: typeof layer.name === 'string' ? layer.name : `图层 ${index + 1}`,
      visible: layer.visible !== false,
      locked: layer.locked === true,
      opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
      order: typeof layer.order === 'number' ? layer.order : index,
      status: layer.status === LayerStatus.Approved ? LayerStatus.Approved : LayerStatus.Working,
      kind: isLayerKind(layer.kind) ? layer.kind : LayerKind.Feature,
      group: typeof layer.group === 'string' ? layer.group : undefined,
    })),
    features,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : undefined,
  };

  // 文件中没有任何图层时补一个默认图层，否则要素将无处安放
  if (document.layers.length === 0) {
    const fallback = createDocument(document.name);
    document.layers = fallback.layers;
    for (const feature of document.features) feature.layerId = document.layers[0].id;
  }

  return { document, skipped };
}

/**
 * 把单个要素从反序列化结果恢复为强类型对象。
 *
 * @param item 待恢复的数据
 * @returns 要素，结构不合法时返回 null
 */
function reviveFeature(item: unknown): MapFeature | null {
  if (!isRecord(item)) return null;
  if (typeof item.id !== 'string' || typeof item.sidc !== 'string') return null;

  const geometry = item.geometry;
  if (!isRecord(geometry) || typeof geometry.kind !== 'string') return null;

  const now = Date.now();

  if (geometry.kind === 'point') {
    const position = geometry.position;
    if (
      !isRecord(position) ||
      typeof position.lon !== 'number' ||
      typeof position.lat !== 'number'
    ) {
      return null;
    }
    return {
      id: item.id,
      layerId: typeof item.layerId === 'string' ? item.layerId : '',
      sidc: item.sidc,
      name: typeof item.name === 'string' ? item.name : '',
      geometry: { kind: 'point', position: { lon: position.lon, lat: position.lat } },
      textFields: reviveTextFields(item.textFields),
      style: isRecord(item.style) ? (item.style as MapFeature['style']) : undefined,
      direction: typeof item.direction === 'number' ? item.direction : undefined,
      vertexBearings: reviveVertexBearings(item.vertexBearings),
      ...reviveGraphicFields(item),
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : now,
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : now,
    };
  }

  const points = geometry.points;
  if (!Array.isArray(points)) return null;
  const coords = points.filter(
    (point): point is { lon: number; lat: number } =>
      isRecord(point) && typeof point.lon === 'number' && typeof point.lat === 'number',
  );
  if (coords.length === 0) return null;

  const kind = geometry.kind === 'area' ? 'area' : 'line';

  return {
    id: item.id,
    layerId: typeof item.layerId === 'string' ? item.layerId : '',
    sidc: item.sidc,
    name: typeof item.name === 'string' ? item.name : '',
    geometry: { kind, points: coords } as MapFeature['geometry'],
    textFields: reviveTextFields(item.textFields),
    style: isRecord(item.style) ? (item.style as MapFeature['style']) : undefined,
    direction: typeof item.direction === 'number' ? item.direction : undefined,
    vertexBearings: reviveVertexBearings(item.vertexBearings),
    ...reviveGraphicFields(item),
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : now,
  };
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

/** 恢复战术图形字段，忽略未知类型与非法参数。 */
function reviveGraphicFields(
  item: Record<string, unknown>,
): Pick<MapFeature, 'symbolKind' | 'graphicType' | 'graphicParams'> {
  const symbolKind =
    item.symbolKind === SymbolKind.Single || item.symbolKind === SymbolKind.MultiPoint
      ? item.symbolKind
      : undefined;
  const graphicType = Object.values(TacticalGraphicType).includes(
    item.graphicType as TacticalGraphicType,
  )
    ? (item.graphicType as MapFeature['graphicType'])
    : undefined;
  const graphicParams = reviveGraphicParams(item.graphicParams);
  return { symbolKind, graphicType, graphicParams };
}

/** 仅恢复声明过的有限参数，避免外部数据污染模型。 */
function reviveGraphicParams(value: unknown): GraphicParams | undefined {
  if (!isRecord(value)) return undefined;
  const result: GraphicParams = {};
  for (const key of GRAPHIC_PARAM_KEYS) {
    const item = value[key];
    if (key === 'smooth') {
      if (typeof item === 'boolean') result.smooth = item;
    } else if (typeof item === 'number' && Number.isFinite(item)) {
      result[key] = item;
    }
  }
  return Object.keys(result).length === 0 ? undefined : result;
}

/** 判断值是否为已知图层种类。 */
function isLayerKind(value: unknown): value is LayerKind {
  return value === LayerKind.Feature || value === LayerKind.Image || value === LayerKind.Wargame;
}

/** 恢复顶点方向数组，只保留有限数值。 */
function reviveVertexBearings(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || !value.every((bearing) => typeof bearing === 'number')) {
    return undefined;
  }

  return [...value];
}

/** 恢复文本修饰符，只保留字符串字段 */
function reviveTextFields(value: unknown): MapFeature['textFields'] {
  if (!isRecord(value)) return {};
  const result: MapFeature['textFields'] = {};
  for (const key of [
    'uniqueDesignation',
    'higherFormation',
    'additionalInformation',
    'staffComments',
  ] as const) {
    if (typeof value[key] === 'string') result[key] = value[key] as string;
  }
  return result;
}

/** 判断值是否为普通对象（排除数组与 null） */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 把 JSON 文本压缩为 gzip 字节流（`.milxlyz` 的内容）。
 *
 * 依赖浏览器原生的 CompressionStream，在无该 API 的环境下会抛出错误，
 * 调用方需要自行降级为未压缩格式。
 *
 * @param text 待压缩的 JSON 文本
 */
export async function compressMilxly(text: string): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('当前环境不支持 CompressionStream，无法生成压缩格式');
  }

  const bytes = new TextEncoder().encode(text);
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();

  return new Uint8Array(buffer);
}

/**
 * 把 gzip 字节流解压为 JSON 文本。
 *
 * @param data 压缩后的字节流
 */
export async function decompressMilxly(data: Uint8Array | ArrayBuffer): Promise<string> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前环境不支持 DecompressionStream，无法读取压缩格式');
  }

  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}
