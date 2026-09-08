/**
 * 战术图形统一分发入口。
 *
 * 此层仅合并元数据默认参数并委派纯几何生成器，不依赖渲染或状态模块。
 */

import type { LonLat } from '../geo';
import {
  TacticalGraphicType,
  type GraphicParams,
  type TacticalGraphicType as TacticalGraphicTypeValue,
} from '../model';
import { assemblyArea, corridor } from './areaGraphics';
import { attackArrow, axisOfAdvance } from './arrow';
import { boundary, defenceLine, phaseLine } from './lineGraphics';
import { GRAPHIC_META } from './meta';
import type { GraphicGeometry } from './types';

function fallback(controlPoints: readonly LonLat[]): GraphicGeometry {
  const outline = controlPoints
    .filter((point) => Number.isFinite(point.lon) && Number.isFinite(point.lat))
    .map((point) => ({ lon: point.lon, lat: point.lat }));
  return { outline, anchors: outline.map((point) => ({ ...point })) };
}

function paramsOf(type: TacticalGraphicTypeValue, params?: GraphicParams): GraphicParams {
  return { ...GRAPHIC_META[type].defaultParams, ...params };
}

/**
 * 根据图形类型构造纯经纬度几何。
 *
 * 用户参数覆盖类型元数据中的默认参数。运行时类型脏数据不会抛错，而是返回控制点折线。
 *
 * @param type 战术图形类型
 * @param controlPoints 可编辑控制点
 * @param params 用户参数覆盖
 * @returns 与缩放无关的图形几何
 */
export function buildGraphic(
  type: TacticalGraphicTypeValue,
  controlPoints: readonly LonLat[],
  params?: GraphicParams,
): GraphicGeometry {
  switch (type) {
    case TacticalGraphicType.AttackArrow:
      return attackArrow(controlPoints, paramsOf(type, params));
    case TacticalGraphicType.AxisOfAdvance:
      return axisOfAdvance(controlPoints, paramsOf(type, params));
    case TacticalGraphicType.DefenceLine:
      return defenceLine(controlPoints, paramsOf(type, params));
    case TacticalGraphicType.AssemblyArea:
      return assemblyArea(controlPoints, paramsOf(type, params));
    case TacticalGraphicType.Boundary:
      return boundary(controlPoints, paramsOf(type, params));
    case TacticalGraphicType.Corridor:
      return corridor(controlPoints, paramsOf(type, params));
    case TacticalGraphicType.PhaseLine:
      return phaseLine(controlPoints, paramsOf(type, params));
    default:
      return fallback(controlPoints);
  }
}
