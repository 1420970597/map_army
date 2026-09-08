/**
 * 符号格式默认值。
 *
 * 本模块只定义用户偏好数据，不依赖模型层，避免符号与模型形成运行时循环依赖。
 */

/** 符号绘制与文本修饰符的默认格式。 */
export interface SymbolDefaults {
  /** 线宽，范围 1 至 8。 */
  lineWeight: number;
  /** 填充色，标准六位十六进制颜色。 */
  fillColor: string;
  /** 文本修饰符字号，范围 10 至 72。 */
  fontSize: number;
  /** 文本修饰符字体。 */
  fontFamily: string;
}

/** 应用首次使用时的符号格式默认值。 */
export const DEFAULT_SYMBOL_DEFAULTS: SymbolDefaults = {
  lineWeight: 3,
  fillColor: '#0B82D6',
  fontSize: 26,
  fontFamily: 'system-ui, "Segoe UI", sans-serif',
};

const MIN_LINE_WEIGHT = 1;
const MAX_LINE_WEIGHT = 8;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 72;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FONT_WHITELIST = new Set([
  DEFAULT_SYMBOL_DEFAULTS.fontFamily,
  'Arial, sans-serif',
  'Georgia, serif',
  '"Segoe UI", sans-serif',
  'sans-serif',
  'serif',
  'monospace',
]);

/**
 * 将未知来源的格式偏好收敛为可安全使用的默认值。
 *
 * 不接受非有限数、非法颜色或未登记字体；字段缺失时保留应用默认值。
 */
export function normalizeSymbolDefaults(input: unknown): SymbolDefaults {
  const value = isRecord(input) ? input : {};
  const lineWeight = finiteNumber(value.lineWeight);
  const fontSize = finiteNumber(value.fontSize);
  const fillColor =
    typeof value.fillColor === 'string' && HEX_COLOR.test(value.fillColor.trim())
      ? value.fillColor.trim().toUpperCase()
      : DEFAULT_SYMBOL_DEFAULTS.fillColor;
  const fontFamily = normalizeFontFamily(value.fontFamily);

  return {
    lineWeight:
      lineWeight === undefined
        ? DEFAULT_SYMBOL_DEFAULTS.lineWeight
        : clamp(lineWeight, MIN_LINE_WEIGHT, MAX_LINE_WEIGHT),
    fillColor,
    fontSize:
      fontSize === undefined
        ? DEFAULT_SYMBOL_DEFAULTS.fontSize
        : clamp(fontSize, MIN_FONT_SIZE, MAX_FONT_SIZE),
    fontFamily,
  };
}

/** 判断未知值是否为可安全读取的对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 仅接收有限数值。 */
function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** 将数值限制到闭区间。 */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** 仅允许白名单字体，且安全移除首尾空白。 */
function normalizeFontFamily(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_SYMBOL_DEFAULTS.fontFamily;
  const trimmed = value.trim();
  return FONT_WHITELIST.has(trimmed) ? trimmed : DEFAULT_SYMBOL_DEFAULTS.fontFamily;
}
