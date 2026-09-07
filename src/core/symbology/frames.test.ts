/**
 * 框架与渲染的单元测试。
 *
 * 框架几何无法用"往返一致性"验证，因此改用**结构性质**做断言：
 * 路径必须闭合、必须落在视口内、不同身份必须产生不同形状。
 */

import { describe, expect, it } from 'vitest';

import {
  buildFrame,
  frameBottomOf,
  frameFamilyOf,
  framePathOf,
  frameTopOf,
  innerBoundsOf,
  requiresDashedFrame,
  VIEWPORT,
} from './frames';
import { findSymbol, listSymbols, searchSymbols } from './icons';
import { renderSymbol, symbolToSvg } from './render';
import { createSidc, parseSidc } from './sidc';
import { Affiliation, Context, Echelon, HqTfDummy, Status, SymbolSet, type Sidc } from './types';

/** 全部轮廓族，用于参数化测试 */
const FAMILIES = [
  'rectangle',
  'diamond',
  'square',
  'quatrefoil',
  'leaf',
  'ellipse',
  'halfEllipse',
] as const;

describe('frameFamilyOf', () => {
  it('地面单位应按身份选择轮廓', () => {
    expect(frameFamilyOf(createSidc({ affiliation: Affiliation.Friend }))).toBe('rectangle');
    expect(frameFamilyOf(createSidc({ affiliation: Affiliation.Hostile }))).toBe('diamond');
    expect(frameFamilyOf(createSidc({ affiliation: Affiliation.Neutral }))).toBe('square');
    expect(frameFamilyOf(createSidc({ affiliation: Affiliation.Unknown }))).toBe('quatrefoil');
  });

  it('假定友军应沿用友军轮廓、可疑应沿用敌军轮廓', () => {
    expect(frameFamilyOf(createSidc({ affiliation: Affiliation.AssumedFriend }))).toBe('rectangle');
    expect(frameFamilyOf(createSidc({ affiliation: Affiliation.Suspect }))).toBe('diamond');
  });

  it('空中符号集应使用叶形轮廓', () => {
    expect(frameFamilyOf(createSidc({ symbolSet: SymbolSet.Air }))).toBe('leaf');
    expect(frameFamilyOf(createSidc({ symbolSet: SymbolSet.Space }))).toBe('leaf');
  });

  it('海面与水下应使用各自专属轮廓', () => {
    expect(frameFamilyOf(createSidc({ symbolSet: SymbolSet.SeaSurface }))).toBe('ellipse');
    expect(frameFamilyOf(createSidc({ symbolSet: SymbolSet.SeaSubsurface }))).toBe('halfEllipse');
  });
});

describe('framePathOf', () => {
  it.each(FAMILIES)('%s 的路径应闭合且非空', (family) => {
    const d = framePathOf(family);

    expect(d.length).toBeGreaterThan(10);
    expect(d.trimEnd().endsWith('Z')).toBe(true);
  });

  it.each(FAMILIES)('%s 的坐标应全部落在视口内', (family) => {
    const numbers = extractNumbers(framePathOf(family));

    for (const value of numbers) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(VIEWPORT);
    }
  });

  it('四种地面轮廓应互不相同', () => {
    const shapes = new Set([
      framePathOf('rectangle'),
      framePathOf('diamond'),
      framePathOf('square'),
      framePathOf('quatrefoil'),
    ]);

    expect(shapes.size).toBe(4);
  });
});

describe('innerBoundsOf', () => {
  it.each(FAMILIES)('%s 的内部区域应有效且位于视口内', (family) => {
    const bounds = innerBoundsOf(family);

    expect(bounds.right).toBeGreaterThan(bounds.left);
    expect(bounds.bottom).toBeGreaterThan(bounds.top);
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(VIEWPORT);
  });

  it('框架顶边应高于内部区域顶边', () => {
    for (const family of FAMILIES) {
      expect(frameTopOf(family)).toBeLessThanOrEqual(innerBoundsOf(family).top);
    }
  });

  it('框架底边应低于内部区域底边', () => {
    for (const family of FAMILIES) {
      expect(frameBottomOf(family)).toBeGreaterThanOrEqual(innerBoundsOf(family).bottom);
    }
  });
});

describe('requiresDashedFrame', () => {
  it('计划状态应使用虚线', () => {
    expect(requiresDashedFrame(createSidc({ status: Status.Planned }))).toBe(true);
  });

  it('演习与模拟上下文应使用虚线', () => {
    expect(requiresDashedFrame(createSidc({ context: Context.Exercise }))).toBe(true);
    expect(requiresDashedFrame(createSidc({ context: Context.Simulation }))).toBe(true);
  });

  it('真实上下文下的存在状态不应使用虚线', () => {
    expect(requiresDashedFrame(createSidc())).toBe(false);
  });
});

describe('buildFrame', () => {
  it('应同时产出填充与描边两个图元', () => {
    const paths = buildFrame(createSidc());

    expect(paths).toHaveLength(2);
    expect(paths[0].role).toBe('fill');
    expect(paths[1].role).toBe('frame');
  });

  it('虚线需求应传递到描边图元', () => {
    const paths = buildFrame(createSidc({ status: Status.Planned }));
    const stroke = paths.find((path) => path.role === 'frame');

    expect(stroke?.dashed).toBe(true);
  });
});

describe('findSymbol', () => {
  it('应能按符号集与实体代码精确命中', () => {
    const infantry = findSymbol(SymbolSet.LandUnit, '121100');
    expect(infantry.name).toBe('步兵');

    const artillery = findSymbol(SymbolSet.LandUnit, '130300');
    expect(artillery.name).toBe('野战炮兵');
  });

  it('未收录的子类型应回退到同类型的父级图标', () => {
    // 121199 未收录，应回退到 121100（步兵）
    const fallback = findSymbol(SymbolSet.LandUnit, '121199');
    expect(fallback.name).toBe('步兵');
    // 回退后仍保留查询时使用的实体代码，便于调用方识别
    expect(fallback.entity).toBe('121199');
  });

  it('完全未知的符号集应回退到未知图标而非抛错', () => {
    const unknown = findSymbol(SymbolSet.Cyberspace, '999999');
    expect(unknown.name).toBe('未知单位');
    expect(unknown.paths.length).toBeGreaterThan(0);
  });
});

describe('listSymbols 与 searchSymbols', () => {
  it('应能按符号集过滤', () => {
    const air = listSymbols(SymbolSet.Air);
    expect(air.length).toBeGreaterThan(0);
    expect(air.every((item) => item.symbolSet === SymbolSet.Air)).toBe(true);
  });

  it('应能按中英文关键字搜索', () => {
    expect(searchSymbols('步兵').length).toBeGreaterThan(0);
    expect(searchSymbols('artillery').length).toBeGreaterThan(0);
  });

  it('空关键字应返回全部', () => {
    expect(searchSymbols('')).toHaveLength(listSymbols().length);
  });
});

describe('renderSymbol', () => {
  it('最简符号应包含框架与图标图元', () => {
    const geometry = renderSymbol(createSidc());

    expect(geometry.fills.length).toBeGreaterThan(0);
    expect(geometry.strokes.length).toBeGreaterThan(0);
  });

  it('带梯队的符号应产出额外的梯队图元', () => {
    const base = renderSymbol(createSidc());
    const withEch = renderSymbol(createSidc({ amplifier: Echelon.Battalion }));

    // 营级梯队为 2 条竖条，故实心图元增加 2 个
    expect(withEch.fills.length).toBe(base.fills.length + 2);
  });

  it('司令部标记应产出额外的描边图元', () => {
    const base = renderSymbol(createSidc());
    const hq = renderSymbol(createSidc({ hqTfDummy: HqTfDummy.Headquarters }));

    expect(hq.strokes.length).toBeGreaterThan(base.strokes.length);
  });

  it('被摧毁状态应在符号上叠加叉号', () => {
    const base = renderSymbol(createSidc());
    const destroyed = renderSymbol(createSidc({ status: Status.Destroyed }));

    // 叉号为两条线段，故描边图元增加 2 个
    expect(destroyed.strokes.length).toBe(base.strokes.length + 2);
  });

  it('指定机动方向时应叠加箭头', () => {
    const base = renderSymbol(createSidc());
    const moving = renderSymbol(createSidc(), { direction: 90 });

    expect(moving.strokes.length).toBeGreaterThan(base.strokes.length);
  });

  it('文本修饰符应生成对应标签', () => {
    const geometry = renderSymbol(createSidc(), { uniqueDesignation: 'A-1' });

    expect(geometry.labels).toHaveLength(1);
    expect(geometry.labels[0].text).toBe('A-1');
  });

  it('图标图元应带有坐标变换', () => {
    const geometry = renderSymbol(createSidc());
    const icons = geometry.strokes.filter((path) => path.role === 'icon' && path.transform);

    expect(icons.length).toBeGreaterThan(0);
  });
});

describe('symbolToSvg', () => {
  it('应输出合法的 SVG 文档', () => {
    const svg = symbolToSvg(createSidc());

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('viewBox="0 0 200 200"');
  });

  it('应按指定尺寸输出', () => {
    const svg = symbolToSvg(createSidc(), { size: 64 });

    expect(svg).toContain('width="64"');
    expect(svg).toContain('height="64"');
  });

  it('敌军符号应使用红色系配色', () => {
    const svg = symbolToSvg(createSidc({ affiliation: Affiliation.Hostile }));
    // #E00000 为敌军身份色
    expect(svg).toContain('#E00000');
  });

  it('友军符号应使用蓝色系配色', () => {
    const svg = symbolToSvg(createSidc({ affiliation: Affiliation.Friend }));
    expect(svg).toContain('#0B82D6');
  });

  it('夜间主题应改变配色', () => {
    const day = symbolToSvg(createSidc({ affiliation: Affiliation.Friend }));
    const night = symbolToSvg(createSidc({ affiliation: Affiliation.Friend }), {
      theme: 'night',
    });

    expect(night).not.toBe(day);
    expect(night).toContain('#7FE3FF');
  });

  it('文本中的特殊字符应被转义，避免破坏 SVG 结构', () => {
    const svg = symbolToSvg(createSidc(), { uniqueDesignation: '<A&B>' });

    expect(svg).toContain('&lt;A&amp;B&gt;');
    expect(svg).not.toContain('<A&B>');
  });

  it('全符号集遍历渲染时不应抛错', () => {
    for (const definition of listSymbols()) {
      const sidc: Sidc = createSidc({
        symbolSet: definition.symbolSet,
        entity: definition.entity.slice(0, 2),
        entityType: definition.entity.slice(2, 4),
        entitySubtype: definition.entity.slice(4, 6),
      });

      expect(() => symbolToSvg(sidc)).not.toThrow();
    }
  });

  it('七种身份与七种轮廓的组合均应正常渲染', () => {
    const affiliations = Object.values(Affiliation);

    for (const affiliation of affiliations) {
      for (const symbolSet of [SymbolSet.LandUnit, SymbolSet.Air, SymbolSet.SeaSurface]) {
        const svg = symbolToSvg(createSidc({ affiliation, symbolSet }));
        expect(svg).toContain('<path');
      }
    }
  });
});

describe('parseSidc 与渲染的集成', () => {
  it('解析真实 SIDC 后应渲染出非空 SVG', () => {
    const sidc = parseSidc('10061500001101040000');
    const svg = symbolToSvg(sidc);

    expect(svg.length).toBeGreaterThan(200);
    expect(sidc.affiliation).toBe(Affiliation.Hostile);
  });
});

/**
 * 从 SVG path 的 d 属性中提取全部数值。
 *
 * 用于校验坐标是否越界；圆弧命令中的标志位会被一并取出，
 * 但它们取值仅为 0 或 1，不会影响越界判断。
 */
function extractNumbers(d: string): number[] {
  const matches = d.match(/-?\d+(\.\d+)?/g);
  return matches ? matches.map(Number) : [];
}
