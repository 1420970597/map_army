/**
 * MilX XML 互操作。
 *
 * 原站 `map.army` 的图交换格式 `.milxly`（JSON + gzip）是私有选择，
 * 优点是体积小、易调试；缺点是**无法与其他 MIL-STD-2525 消费者互通**——
 * 例如 KADAS Albireo、OGC MilSym 工具链都基于真正的 MilX XML。
 *
 * 本模块提供**第二条**互操作路径：
 *
 * - `documentToMilxXml(doc)` —— 输出 XML 文本；
 * - `milxXmlToDocument(xml, name)` —— 从 XML 文本恢复文档。
 *
 * 与 JSON 路径的关系：两者并列、互不替代。`.milxly` 仍是本仓库的
 * 主交换格式；本模块输出的 XML 用于跨产品互操作场景。
 *
 * ## SIDC 长度差异
 *
 * 真实世界的 MilX 文件里 SIDC 长度不统一：
 *
 * - 2525C 用 **15 位**（仅前 10 位 Set A + 实体 5 位，无修饰符）；
 * - 2525D 用 **20 位**（Set A 10 位 + Set B 10 位）。
 *
 * 本仓库内部一律按 2525D 的 20 位存储（见 {@link SIDC_LENGTH}），
 * 但解析 XML 时必须兼容外部系统的 15 位输入。函数 {@link sidlPad}
 * 负责把 15 位补 0 扩展到 20 位（实体子类型 / 修饰符 1 / 修饰符 2
 * 在 2525C 中不存在，统一填 `0`）。
 */

import type { LonLat } from '../geo';
import {
  createDocument,
  GeometryKind,
  type MapDocument,
  type MapFeature,
} from '../model';

/** MilX XML 默认命名空间（行业惯例，可稳定复用） */
export const MILX_XML_NAMESPACE = 'urn:mil:gs-soft:milx';

/** 当前 XML 互操作的格式版本 */
export const MILX_XML_VERSION = 1;

/** 2525D 标准 SIDC 长度 */
const SIDC_LENGTH_D = 20;

/** 2525C 标准 SIDC 长度（XML 互操作允许的输入长度之一） */
const SIDC_LENGTH_C = 15;

/** XML 输出的缩进 */
const XML_INDENT = 2;

/**
 * 把 15 位 SIDC（2525C）补 0 到 20 位（2525D），20 位原样返回。
 *
 * 真实部署中常会混入这两种长度的文件：补 0 策略简单、对未使用的
 * 子类型 / 修饰符字段填 0 也符合"未指定即默认"的语义。
 *
 * 非 15 / 20 位输入会被原样返回（不做截断或重排），由上层校验。
 */
export function sidlPad(sidc: string): string {
  const stripped = sidc.replace(/[\s-]/g, '').toUpperCase();
  if (stripped.length === SIDC_LENGTH_D) return stripped;
  if (stripped.length === SIDC_LENGTH_C) {
    return stripped + '0'.repeat(SIDC_LENGTH_D - SIDC_LENGTH_C);
  }
  return stripped;
}

/**
 * 把文档序列化为 MilX XML 文本。
 *
 * 输出结构（缩进 2 空格）：
 *
 * ```xml
 * <milx xmlns="urn:mil:gs-soft:milx" version="1" exportedAt="...">
 *   <layers>
 *     <layer id="..." name="..." visible="true" locked="false" opacity="1" order="0"/>
 *     ...
 *   </layers>
 *   <features>
 *     <feature id="..." layerId="..." sidc="..." name="..." direction="45">
 *       <geometry type="point">
 *         <position lon="8.5" lat="47.4"/>
 *       </geometry>
 *       <textFields>
 *         <uniqueDesignation>A-1</uniqueDesignation>
 *         ...
 *       </textFields>
 *     </feature>
 *     ...
 *   </features>
 * </milx>
 * ```
 *
 * SIDC 一律按 20 位输出；几何、文本修饰符、方向等可选字段缺失时
 * 省略对应节点，避免空标签污染交换文件。
 *
 * @param document 待导出的文档
 * @returns XML 字符串
 */
export function documentToMilxXml(document: MapDocument): string {
  const lines: string[] = [];
  const exportedAt = new Date().toISOString();

  push(
    lines,
    0,
    `<milx xmlns="${MILX_XML_NAMESPACE}" version="${MILX_XML_VERSION}" exportedAt="${escapeAttribute(exportedAt)}">`,
  );

  // --- 图层 ---
  push(lines, 1, '<layers>');
  for (const layer of document.layers) {
    push(
      lines,
      2,
      `<layer id="${escapeAttribute(layer.id)}" name="${escapeAttribute(layer.name)}"` +
        ` visible="${layer.visible}" locked="${layer.locked}"` +
        ` opacity="${formatNumber(layer.opacity)}" order="${layer.order}"/>`,
    );
  }
  push(lines, 1, '</layers>');

  // --- 要素 ---
  push(lines, 1, '<features>');
  for (const feature of document.features) {
    writeFeature(lines, feature);
  }
  push(lines, 1, '</features>');

  push(lines, 0, '</milx>');

  return lines.join('\n') + '\n';
}

/**
 * 从 MilX XML 文本解析出文档。
 *
 * 采用与 JSON 路径一致的**宽容策略**：
 *
 * - 缺失的可选字段补默认值（文本修饰符空对象、时间戳取当前时刻）；
 * - 结构不合法的要素被跳过并计数，而不是导致整份文件加载失败；
 * - SIDC 接受 15 位（2525C）或 20 位（2525D），15 位自动补 0。
 *
 * @param xml 文件内容
 * @param name 文档名称（XML 中没有文档级名称时使用）
 * @returns 解析结果，包含文档与被跳过要素的数量
 * @throws 当 XML 内容根本不是本格式时抛出错误
 */
export function milxXmlToDocument(
  xml: string,
  name: string,
): { document: MapDocument; skipped: number } {
  const doc = parseXml(xml);
  const root = doc.documentElement;
  if (!root || root.localName !== 'milx') {
    throw new Error('XML 根节点不是 <milx>，无法作为 MilX 文件载入');
  }

  const documentName = readLayersAndName(root, name);
  const layersRoot = getFirstChild(root, 'layers');
  const featuresRoot = getFirstChild(root, 'features');

  const layers = layersRoot ? readLayers(layersRoot) : [];
  const layerIds = new Set(layers.map((layer) => layer.id));

  const now = Date.now();
  let skipped = 0;
  const features: MapFeature[] = [];
  if (featuresRoot) {
    for (const node of childrenOf(featuresRoot, 'feature')) {
      const feature = readFeature(node, layerIds, now);
      if (feature) {
        features.push(feature);
      } else {
        skipped += 1;
      }
    }
  }

  // 没有图层时补一个默认图层，与 JSON 路径行为保持一致
  if (layers.length === 0) {
    const fallback = createDocument(documentName);
    for (const feature of features) feature.layerId = fallback.layers[0].id;
    return { document: { ...fallback, features }, skipped };
  }

  return {
    document: {
      name: documentName,
      layers,
      features,
      createdAt: now,
      updatedAt: now,
    },
    skipped,
  };
}

// ─────────────────────────── 序列化辅助 ───────────────────────────

/** 追加一行并加上缩进 */
function push(lines: string[], depth: number, content: string): void {
  lines.push(' '.repeat(depth * XML_INDENT) + content);
}

/**
 * 把单个要素写入 XML 行缓冲。
 *
 * 几何按 kind 分支：
 *
 * - point —— `<position lon= lat=/>`；
 * - line / area —— `<points>` 包若干 `<point>` 子节点。
 *
 * 文本修饰符只在至少有一个字段被填入时输出 `<textFields>` 节点。
 */
function writeFeature(lines: string[], feature: MapFeature): void {
  const attrs: string[] = [
    `id="${escapeAttribute(feature.id)}"`,
    `layerId="${escapeAttribute(feature.layerId)}"`,
    `sidc="${escapeAttribute(sidlPad(feature.sidc))}"`,
    `name="${escapeAttribute(feature.name)}"`,
  ];
  if (typeof feature.direction === 'number' && Number.isFinite(feature.direction)) {
    attrs.push(`direction="${formatNumber(feature.direction)}"`);
  }

  const text = feature.textFields;
  const hasText = Boolean(
    text.uniqueDesignation || text.higherFormation || text.additionalInformation || text.staffComments,
  );

  push(lines, 2, `<feature ${attrs.join(' ')}>`);

  // 几何
  writeGeometry(lines, feature.geometry);

  // 文本修饰符
  if (hasText) {
    push(lines, 3, '<textFields>');
    writeTextField(lines, 4, 'uniqueDesignation', text.uniqueDesignation);
    writeTextField(lines, 4, 'higherFormation', text.higherFormation);
    writeTextField(lines, 4, 'additionalInformation', text.additionalInformation);
    writeTextField(lines, 4, 'staffComments', text.staffComments);
    push(lines, 3, '</textFields>');
  }

  push(lines, 2, '</feature>');
}

/** 写入一个可选文本修饰符字段，缺失时跳过 */
function writeTextField(
  lines: string[],
  depth: number,
  tag: string,
  value: string | undefined,
): void {
  if (!value) return;
  push(lines, depth, `<${tag}>${escapeText(value)}</${tag}>`);
}

/** 写入几何节点 */
function writeGeometry(lines: string[], geometry: MapFeature['geometry']): void {
  push(lines, 3, `<geometry type="${geometry.kind}">`);
  if (geometry.kind === GeometryKind.Point) {
    push(
      lines,
      4,
      `<position lon="${formatNumber(geometry.position.lon)}" lat="${formatNumber(geometry.position.lat)}"/>`,
    );
  } else {
    push(lines, 4, '<points>');
    for (const point of geometry.points) {
      push(
        lines,
        5,
        `<point lon="${formatNumber(point.lon)}" lat="${formatNumber(point.lat)}"/>`,
      );
    }
    push(lines, 4, '</points>');
  }
  push(lines, 3, '</geometry>');
}

// ─────────────────────────── 解析辅助 ───────────────────────────

/**
 * 读取文档名。
 *
 * XML 中没有强制的文档级名称节点，沿用调用方传入的 `name` 参数；
 * 这里仅预留扩展位（未来可从 `<metadata>` 中读取）。
 */
function readLayersAndName(root: Element, fallback: string): string {
  // 优先取 <milx name="..."/> 属性，其次使用调用方传入的名称
  const attr = root.getAttribute('name');
  return attr && attr.trim() ? attr : fallback;
}

/** 读取图层列表 */
function readLayers(layersRoot: Element): MapDocument['layers'] {
  return childrenOf(layersRoot, 'layer').map((node, index) => ({
    id: node.getAttribute('id') ?? `lyr_imported_${index}`,
    name: node.getAttribute('name') ?? `图层 ${index + 1}`,
    visible: node.getAttribute('visible') !== 'false',
    locked: node.getAttribute('locked') === 'true',
    opacity: readNumberAttribute(node, 'opacity', 1),
    order: readNumberAttribute(node, 'order', index),
  }));
}

/**
 * 把单个 XML feature 节点恢复为强类型对象。
 *
 * 返回 null 表示该要素被跳过：通常是因为缺少关键字段（id / sidc）
 * 或几何非法。SIDC 长度不是跳过条件——15 位会被自动补 0。
 */
function readFeature(node: Element, layerIds: Set<string>, fallbackTime: number): MapFeature | null {
  const id = node.getAttribute('id');
  const sidcRaw = node.getAttribute('sidc');
  if (!id || !sidcRaw) return null;

  const sidc = sidlPad(sidcRaw);
  // 只接受 15 位（已被 sidlPad 扩展到 20）或原本就是 20 位
  if (sidc.length !== SIDC_LENGTH_D) return null;
  if (!/^\d+$/.test(sidc)) return null;

  const layerIdAttr = node.getAttribute('layerId');
  // 未知图层回退到第一个已知图层（与 JSON 路径的宽容接管一致）；
  // 调用方若需要按 layerId 重新归并，可在导入后调用相关工具。
  const layerId =
    layerIdAttr && layerIds.has(layerIdAttr)
      ? layerIdAttr
      : layerIdAttr ?? '';

  const geometryNode = getFirstChild(node, 'geometry');
  const geometry = geometryNode ? readGeometry(geometryNode) : null;
  if (!geometry) return null;

  const textNode = getFirstChild(node, 'textFields');
  const textFields = textNode ? readTextFields(textNode) : {};

  const direction = readNumberAttribute(node, 'direction', NaN);
  const createdAt = readNumberAttribute(node, 'createdAt', fallbackTime);
  const updatedAt = readNumberAttribute(node, 'updatedAt', fallbackTime);

  // 不走 createFeature：保留 XML 中的 id 与时间戳，必要时让调用方
  // 在导入后用 cloneFeature 重新生成新标识。
  return {
    id,
    layerId,
    sidc,
    name: node.getAttribute('name') ?? '',
    geometry,
    textFields,
    style: undefined,
    direction: Number.isFinite(direction) ? direction : undefined,
    createdAt,
    updatedAt,
  } satisfies MapFeature;
}

/** 读取几何节点；返回 null 表示几何缺失或类型不支持 */
function readGeometry(node: Element): MapFeature['geometry'] | null {
  const type = node.getAttribute('type');
  if (type === GeometryKind.Point) {
    const positionNode = getFirstChild(node, 'position');
    if (!positionNode) return null;
    const lon = readNumberAttribute(positionNode, 'lon', NaN);
    const lat = readNumberAttribute(positionNode, 'lat', NaN);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    return { kind: GeometryKind.Point, position: { lon, lat } };
  }

  if (type === GeometryKind.Line || type === GeometryKind.Area) {
    const pointsNode = getFirstChild(node, 'points');
    if (!pointsNode) return null;
    const points: LonLat[] = [];
    for (const pointNode of childrenOf(pointsNode, 'point')) {
      const lon = readNumberAttribute(pointNode, 'lon', NaN);
      const lat = readNumberAttribute(pointNode, 'lat', NaN);
      if (Number.isFinite(lon) && Number.isFinite(lat)) points.push({ lon, lat });
    }
    if (points.length === 0) return null;
    return {
      kind: type === GeometryKind.Area ? GeometryKind.Area : GeometryKind.Line,
      points,
    };
  }

  // 未知几何类型（如未来扩展）——按不支持处理
  return null;
}

/** 读取文本修饰符节点；缺失节点时返回空对象 */
function readTextFields(node: Element): MapFeature['textFields'] {
  const text: MapFeature['textFields'] = {};
  for (const child of childrenOf(node)) {
    const value = child.textContent ?? '';
    if (!value) continue;
    switch (child.localName) {
      case 'uniqueDesignation':
        text.uniqueDesignation = value;
        break;
      case 'higherFormation':
        text.higherFormation = value;
        break;
      case 'additionalInformation':
        text.additionalInformation = value;
        break;
      case 'staffComments':
        text.staffComments = value;
        break;
      default:
        // 未知字段忽略，便于向前兼容
        break;
    }
  }
  return text;
}

// ─────────────────────────── XML 解析层 ───────────────────────────

/**
 * 解析 XML 文本。
 *
 * 优先使用浏览器原生的 `DOMParser`，Node 环境（>= 20）也已内置；
 * 缺失时抛出明确错误，避免静默 fallback。
 */
function parseXml(xml: string): Document {
  if (typeof DOMParser === 'undefined') {
    throw new Error('当前环境不支持 DOMParser，无法解析 MilX XML');
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  // parseFromString 在解析失败时会返回包含 <parsererror> 的文档
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('XML 内容非法，无法解析');
  }
  return doc;
}

/** 取节点的直接子元素中第一个 localName 匹配的元素 */
function getFirstChild(parent: Element, localName: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (child.localName === localName) return child;
  }
  return null;
}

/** 列出节点下所有指定 localName 的直接子元素 */
function childrenOf(parent: Element, localName?: string): Element[] {
  const result: Element[] = [];
  for (const child of Array.from(parent.children)) {
    if (!localName || child.localName === localName) result.push(child);
  }
  return result;
}

/** 读取数字属性，缺失或非数时回退到默认值 */
function readNumberAttribute(node: Element, name: string, fallback: number): number {
  const raw = node.getAttribute(name);
  if (raw === null || raw === '') return fallback;
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

/** 把数字格式化为简洁的字符串（避免科学计数法） */
function formatNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : '0';
}

// ─────────────────────────── 转义工具 ───────────────────────────

/** 转义 XML 属性值：换行、双引号、与号 */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, '&#10;')
    .replace(/\t/g, '&#9;');
}

/** 转义 XML 文本节点：与号与尖括号 */
function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}