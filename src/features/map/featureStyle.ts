/**
 * 要素在地图上的渲染样式。
 *
 * 样式由 SIDC 推导：颜色取自身份（与符号框架同源，保证视觉一致），
 * 线型取自身份之外的状态与上下文。这样用户只需设置 SIDC，
 * 不必再手工维护一套平行的配色。
 */

import { parseSidc, paletteOf } from '@/core/symbology';
import type { Sidc } from '@/core/symbology';
import { Context, Status } from '@/core/symbology';
import { GeometryKind, type FeatureStyle, type MapFeature } from '@/core/model';

/** 默认线宽 */
const DEFAULT_WEIGHT = 3;

/** 面要素的默认填充不透明度 */
const DEFAULT_FILL_OPACITY = 0.2;

/** 安全解析 SIDC，失败时回退到友军地面单位 */
function safeParse(sidc: string): Sidc {
  try {
    return parseSidc(sidc);
  } catch {
    return parseSidc('10031000000000000000');
  }
}

/**
 * 计算要素的完整渲染样式。
 *
 * 优先级：要素自身的样式覆盖 > SIDC 推导 > 全局默认。
 *
 * @param feature 要素
 * @returns Leaflet 风格的样式对象
 */
export function featureStyleOf(feature: MapFeature): {
  color: string;
  weight: number;
  opacity: number;
  fillOpacity: number;
  dashArray?: string;
} {
  const sidc = safeParse(feature.sidc);
  const palette = paletteOf(sidc.affiliation);
  const override: FeatureStyle = feature.style ?? {};

  const dashed = sidc.status === Status.Planned || sidc.context !== Context.Reality;

  return {
    color: override.color ?? palette.identity,
    weight: override.weight ?? DEFAULT_WEIGHT,
    opacity: override.opacity ?? 0.9,
    // 点要素不需要填充，仅线与面使用
    fillOpacity: feature.geometry.kind === GeometryKind.Point ? 0 : DEFAULT_FILL_OPACITY,
    dashArray: override.dashArray ?? (dashed ? '8 6' : undefined),
  };
}

/**
 * 取得要素选中时的高亮样式。
 *
 * 在基础样式上加重并提高不透明度，使选中项在密集标图中依然醒目。
 */
export function featureHighlightStyleOf(feature: MapFeature): {
  color: string;
  weight: number;
  opacity: number;
  dashArray?: string;
} {
  const base = featureStyleOf(feature);
  return {
    color: base.color,
    weight: base.weight + 2,
    opacity: 1,
    dashArray: base.dashArray,
  };
}

/** 取得要素的身份色，供 UI 中的色块与图例使用 */
export function featureColorOf(feature: MapFeature): string {
  return paletteOf(safeParse(feature.sidc).affiliation).identity;
}
