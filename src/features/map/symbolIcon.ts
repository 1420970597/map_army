/**
 * 军标符号到 Leaflet 图标的转换。
 *
 * Leaflet 的标记只接受图片或 DOM 元素，而符号引擎产出的是 SVG 字符串，
 * 因此需要用 `L.divIcon` 把 SVG 包成 DOM 节点。本模块在二者之间做桥接，
 * 并提供按 SIDC 缓存以避免同一符号反复生成 DOM。
 */

import L from 'leaflet';
import { militarySvg } from '@/core/symbology/military';
import type { FeatureTextFields } from '@/core/model';

import { parseSidc, renderSymbol, symbolToSvg } from '@/core/symbology';
import { mapSymbolMarkup } from './symbolMarkup';

/** 符号在地图上的默认边长（像素） */
export const DEFAULT_SYMBOL_SIZE = 40;

/** 图标缓存键的组成要素 */
interface IconKeyParts extends FeatureTextFields {
  approved?: boolean;
  sidc: string;
  size: number;
  direction?: number;
  higherFormation?: string;
  uniqueDesignation?: string;
  fontSize?: number;
  fontFamily?: string;
  customSvg?: string;
}

/**
 * 图标缓存。
 *
 * 同一份 SVG 会被大量标记复用（例如一个营下属的多个连队），
 * 缓存能把 DOM 生成次数从"要素数量"降到"符号种类数量"。
 */
const iconCache = new Map<string, L.DivIcon>();

/** 缓存上限，超出后整体清空以防止长时间编辑导致内存无界增长 */
const MAX_CACHE = 500;

/**
 * 生成军标符号的 Leaflet 图标。
 *
 * @param parts 图标的组成要素
 * @returns Leaflet 图标实例（可能来自缓存，请勿就地修改）
 */
export function symbolIcon(parts: IconKeyParts): L.DivIcon {
  const key = iconKey(parts);
  const cached = iconCache.get(key);
  if (cached) return cached;

  const icon = buildIcon(parts);
  if (iconCache.size >= MAX_CACHE) iconCache.clear();
  iconCache.set(key, icon);

  return icon;
}

/**
 * 生成符号的 SVG 字符串。
 *
 * 抽离出来供导出器与预览组件复用，避免它们各自拼装渲染参数。
 *
 * @param sidc 20 位 SIDC 字符串
 * @param size 输出尺寸
 * @param direction 机动方向方位角
 */
export function symbolSvg(sidc: string, size = DEFAULT_SYMBOL_SIZE, direction?: number): string {
  return symbolToSvg(parseSidc(sidc), { size, direction });
}

/** 构造实际的图标实例 */
function buildIcon(parts: IconKeyParts): L.DivIcon {
  const { size, direction, higherFormation, uniqueDesignation, fontSize, fontFamily } = parts;
  const svg = militarySvg(parts.sidc, {
    ...parts,
    size,
    direction,
    higherFormation,
    uniqueDesignation,
    infoSize: fontSize ? (fontSize / 26) * 40 : undefined,
    fontfamily: fontFamily,
    monoColor: parts.approved ? '#111111' : undefined,
  });
  const customSvg = parts.customSvg;

  return L.divIcon({
    html: mapSymbolMarkup(customSvg ?? svg, size),
    // 图标锚点取几何中心，使标记尖端正对经纬度
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: 'mil-symbol-icon',
  });
}

/** 生成缓存键 */
function iconKey(parts: IconKeyParts): string {
  return JSON.stringify(parts);
}

/** 清空图标缓存（切换配色主题等导致 SVG 变化时需要调用） */
export function clearIconCache(): void {
  iconCache.clear();
}

/**
 * 生成要素的几何预览 SVG，用于属性面板与导出预览。
 *
 * 与地图图标的区别是不带锚点语义，返回纯 SVG 字符串。
 */
export function previewSymbol(
  sidc: string,
  size = 96,
  options: {
    direction?: number;
    text?: { higherFormation?: string; uniqueDesignation?: string };
  } = {},
): string {
  try {
    return symbolToSvg(parseSidc(sidc), {
      size,
      direction: options.direction,
      higherFormation: options.text?.higherFormation,
      uniqueDesignation: options.text?.uniqueDesignation,
    });
  } catch {
    return symbolToSvg(parseSidc('10031000000000000000'), { size });
  }
}

/**
 * 判断要素是否需要在符号上叠加文本修饰符。
 *
 * 提取为函数是为了让图标缓存键的构造与渲染逻辑保持单一来源。
 */
export function iconPartsOf(
  sidc: string,
  text: FeatureTextFields = {},
  size = DEFAULT_SYMBOL_SIZE,
  direction?: number,
  fontSize?: number,
  fontFamily?: string,
): IconKeyParts {
  return {
    sidc,
    size,
    direction,
    ...text,
    fontSize,
    fontFamily,
  };
}

/** 导出渲染器供外部复用，避免重复解析 SIDC */
export { renderSymbol };
