/**
 * 图层与要素列表面板。
 *
 * 左侧列出图层（可切换可见性、锁定、状态、重命名、删除、拖拽排序、调整透明度），
 * 选中某个图层后，下方列出其承载的要素（可多选、移动和删除）。
 */

import { useMemo, useRef, useState, type MouseEvent } from 'react';

import { GeometryKind, rangeSelection, sortLayersByDisplay, type MapFeature } from '@/core/model';
import { mergeFeatureText, useDocumentStore } from '@/stores/useDocumentStore';
import { useViewStore } from '@/stores/useViewStore';

import {
  FEATURE_IDS_DRAG_MIME,
  LAYER_ID_DRAG_MIME,
  dropPayloadKind,
  layerStatusDisplay,
  opacityTransactionAction,
  parseFeatureDragIds,
  serializeFeatureDragIds,
} from './layerPanelLogic';

/** 图层面板组件。 */
export function LayerPanel() {
  const layers = useDocumentStore((state) => state.document.layers);
  const features = useDocumentStore((state) => state.document.features);
  const activeLayerId = useDocumentStore((state) => state.activeLayerId);
  const setActiveLayer = useDocumentStore((state) => state.setActiveLayer);
  const addLayer = useDocumentStore((state) => state.addLayer);
  const updateLayer = useDocumentStore((state) => state.updateLayer);
  const moveLayer = useDocumentStore((state) => state.moveLayer);
  const moveFeaturesToLayer = useDocumentStore((state) => state.moveFeaturesToLayer);
  const removeLayer = useDocumentStore((state) => state.removeLayer);
  const setLayerStatus = useDocumentStore((state) => state.setLayerStatus);
  const beginGesture = useDocumentStore((state) => state.beginGesture);
  const endGesture = useDocumentStore((state) => state.endGesture);
  const previewLayer = useDocumentStore((state) => state.previewLayer);
  const selectedIds = useDocumentStore((state) => state.selectedIds);
  const select = useDocumentStore((state) => state.select);
  const toggleSelect = useDocumentStore((state) => state.toggleSelect);
  const removeFeatures = useDocumentStore((state) => state.removeFeatures);
  const setInspectorOpen = useViewStore((state) => state.setInspectorOpen);

  const [newLayerName, setNewLayerName] = useState('');
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const opacityGestureActive = useRef(false);

  const orderedLayers = useMemo(() => sortLayersByDisplay(layers), [layers]);
  const activeFeatures = useMemo(
    () => features.filter((feature) => feature.layerId === activeLayerId),
    [features, activeLayerId],
  );
  const activeFeatureIds = useMemo(
    () => activeFeatures.map((feature) => feature.id),
    [activeFeatures],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const commitRename = () => {
    const id = editingLayerId;
    setEditingLayerId(null);
    if (!id) return;
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== layers.find((layer) => layer.id === id)?.name) {
      updateLayer(id, { name: trimmed });
    }
  };

  const applyOpacityTransaction = (
    event: 'pointerdown' | 'pointerup' | 'pointercancel' | 'blur' | 'keydown' | 'keyup',
    key?: string,
  ) => {
    const action = opacityTransactionAction(event, key);
    if (action === 'begin' && !opacityGestureActive.current) {
      opacityGestureActive.current = true;
      beginGesture();
    } else if (action === 'end' && opacityGestureActive.current) {
      opacityGestureActive.current = false;
      endGesture();
    }
  };

  const selectFeature = (featureId: string, event: MouseEvent<HTMLDivElement>) => {
    if (event.shiftKey && selectionAnchorId) {
      const range = rangeSelection(activeFeatureIds, selectionAnchorId, featureId);
      if (range.length > 0) select(range);
    } else if (event.ctrlKey || event.metaKey) {
      toggleSelect(featureId);
      setSelectionAnchorId(featureId);
    } else {
      select([featureId]);
      setSelectionAnchorId(featureId);
    }
    setInspectorOpen(true);
  };

  return (
    <aside className="panel panel-right">
      <div className="panel-header">
        <span>图层与要素</span>
      </div>

      <div className="panel-body">
        <div className="panel-section">
          <div className="panel-section-title">图层</div>

          {orderedLayers.map((layer) => {
            const isEditing = editingLayerId === layer.id;
            const status = layerStatusDisplay(layer.status);
            const acceptsDrop = dropTargetId === layer.id;
            return (
              <div
                key={layer.id}
                className={
                  `layer-row${layer.id === activeLayerId ? ' is-active' : ''}` +
                  (dragLayerId === layer.id ? ' is-dragging' : '') +
                  (acceptsDrop ? ' is-drag-over' : '')
                }
                draggable={!isEditing}
                onDragStart={(event) => {
                  setDragLayerId(layer.id);
                  event.dataTransfer.setData(LAYER_ID_DRAG_MIME, layer.id);
                  event.dataTransfer.setData('text/plain', layer.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDragLayerId(null);
                  setDropTargetId(null);
                }}
                onDragOver={(event) => {
                  const kind = dropPayloadKind(Array.from(event.dataTransfer.types));
                  if (!kind || (kind === 'layer' && dragLayerId === layer.id)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  if (dropTargetId !== layer.id) setDropTargetId(layer.id);
                }}
                onDragLeave={() => {
                  if (dropTargetId === layer.id) setDropTargetId(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const kind = dropPayloadKind(Array.from(event.dataTransfer.types));
                  setDragLayerId(null);
                  setDropTargetId(null);
                  if (kind === 'feature') {
                    const ids = parseFeatureDragIds(
                      event.dataTransfer.getData(FEATURE_IDS_DRAG_MIME),
                    );
                    if (ids) moveFeaturesToLayer(ids, layer.id);
                  } else if (kind === 'layer') {
                    const sourceId =
                      event.dataTransfer.getData(LAYER_ID_DRAG_MIME) ||
                      event.dataTransfer.getData('text/plain') ||
                      dragLayerId;
                    if (sourceId && sourceId !== layer.id) moveLayer(sourceId, layer.id);
                  }
                }}
                onClick={() => {
                  if (!isEditing) setActiveLayer(layer.id);
                }}
              >
                <input
                  type="checkbox"
                  title="可见性"
                  checked={layer.visible}
                  draggable={false}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    updateLayer(layer.id, { visible: event.target.checked });
                  }}
                />
                <button
                  type="button"
                  className={`layer-status-badge is-${layer.status ?? 'working'}`}
                  title={`当前状态：${status.label}；点击切换为${status.nextStatus === 'approved' ? '已核定' : '草稿'}`}
                  aria-label={`图层 ${layer.name} 当前状态${status.label}，点击切换`}
                  draggable={false}
                  onClick={(event) => {
                    event.stopPropagation();
                    setLayerStatus(layer.id, status.nextStatus);
                  }}
                >
                  {status.label}
                </button>
                {isEditing ? (
                  <input
                    className="layer-name layer-name-input"
                    value={draftName}
                    autoFocus
                    draggable={false}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitRename();
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        setEditingLayerId(null);
                      }
                    }}
                    onBlur={commitRename}
                  />
                ) : (
                  <span
                    className="layer-name"
                    title={`${layer.name}（双击重命名）`}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      setEditingLayerId(layer.id);
                      setDraftName(layer.name);
                    }}
                  >
                    {layer.name}
                  </span>
                )}
                <button
                  type="button"
                  className="icon-button"
                  title={layer.locked ? '解锁图层' : '锁定图层'}
                  draggable={false}
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
                  draggable={false}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeLayer(layer.id);
                  }}
                >
                  ×
                </button>
                <div
                  className="layer-opacity-row"
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <input
                    type="range"
                    className="layer-opacity"
                    min={0}
                    max={1}
                    step={0.05}
                    value={layer.opacity}
                    draggable={false}
                    title={`不透明度 ${Math.round(layer.opacity * 100)}%`}
                    aria-label={`图层 ${layer.name} 的不透明度`}
                    onPointerDown={() => applyOpacityTransaction('pointerdown')}
                    onPointerUp={() => applyOpacityTransaction('pointerup')}
                    onPointerCancel={() => applyOpacityTransaction('pointercancel')}
                    onBlur={() => applyOpacityTransaction('blur')}
                    onKeyDown={(event) => applyOpacityTransaction('keydown', event.key)}
                    onKeyUp={(event) => applyOpacityTransaction('keyup', event.key)}
                    onChange={(event) =>
                      previewLayer(layer.id, { opacity: Number(event.target.value) })
                    }
                  />
                  <span className="layer-opacity-value">{Math.round(layer.opacity * 100)}%</span>
                </div>
              </div>
            );
          })}

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
                selected={selectedIdSet.has(feature.id)}
                dragIds={selectedIdSet.has(feature.id) ? selectedIds : [feature.id]}
                onSelect={(event) => selectFeature(feature.id, event)}
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

/** 要素行：显示几何类型图标、名称与操作按钮。 */
function FeatureRow({
  feature,
  selected,
  dragIds,
  onSelect,
  onDelete,
  onRename,
}: {
  feature: MapFeature;
  selected: boolean;
  dragIds: readonly string[];
  onSelect: (event: MouseEvent<HTMLDivElement>) => void;
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
    <div
      className={`feature-row is-draggable${selected ? ' is-selected' : ''}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(FEATURE_IDS_DRAG_MIME, serializeFeatureDragIds(dragIds));
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onSelect}
    >
      <span className="muted" title="几何类型">
        {kindLabel}
      </span>
      <input
        className="feature-name"
        value={feature.textFields.uniqueDesignation ?? ''}
        placeholder={feature.name || '未命名'}
        draggable={false}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onRename(event.target.value)}
      />
      <button
        type="button"
        className="icon-button"
        title="删除要素"
        draggable={false}
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
