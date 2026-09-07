/**
 * 要素渲染层。
 *
 * 把文档中的全部要素按图层顺序绘制到地图上，并处理选中、点击等交互。
 * 组件的渲染顺序即压盖顺序：图层 order 越大越靠上，越晚渲染。
 */

import { useMemo } from 'react';
import { Marker, Polygon, Polyline, Tooltip, useMapEvent } from 'react-leaflet';

import type { LonLat } from '@/core/geo';
import { GeometryKind, type MapFeature } from '@/core/model';
import { featureHighlightStyleOf, featureStyleOf } from './featureStyle';
import { iconPartsOf, symbolIcon } from './symbolIcon';

/** 组件属性 */
export interface FeatureLayerProps {
  /** 需要渲染的要素集合，通常由调用方按图层过滤后传入 */
  features: MapFeature[];
  /** 点击要素的回调 */
  onSelect?: (id: string) => void;
  /** 当前选中的要素标识 */
  selectedId?: string | null;
}

/**
 * 要素渲染层组件。
 */
export function FeatureLayer({ features, onSelect, selectedId }: FeatureLayerProps) {
  return (
    <>
      {features.map((feature) => (
        <FeatureShape
          key={feature.id}
          feature={feature}
          selected={feature.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

/** 单个要素的图形，按几何类型分发 */
function FeatureShape({
  feature,
  selected,
  onSelect,
}: {
  feature: MapFeature;
  selected: boolean;
  onSelect?: (id: string) => void;
}) {
  const geometry = feature.geometry;

  if (geometry.kind === GeometryKind.Point) {
    return (
      <PointFeature
        feature={feature}
        position={geometry.position}
        selected={selected}
        onSelect={onSelect}
      />
    );
  }

  const positions = toLatLngs(geometry.points);
  const style = selected ? featureHighlightStyleOf(feature) : featureStyleOf(feature);

  const shared = {
    positions,
    pathOptions: {
      color: style.color,
      weight: style.weight,
      opacity: style.opacity,
      dashArray: style.dashArray,
      fillOpacity: selected ? 0.35 : 0.2,
    },
    eventHandlers: onSelect ? { click: () => onSelect(feature.id) } : undefined,
  };

  return geometry.kind === GeometryKind.Line ? (
    <Polyline {...shared}>
      {feature.name ? <Tooltip direction="top">{feature.name}</Tooltip> : null}
    </Polyline>
  ) : (
    <Polygon {...shared}>
      {feature.name ? <Tooltip direction="top">{feature.name}</Tooltip> : null}
    </Polygon>
  );
}

/** 点要素：以军标符号标记呈现 */
function PointFeature({
  feature,
  position,
  selected,
  onSelect,
}: {
  feature: MapFeature;
  position: LonLat;
  selected: boolean;
  onSelect?: (id: string) => void;
}) {
  // 图标构造成本较高，按要素内容缓存；选中态通过 CSS 类切换而非重建图标
  const icon = useMemo(
    () =>
      symbolIcon(
        iconPartsOf(feature.sidc, feature.textFields, selected ? 52 : 40, feature.direction),
      ),
    [feature.sidc, feature.textFields, feature.direction, selected],
  );

  return (
    <Marker
      position={[position.lat, position.lon]}
      icon={icon}
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={onSelect ? { click: () => onSelect(feature.id) } : undefined}
    >
      {feature.name ? <Tooltip direction="top">{feature.name}</Tooltip> : null}
    </Marker>
  );
}

/**
 * 地图空白处的点击处理：用于取消选中。
 *
 * 抽为独立组件是因为 react-leaflet 的地图事件只能在 MapContainer 的子组件中注册。
 */
export function MapClickHandler({ onBlankClick }: { onBlankClick: () => void }) {
  useMapEvent('click', onBlankClick);
  return null;
}

/**
 * 经纬度数组转为 Leaflet 的 [纬度, 经度] 元组序列。
 *
 * 注意：本文件只导出组件，工具函数保持文件内私有，
 * 否则会破坏 React Fast Refresh 的作用域假设。
 */
function toLatLngs(points: LonLat[]): [number, number][] {
  return points.map((point) => [point.lat, point.lon]);
}
