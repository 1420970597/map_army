/**
 * 符号目录检索别名。
 *
 * 别名与 SVG 图标资产分离，便于独立维护装备型号、缩写与常用称呼。
 */

/** 目录键到可检索别名的映射。 */
export const SYMBOL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  '1-110104': ['F/A-18', 'F/A 18', 'FA18', 'F18', 'Super Hornet', 'Hornet', '大黄蜂'],
  '10-121102': ['APC', '装甲输送车', '步战车', 'IFV'],
  '10-120500': ['MBT', '主战坦克', 'Main Battle Tank'],
  '10-130300': ['SPG', '自行火炮', 'Howitzer'],
  '10-111000': ['C2', '指挥通信', 'Command Post'],
  '30-120100': ['CVN', '航母', 'Aircraft Carrier'],
  '35-110100': ['SSN', 'SSK', '攻击核潜艇'],
};

/** 读取目录键对应的别名；未知键返回不可变空数组语义。 */
export function aliasesOf(key: string): readonly string[] {
  return SYMBOL_ALIASES[key] ?? [];
}
