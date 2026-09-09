/** 标准军标适配器，兼容 MIL-STD-2525C 字母代码和 D/E 数字代码及完整文本修饰符。 */
import ms from 'milsymbol';
import type { SymbolOptions } from 'milsymbol';
import { parseSidc, createSidc } from './sidc';
import { hasLocalSymbolSet } from './icons';
import { symbolToSvg } from './render';

/** 返回包含扩展文字的完整 SVG，不裁剪框外修饰符。 */
export function militarySvg(sidc: string, options: SymbolOptions = {}): string {
  let parsed;
  try {
    parsed = parseSidc(sidc);
    if (hasLocalSymbolSet(parsed.symbolSet)) {
      return symbolToSvg(parsed, {
        ...options,
        size: options.size ?? 40,
      });
    }
  } catch {
    // 非数字 SIDC 交给 milsymbol 处理，例如 15 位 2525C 字母 SIDC。
  }
  try {
    const symbol = new ms.Symbol(sidc, options);
    if (symbol.isValid()) return symbol.asSVG();
  } catch {
    /* 不支持的编码使用本地自绘引擎继续呈现。 */
  }
  parsed = parsed ?? createSidc();
  try {
    parsed = parseSidc(sidc);
  } catch {
    /* 保留未知符号外观。 */
  }
  return symbolToSvg(parsed, { ...options, size: options.size ?? 40 });
}
