/**
 * 符号渲染：把 SIDC 合成为可绘制的几何描述，并序列化为 SVG。
 *
 * 渲染分两步：
 * 1. {@link renderSymbol} 把 SIDC 解析为与渲染后端无关的 {@link SymbolGeometry}；
 * 2. {@link toSvg} 把几何序列化为 SVG 字符串。
 *
 * 拆分的意义在于：地图图层（需要 DOM 元素）、导出器（需要图片）、
 * 单元测试（只需断言数值）可以各取所需，互不干扰。
 */

import { colorOf, paletteOf, type PaletteTheme } from './colors';
import {
  buildFrame,
  frameBottomOf,
  frameFamilyOf,
  frameTopOf,
  innerBoundsOf,
  VIEWPORT,
} from './frames';
import { findSymbol } from './icons';
import { buildDirectionArrow, buildEchelon, buildHqTfDummy, buildStatusOverlay } from './modifiers';
import { echelonOf, entityCodeOf } from './sidc';
import { Affiliation, SymbolSet, type Sidc, type SymbolGeometry, type SymbolPath } from './types';

/** 图标局部坐标系的边长，图标定义均基于此尺寸 */
const ICON_SPACE = 100;

/** 渲染选项 */
export interface RenderOptions {
  /** 配色主题，默认昼间 */
  theme?: PaletteTheme;
  /**
   * 机动方向方位角（度，0 为正北、顺时针递增）。
   * 传入后会在符号上叠加方向箭头。
   */
  direction?: number;
  /** 框架左右边界，用于绘制司令部与特遣队指示符 */
  frameExtent?: { left: number; right: number };
  /** 文本修饰符字号，缺省为 26。 */
  fontSize?: number;
  /** 文本修饰符字体，缺省为 sans-serif。 */
  fontFamily?: string;
}

/**
 * 文本修饰符（对应 2525 的字段）。
 *
 * 标准规定了各字段相对框架的固定位置，此处沿用该约定：
 * 唯一标识在右、上级编成在左、附加信息在右下、参谋注记在左下。
 */
export interface SymbolTextFields {
  /** 唯一标识（Field T），置于框架右侧 */
  uniqueDesignation?: string;
  /** 上级编成（Field M），置于框架左侧 */
  higherFormation?: string;
  /** 附加信息（Field H），置于框架右下方 */
  additionalInformation?: string;
  /** 参谋注记（Field G），置于框架左下方 */
  staffComments?: string;
}

/**
 * 把 SIDC 渲染为几何描述。
 *
 * 合成顺序为：框架 → 图标 → 状态覆盖 → 梯队/司令部 → 方向箭头。
 * 顺序决定了压盖关系，后绘制者位于上层。
 *
 * @param sidc 符号的 SIDC
 * @param options 渲染选项，可同时携带文本修饰符字段
 * @returns 几何描述
 */
export function renderSymbol(
  sidc: Sidc,
  options: RenderOptions & SymbolTextFields = {},
): SymbolGeometry {
  const family = frameFamilyOf(sidc);
  const frameTop = frameTopOf(family);
  const frameBottom = frameBottomOf(family);
  const bounds = innerBoundsOf(family);

  const extent = options.frameExtent ?? { left: 25, right: 175 };

  const fills: SymbolPath[] = [];
  const strokes: SymbolPath[] = [];

  // 1. 框架：填充与描边
  for (const path of buildFrame(sidc)) {
    if (path.role === 'fill') fills.push(path);
    else strokes.push(path);
  }

  // 2. 图标：从 100×100 局部坐标变换到框架内部可用区域
  const definition = findSymbol(sidc.symbolSet, entityCodeOf(sidc));
  const transform = iconTransform(bounds);
  for (const iconPath of definition.paths) {
    const path: SymbolPath = { d: iconPath.d, role: 'icon', transform };
    if (iconPath.filled) fills.push(path);
    else strokes.push({ ...path, strokeWidth: 6 });
  }

  // 3. 状态覆盖：受损、被摧毁、满载
  strokes.push(...buildStatusOverlay(sidc.status));

  // 4. 梯队与司令部/特遣队指示符
  const echelon = echelonOf(sidc);
  if (echelon) {
    const echelonPaths = buildEchelon(echelon, frameTop);
    fills.push(...echelonPaths.fills);
    strokes.push(...echelonPaths.strokes);
  }
  strokes.push(...buildHqTfDummy(sidc.hqTfDummy, frameTop, extent.left, extent.right));

  // 5. 机动方向箭头
  if (options.direction !== undefined) {
    strokes.push(...buildDirectionArrow(options.direction));
  }

  return { fills, strokes, labels: buildLabels(sidc, options, frameBottom, extent) };
}

/**
 * 生成文本修饰符。
 *
 * @param sidc 符号的 SIDC
 * @param options 渲染选项（含文本字段）
 * @param frameBottom 框架底边 y 坐标
 * @param extent 框架左右边界
 */
function buildLabels(
  _sidc: Sidc,
  options: RenderOptions & SymbolTextFields,
  frameBottom: number,
  extent: { left: number; right: number },
): SymbolGeometry['labels'] {
  const labels: SymbolGeometry['labels'] = [];
  const fontSize = options.fontSize ?? 26;

  // 上部文本：与框架顶部对齐
  if (options.higherFormation) {
    labels.push({
      text: options.higherFormation,
      x: extent.left - 10,
      y: 82,
      fontSize,
      anchor: 'end',
      role: 'text',
    });
  }
  if (options.uniqueDesignation) {
    labels.push({
      text: options.uniqueDesignation,
      x: extent.right + 10,
      y: 82,
      fontSize,
      anchor: 'start',
      role: 'text',
    });
  }

  // 下部文本：置于框架底边之下
  const bottomY = frameBottom + 30;
  if (options.staffComments) {
    labels.push({
      text: options.staffComments,
      x: extent.left - 10,
      y: bottomY,
      fontSize: fontSize * 0.8,
      anchor: 'end',
      role: 'text',
    });
  }
  if (options.additionalInformation) {
    labels.push({
      text: options.additionalInformation,
      x: extent.right + 10,
      y: bottomY,
      fontSize: fontSize * 0.8,
      anchor: 'start',
      role: 'text',
    });
  }

  return labels;
}

/**
 * 计算图标从 100×100 局部坐标系到框架内部区域的变换。
 *
 * 采用**等比缩放**并水平垂直居中，避免图标被拉伸变形；
 * 缩放比取宽高比例的较小值，保证图标始终完整落在框架内。
 */
function iconTransform(bounds: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}): string {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const scale = Math.min(width, height) / ICON_SPACE;
  const offsetX = bounds.left + (width - ICON_SPACE * scale) / 2;
  const offsetY = bounds.top + (height - ICON_SPACE * scale) / 2;
  return `translate(${round(offsetX)} ${round(offsetY)}) scale(${round(scale)})`;
}

/** 保留三位小数，避免 SVG 中出现超长的浮点字符串 */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** SVG 序列化选项 */
export interface SvgOptions {
  /** 输出尺寸（像素，正方形），默认 200 */
  size?: number;
  /** 配色主题 */
  theme?: PaletteTheme;
  /** 文本修饰符字体，缺省为 sans-serif。 */
  fontFamily?: string;
  /** 是否绘制调试用的视口边框 */
  debug?: boolean;
}

/**
 * 把几何描述序列化为 SVG 字符串。
 *
 * @param sidc 符号的 SIDC，用于确定配色
 * @param geometry 由 {@link renderSymbol} 生成的几何描述
 * @param options 序列化选项
 * @returns 完整的 `<svg>` 文档字符串
 */
export function toSvg(sidc: Sidc, geometry: SymbolGeometry, options: SvgOptions = {}): string {
  const size = options.size ?? VIEWPORT;
  const palette = paletteOf(sidc.affiliation, options.theme);
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWPORT} ${VIEWPORT}" ` +
      `width="${size}" height="${size}">`,
  );

  if (options.debug) {
    parts.push(
      `<rect x="0" y="0" width="${VIEWPORT}" height="${VIEWPORT}" fill="none" stroke="#ccc" stroke-width="1"/>`,
    );
  }

  // 填充图元：不带描边，避免出现双倍轮廓
  for (const path of geometry.fills) {
    parts.push(
      `<path d="${path.d}" fill="${colorOf(path.role, palette)}"${transformAttr(path.transform)}/>`,
    );
  }

  // 描边图元：不填充，线端与转角做圆角处理以提升小尺寸下的可读性
  for (const path of geometry.strokes) {
    const dash = path.dashed ? ' stroke-dasharray="10 6"' : '';
    parts.push(
      `<path d="${path.d}" fill="none" stroke="${colorOf(path.role, palette)}" ` +
        `stroke-width="${path.strokeWidth ?? 6}" stroke-linecap="round" ` +
        `stroke-linejoin="round"${dash}${transformAttr(path.transform)}/>`,
    );
  }

  const fontFamily = options.fontFamily ?? 'sans-serif';
  for (const label of geometry.labels) {
    parts.push(
      `<text x="${label.x}" y="${label.y}" font-size="${label.fontSize}" ` +
        `text-anchor="${label.anchor}" fill="${colorOf(label.role, palette)}" ` +
        `font-family="${escapeXml(fontFamily)}">${escapeXml(label.text)}</text>`,
    );
  }

  parts.push('</svg>');
  return parts.join('');
}

/**
 * 一步到位：由 SIDC 直接生成 SVG 字符串。
 *
 * 这是面向 UI 的便捷入口，内部串联 {@link renderSymbol} 与 {@link toSvg}。
 */
export function symbolToSvg(
  sidc: Sidc,
  options: SvgOptions & RenderOptions & SymbolTextFields = {},
): string {
  return toSvg(sidc, renderSymbol(sidc, options), options);
}

/** 生成 SVG 的 transform 属性片段，无变换时返回空串 */
function transformAttr(transform: string | undefined): string {
  return transform ? ` transform="${transform}"` : '';
}

/** 转义 XML 特殊字符，防止文本修饰符破坏 SVG 结构 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 生成符号的短文本描述，用于无障碍标签与工具提示。
 *
 * @param sidc 符号的 SIDC
 */
export function describeSymbol(sidc: Sidc): string {
  const definition = findSymbol(sidc.symbolSet, entityCodeOf(sidc));
  return `${definition.name}（${definition.nameEn}）`;
}

/**
 * 按符号集给出该符号集在 UI 中的显示名称。
 *
 * 用于符号选择器的分组标题。
 */
export function symbolSetName(symbolSet: SymbolSet): string {
  switch (symbolSet) {
    case SymbolSet.LandUnit:
      return '地面单位';
    case SymbolSet.Air:
      return '空中';
    case SymbolSet.SeaSurface:
      return '海面';
    case SymbolSet.SeaSubsurface:
      return '水下';
    case SymbolSet.LandEquipment:
      return '地面装备';
    case SymbolSet.LandInstallation:
      return '地面设施';
    case SymbolSet.ControlMeasure:
      return '控制措施';
    case SymbolSet.Activities:
      return '活动事件';
    case SymbolSet.Space:
      return '太空';
    case SymbolSet.Cyberspace:
      return '网络空间';
    default:
      return '其他';
  }
}

/**
 * 判断符号是否属于需要填充框架的"实心"身份。
 *
 * 敌军与不明身份按标准使用实心框架，图标因此需要改用反色（浅色）绘制，
 * 该信息供自定义渲染后端决定图标配色。
 */
export function isFilledAffiliation(affiliation: Affiliation): boolean {
  return (
    affiliation === Affiliation.Hostile ||
    affiliation === Affiliation.Suspect ||
    affiliation === Affiliation.Unknown
  );
}
