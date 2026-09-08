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

/** 选中态的填充不透明度（比常态更醒目） */
const HIGHLIGHT_FILL_OPACITY = 0.35;

/** 安全解析 SIDC，失败时回退到友军地面单位 */
function safeParse(sidc: string): Sidc {
  try {
    return parseSidc(sidc);
  } catch {
    return parseSidc('10031000000000000000');
  }
}

/**
 * Leaflet 风格的完整渲染样式。
 *
 * 与 `pathOptions` 字段一一对应；统一类型便于在基础样式与高亮样式之间
 * 传递、并叠加图层级的不透明度。
 */
export interface RenderStyle {
  /** 描边颜色 */
  color: string;
  /** 描边线宽 */
  weight: number;
  /** 描边不透明度，0 ~ 1 */
  opacity: number;
  /** 填充不透明度，0 ~ 1（点要素不参与计算） */
  fillOpacity: number;
  /** 虚线样式，如 "8 6" */
  dashArray?: string;
}

/**
 * 从可选的只读选择标识构造判定集合。
 *
 * Set 会自然去重，且构造过程不会修改调用方传入的数组。
 */
export function selectedIdSetOf(selectedIds?: readonly string[]): ReadonlySet<string> {
  return new Set(selectedIds);
}

/**
 * 把任意数值夹到 `[0, 1]`，用于防御脏数据（如导入文档中的越界值）。
 *
 * 非有限数（NaN / Infinity）回退为 1（完全不透明），让要素至少可见。
 */
export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/**
 * 计算要素的完整渲染样式。
 *
 * 优先级：要素自身的样式覆盖 > SIDC 推导 > 全局默认。
 */
export function featureStyleOf(feature: MapFeature): RenderStyle {
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
export function featureHighlightStyleOf(feature: MapFeature): RenderStyle {
  const base = featureStyleOf(feature);
  return {
    color: base.color,
    weight: base.weight + 2,
    opacity: 1,
    fillOpacity: HIGHLIGHT_FILL_OPACITY,
    dashArray: base.dashArray,
  };
}

/**
 * 把图层级的不透明度叠加到要素样式上。
 *
 * 返回新对象，不修改入参；图层不透明度被夹到 `[0, 1]` 防止脏数据。
 *
 * @param style 要素基础或高亮样式
 * @param layerOpacity 图层不透明度，0 ~ 1
 */
export function applyLayerOpacity(style: RenderStyle, layerOpacity: number): RenderStyle {
  const factor = clampUnit(layerOpacity);
  return {
    ...style,
    opacity: style.opacity * factor,
    fillOpacity: style.fillOpacity * factor,
  };
}

/** 取得要素的身份色，供 UI 中的色块与图例使用 */
export function featureColorOf(feature: MapFeature): string {
  return paletteOf(safeParse(feature.sidc).affiliation).identity;
}
