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
  '15-110100': ['MBT', '主战坦克', '坦克'],
  '15-110200': ['IFV', '步战车'],
  '15-110300': ['APC', '装甲输送车'],
  '15-120300': ['MLRS', '火箭炮'],
  '15-140100': ['雷达', 'Radar'],
  '20-110100': ['CP', 'Command Post', '指挥中心'],
  '20-120300': ['医院', 'Hospital'],
  '25-110100': ['CP', 'Checkpoint', '检查站'],
  '25-110200': ['TRP', 'Target Reference Point', '目标'],
  '40-110200': ['HA', 'Humanitarian Assistance', '救援'],
};

/** 读取目录键对应的别名；未知键返回不可变空数组语义。 */
export function aliasesOf(key: string): readonly string[] {
  return SYMBOL_ALIASES[key] ?? [];
}
