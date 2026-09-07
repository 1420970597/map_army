/**
 * 要素样式与图层不透明度叠加的单测。
 *
 * 覆盖：
 * - clampUnit 对非有限数、越界值的处理；
 * - applyLayerOpacity 把图层透明度按比例叠加到描边与填充，且不修改入参；
 * - 边界值（0 / 1）下的行为。
 */

import { describe, expect, it } from 'vitest';

import { applyLayerOpacity, clampUnit, type RenderStyle } from './featureStyle';

/** 构造一个非平凡的 RenderStyle 用作测试输入 */
function baseStyle(): RenderStyle {
  return {
    color: '#076391',
    weight: 3,
    opacity: 0.8,
    fillOpacity: 0.4,
    dashArray: '8 6',
  };
}

describe('clampUnit', () => {
  it('夹住越界负数', () => {
    expect(clampUnit(-0.5)).toBe(0);
  });

  it('夹住越界正数', () => {
    expect(clampUnit(1.7)).toBe(1);
  });

  it('原样返回范围内数值', () => {
    expect(clampUnit(0.42)).toBe(0.42);
  });

  it('非有限数回退为 1', () => {
    expect(clampUnit(Number.NaN)).toBe(1);
    expect(clampUnit(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('applyLayerOpacity', () => {
  it('把图层不透明度叠加到描边与填充上', () => {
    const next = applyLayerOpacity(baseStyle(), 0.5);
    expect(next.opacity).toBeCloseTo(0.4, 5);
    expect(next.fillOpacity).toBeCloseTo(0.2, 5);
    // 颜色、线宽、虚线等几何属性保持不变
    expect(next.color).toBe('#076391');
    expect(next.weight).toBe(3);
    expect(next.dashArray).toBe('8 6');
  });

  it('图层完全不透明时输出与原样式一致', () => {
    const style = baseStyle();
    const next = applyLayerOpacity(style, 1);
    expect(next.opacity).toBeCloseTo(style.opacity, 5);
    expect(next.fillOpacity).toBeCloseTo(style.fillOpacity, 5);
  });

  it('图层完全透明时描边与填充都为零', () => {
    const next = applyLayerOpacity(baseStyle(), 0);
    expect(next.opacity).toBe(0);
    expect(next.fillOpacity).toBe(0);
  });

  it('不修改入参对象', () => {
    const style = baseStyle();
    const snapshot = { ...style };
    applyLayerOpacity(style, 0.3);
    expect(style).toEqual(snapshot);
  });

  it('对越界与脏数据保持鲁棒', () => {
    const next = applyLayerOpacity(baseStyle(), 2);
    // 越界值被夹到 1，等价于原样返回
    expect(next.opacity).toBeCloseTo(baseStyle().opacity, 5);
    expect(next.fillOpacity).toBeCloseTo(baseStyle().fillOpacity, 5);
  });
});
