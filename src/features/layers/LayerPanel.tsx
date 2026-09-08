/**
 * 图层与要素列表面板。
 *
 * 左侧列出图层（可切换可见性、锁定、重命名、删除、拖拽排序、调整透明度），
 * 选中某个图层后，下方列出其承载的要素（可点选、删除）。
 */

import { useMemo, useState } from 'react';

import { GeometryKind, sortLayersByDisplay, type MapFeature } from '@/core/model';
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
  const moveLayer = useDocumentStore((state) => state.moveLayer);
  const removeLayer = useDocumentStore((state) => state.removeLayer);
  const selectedIds = useDocumentStore((state) => state.selectedIds);
  const select = useDocumentStore((state) => state.select);
  const removeFeatures = useDocumentStore((state) => state.removeFeatures);
  const setInspectorOpen = useViewStore((state) => state.setInspectorOpen);

  const [newLayerName, setNewLayerName] = useState('');

  // 重命名编辑态：仅允许同时编辑一个图层；draftName 保存输入框临时值
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  // 拖拽态：当前被拖动的图层与当前放置目标
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  /** 图层按 order 降序展示，与地图上的压盖顺序一致 */
  const orderedLayers = useMemo(() => sortLayersByDisplay(layers), [layers]);

  const activeFeatures = useMemo(
    () => features.filter((feature) => feature.layerId === activeLayerId),
    [features, activeLayerId],
  );

  /** 提交重命名：trim 后为空则放弃（保留原名），否则写入 store */
  const commitRename = () => {
    const id = editingLayerId;
    setEditingLayerId(null);
    if (!id) return;
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== layers.find((layer) => layer.id === id)?.name) {
      updateLayer(id, { name: trimmed });
    }
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
            return (
              <div
                key={layer.id}
                className={
                  `layer-row${layer.id === activeLayerId ? ' is-active' : ''}` +
                  (dragLayerId === layer.id ? ' is-dragging' : '') +
                  (dropTargetId === layer.id && dragLayerId && dragLayerId !== layer.id
                    ? ' is-drag-over'
                    : '')
                }
                // 编辑期间禁用整行拖拽，避免输入框与父级 draggable 互相干扰
                draggable={!isEditing}
                onDragStart={(event) => {
                  setDragLayerId(layer.id);
                  // Firefox 必需 setData 才能让 drop 事件触发
                  event.dataTransfer.setData('text/plain', layer.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDragLayerId(null);
                  setDropTargetId(null);
                }}
                onDragOver={(event) => {
                  if (!dragLayerId || dragLayerId === layer.id) return;
                  // 必须 preventDefault 才能触发 drop
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  if (dropTargetId !== layer.id) setDropTargetId(layer.id);
                }}
                onDragLeave={() => {
                  if (dropTargetId === layer.id) setDropTargetId(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceId = event.dataTransfer.getData('text/plain') || dragLayerId;
                  setDragLayerId(null);
                  setDropTargetId(null);
                  if (sourceId && sourceId !== layer.id) moveLayer(sourceId, layer.id);
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
                  // 阻止滑块上的事件冒泡触发整行的选中/拖拽
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
                    onChange={(event) =>
                      updateLayer(layer.id, { opacity: Number(event.target.value) })
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
