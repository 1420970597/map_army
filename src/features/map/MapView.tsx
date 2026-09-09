/**
 * 地图主视图。
 *
 * 组合底图、军网、要素与绘制交互，构成应用的核心画布。
 * 视图状态（中心、缩放、底图、军网）来自 view store，
 * 文档数据（要素、图层）来自 document store，二者在此汇合。
 */

import { useEffect, useMemo } from 'react';
import { latLng } from 'leaflet';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';

import { TILE_SOURCES } from './tileSources';
import { ImageLayers } from './ImageLayers';
import { MapTools } from './MapTools';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useDocumentStore, usePrimaryFeature } from '@/stores/useDocumentStore';
import { useViewStore } from '@/stores/useViewStore';
import { DrawHandler } from '@/features/draw/DrawHandler';
import { VertexEditor } from '@/features/draw/VertexEditor';
import { isVertexEditorEligible } from '@/features/draw/vertexEditorLogic';
import { Map3DView } from './Map3DView';
import { BoxSelect } from './BoxSelect';
import { MapClickHandler, FeatureLayer } from './FeatureLayer';
import { GridOverlay } from './GridOverlay';
import { selectionAfterBlankClick, selectionAfterFeatureClick } from './mapSelection';
import { MouseTracker } from './MouseTracker';
import { MapCommandHandler } from './MapCommandHandler';

/**
 * 底图瓦片源配置。
 *
 * 均选用无需密钥即可访问的公开服务，保证克隆仓库后开箱可用。
 */

/**
 * 视图双向同步器。
 *
 * 职责是把地图实例的真实状态与 view store 对齐：
 * - **地图 → store**：拖动、缩放结束后写回中心点与缩放级别，
 *   使状态栏等外部组件能反映当前视野；
 * - **store → 地图**：当外部（如工具栏定位、跳转按钮）修改 store 时，
 *   驱动地图跳转。
 *
 * 双向同步的收敛条件是两条：
 * 1. store 的 setCenter / setZoom 带**同值守卫**（见 useViewStore），
 *    写回相同数值不会产生新状态，也就不会触发新的渲染；
 * 2. 跳转前先比较目标与地图当前状态，超过 1 米容差才真正调用 setView，
 *    避免"同步 → 触发事件 → 再同步"的抖动。
 *
 * 历史上这里曾用内联 `ref` 回调同步，而 React 每次渲染都会重新调用
 * 内联 ref 回调，配合无守卫的 setter 会形成
 * 写入 → 重渲染 → 再写入 的死循环，最终被 React 以
 * "Maximum update depth exceeded" 中断，页面整棵组件树被卸载——
 * 表现即为**白屏**。故一律使用事件订阅而非 ref 回调。
 */
function ViewSync() {
  const map = useMap();
  const center = useViewStore((state) => state.center);
  const zoom = useViewStore((state) => state.zoom);

  // 地图 → store
  useEffect(() => {
    const sync = () => {
      const current = map.getCenter();
      useViewStore.getState().setCenter({ lon: current.lng, lat: current.lat });
      useViewStore.getState().setZoom(map.getZoom());
    };
    // 挂载时先对齐一次，随后只在交互结束时同步
    sync();
    map.on('moveend', sync);
    map.on('zoomend', sync);
    return () => {
      map.off('moveend', sync);
      map.off('zoomend', sync);
    };
  }, [map]);

  // store → 地图
  useEffect(() => {
    const target = latLng(center.lat, center.lon);
    const moved = map.getCenter().distanceTo(target) > 1;
    if (moved || map.getZoom() !== zoom) {
      map.setView(target, zoom);
    }
  }, [map, center, zoom]);

  return null;
}

/**
 * 地图主视图组件。
 */
export function MapView() {
  const is3d = useViewStore((state) => state.is3d);
  const center = useViewStore((state) => state.center);
  const zoom = useViewStore((state) => state.zoom);
  const hillshade = usePreferencesStore((state) => state.hillshade);
  const baseMap = useViewStore((state) => state.baseMap);
  const grid = useViewStore((state) => state.grid);
  const gridLabels = useViewStore((state) => state.gridLabels);
  const activeTool = useViewStore((state) => state.activeTool);

  const features = useDocumentStore((state) => state.document.features);
  const layers = useDocumentStore((state) => state.document.layers);
  const selectedIds = useDocumentStore((state) => state.selectedIds);
  const select = useDocumentStore((state) => state.select);

  /**
   * 按图层顺序展开要素。
   *
   * Leaflet 按渲染顺序压盖，因此需要先按 order 升序排列图层，
   * 再依次取出其下的要素；隐藏图层直接跳过。
   */
  const orderedFeatures = useMemo(() => {
    const byId = new Map(layers.map((layer) => [layer.id, layer]));
    return [...features]
      .filter((feature) => byId.get(feature.layerId)?.visible !== false)
      .sort((a, b) => (byId.get(a.layerId)?.order ?? 0) - (byId.get(b.layerId)?.order ?? 0));
  }, [features, layers]);

  /**
   * 图层标识到不透明度的映射。
   *
   * 传给要素渲染层后，会被叠加到要素自身的描边/填充透明度上，
   * 使面板上的不透明度滑块能直接驱动地图表现。
   */
  const approvedLayerIds = useMemo(
    () => layers.filter((layer) => layer.status === 'approved').map((layer) => layer.id),
    [layers],
  );

  const layerOpacity = useMemo(() => {
    const map: Record<string, number> = {};
    for (const layer of layers) map[layer.id] = layer.opacity;
    return map;
  }, [layers]);

  const primaryFeature = usePrimaryFeature();

  const vertexEditing = isVertexEditorEligible({
    activeTool,
    selectedIds,
    feature: primaryFeature,
    layers,
  });
  const hiddenIds = vertexEditing && primaryFeature !== null ? [primaryFeature.id] : [];
  const tile = TILE_SOURCES[baseMap] ?? TILE_SOURCES.streets;

  if (is3d) return <Map3DView />;

  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={zoom}
      zoomControl={false}
      zoomSnap={0}
      // 绘制工具激活时禁用惯性拖动，避免采点过程中地图漂移
      dragging={true}
      preferCanvas={true}
      className="map-container"
    >
      {tile.url && (
        <TileLayer
          crossOrigin="anonymous"
          url={tile.url}
          attribution={tile.attribution}
          maxZoom={tile.maxZoom}
        />
      )}
      {hillshade && (
        <TileLayer
          crossOrigin="anonymous"
          url={TILE_SOURCES.terrain.url}
          attribution={TILE_SOURCES.terrain.attribution}
          maxNativeZoom={13}
          opacity={0.3}
        />
      )}
      <MapTools />
      <ZoomControl position="bottomright" />

      {/* 视图双向同步：替代会引发更新死循环的内联 ref 回调 */}
      <ViewSync />
      <MapCommandHandler />

      <GridOverlay type={grid} showLabels={gridLabels} />

      <ImageLayers />
      <FeatureLayer
        features={orderedFeatures}
        selectedIds={selectedIds}
        layerOpacity={layerOpacity}
        hiddenIds={hiddenIds}
        approvedLayerIds={approvedLayerIds}
        onSelect={(id, event) => {
          const originalEvent = event.originalEvent;
          const next = selectionAfterFeatureClick(selectedIds, id, {
            ctrlKey: originalEvent?.ctrlKey,
            metaKey: originalEvent?.metaKey,
          });
          select(next);
          if (next.length > 0) useViewStore.getState().setInspectorOpen(true);
        }}
      />

      <MapClickHandler onBlankClick={() => select(selectionAfterBlankClick())} />
      <BoxSelect />
      <VertexEditor
        activeTool={activeTool}
        selectedIds={selectedIds}
        feature={primaryFeature}
        visibleFeatures={orderedFeatures}
        layers={layers}
      />
      <DrawHandler />
      <MouseTracker />
    </MapContainer>
  );
}
