/**
 * 军网叠加层。
 *
 * 根据当前视口与缩放级别实时生成 MGRS / UTM / BNG 网格线，
 * 在地图缩放与平移时自动重算。网格线按"层级"分级着色：
 * 主级（如 100 km）用较粗较亮的线，次级用细线，形成层次感。
 *
 * 性能考虑：
 * - 网格生成是纯 CPU 计算，放在 `useMemo` 中按视口缓存；
 * - 测绘模块内部已对线条总数设上限，极端视口下会直接放弃绘制而非卡死。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';

import { generateGrid, suggestSpacing, type GeoBounds, type GridLine } from '@/core/geo';

/** 视口变化事件的最小触发间隔（毫秒），避免拖动时高频重算 */
const RECALC_DEBOUNCE = 120;

/** 网格线配色：按层级递减亮度 */
const LINE_COLORS = ['#d1495b', '#edae49', '#30638e'];

/** 网格组件属性 */
export interface GridOverlayProps {
  /** 网格类型，'none' 时不渲染任何内容 */
  type: string;
  /** 是否显示网格标签 */
  showLabels: boolean;
}

/**
 * 军网叠加层组件。
 *
 * 采用「监听地图事件 → 防抖更新视口 → 生成网格」的三段式结构，
 * 而不是在每次渲染时直接读取地图状态，这样可以让 React 的重渲染
 * 与 Leaflet 的内部状态变化解耦。
 */
export function GridOverlay({ type, showLabels }: GridOverlayProps) {
  const map = useMap();
  const [bounds, setBounds] = useState<GeoBounds>(() => readBounds(map));
  const [zoom, setZoom] = useState<number>(() => map.getZoom());

  /**
   * 读取当前视口的地理边界。
   *
   * 视口跨越 180° 经线时 Leaflet 会返回 east < west 的边界，
   * 测绘模块已处理该情形，此处保持原样传递。
   */
  const update = useCallback(() => {
    setBounds(readBounds(map));
    setZoom(map.getZoom());
  }, [map]);

  // 监听视口变化；防抖由 effect 内部的定时器实现
  useMapEvents({
    moveend: update,
    zoomend: update,
  });

  useEffect(() => {
    const timer = window.setTimeout(update, RECALC_DEBOUNCE);
    return () => window.clearTimeout(timer);
  }, [update, type]);

  const lines = useMemo<GridLine[]>(() => {
    if (type === 'none') return [];

    const spacing = suggestSpacing(zoom, (bounds.north + bounds.south) / 2);
    return generateGrid({
      bounds,
      type: type as 'MGRS' | 'UTM' | 'BNG' | 'WGS84' | 'GARS' | 'LV95' | 'LV03' | 'HEX',
      spacingMeters: spacing,
    });
  }, [bounds, zoom, type]);

  if (type === 'none') return null;

  return (
    <>
      {lines.map((line, index) => (
        <Polyline
          key={`${line.level}-${index}`}
          positions={line.path.map((point) => [point.lat, point.lon] as [number, number])}
          pathOptions={{
            color: LINE_COLORS[line.level % LINE_COLORS.length],
            weight: line.level === 0 ? 2 : 1,
            opacity: line.level === 0 ? 0.85 : 0.55,
            interactive: false,
          }}
        >
          {showLabels && line.label ? (
            <Tooltip direction="center" opacity={0.85} permanent>
              {line.label}
            </Tooltip>
          ) : null}
        </Polyline>
      ))}
    </>
  );
}

/** 从 Leaflet 地图实例读取视口边界 */
function readBounds(map: ReturnType<typeof useMap>): GeoBounds {
  const bounds = map.getBounds();
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}
