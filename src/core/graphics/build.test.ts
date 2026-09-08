/** 战术图形统一分发测试。 */

import { describe, expect, it } from 'vitest';

import type { LonLat } from '../geo';
import { TacticalGraphicType } from '../model';
import { buildGraphic } from './build';
import * as graphics from './index';

const line: LonLat[] = [
  { lon: 116.3, lat: 39.9 },
  { lon: 116.4, lat: 39.9 },
];
const area: LonLat[] = [...line, { lon: 116.4, lat: 40 }, { lon: 116.3, lat: 40 }];

describe('buildGraphic', () => {
  it.each([
    TacticalGraphicType.AttackArrow,
    TacticalGraphicType.AxisOfAdvance,
    TacticalGraphicType.DefenceLine,
    TacticalGraphicType.Boundary,
    TacticalGraphicType.Corridor,
    TacticalGraphicType.PhaseLine,
  ])('分发 %s 并返回非空几何', (type) => {
    expect(buildGraphic(type, line).outline.length).toBeGreaterThan(1);
  });

  it('分发集结地域', () => {
    const result = buildGraphic(TacticalGraphicType.AssemblyArea, area);
    expect(result.outline[0]).toEqual(result.outline.at(-1));
  });

  it('用户参数覆盖元数据默认值', () => {
    const narrow = buildGraphic(TacticalGraphicType.Corridor, line, { corridorWidthMeters: 400 });
    const wide = buildGraphic(TacticalGraphicType.Corridor, line, { corridorWidthMeters: 800 });
    const distance = (geometry: typeof narrow) =>
      Math.abs(geometry.outline[0].lat - geometry.outline.at(-2)!.lat);
    expect(distance(wide)).toBeGreaterThan(distance(narrow));
  });

  it('不足控制点返回最小可用几何', () => {
    expect(buildGraphic(TacticalGraphicType.AttackArrow, [line[0]])).toEqual({
      outline: [line[0]],
      anchors: [line[0]],
    });
  });

  it('运行时未知类型安全回退到控制点轮廓', () => {
    expect(buildGraphic('invalid' as TacticalGraphicType, line)).toEqual({
      outline: line,
      anchors: line,
    });
  });

  it('输出确定且不修改输入', () => {
    const snapshot = structuredClone(area);
    expect(buildGraphic(TacticalGraphicType.AssemblyArea, area)).toEqual(
      buildGraphic(TacticalGraphicType.AssemblyArea, area),
    );
    expect(area).toEqual(snapshot);
  });

  it('index 导出统一生成接口', () => {
    expect(graphics.buildGraphic).toBe(buildGraphic);
    expect(graphics.attackArrow).toBeTypeOf('function');
    expect(graphics.corridor).toBeTypeOf('function');
  });
});
