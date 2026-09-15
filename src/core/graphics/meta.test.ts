/** 战术图形元数据与内部 SIDC 测试。 */

import { describe, expect, it } from 'vitest';

import { TacticalGraphicType } from '../model';
import { parseSidc, SymbolSet } from '../symbology';
import { GRAPHIC_META, metaOfGraphic, sidcOfGraphic } from './meta';

const types = Object.values(TacticalGraphicType);

describe('GRAPHIC_META', () => {
  it('覆盖全部七种战术图形', () => {
    expect(Object.keys(GRAPHIC_META)).toEqual(types);
  });

  it.each(types)('%s 具有中英文名称、几何种类和最小控制点数', (type) => {
    const meta = metaOfGraphic(type);

    expect(meta.name.length).toBeGreaterThan(0);
    expect(meta.nameEn.length).toBeGreaterThan(0);
    expect(['line', 'area']).toContain(meta.geometryKind);
    expect(meta.minPoints).toBeGreaterThanOrEqual(2);
  });

  it.each(types)('%s 具有完整、有限的默认参数', (type) => {
    const params = metaOfGraphic(type).defaultParams;

    expect(
      Object.values(params).every((value) => typeof value === 'boolean' || Number.isFinite(value)),
    ).toBe(true);
    expect(params.widthRatio).toBeGreaterThan(0);
    expect(params.headRatio).toBeGreaterThan(0);
  });

  it('面图形的最小控制点数符合控制点语义', () => {
    expect(metaOfGraphic(TacticalGraphicType.AttackArrow)).toMatchObject({
      geometryKind: 'area',
      minPoints: 2,
    });
    expect(metaOfGraphic(TacticalGraphicType.AssemblyArea)).toMatchObject({
      geometryKind: 'area',
      minPoints: 3,
    });
    expect(metaOfGraphic(TacticalGraphicType.Corridor)).toMatchObject({
      geometryKind: 'area',
      minPoints: 2,
    });
  });

  it('每个内部实体段均为唯一的六位数字', () => {
    const entities = types.map((type) => metaOfGraphic(type).entity);

    expect(new Set(entities).size).toBe(types.length);
    expect(entities.every((entity) => /^\d{6}$/.test(entity))).toBe(true);
  });

  it.each(types)('%s 的 SIDC 为可解析的二十位控制措施编码', (type) => {
    const sidc = sidcOfGraphic(type);
    const parsed = parseSidc(sidc);

    expect(sidc).toHaveLength(20);
    expect(parsed.symbolSet).toBe(SymbolSet.ControlMeasure);
  });

  it('SIDC 实体段来自对应元数据', () => {
    const type = TacticalGraphicType.Boundary;

    expect(sidcOfGraphic(type).slice(10, 16)).toBe(metaOfGraphic(type).entity);
  });

  it('元数据读取返回已登记的稳定对象', () => {
    expect(metaOfGraphic(TacticalGraphicType.PhaseLine)).toBe(
      GRAPHIC_META[TacticalGraphicType.PhaseLine],
    );
  });
});
