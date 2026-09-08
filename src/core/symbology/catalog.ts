/**
 * 符号目录与检索。
 *
 * 目录仅管理分类和查询元数据，不修改或承载 SVG 渲染资产。
 */

import { aliasesOf } from './aliases';
import { listSymbols } from './icons';
import { SymbolSet, type SymbolSet as SymbolSetValue } from './types';

/** 符号库的六个固定分区。 */
export const SymbolCategory = {
  Favorites: 'favorites',
  Formations: 'formations',
  Equipment: 'equipment',
  TacticalGraphics: 'tacticalGraphics',
  FunctionSpecific: 'functionSpecific',
  Metoc: 'metoc',
} as const;
export type SymbolCategory = (typeof SymbolCategory)[keyof typeof SymbolCategory];

/** 面板使用的固定分区顺序。 */
export const SYMBOL_CATEGORY_ORDER: readonly SymbolCategory[] = [
  SymbolCategory.Favorites,
  SymbolCategory.Formations,
  SymbolCategory.Equipment,
  SymbolCategory.TacticalGraphics,
  SymbolCategory.FunctionSpecific,
  SymbolCategory.Metoc,
];

/** 目录条目。 */
export interface CatalogEntry {
  key: string;
  category: SymbolCategory;
  name: string;
  nameEn: string;
  symbolSet: SymbolSetValue;
  entity?: string;
  sidc?: string;
  graphicType?: string;
  aliases?: readonly string[];
}

/** 每个当前符号集都有可用的默认分区。 */
export const DEFAULT_CATEGORY_BY_SYMBOL_SET: Readonly<Record<SymbolSetValue, SymbolCategory>> = {
  [SymbolSet.Unknown]: SymbolCategory.FunctionSpecific,
  [SymbolSet.Air]: SymbolCategory.Formations,
  [SymbolSet.AirMissile]: SymbolCategory.Equipment,
  [SymbolSet.Space]: SymbolCategory.Equipment,
  [SymbolSet.SpaceMissile]: SymbolCategory.Equipment,
  [SymbolSet.LandUnit]: SymbolCategory.Formations,
  [SymbolSet.LandCivilian]: SymbolCategory.Formations,
  [SymbolSet.LandEquipment]: SymbolCategory.Equipment,
  [SymbolSet.LandInstallation]: SymbolCategory.Equipment,
  [SymbolSet.ControlMeasure]: SymbolCategory.TacticalGraphics,
  [SymbolSet.Dismounted]: SymbolCategory.Formations,
  [SymbolSet.SeaSurface]: SymbolCategory.Formations,
  [SymbolSet.SeaSubsurface]: SymbolCategory.Formations,
  [SymbolSet.MineWarfare]: SymbolCategory.Equipment,
  [SymbolSet.Activities]: SymbolCategory.FunctionSpecific,
  [SymbolSet.Atmospheric]: SymbolCategory.Metoc,
  [SymbolSet.Oceanographic]: SymbolCategory.Metoc,
  [SymbolSet.Sigint]: SymbolCategory.FunctionSpecific,
  [SymbolSet.Cyberspace]: SymbolCategory.Formations,
};

const TACTICAL_GRAPHIC_PLACEHOLDERS: readonly CatalogEntry[] = [
  graphicEntry('attackArrow', '进攻箭头', 'Attack Arrow'),
  graphicEntry('axisOfAdvance', '进攻轴线', 'Axis of Advance'),
  graphicEntry('defenceLine', '防御线', 'Defence Line'),
  graphicEntry('assemblyArea', '集结地域', 'Assembly Area'),
  graphicEntry('boundary', '分界线', 'Boundary'),
  graphicEntry('corridor', '走廊', 'Corridor'),
  graphicEntry('phaseLine', '相位线', 'Phase Line'),
];

const CATALOG: readonly CatalogEntry[] = [
  ...listSymbols().map((definition) => {
    const key = symbolKeyOf(definition.symbolSet, definition.entity);
    return {
      key,
      category: DEFAULT_CATEGORY_BY_SYMBOL_SET[definition.symbolSet],
      name: definition.name,
      nameEn: definition.nameEn,
      symbolSet: definition.symbolSet,
      entity: definition.entity,
      aliases: aliasesOf(key),
    };
  }),
  ...TACTICAL_GRAPHIC_PLACEHOLDERS,
];

/** 返回六大分区的本地化显示名称。 */
export function categoryLabelOf(category: SymbolCategory): string {
  switch (category) {
    case SymbolCategory.Favorites:
      return '我的收藏';
    case SymbolCategory.Formations:
      return '编组单位';
    case SymbolCategory.Equipment:
      return '装备与设施';
    case SymbolCategory.TacticalGraphics:
      return '战术图形';
    case SymbolCategory.FunctionSpecific:
      return '功能专项';
    case SymbolCategory.Metoc:
      return '气象海洋';
  }
}

/** 生成与图标库同构的稳定目录键。 */
export function symbolKeyOf(symbolSet: SymbolSetValue, entity: string): string {
  return `${symbolSet}-${entity}`;
}

/** 归一化查询：移除空格、连字符、斜杠与点号，并转为小写。 */
export function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/[\s\-/.]+/g, '');
}

/** 返回全部目录条目的稳定副本。 */
export function listCatalog(): readonly CatalogEntry[] {
  return [...CATALOG];
}

/** 根据目录键查找条目。 */
export function findCatalogEntry(key: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.key === key);
}

/** 返回指定分区中的条目。收藏分区由上层根据收藏键动态计算，因此固定为空。 */
export function entriesInCategory(category: SymbolCategory): readonly CatalogEntry[] {
  if (category === SymbolCategory.Favorites) return [];
  return CATALOG.filter((entry) => entry.category === category);
}

/**
 * 搜索目录。空查询返回全量，结果按中英文名称和稳定键排序。
 */
export function catalogSearch(query: string, entries: readonly CatalogEntry[] = CATALOG): CatalogEntry[] {
  const normalized = normalizeQuery(query);
  const matched = normalized ? entries.filter((entry) => matchesQuery(entry, normalized)) : [...entries];
  return matched.sort(compareEntries);
}

/** 判断条目是否命中标准化查询。 */
export function matchesQuery(entry: CatalogEntry, query: string): boolean {
  const normalized = normalizeQuery(query);
  if (!normalized) return true;

  const candidates = [entry.name, entry.nameEn, entry.key, entry.entity ?? '', entry.sidc ?? '', ...(entry.aliases ?? [])];
  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeQuery(candidate);
    return normalizedCandidate.includes(normalized) || (entry.sidc !== undefined && normalizedCandidate.startsWith(normalized));
  });
}

/** 构造战术图形的非渲染目录占位条目。 */
function graphicEntry(graphicType: string, name: string, nameEn: string): CatalogEntry {
  return {
    key: `graphic:${graphicType}`,
    category: SymbolCategory.TacticalGraphics,
    name,
    nameEn,
    symbolSet: SymbolSet.ControlMeasure,
    graphicType,
  };
}

/** 目录稳定排序：名称、英文名称、稳定键依次比较。 */
function compareEntries(left: CatalogEntry, right: CatalogEntry): number {
  return left.name.localeCompare(right.name, 'zh-Hans-CN') || left.nameEn.localeCompare(right.nameEn) || left.key.localeCompare(right.key);
}
