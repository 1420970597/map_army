/**
 * 战术图形生成器的纯几何输出契约。
 *
 * 本模块只描述经纬度几何，不携带颜色、线宽或任何渲染框架选项。
 */

import type { LonLat } from '../geo';
import type { GraphicParams, TacticalGraphicType } from '../model';

/** 图形附属标签的文本与建议位置。 */
export interface GraphicLabel {
  text: string;
  position: LonLat;
  direction?: number;
}

/** 战术图形的渲染几何。 */
export interface GraphicGeometry {
  /** 面图形为闭合环，线图形为折线。 */
  outline: LonLat[];
  /** 独立渲染的附加笔画。 */
  parts?: LonLat[][];
  /** 与输入对应的可编辑控制点。 */
  anchors?: LonLat[];
  /** 文本标签锚点。 */
  labels?: GraphicLabel[];
}

/**
 * 由控制点与参数构造战术图形。
 *
 * @param type 战术图形类型
 * @param controlPoints 可编辑控制点
 * @param params 用户参数覆盖
 * @returns 与缩放无关的纯经纬度几何
 */
export declare function buildGraphic(
  type: TacticalGraphicType,
  controlPoints: readonly LonLat[],
  params?: GraphicParams,
): GraphicGeometry;
