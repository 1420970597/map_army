/**
 * 军标符号引擎统一出口。
 *
 * 对外只暴露稳定的 API，内部模块划分（编码解析 / 框架 / 图标 / 修饰符 / 渲染）
 * 可自由演进而不影响调用方。
 */

// ── 类型 ──
export {
  Affiliation,
  AmplifierCategory,
  Context,
  Echelon,
  HqTfDummy,
  MobilityLand,
  Status,
  SymbolSet,
} from './types';
export type { ColorRole, Sidc, SymbolGeometry, SymbolLabel, SymbolPath } from './types';

// ── 配色 ──
export { colorOf, paletteOf } from './colors';
export type { Palette, PaletteTheme } from './colors';

// ── SIDC 编解码 ──
export {
  createSidc,
  echelonOf,
  entityCodeOf,
  formatSidc,
  isValidSidc,
  mobilityOf,
  parseSidc,
  setAOf,
  withEchelon,
  SIDC_LENGTH,
  VERSION_2525D,
  VERSION_2525E,
} from './sidc';

// ── 框架 ──
export {
  buildFrame,
  frameBottomOf,
  frameFamilyOf,
  framePathOf,
  frameTopOf,
  innerBoundsOf,
  requiresDashedFrame,
  CENTER,
  VIEWPORT,
} from './frames';
export type { FrameFamily } from './frames';

// ── 图标库 ──
export { findSymbol, listSymbols, searchSymbols } from './icons';
export type { IconPath, SymbolDefinition } from './icons';

// ── 符号目录 ──
export {
  catalogSearch,
  categoryLabelOf,
  entriesInCategory,
  findCatalogEntry,
  listCatalog,
  matchesQuery,
  normalizeQuery,
  symbolKeyOf,
  SymbolCategory,
  SYMBOL_CATEGORY_ORDER,
  DEFAULT_CATEGORY_BY_SYMBOL_SET,
} from './catalog';
export type { CatalogEntry, SymbolCategory as SymbolCategoryValue } from './catalog';
export { createCustomSymbol, customSymbolMatches, sanitizeCustomSvg } from './custom';
export type { CustomSymbolDefinition } from './custom';
export { aliasesOf, SYMBOL_ALIASES } from './aliases';

// ── 收藏 ──
export {
  FAVORITES_VERSION,
  isFavorite,
  normalizeFavorites,
  parseFavorites,
  serializeFavorites,
  toggleFavorite,
} from './favorites';

// ── 默认格式 ──
export { DEFAULT_SYMBOL_DEFAULTS, normalizeSymbolDefaults } from './defaults';
export type { SymbolDefaults } from './defaults';

// ── 修饰符 ──
export {
  buildDirectionArrow,
  buildEchelon,
  buildHqTfDummy,
  buildIconExtensions,
  buildStatusOverlay,
} from './modifiers';

// ── 渲染 ──
export {
  describeSymbol,
  isFilledAffiliation,
  renderSymbol,
  symbolSetName,
  symbolToSvg,
  toSvg,
} from './render';
export type { RenderOptions, SymbolTextFields, SvgOptions } from './render';
