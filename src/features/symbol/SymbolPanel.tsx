/**
 * 符号选择面板。
 *
 * 用户在此组合出完整的 SIDC：先选身份与梯队，再点选具体符号，
 * 随后在地图上单击即可放置。面板本身不直接创建要素，
 * 只负责把"待放置符号"写入视图状态，由绘制处理器消费。
 */

import { useMemo, useState } from 'react';

import {
  Affiliation,
  Echelon,
  SymbolSet,
  createSidc,
  formatSidc,
  listSymbols,
  parseSidc,
  searchSymbols,
  symbolSetName,
  symbolToSvg,
  type Sidc,
  type SymbolDefinition,
} from '@/core/symbology';
import { Tool } from '@/core/model';
import { useViewStore } from '@/stores/useViewStore';

/** 可选的身份及其显示名 */
const AFFILIATIONS: { value: Affiliation; label: string }[] = [
  { value: Affiliation.Friend, label: '友军' },
  { value: Affiliation.Hostile, label: '敌军' },
  { value: Affiliation.Neutral, label: '中立' },
  { value: Affiliation.Unknown, label: '不明' },
  { value: Affiliation.AssumedFriend, label: '假定友军' },
  { value: Affiliation.Suspect, label: '可疑' },
];

/** 可选的梯队 */
const ECHELONS: { value: number; label: string }[] = [
  { value: 0, label: '无' },
  { value: Echelon.Team, label: '班/组' },
  { value: Echelon.Squad, label: '小队' },
  { value: Echelon.Platoon, label: '排' },
  { value: Echelon.Company, label: '连' },
  { value: Echelon.Battalion, label: '营' },
  { value: Echelon.Regiment, label: '团' },
  { value: Echelon.Brigade, label: '旅' },
  { value: Echelon.Division, label: '师' },
  { value: Echelon.Corps, label: '军' },
  { value: Echelon.Army, label: '集团军' },
];

/** 面板中提供的符号集分页 */
const TABS: SymbolSet[] = [
  SymbolSet.LandUnit,
  SymbolSet.Air,
  SymbolSet.SeaSurface,
  SymbolSet.SeaSubsurface,
];

/**
 * 符号选择面板组件。
 */
export function SymbolPanel() {
  const pendingSidc = useViewStore((state) => state.pendingSidc);
  const setPendingSidc = useViewStore((state) => state.setPendingSidc);
  const setActiveTool = useViewStore((state) => state.setActiveTool);

  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState<SymbolSet>(SymbolSet.LandUnit);

  /** 当前身份与梯队从 pendingSidc 反解，保证面板与地图上的符号一致 */
  const current = useMemo(() => {
    try {
      return parseSidc(pendingSidc);
    } catch {
      return createSidc();
    }
  }, [pendingSidc]);

  const symbols = useMemo(
    () => (keyword.trim() ? searchSymbols(keyword) : listSymbols(tab)),
    // 搜索时跨全部符号集，浏览时仅显示当前分页
    [keyword, tab],
  );

  /** 更新 pendingSidc 的若干字段 */
  const patchSidc = (patch: Partial<Sidc>): void => {
    setPendingSidc(formatSidc({ ...current, ...patch }));
  };

  /** 选中某个符号：写入实体代码并激活符号工具 */
  const pickSymbol = (definition: SymbolDefinition): void => {
    setPendingSidc(
      formatSidc({
        ...current,
        symbolSet: definition.symbolSet,
        entity: definition.entity.slice(0, 2),
        entityType: definition.entity.slice(2, 4),
        entitySubtype: definition.entity.slice(4, 6),
      }),
    );
    setActiveTool(Tool.Symbol);
  };

  return (
    <aside className="panel panel-left">
      <div className="panel-header">
        <span>军标符号</span>
      </div>

      <div className="panel-body">
        <div className="panel-section">
          <input
            className="symbol-search"
            placeholder="搜索符号（中英文）"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>

        <div className="panel-section">
          <div className="panel-section-title">身份</div>
          <select
            className="field-select"
            value={current.affiliation}
            onChange={(event) =>
              patchSidc({ affiliation: Number(event.target.value) as Affiliation })
            }
          >
            {AFFILIATIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="panel-section">
          <div className="panel-section-title">梯队</div>
          <select
            className="field-select"
            value={current.amplifier}
            onChange={(event) => patchSidc({ amplifier: Number(event.target.value) })}
          >
            {ECHELONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="panel-section">
          <div className="panel-section-title">
            {keyword.trim() ? `搜索结果（${symbols.length}）` : symbolSetName(tab)}
          </div>

          {!keyword.trim() ? (
            <div className="field-row" style={{ marginBottom: 6 }}>
              {TABS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`tb-button${tab === item ? ' is-active' : ''}`}
                  style={{ color: 'var(--c-text)', fontSize: 12 }}
                  onClick={() => setTab(item)}
                >
                  {symbolSetName(item)}
                </button>
              ))}
            </div>
          ) : null}

          <div className="symbol-grid">
            {symbols.map((definition) => (
              <SymbolTile
                key={`${definition.symbolSet}-${definition.entity}`}
                definition={definition}
                affiliation={current.affiliation}
                amplifier={current.amplifier}
                active={
                  definition.symbolSet === current.symbolSet &&
                  definition.entity ===
                    `${current.entity}${current.entityType}${current.entitySubtype}`
                }
                onPick={() => pickSymbol(definition)}
              />
            ))}
          </div>

          {symbols.length === 0 ? <div className="empty-hint">未找到匹配符号</div> : null}
        </div>
      </div>
    </aside>
  );
}

/**
 * 单个符号预览块。
 *
 * 以 data URI 形式内联 SVG，避免为每个预览块插入可执行的 DOM 子树。
 */
function SymbolTile({
  definition,
  affiliation,
  amplifier,
  active,
  onPick,
}: {
  definition: SymbolDefinition;
  affiliation: Affiliation;
  amplifier: number;
  active: boolean;
  onPick: () => void;
}) {
  const uri = useMemo(() => {
    const sidc = formatSidc(
      createSidc({
        affiliation,
        symbolSet: definition.symbolSet,
        amplifier,
        entity: definition.entity.slice(0, 2),
        entityType: definition.entity.slice(2, 4),
        entitySubtype: definition.entity.slice(4, 6),
      }),
    );
    return toDataUri(previewSvg(sidc, 48));
  }, [definition, affiliation, amplifier]);

  return (
    <button
      type="button"
      className={`symbol-item${active ? ' is-active' : ''}`}
      title={definition.nameEn}
      onClick={onPick}
    >
      <img src={uri} alt={definition.name} width={40} height={40} />
      <span className="symbol-item-name">{definition.name}</span>
    </button>
  );
}

/** 把 SVG 字符串转为可在 img 中使用的数据 URI */
function toDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * 生成符号预览用的 SVG。
 *
 * 非法 SIDC 回退到默认符号，保证面板在任何状态下都能渲染。
 */
function previewSvg(sidc: string, size: number): string {
  try {
    return symbolToSvg(parseSidc(sidc), { size });
  } catch {
    return symbolToSvg(createSidc(), { size });
  }
}
