/**
 * 要素渲染层。
 *
 * 把文档中的全部要素按图层顺序绘制到地图上，并处理选中、点击等交互。
 * 组件的渲染顺序即压盖顺序：图层 order 越大越靠上，越晚渲染。
 */

import { useMemo } from 'react';
import { TacticalGraphic } from './TacticalGraphic';
import { Circle, Marker, Polygon, Polyline, Tooltip, useMapEvent } from 'react-leaflet';

import type { LonLat } from '@/core/geo';
import { GeometryKind, type MapFeature } from '@/core/model';
import type * as L from 'leaflet';
import {
  applyLayerOpacity,
  featureHighlightStyleOf,
  featureStyleOf,
  selectedIdSetOf,
  type RenderStyle,
} from './featureStyle';
import { iconPartsOf, symbolIcon } from './symbolIcon';
import { useCustomSymbolStore } from '@/stores/useCustomSymbolStore';

/** 组件属性 */
export interface FeatureLayerProps {
  /** 需要渲染的要素集合，通常由调用方按图层过滤后传入 */
  features: MapFeature[];
  /** 点击要素的回调 */
  onSelect?: (id: string, event: L.LeafletMouseEvent) => void;
  /** 当前选中的要素标识集合 */
  selectedIds?: readonly string[];
  /**
   * 图层标识到不透明度的映射，缺省的图层视为完全不透明。
   * 在渲染时被叠加到要素自身样式上，使调整面板滑块时地图立即变化。
   */
  layerOpacity?: Record<string, number>;
  /** 编辑器接管渲染的要素标识，避免与幽灵几何重复绘制。 */
  hiddenIds?: readonly string[];
  /** 已核定图层以黑白渲染。 */
  approvedLayerIds?: readonly string[];
}

/** 缺省图层不透明度，避免热路径每次创建对象字面量 */
const DEFAULT_LAYER_OPACITY = 1;

/**
 * 要素渲染层组件。
 */
export function FeatureLayer({
  features,
  onSelect,
  selectedIds,
  layerOpacity,
  hiddenIds,
  approvedLayerIds,
}: FeatureLayerProps) {
  const selectedIdSet = useMemo(() => selectedIdSetOf(selectedIds), [selectedIds]);
  const hiddenIdSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const approvedIdSet = useMemo(() => new Set(approvedLayerIds), [approvedLayerIds]);

  return (
    <>
      {features
        .filter((feature) => !hiddenIdSet.has(feature.id))
        .map((feature) => (
          <FeatureShape
            key={feature.id}
            feature={feature}
            selected={selectedIdSet.has(feature.id)}
            onSelect={onSelect}
            opacity={layerOpacity?.[feature.layerId] ?? DEFAULT_LAYER_OPACITY}
            approved={approvedIdSet.has(feature.layerId)}
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
  opacity,
  approved = false,
}: {
  feature: MapFeature;
  selected: boolean;
  onSelect?: (id: string, event: L.LeafletMouseEvent) => void;
  /** 图层级不透明度 */
  opacity: number;
  approved?: boolean;
}) {
  const geometry = feature.geometry;
  if (feature.graphicType)
    return (
      <TacticalGraphic
        feature={feature}
        selected={selected}
        opacity={opacity}
        approved={approved}
        onSelect={onSelect}
      />
    );

  switch (geometry.kind) {
    case GeometryKind.Point:
      return (
        <PointFeature
          feature={feature}
          position={geometry.position}
          selected={selected}
          onSelect={onSelect}
          opacity={opacity}
          approved={approved}
        />
      );
    case GeometryKind.Line:
    case GeometryKind.Area: {
      const positions = toLatLngs(geometry.points);
      // 把图层级不透明度叠加到要素样式上：选中态与常态都受影响，
      // 这样拉滑块时高亮也会同步半透明，符合直觉。
      const style: RenderStyle = applyLayerOpacity(
        selected ? featureHighlightStyleOf(feature) : featureStyleOf(feature),
        opacity,
      );
      const shared = {
        positions,
        pathOptions: {
          weight: style.weight,
          opacity: style.opacity,
          dashArray: style.dashArray,
          fillOpacity: style.fillOpacity,
          color: approved ? '#111111' : style.color,
        },
        eventHandlers: onSelect
          ? { click: (event: L.LeafletMouseEvent) => onSelect(feature.id, event) }
          : undefined,
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
    default:
      return assertNever(geometry);
  }
}

/** 点要素：以军标符号标记呈现 */
function PointFeature({
  feature,
  position,
  selected,
  onSelect,
  opacity,
  approved = false,
}: {
  feature: MapFeature;
  position: LonLat;
  selected: boolean;
  onSelect?: (id: string, event: L.LeafletMouseEvent) => void;
  /** 图层级不透明度，传递给 Leaflet Marker 的 opacity 选项 */
  opacity: number;
  approved?: boolean;
}) {
  const customSvg = useCustomSymbolStore(
    (state) =>
      feature.customSymbolSvg ??
      state.symbols.find((symbol) => symbol.id === feature.customSymbolId)?.svg,
  );
  // 图标构造成本较高，按要素内容缓存；选中态通过 CSS 类切换而非重建图标
  const icon = useMemo(
    () =>
      symbolIcon({
        ...iconPartsOf(
          feature.sidc,
          feature.textFields,
          selected ? 52 : 40,
          feature.direction,
          feature.style?.fontSize,
          feature.style?.fontFamily,
        ),
        approved,
        customSvg,
      }),
    [
      feature.sidc,
      customSvg,
      feature.textFields,
      feature.direction,
      feature.style,
      selected,
      approved,
    ],
  );

  return (
    <>
      {feature.rangeRings?.map((radius) => (
        <Circle
          key={radius}
          center={[position.lat, position.lon]}
          radius={radius}
          pathOptions={{
            color: approved ? '#111111' : (feature.style?.color ?? '#0B82D6'),
            weight: feature.style?.weight ?? 2,
            opacity,
            fillOpacity: 0.03,
            dashArray: feature.style?.dashArray,
          }}
          eventHandlers={onSelect ? { click: (event) => onSelect(feature.id, event) } : undefined}
        >
          <Tooltip permanent direction="top">
            {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}
          </Tooltip>
        </Circle>
      ))}
      <Marker
        position={[position.lat, position.lon]}
        icon={icon}
        opacity={opacity}
        zIndexOffset={selected ? 1000 : 0}
        eventHandlers={
          onSelect
            ? { click: (event: L.LeafletMouseEvent) => onSelect(feature.id, event) }
            : undefined
        }
      >
        {feature.name ? <Tooltip direction="top">{feature.name}</Tooltip> : null}
      </Marker>
    </>
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

/** 几何联合类型扩展后强制补齐渲染分支。 */
function assertNever(value: never): never {
  throw new Error(`未支持的几何类型: ${String(value)}`);
}
