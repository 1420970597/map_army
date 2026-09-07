/**
 * 地图主视图。
 *
 * 组合底图、军网、要素与绘制交互，构成应用的核心画布。
 * 视图状态（中心、缩放、底图、军网）来自 view store，
 * 文档数据（要素、图层）来自 document store，二者在此汇合。
 */

import { useMemo } from 'react';
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet';

import { BaseMapType, Tool } from '@/core/model';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useViewStore } from '@/stores/useViewStore';
import { DrawHandler } from '@/features/draw/DrawHandler';
import { MapClickHandler, FeatureLayer } from './FeatureLayer';
import { GridOverlay } from './GridOverlay';
import { MouseTracker } from './MouseTracker';

/**
 * 底图瓦片源配置。
 *
 * 均选用无需密钥即可访问的公开服务，保证克隆仓库后开箱可用。
 */
const TILE_SOURCES: Record<BaseMapType, { url: string; attribution: string; maxZoom: number }> = {
  [BaseMapType.Streets]: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap 贡献者',
    maxZoom: 19,
  },
  [BaseMapType.Topo]: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap 贡献者, SRTM | 地图样式 &copy; OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
  },
  [BaseMapType.Satellite]: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18,
  },
};

/**
 * 地图主视图组件。
 */
export function MapView() {
  const center = useViewStore((state) => state.center);
  const zoom = useViewStore((state) => state.zoom);
  const baseMap = useViewStore((state) => state.baseMap);
  const grid = useViewStore((state) => state.grid);
  const gridLabels = useViewStore((state) => state.gridLabels);
  const setCenter = useViewStore((state) => state.setCenter);
  const setZoom = useViewStore((state) => state.setZoom);
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

  const tile = TILE_SOURCES[baseMap];

  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={zoom}
      zoomControl={false}
      // 绘制工具激活时禁用惯性拖动，避免采点过程中地图漂移
      dragging={activeTool !== Tool.Measure}
      className="map-container"
      // 以受控方式同步视图状态，便于外部按钮触发定位
      ref={(instance) => {
        if (!instance) return;
        setCenter({ lon: instance.getCenter().lng, lat: instance.getCenter().lat });
        setZoom(instance.getZoom());
      }}
    >
      <TileLayer url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />
      <ZoomControl position="bottomright" />

      <GridOverlay type={grid} showLabels={gridLabels} />

      <FeatureLayer
        features={orderedFeatures}
        selectedId={selectedIds[0] ?? null}
        onSelect={(id) => {
          select([id]);
          useViewStore.getState().setInspectorOpen(true);
        }}
      />

      <MapClickHandler onBlankClick={() => select([])} />
      <DrawHandler />
      <MouseTracker />
    </MapContainer>
  );
}
