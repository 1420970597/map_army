/** 六大分区符号库，支持别名搜索、收藏、标准身份及战术图形选择。 */
import { useMemo, useState } from 'react';
import type { TacticalGraphicType } from '@/core/model';
import { Tool } from '@/core/model';
import { GRAPHIC_META, sidcOfGraphic } from '@/core/graphics';
import {
  Affiliation,
  createSidc,
  formatSidc,
  parseSidc,
  symbolToSvg,
  listCatalog,
  catalogSearch,
  categoryLabelOf,
  SYMBOL_CATEGORY_ORDER,
  SymbolCategory,
  type CatalogEntry,
} from '@/core/symbology';
import { useViewStore } from '@/stores/useViewStore';
import { useSymbolStore } from '@/stores/useSymbolStore';
import { useCustomSymbolStore } from '@/stores/useCustomSymbolStore';

/** 选择一个目录项时构建其身份对应的标准代码。 */
function entrySidc(entry: CatalogEntry, affiliation: Affiliation): string {
  if (entry.sidc) return entry.sidc;
  if (entry.graphicType) return sidcOfGraphic(entry.graphicType as TacticalGraphicType);
  const entity = entry.entity ?? '000000';
  return formatSidc(
    createSidc({
      affiliation,
      symbolSet: entry.symbolSet,
      entity: entity.slice(0, 2),
      entityType: entity.slice(2, 4),
      entitySubtype: entity.slice(4, 6),
    }),
  );
}

export function SymbolPanel() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SymbolCategory>(SymbolCategory.Formations);
  const [affiliation, setAffiliation] = useState<Affiliation>(Affiliation.Friend);
  const [customName, setCustomName] = useState('');
  const [customSvg, setCustomSvg] = useState(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 5L95 95H5Z" fill="none" stroke="currentColor" stroke-width="8"/></svg>',
  );
  const favorites = useSymbolStore((state) => state.favorites);
  const toggleFavorite = useSymbolStore((state) => state.toggleFavorite);
  const customSymbols = useCustomSymbolStore((state) => state.symbols);
  const addCustomSymbol = useCustomSymbolStore((state) => state.add);
  const removeCustomSymbol = useCustomSymbolStore((state) => state.remove);
  const setPendingCustomSymbolId = useViewStore((state) => state.setPendingCustomSymbolId);
  const pendingSidc = useViewStore((state) => state.pendingSidc);
  const entries = useMemo(() => {
    const directSidc = /^(?:\d{15}|\d{20})$/.test(query.trim())
      ? [
          {
            key: `sidc:${query.trim()}`,
            category: SymbolCategory.FunctionSpecific,
            name: 'MSS 标准 SIDC',
            nameEn: 'MSS SIDC',
            symbolSet: 0 as CatalogEntry['symbolSet'],
            sidc: query.trim(),
            graphicType: undefined,
          } satisfies CatalogEntry,
        ]
      : [];
    return [
      ...directSidc,
      ...catalogSearch(
        query,
        listCatalog().filter(
          (entry) =>
            query.trim() ||
            (category === SymbolCategory.Favorites
              ? favorites.includes(entry.key)
              : entry.category === category),
        ),
      ),
    ];
  }, [query, category, favorites]);
  const pick = (entry: CatalogEntry) => {
    const view = useViewStore.getState();
    const type = entry.graphicType as TacticalGraphicType | undefined;
    useSymbolStore.getState().setGraphicType(type ?? null);
    view.setPendingSidc(entrySidc(entry, affiliation));
    setPendingCustomSymbolId(undefined);
    view.setActiveTool(type ? Tool.TacticalGraphic : Tool.Symbol);
  };
  const customMatches = customSymbols.filter(
    (symbol) =>
      !query ||
      `${symbol.name} ${symbol.nameEn ?? ''} ${(symbol.aliases ?? []).join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <aside className="panel panel-left">
      <div className="panel-header">
        <span>符号库</span>
        <span>{listCatalog().length}</span>
      </div>
      <div className="panel-body">
        <label className="field">
          <span className="field-label">搜索符号或装备名称</span>
          <input
            className="field-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="步兵 / F/A 18 / corridor"
          />
        </label>
        <label className="field">
          <span className="field-label">身份</span>
          <select
            className="field-select"
            value={affiliation}
            onChange={(event) => setAffiliation(Number(event.target.value) as Affiliation)}
          >
            <option value={Affiliation.Friend}>友军</option>
            <option value={Affiliation.Hostile}>敌方</option>
            <option value={Affiliation.Neutral}>中立</option>
            <option value={Affiliation.Unknown}>未知</option>
            <option value={Affiliation.AssumedFriend}>推定友军</option>
            <option value={Affiliation.Suspect}>可疑</option>
            <option value={Affiliation.Pending}>待定</option>
          </select>
        </label>
        <div className="symbol-categories" role="tablist">
          {SYMBOL_CATEGORY_ORDER.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={category === item}
              className={category === item ? 'is-active' : ''}
              key={item}
              onClick={() => {
                setCategory(item);
                setQuery('');
              }}
            >
              {categoryLabelOf(item)}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={category === SymbolCategory.Custom}
            className={category === SymbolCategory.Custom ? 'is-active' : ''}
            onClick={() => {
              setCategory(SymbolCategory.Custom);
              setQuery('');
            }}
          >
            {categoryLabelOf(SymbolCategory.Custom)}
          </button>
        </div>
        <p className="empty-hint">
          {query ? `搜索结果：${entries.length}` : categoryLabelOf(category)} · 点击选择，右键收藏 ·
          MSS 引擎支持完整标准 SIDC
        </p>
        <div className="symbol-grid">
          {category === SymbolCategory.Custom
            ? customMatches.map((symbol) => (
                <button
                  type="button"
                  className="symbol-item"
                  key={symbol.id}
                  onClick={() => {
                    setPendingCustomSymbolId(symbol.id);
                    useViewStore
                      .getState()
                      .setPendingSidc(symbol.baseSidc ?? '10031000001211000000');
                    useViewStore.getState().setActiveTool(Tool.Symbol);
                  }}
                >
                  <img
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(symbol.svg)}`}
                    alt=""
                    width={44}
                    height={44}
                  />
                  <span className="symbol-item-name">{symbol.name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeCustomSymbol(symbol.id);
                    }}
                  >
                    删除
                  </span>
                </button>
              ))
            : entries.map((entry) => {
                const sidc = entrySidc(entry, affiliation);
                const type = entry.graphicType as TacticalGraphicType | undefined;
                const svg = type ? null : symbolToSvg(parseSidc(sidc), { size: 48 });
                return (
                  <button
                    type="button"
                    className={`symbol-item${pendingSidc === sidc ? ' is-active' : ''}`}
                    key={entry.key}
                    title={`${entry.nameEn}${favorites.includes(entry.key) ? ' · 已收藏' : ''}`}
                    onClick={() => pick(entry)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      toggleFavorite(entry.key);
                    }}
                  >
                    {svg ? (
                      <img
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
                        alt=""
                        width={44}
                        height={44}
                      />
                    ) : (
                      <span className="graphic-preview">
                        {type === 'assemblyArea'
                          ? '▱'
                          : type === 'corridor'
                            ? '╱╱'
                            : type?.includes('Arrow') || type === 'axisOfAdvance'
                              ? '➜'
                              : '⎯'}
                      </span>
                    )}
                    <span className="symbol-item-name">
                      {favorites.includes(entry.key) ? '★ ' : ''}
                      {type ? GRAPHIC_META[type].name : entry.name}
                    </span>
                  </button>
                );
              })}
        </div>
        {category === SymbolCategory.Custom ? (
          <div className="panel-section">
            <label className="field">
              <span className="field-label">名称</span>
              <input
                className="field-input"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="例如：任务专用标记"
              />
            </label>
            <label className="field">
              <span className="field-label">SVG 图形</span>
              <textarea
                className="field-input"
                rows={5}
                value={customSvg}
                onChange={(event) => setCustomSvg(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="tb-button"
              disabled={!customName.trim()}
              onClick={() => {
                try {
                  addCustomSymbol({ name: customName.trim(), svg: customSvg, category: 'custom' });
                  setCustomName('');
                } catch {
                  /* 输入错误由表单状态处理 */
                }
              }}
            >
              保存自定义军标
            </button>
          </div>
        ) : null}
        {(category === SymbolCategory.Custom ? customMatches.length : entries.length) === 0 && (
          <p className="empty-hint">暂无符号；可在此创建自定义军标。</p>
        )}
        <p className="empty-hint">MIL-STD-2525C / APP-6(C) 基线 · 兼容 2525D 数字 SIDC</p>
      </div>
    </aside>
  );
}
