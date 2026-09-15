import { describe, expect, it } from 'vitest';

import {
  catalogSearch,
  DEFAULT_CATEGORY_BY_SYMBOL_SET,
  entriesInCategory,
  listCatalog,
  matchesQuery,
  normalizeQuery,
  SymbolCategory,
  SYMBOL_CATEGORY_ORDER,
  symbolKeyOf,
} from './catalog';
import { listSymbols } from './icons';
import { symbolToSvg } from './render';
import { parseSidc } from './sidc';
import { SymbolSet } from './types';

describe('符号目录', () => {
  it('包含六大分区', () => {
    expect(SYMBOL_CATEGORY_ORDER).toEqual([
      SymbolCategory.Favorites,
      SymbolCategory.Formations,
      SymbolCategory.Equipment,
      SymbolCategory.TacticalGraphics,
      SymbolCategory.FunctionSpecific,
      SymbolCategory.Metoc,
    ]);
  });

  it('当前每个符号集都有默认分区', () => {
    expect(Object.keys(DEFAULT_CATEGORY_BY_SYMBOL_SET)).toHaveLength(Object.keys(SymbolSet).length);
  });

  it('已有图标全部收录到目录', () => {
    const catalogKeys = new Set(listCatalog().map((entry) => entry.key));
    for (const definition of listSymbols()) {
      expect(catalogKeys).toContain(symbolKeyOf(definition.symbolSet, definition.entity));
    }
  });

  it('新增符号按默认分区归类', () => {
    expect(entriesInCategory(SymbolCategory.Equipment).length).toBeGreaterThanOrEqual(32);
    expect(entriesInCategory(SymbolCategory.TacticalGraphics).length).toBeGreaterThanOrEqual(17);
    expect(entriesInCategory(SymbolCategory.FunctionSpecific).length).toBeGreaterThanOrEqual(4);
  });

  it('目录总量至少为九十', () => {
    expect(listCatalog().length).toBeGreaterThanOrEqual(90);
  });

  it('每个图标目录条目都有精确渲染定义', () => {
    for (const definition of listSymbols()) {
      const resolved = listSymbols(definition.symbolSet).find(
        (candidate) => candidate.entity === definition.entity,
      );
      expect(resolved).toBe(definition);
    }
  });

  it('战术图形含多点图形与点状控制措施', () => {
    expect(entriesInCategory(SymbolCategory.TacticalGraphics)).toHaveLength(17);
  });

  it('气象海洋分类保留空条目', () => {
    expect(entriesInCategory(SymbolCategory.Metoc)).toEqual([]);
  });

  it('收藏分类由上层动态计算', () => {
    expect(entriesInCategory(SymbolCategory.Favorites)).toEqual([]);
  });

  it('目录键与图标库同构', () => {
    expect(symbolKeyOf(SymbolSet.LandUnit, '121100')).toBe('10-121100');
  });
});

describe('文本渲染', () => {
  const sidc = parseSidc('10031000001211000000');

  it('缺省文本字号保持 26', () => {
    const svg = symbolToSvg(sidc, { uniqueDesignation: 'A' });
    expect(svg).toContain('font-size="26"');
    expect(svg).toContain('font-family="sans-serif"');
  });

  it('支持自定义文本字号与字体', () => {
    const svg = symbolToSvg(sidc, {
      uniqueDesignation: 'A',
      fontSize: 18,
      fontFamily: 'Noto Sans SC',
    });
    expect(svg).toContain('font-size="18"');
    expect(svg).toContain('font-family="Noto Sans SC"');
  });

  it('自定义渲染不影响后续缺省渲染', () => {
    symbolToSvg(sidc, { uniqueDesignation: 'A', fontSize: 18, fontFamily: 'Noto Sans SC' });
    const svg = symbolToSvg(sidc, { uniqueDesignation: 'A' });
    expect(svg).toContain('font-size="26"');
    expect(svg).toContain('font-family="sans-serif"');
  });
});

describe('检索', () => {
  it('归一化移除空格', () => {
    expect(normalizeQuery('F A 18')).toBe('fa18');
  });

  it('归一化移除连字符、斜杠和点号', () => {
    expect(normalizeQuery('F/A-18.')).toBe('fa18');
  });

  it('归一化不修改输入字符串', () => {
    const input = 'F/A 18';
    normalizeQuery(input);
    expect(input).toBe('F/A 18');
  });

  it('F/A 18 命中战斗机别名', () => {
    expect(catalogSearch('F/A 18').map((entry) => entry.key)).toContain('1-110104');
  });

  it('APC 命中机械化步兵别名', () => {
    expect(catalogSearch('APC').map((entry) => entry.key)).toContain('10-121102');
  });

  it('MBT 命中装甲别名', () => {
    expect(catalogSearch('MBT').map((entry) => entry.key)).toContain('10-120500');
  });

  it('支持实体代码前缀匹配', () => {
    expect(catalogSearch('1211').map((entry) => entry.key)).toContain('10-121100');
  });

  it('支持 SIDC 前缀匹配', () => {
    const entry = { ...listCatalog()[0], sidc: '10031000001121000000' };
    expect(catalogSearch('100310', [entry])).toEqual([entry]);
  });

  it('空查询返回传入的全量条目', () => {
    const entries = listCatalog();
    expect(catalogSearch('', entries)).toHaveLength(entries.length);
  });

  it('结果按稳定规则排序', () => {
    const entries = [
      {
        key: 'x-2',
        category: SymbolCategory.Formations,
        name: '乙',
        nameEn: 'Bravo',
        symbolSet: SymbolSet.Air,
      },
      {
        key: 'x-1',
        category: SymbolCategory.Formations,
        name: '甲',
        nameEn: 'Alpha',
        symbolSet: SymbolSet.Air,
      },
    ];
    expect(catalogSearch('', entries).map((entry) => entry.key)).toEqual(['x-1', 'x-2']);
  });

  it('重复检索保持相同排序', () => {
    expect(catalogSearch('机').map((entry) => entry.key)).toEqual(
      catalogSearch('机').map((entry) => entry.key),
    );
  });

  it('matchesQuery 支持英文名称', () => {
    const fighter = listCatalog().find((entry) => entry.key === '1-110104');
    expect(fighter && matchesQuery(fighter, 'fighter')).toBe(true);
  });
});
