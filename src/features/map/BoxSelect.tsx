/**
 * 地图框选交互。
 *
 * 框选期间直接命令式更新 Leaflet Rectangle，避免 mousemove 驱动 React
 * 或文档 store 更新，从而不污染撤销历史与渲染路径。
 */

import { rectangle, type LeafletMouseEvent, type Map as LeafletMap, type Rectangle } from 'leaflet';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

import type { LonLat, Pixel } from '@/core/geo';
import { featuresInBounds, Tool } from '@/core/model';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useEditStore } from '@/stores/useEditStore';
import { useViewStore } from '@/stores/useViewStore';
import { isBoxSelectDrag, lonLatBoundsFromCorners } from './boxSelectLogic';

/** 当前进行中的框选会话，仅存在组件 ref 中。 */
interface BoxSelectSession {
  append: boolean;
  start: LonLat;
  startPixel: Pixel;
  startLayerPixel: Pixel;
  rectangle: Rectangle;
  draggingWasEnabled: boolean;
  boxZoomWasEnabled: boolean;
}

/** 将 Leaflet 经纬度转为领域坐标。 */
function toLonLat(point: { lat: number; lng: number }): LonLat {
  return { lon: point.lng, lat: point.lat };
}

/**
 * 框选组件。
 *
 * Select 工具下仅 Ctrl/Cmd 拖动追加选择；BoxSelect 工具下任意拖动替换选择。
 */
export function BoxSelect() {
  const map = useMap();
  const sessionRef = useRef<BoxSelectSession | null>(null);
  const suppressNextClickRef = useRef(false);
  const activeToolRef = useRef(useViewStore.getState().activeTool);

  useEffect(
    () => useViewStore.subscribe((state) => (activeToolRef.current = state.activeTool)),
    [],
  );

  useEffect(() => {
    const complete = (event: LeafletMouseEvent): void => {
      const session = sessionRef.current;
      if (session === null) return;

      const endPixel = map.latLngToContainerPoint(event.latlng);
      const dragged = isBoxSelectDrag({ start: session.startPixel, end: endPixel });
      suppressNextClickRef.current = dragged;

      restoreMapInteractions(map, session);
      session.rectangle.remove();
      sessionRef.current = null;
      useEditStore.getState().setBoxSelect(null);

      if (!dragged) {
        useDocumentStore.getState().clearSelection();
        return;
      }

      const end = toLonLat(map.containerPointToLatLng(endPixel));
      const bounds = lonLatBoundsFromCorners(session.start, end);
      const documentStore = useDocumentStore.getState();
      const hitIds = featuresInBounds(documentStore.document.features, bounds, 'intersect');
      if (session.append) documentStore.addToSelection(hitIds);
      else documentStore.selectInBounds(bounds, 'intersect');
    };

    const begin = (event: LeafletMouseEvent): void => {
      if (sessionRef.current !== null) return;

      const activeTool = activeToolRef.current;
      const append =
        activeTool === Tool.Select && (event.originalEvent.ctrlKey || event.originalEvent.metaKey);
      const replacing = activeTool === Tool.BoxSelect;
      if (!append && !replacing) return;

      const start = toLonLat(event.latlng);
      const startPixel = map.latLngToContainerPoint(event.latlng);
      const startLayerPixel = map.latLngToLayerPoint(event.latlng);
      const draggingWasEnabled = map.dragging.enabled();
      const boxZoomWasEnabled = map.boxZoom.enabled();
      map.dragging.disable();
      map.boxZoom.disable();

      const selectionRectangle = rectangle(
        [
          [event.latlng.lat, event.latlng.lng],
          [event.latlng.lat, event.latlng.lng],
        ],
        {
          className: 'box-select-rectangle',
          color: '#076391',
          weight: 1,
          fillOpacity: 0.12,
          interactive: false,
        },
      ).addTo(map);

      sessionRef.current = {
        append,
        start,
        startPixel,
        startLayerPixel,
        rectangle: selectionRectangle,
        draggingWasEnabled,
        boxZoomWasEnabled,
      };
      useEditStore.getState().setBoxSelect({ a: start, b: start });
    };

    const update = (event: LeafletMouseEvent): void => {
      const session = sessionRef.current;
      if (session === null) return;

      const endLayerPixel = map.latLngToLayerPoint(event.latlng);
      const end = map.layerPointToLatLng(endLayerPixel);
      const start = map.layerPointToLatLng([session.startLayerPixel.x, session.startLayerPixel.y]);
      session.rectangle.setBounds([
        [start.lat, start.lng],
        [end.lat, end.lng],
      ]);
    };

    const suppressContextMenu = (event: MouseEvent): void => {
      if (sessionRef.current !== null) event.preventDefault();
    };

    const suppressContainerClick = (event: MouseEvent): void => {
      if (!suppressNextClickRef.current) return;
      suppressNextClickRef.current = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const container = map.getContainer();
    map.on('mousedown', begin);
    map.on('mousemove', update);
    map.on('mouseup', complete);
    container.addEventListener('click', suppressContainerClick, true);
    container.addEventListener('contextmenu', suppressContextMenu);

    return () => {
      map.off('mousedown', begin);
      map.off('mousemove', update);
      map.off('mouseup', complete);
      container.removeEventListener('click', suppressContainerClick, true);
      container.removeEventListener('contextmenu', suppressContextMenu);
      const session = sessionRef.current;
      if (session !== null) {
        restoreMapInteractions(map, session);
        session.rectangle.remove();
        sessionRef.current = null;
      }
      useEditStore.getState().setBoxSelect(null);
    };
  }, [map]);

  return null;
}

/** 恢复框选前的地图拖动与原生 BoxZoom 状态。 */
function restoreMapInteractions(map: LeafletMap, session: BoxSelectSession): void {
  if (session.draggingWasEnabled) map.dragging.enable();
  else map.dragging.disable();

  if (session.boxZoomWasEnabled) map.boxZoom.enable();
  else map.boxZoom.disable();
}
