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
  const favorites = useSymbolStore((state) => state.favorites);
  const toggleFavorite = useSymbolStore((state) => state.toggleFavorite);
  const pendingSidc = useViewStore((state) => state.pendingSidc);
  const entries = useMemo(
    () =>
      catalogSearch(
        query,
        listCatalog().filter(
          (entry) =>
            query.trim() ||
            (category === SymbolCategory.Favorites
              ? favorites.includes(entry.key)
              : entry.category === category),
        ),
      ),
    [query, category, favorites],
  );
  const pick = (entry: CatalogEntry) => {
    const view = useViewStore.getState();
    const type = entry.graphicType as TacticalGraphicType | undefined;
    useSymbolStore.getState().setGraphicType(type ?? null);
    view.setPendingSidc(entrySidc(entry, affiliation));
    view.setActiveTool(type ? Tool.TacticalGraphic : Tool.Symbol);
  };
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
        </div>
        <p className="empty-hint">
          {query ? `搜索结果：${entries.length}` : categoryLabelOf(category)} · 点击选择，右键收藏
        </p>
        <div className="symbol-grid">
          {entries.map((entry) => {
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
        {entries.length === 0 && <p className="empty-hint">暂无符号；右键符号可加入收藏。</p>}
        <p className="empty-hint">MIL-STD-2525C / APP-6(C) 基线 · 兼容 2525D 数字 SIDC</p>
      </div>
    </aside>
  );
}
