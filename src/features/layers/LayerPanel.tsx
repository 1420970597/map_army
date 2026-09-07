/**
 * 图层与要素列表面板。
 *
 * 左侧列出图层（可切换可见性、锁定、重命名、删除），
 * 选中某个图层后，下方列出其承载的要素（可点选、删除）。
 */

import { useMemo, useState } from 'react';

import { GeometryKind, type MapFeature } from '@/core/model';
import { mergeFeatureText, useDocumentStore } from '@/stores/useDocumentStore';
import { useViewStore } from '@/stores/useViewStore';

/**
 * 图层面板组件。
 */
export function LayerPanel() {
  const layers = useDocumentStore((state) => state.document.layers);
  const features = useDocumentStore((state) => state.document.features);
  const activeLayerId = useDocumentStore((state) => state.activeLayerId);
  const setActiveLayer = useDocumentStore((state) => state.setActiveLayer);
  const addLayer = useDocumentStore((state) => state.addLayer);
  const updateLayer = useDocumentStore((state) => state.updateLayer);
  const removeLayer = useDocumentStore((state) => state.removeLayer);
  const selectedIds = useDocumentStore((state) => state.selectedIds);
  const select = useDocumentStore((state) => state.select);
  const removeFeatures = useDocumentStore((state) => state.removeFeatures);
  const setInspectorOpen = useViewStore((state) => state.setInspectorOpen);

  const [newLayerName, setNewLayerName] = useState('');

  /** 图层按 order 降序展示，与地图上的压盖顺序一致 */
  const orderedLayers = useMemo(() => [...layers].sort((a, b) => b.order - a.order), [layers]);

  const activeFeatures = useMemo(
    () => features.filter((feature) => feature.layerId === activeLayerId),
    [features, activeLayerId],
  );

  return (
    <aside className="panel panel-right">
      <div className="panel-header">
        <span>图层与要素</span>
      </div>

      <div className="panel-body">
        <div className="panel-section">
          <div className="panel-section-title">图层</div>

          {orderedLayers.map((layer) => (
            <div
              key={layer.id}
              className={`layer-row${layer.id === activeLayerId ? ' is-active' : ''}`}
              onClick={() => setActiveLayer(layer.id)}
            >
              <input
                type="checkbox"
                title="可见性"
                checked={layer.visible}
                onChange={(event) => {
                  event.stopPropagation();
                  updateLayer(layer.id, { visible: event.target.checked });
                }}
              />
              <span className="layer-name" title={layer.name}>
                {layer.name}
              </span>
              <button
                type="button"
                className="icon-button"
                title={layer.locked ? '解锁图层' : '锁定图层'}
                onClick={(event) => {
                  event.stopPropagation();
                  updateLayer(layer.id, { locked: !layer.locked });
                }}
              >
                {layer.locked ? '锁' : '开'}
              </button>
              <button
                type="button"
                className="icon-button"
                title="删除图层"
                disabled={layers.length <= 1}
                onClick={(event) => {
                  event.stopPropagation();
                  removeLayer(layer.id);
                }}
              >
                ×
              </button>
            </div>
          ))}

          <div className="field-row" style={{ marginTop: 8 }}>
            <input
              className="field-input"
              placeholder="新图层名称"
              value={newLayerName}
              onChange={(event) => setNewLayerName(event.target.value)}
            />
            <button
              type="button"
              className="tb-button"
              style={{ color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
              disabled={!newLayerName.trim()}
              onClick={() => {
                addLayer(newLayerName.trim());
                setNewLayerName('');
              }}
            >
              添加
            </button>
          </div>
        </div>

        <div className="panel-section">
          <div className="panel-section-title">要素（{activeFeatures.length}）</div>

          {activeFeatures.length === 0 ? (
            <div className="empty-hint">该图层暂无要素</div>
          ) : (
            activeFeatures.map((feature) => (
              <FeatureRow
                key={feature.id}
                feature={feature}
                selected={selectedIds.includes(feature.id)}
                onSelect={() => {
                  select([feature.id]);
                  setInspectorOpen(true);
                }}
                onDelete={() => removeFeatures([feature.id])}
                onRename={(name) => mergeFeatureText(feature.id, { uniqueDesignation: name })}
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

/** 要素行：显示几何类型图标、名称与操作按钮 */
function FeatureRow({
  feature,
  selected,
  onSelect,
  onDelete,
  onRename,
}: {
  feature: MapFeature;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const kindLabel =
    feature.geometry.kind === GeometryKind.Point
      ? '点'
      : feature.geometry.kind === GeometryKind.Line
        ? '线'
        : '面';

  return (
    <div className={`feature-row${selected ? ' is-selected' : ''}`} onClick={onSelect}>
      <span className="muted" title="几何类型">
        {kindLabel}
      </span>
      <input
        className="feature-name"
        value={feature.textFields.uniqueDesignation ?? ''}
        placeholder={feature.name || '未命名'}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onRename(event.target.value)}
      />
      <button
        type="button"
        className="icon-button"
        title="删除要素"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        ×
      </button>
    </div>
  );
}
