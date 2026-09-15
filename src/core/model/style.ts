/**
 * 符号默认值到要素样式的映射。
 *
 * 此处使用结构类型而不是导入 symbology，确保模型层不形成运行时循环依赖。
 */

import type { FeatureStyle } from './types';

/** 样式映射需要的最小默认值结构。 */
export interface SymbolStyleDefaults {
  lineWeight: number;
  fillColor: string;
}

/**
 * 将符号默认值投影为新建要素的样式。
 *
 * @param defaults 用户符号默认值的最小结构
 * @returns 可直接传给要素工厂的样式覆盖
 */
export function styleFromSymbolDefaults(defaults: SymbolStyleDefaults): FeatureStyle {
  return {
    color: defaults.fillColor,
    weight: defaults.lineWeight,
  };
}

/**
 * 用默认样式补齐要素级覆盖。
 *
 * 已存在的要素级字段始终优先，默认值只填充缺失字段。
 *
 * @param defaults 用户符号默认值的最小结构
 * @param override 要素级样式覆盖
 * @returns 合并后的完整基础样式
 */
export function mergeStyleWithDefaults(
  defaults: SymbolStyleDefaults,
  override?: FeatureStyle,
): FeatureStyle {
  return {
    ...styleFromSymbolDefaults(defaults),
    ...override,
  };
}
