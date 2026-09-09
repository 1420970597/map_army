/**
 * 要素属性面板。
 *
 * 编辑单个要素的符号与样式；多选时提供批量移动与删除操作。
 */

import { militarySvg } from '@/core/symbology/military';
import { useSymbolStore } from '@/stores/useSymbolStore';
import { useAccessStore } from '@/stores/useAccessStore';
import { useEffect, useMemo, useState } from 'react';

import {
  Affiliation,
  Context,
  Echelon,
  HqTfDummy,
  Status,
  createSidc,
  formatSidc,
  parseSidc,
} from '@/core/symbology';
import { mergeFeatureStyle, mergeFeatureText, useDocumentStore } from '@/stores/useDocumentStore';
import { useEditStore } from '@/stores/useEditStore';
import { useViewStore } from '@/stores/useViewStore';

import { canResetVertexBearing, deriveInspectorSelection, targetLayers } from './inspectorLogic';

/** 属性面板组件。 */
export function Inspector() {
  const open = useViewStore((state) => state.inspectorOpen);
  const setOpen = useViewStore((state) => state.setInspectorOpen);
  const selectedIds = useDocumentStore((state) => state.selectedIds);
  const features = useDocumentStore((state) => state.document.features);
  const layers = useDocumentStore((state) => state.document.layers);
  const updateFeature = useDocumentStore((state) => state.updateFeature);
  const removeFeatures = useDocumentStore((state) => state.removeFeatures);
  const moveFeaturesToLayer = useDocumentStore((state) => state.moveFeaturesToLayer);
  const resetVertexBearing = useDocumentStore((state) => state.resetVertexBearing);
  const readOnly = useAccessStore((s) => s.readOnly);
  const activeVertex = useEditStore((state) => state.activeVertex);
  const selection = useMemo(
    () => deriveInspectorSelection(selectedIds, features),
    [selectedIds, features],
  );

  if (!open || selection.mode === 'none') return null;

  return (
    <fieldset
      className="inspector"
      disabled={
        readOnly ||
        (selection.primary
          ? layers.find((l) => l.id === selection.primary?.layerId)?.locked
          : false)
      }
    >
      <div className="panel-header">
        <span>要素属性</span>
        <button type="button" className="icon-button" title="关闭" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>
      {selection.mode === 'multiple' ? (
        <MultiFeaturePanel
          selectedIds={selection.selectedIds}
          layers={targetLayers(layers)}
          onMove={moveFeaturesToLayer}
          onDelete={() => {
            removeFeatures(selection.selectedIds);
            setOpen(false);
          }}
        />
      ) : selection.primary ? (
        <SingleFeaturePanel
          key={selection.primary.id}
          feature={selection.primary}
          activeVertex={activeVertex}
          onUpdate={updateFeature}
          onDelete={() => {
            removeFeatures([selection.primary!.id]);
            setOpen(false);
          }}
          onResetVertexBearing={resetVertexBearing}
        />
      ) : null}
    </fieldset>
  );
}

/** 多选时的批量操作区。 */
function MultiFeaturePanel({
  selectedIds,
  layers,
  onMove,
  onDelete,
}: {
  selectedIds: readonly string[];
  layers: readonly { id: string; name: string; locked: boolean }[];
  onMove: (ids: string[], layerId: string) => void;
  onDelete: () => void;
}) {
  const initialLayerId = layers.find((layer) => !layer.locked)?.id ?? '';
  const [targetLayerId, setTargetLayerId] = useState(initialLayerId);

  useEffect(() => {
    if (!layers.some((layer) => layer.id === targetLayerId && !layer.locked)) {
      setTargetLayerId(layers.find((layer) => !layer.locked)?.id ?? '');
    }
  }, [layers, targetLayerId]);

  return (
    <div className="panel-body">
      <div className="inspector-batch-summary">已选 {selectedIds.length} 个要素</div>
      <div className="panel-section inspector-batch-actions">
        <label className="field">
          <span className="field-label">目标图层</span>
          <select
            className="field-select"
            value={targetLayerId}
            onChange={(event) => setTargetLayerId(event.target.value)}
          >
            {layers.map((layer) => (
              <option key={layer.id} value={layer.id} disabled={layer.locked}>
                {layer.name}
                {layer.locked ? '（已锁定）' : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="tb-button inspector-batch-button"
          disabled={!targetLayerId}
          onClick={() => onMove([...selectedIds], targetLayerId)}
        >
          移动
        </button>
        <button type="button" className="tb-button inspector-delete-button" onClick={onDelete}>
          批量删除
        </button>
      </div>
    </div>
  );
}

/** 单要素属性编辑表单。 */
function SingleFeaturePanel({
  feature,
  activeVertex,
  onUpdate,
  onDelete,
  onResetVertexBearing,
}: {
  feature: NonNullable<ReturnType<typeof deriveInspectorSelection>['primary']>;
  activeVertex: number | null;
  onUpdate: (id: string, patch: Partial<typeof feature>) => void;
  onDelete: () => void;
  onResetVertexBearing: (id: string, index?: number | 'all') => void;
}) {
  const mode = useSymbolStore((s) => s.symbolMode);
  const nativeExternal = feature.sidc.length === 15 && feature.nativeMss !== undefined;
  let sidc = createSidc();
  try {
    sidc = parseSidc(feature.sidc);
  } catch {
    // SIDC 非法时以默认符号继续编辑，用户可重新选择身份与实体
  }

  const patchSidc = (patch: Partial<typeof sidc>): void => {
    if (nativeExternal) return;
    onUpdate(feature.id, { sidc: formatSidc({ ...sidc, ...patch }) });
  };
  const canResetBearing = canResetVertexBearing(feature);

  return (
    <div className="panel-body">
      <div className="panel-section" style={{ textAlign: 'center' }}>
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
            militarySvg(feature.sidc, {
              ...feature.textFields,
              size: 96,
              direction: feature.direction,
            }),
          )}`}
          alt="符号预览"
          width={96}
          height={96}
        />
      </div>

      <div className="panel-section">
        <label className="field">
          <span className="field-label">名称</span>
          <input
            className="field-input"
            value={feature.name}
            onChange={(event) => onUpdate(feature.id, { name: event.target.value })}
          />
        </label>
      </div>

      <div className="panel-section">
        <TextField
          label="SIDC（15 位或 20 位）"
          value={feature.sidc}
          onChange={(value) => {
            if (/^(?:[A-Za-z0-9*-]{15}|\d{20})$/.test(value))
              onUpdate(feature.id, { sidc: value.toUpperCase(), nativeMss: undefined });
          }}
        />
        {nativeExternal && (
          <p className="field-hint native-format-warning" role="status">
            此要素来自原生 MilX 15 位 SIDC。未修改字段时保留原始
            MSS；编辑属性后将按本地字段重新生成。
          </p>
        )}
        {feature.geometry.kind === 'point' && (
          <label className="field">
            距离环半径（米，逗号分隔）
            <input
              key={feature.id + '-rings'}
              defaultValue={feature.rangeRings?.join(', ') ?? ''}
              onBlur={(e) => {
                const values = e.target.value
                  .split(/[,，;\s]+/)
                  .filter(Boolean)
                  .map(Number);
                if (values.every((n) => Number.isFinite(n) && n > 0))
                  onUpdate(feature.id, { rangeRings: [...new Set(values)].sort((a, b) => a - b) });
              }}
            />
          </label>
        )}
        <fieldset disabled={nativeExternal} className="native-sidc-fields">
          <div className="panel-section-title">符号标识（SIDC）</div>
          <label className="field">
            <span className="field-label">身份</span>
            <select
              className="field-select"
              value={sidc.affiliation}
              onChange={(event) =>
                patchSidc({ affiliation: Number(event.target.value) as Affiliation })
              }
            >
              <option value={Affiliation.Friend}>友军</option>
              <option value={Affiliation.Hostile}>敌军</option>
              <option value={Affiliation.Neutral}>中立</option>
              <option value={Affiliation.Unknown}>不明</option>
              <option value={Affiliation.AssumedFriend}>假定友军</option>
              <option value={Affiliation.Suspect}>可疑</option>
              <option value={Affiliation.Pending}>待定</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">上下文</span>
            <select
              className="field-select"
              value={sidc.context}
              onChange={(event) => patchSidc({ context: Number(event.target.value) as Context })}
            >
              <option value={Context.Reality}>真实</option>
              <option value={Context.Exercise}>演习</option>
              <option value={Context.Simulation}>模拟</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">状态</span>
            <select
              className="field-select"
              value={sidc.status}
              onChange={(event) => patchSidc({ status: Number(event.target.value) as Status })}
            >
              <option value={Status.Present}>存在</option>
              <option value={Status.Planned}>计划/预期</option>
              <option value={Status.Damaged}>受损</option>
              <option value={Status.Destroyed}>已摧毁</option>
              <option value={Status.FullToCapacity}>满载</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">司令部 / 特遣队</span>
            <select
              className="field-select"
              value={sidc.hqTfDummy}
              onChange={(event) =>
                patchSidc({ hqTfDummy: Number(event.target.value) as HqTfDummy })
              }
            >
              <option value={HqTfDummy.None}>无</option>
              <option value={HqTfDummy.FeintDummy}>佯动/假目标</option>
              <option value={HqTfDummy.Headquarters}>司令部</option>
              <option value={HqTfDummy.TaskForce}>特遣队</option>
              <option value={HqTfDummy.TaskForceHeadquarters}>特遣队司令部</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">梯队</span>
            <select
              className="field-select"
              value={sidc.amplifier}
              onChange={(event) => patchSidc({ amplifier: Number(event.target.value) })}
            >
              <option value={0}>无</option>
              <option value={Echelon.Team}>班/组</option>
              <option value={Echelon.Squad}>小队</option>
              <option value={Echelon.Platoon}>排</option>
              <option value={Echelon.Company}>连</option>
              <option value={Echelon.Battalion}>营</option>
              <option value={Echelon.Regiment}>团</option>
              <option value={Echelon.Brigade}>旅</option>
              <option value={Echelon.Division}>师</option>
              <option value={Echelon.Corps}>军</option>
              <option value={Echelon.Army}>集团军</option>
            </select>
          </label>
        </fieldset>
      </div>

      <div className="panel-section">
        <div className="panel-section-title">文本修饰符</div>
        <TextField
          label="唯一标识（右侧）"
          value={feature.textFields.uniqueDesignation ?? ''}
          onChange={(value) => mergeFeatureText(feature.id, { uniqueDesignation: value })}
        />
        <TextField
          label="上级编成（左侧）"
          value={feature.textFields.higherFormation ?? ''}
          onChange={(value) => mergeFeatureText(feature.id, { higherFormation: value })}
        />
        <TextField
          label="附加信息（右下）"
          value={feature.textFields.additionalInformation ?? ''}
          onChange={(value) => mergeFeatureText(feature.id, { additionalInformation: value })}
        />
        <TextField
          label="参谋注记（左下）"
          value={feature.textFields.staffComments ?? ''}
          onChange={(value) => mergeFeatureText(feature.id, { staffComments: value })}
        />
      </div>

      <div className="panel-section">
        {(
          [
            ['quantity', '兵力 / 装备数量'],
            ['type', '平台型号'],
            ['platformType', '平台代号'],
            ['commonIdentifier', '通用标识'],
            ['dtg', '日期时间组'],
            ['altitudeDepth', '高度 / 深度'],
            ['speed', '速度'],
            ['combatEffectiveness', '战斗效能'],
            ['reinforcedReduced', '加强 / 缩编'],
            ['specialHeadquarters', '特殊司令部'],
          ] as const
        ).map(([key, label]) => (
          <TextField
            key={key}
            label={label}
            value={feature.textFields[key] ?? ''}
            onChange={(value) => mergeFeatureText(feature.id, { [key]: value })}
          />
        ))}
        {mode === 'extended' &&
          (
            [
              ['modifier1', '扩展图标一'],
              ['modifier2', '扩展图标二'],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <input
                type="number"
                min={0}
                max={99}
                value={sidc[key]}
                onChange={(e) => patchSidc({ [key]: e.target.value.padStart(2, '0') })}
              />
            </label>
          ))}
      </div>
      <div className="panel-section">
        <div className="panel-section-title">样式</div>
        <label className="field">
          <span className="field-label">机动方向（方位角 {feature.direction ?? 0}°）</span>
          <input
            type="range"
            min={0}
            max={359}
            value={feature.direction ?? 0}
            onChange={(event) => onUpdate(feature.id, { direction: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          <span className="field-label">颜色</span>
          <input
            type="color"
            className="field-input"
            value={feature.style?.color ?? '#0B82D6'}
            onChange={(event) => mergeFeatureStyle(feature.id, { color: event.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">线宽 {feature.style?.weight ?? 3}</span>
          <input
            type="range"
            min={1}
            max={10}
            value={feature.style?.weight ?? 3}
            onChange={(event) =>
              mergeFeatureStyle(feature.id, { weight: Number(event.target.value) })
            }
          />
        </label>
      </div>

      {canResetBearing && (
        <div className="panel-section vertex-bearing-actions">
          <button
            type="button"
            className="tb-button inspector-batch-button"
            disabled={activeVertex === null}
            title={activeVertex === null ? '请先在地图上选择一个顶点' : '重置当前顶点方向'}
            onClick={() => activeVertex !== null && onResetVertexBearing(feature.id, activeVertex)}
          >
            重置当前顶点方向
          </button>
          <button
            type="button"
            className="tb-button inspector-batch-button"
            onClick={() => onResetVertexBearing(feature.id, 'all')}
          >
            重置全部顶点方向
          </button>
        </div>
      )}

      <div className="panel-section">
        <button type="button" className="tb-button inspector-delete-button" onClick={onDelete}>
          删除要素
        </button>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="field-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
