/**
 * 七类战术图形的稳定元数据。
 *
 * 内部 SIDC 使用控制措施符号集 25 和本库保留的六位数字实体段。实体段不等同于
 * 外部标准映射，现有 SIDC 解析器仅校验结构，因此可以在后续交换层集中替换。
 */

import {
  TacticalGraphicType,
  type GraphicParams,
  type TacticalGraphicType as TacticalGraphicTypeValue,
} from '../model';

/** 战术图形在要素模型中的元数据。 */
export interface TacticalGraphicMeta {
  type: TacticalGraphicTypeValue;
  name: string;
  nameEn: string;
  geometryKind: 'line' | 'area';
  minPoints: number;
  defaultParams: Required<GraphicParams>;
  /** 本库内部的六位数字实体段。 */
  entity: string;
}

const DEFAULT_PARAMS: Required<GraphicParams> = {
  widthRatio: 0.25,
  headRatio: 0.22,
  toothRatio: 0.18,
  toothSpacingRatio: 0.12,
  tickRatio: 0.15,
  tickSpacingRatio: 0.1,
  hatchSpacingRatio: 0.1,
  corridorWidthMeters: 0,
  phaseWingRatio: 0.5,
  smooth: true,
};

/**
 * 战术图形定义表。
 *
 * 所有默认参数都是独立对象，避免调用者意外修改一类图形后污染其他图形。
 */
export const GRAPHIC_META: Readonly<Record<TacticalGraphicTypeValue, TacticalGraphicMeta>> = {
  [TacticalGraphicType.AttackArrow]: {
    type: TacticalGraphicType.AttackArrow,
    name: '进攻箭头',
    nameEn: 'Attack Arrow',
    geometryKind: 'area',
    minPoints: 2,
    defaultParams: { ...DEFAULT_PARAMS, widthRatio: 0.25, headRatio: 0.22 },
    entity: '900001',
  },
  [TacticalGraphicType.AxisOfAdvance]: {
    type: TacticalGraphicType.AxisOfAdvance,
    name: '进攻轴线',
    nameEn: 'Axis of Advance',
    geometryKind: 'line',
    minPoints: 2,
    defaultParams: { ...DEFAULT_PARAMS, headRatio: 0.18 },
    entity: '900002',
  },
  [TacticalGraphicType.DefenceLine]: {
    type: TacticalGraphicType.DefenceLine,
    name: '防御线',
    nameEn: 'Defence Line',
    geometryKind: 'line',
    minPoints: 2,
    defaultParams: { ...DEFAULT_PARAMS, toothRatio: 0.18, toothSpacingRatio: 0.12 },
    entity: '900003',
  },
  [TacticalGraphicType.AssemblyArea]: {
    type: TacticalGraphicType.AssemblyArea,
    name: '集结地域',
    nameEn: 'Assembly Area',
    geometryKind: 'area',
    minPoints: 3,
    defaultParams: { ...DEFAULT_PARAMS, hatchSpacingRatio: 0.1 },
    entity: '900004',
  },
  [TacticalGraphicType.Boundary]: {
    type: TacticalGraphicType.Boundary,
    name: '分界线',
    nameEn: 'Boundary',
    geometryKind: 'line',
    minPoints: 2,
    defaultParams: { ...DEFAULT_PARAMS, tickRatio: 0.15, tickSpacingRatio: 0.1 },
    entity: '900005',
  },
  [TacticalGraphicType.Corridor]: {
    type: TacticalGraphicType.Corridor,
    name: '走廊',
    nameEn: 'Corridor',
    geometryKind: 'area',
    minPoints: 2,
    defaultParams: { ...DEFAULT_PARAMS, widthRatio: 0.25, corridorWidthMeters: 0 },
    entity: '900006',
  },
  [TacticalGraphicType.PhaseLine]: {
    type: TacticalGraphicType.PhaseLine,
    name: '相位线',
    nameEn: 'Phase Line',
    geometryKind: 'line',
    minPoints: 2,
    defaultParams: { ...DEFAULT_PARAMS, phaseWingRatio: 0.5 },
    entity: '900007',
  },
};

/** 获取指定战术图形的元数据。 */
export function metaOfGraphic(type: TacticalGraphicTypeValue): TacticalGraphicMeta {
  return GRAPHIC_META[type];
}

/**
 * 生成图形的内部 20 位 SIDC。
 *
 * 固定使用 2525D、真实态势、友军、控制措施符号集、存在状态、无 HQ 和无放大器。
 */
export function sidcOfGraphic(type: TacticalGraphicTypeValue): string {
  return `1003250000${metaOfGraphic(type).entity}0000`;
}
