/**
 * 单要素顶点编辑器。
 *
 * 以 Leaflet 命令式图层承载幽灵几何和可拖拽手柄；拖拽过程只更新这些临时图层，
 * 松手后才通过 DocumentStore 的手势事务写入一次最终几何。
 */

import { useEffect, useRef } from 'react';
import {
  circleMarker,
  divIcon,
  marker,
  polygon,
  polyline,
  type LatLngExpression,
  type LeafletEventHandlerFnMap,
  type Marker as LeafletMarker,
} from 'leaflet';
import { useMap } from 'react-leaflet';

import type { LonLat } from '@/core/geo';
import { snapPoint } from '@/core/geo';
import { GeometryKind, moveVertex, type Layer, type MapFeature, type Tool } from '@/core/model';
import { createLeafletProjection } from '@/features/map/leafletProjection';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useEditStore } from '@/stores/useEditStore';

import {
  buildVertexSnapCandidates,
  isVertexEditorEligible,
  shouldCommitVertexDrag,
} from './vertexEditorLogic';

/** 手柄图标尺寸与锚点均以中心为准。 */
const HANDLE_SIZE = 12;
/** 幽灵线与手柄之上的吸附指示半径。 */
const SNAP_INDICATOR_RADIUS = 9;

/** 组件所需的选中要素与文档可见数据。 */
export interface VertexEditorProps {
  activeTool: Tool;
  selectedIds: readonly string[];
  feature: MapFeature | null;
  visibleFeatures: readonly MapFeature[];
  layers: readonly Layer[];
}

/** 返回 Leaflet 可消费的纬度、经度坐标元组。 */
function toLatLngs(points: readonly LonLat[]): LatLngExpression[] {
  return points.map((point) => [point.lat, point.lon]);
}

/** 创建用于拖拽的顶点手柄图标。 */
function vertexHandleIcon() {
  return divIcon({
    className: 'vertex-editor-handle-icon',
    html: '<span class="vertex-editor-handle-dot"></span>',
    iconSize: [HANDLE_SIZE, HANDLE_SIZE],
    iconAnchor: [HANDLE_SIZE / 2, HANDLE_SIZE / 2],
  });
}

/**
 * 单要素顶点编辑器。
 *
 * 不使用 React state 驱动拖拽帧，以免连续 mousemove 触发整棵地图重渲染。
 */
export function VertexEditor({
  activeTool,
  selectedIds,
  feature,
  visibleFeatures,
  layers,
}: VertexEditorProps) {
  const map = useMap();
  const ownsGestureRef = useRef(false);
  const draggingWasEnabledRef = useRef(false);

  useEffect(() => {
    if (!isVertexEditorEligible({ activeTool, selectedIds, feature, layers }) || feature === null)
      return;

    const editableFeature = feature;
    if (editableFeature.geometry.kind === GeometryKind.Point) return;
    const initialPoints = editableFeature.geometry.points.map((point) => ({ ...point }));
    const pointsRef = { current: initialPoints };
    const dragRef = { current: null as { index: number; startPoints: LonLat[] } | null };
    const projection = createLeafletProjection(map);
    const ghost =
      editableFeature.geometry.kind === GeometryKind.Area
        ? polygon(toLatLngs(initialPoints), {
            className: 'vertex-editor-ghost',
            color: '#0a7fb8',
            weight: 3,
            opacity: 0.9,
            fillColor: '#0a7fb8',
            fillOpacity: 0.1,
            interactive: false,
          })
        : polyline(toLatLngs(initialPoints), {
            className: 'vertex-editor-ghost',
            color: '#0a7fb8',
            weight: 3,
            opacity: 0.9,
            interactive: false,
          });
    const snapIndicator = circleMarker([0, 0], {
      className: 'vertex-editor-snap-indicator',
      color: '#f59e0b',
      weight: 2,
      fillColor: '#fff',
      fillOpacity: 0.75,
      radius: SNAP_INDICATOR_RADIUS,
      interactive: false,
    });
    const handles: LeafletMarker[] = [];

    ghost.addTo(map);

    const resetTransient = (): void => {
      const edit = useEditStore.getState();
      edit.endDrag();
      edit.setActiveVertex(null);
      edit.setSnapPreview(null);
      edit.setSnapCandidates([]);
      if (map.hasLayer(snapIndicator)) map.removeLayer(snapIndicator);
    };

    const restoreMapDragging = (): void => {
      if (draggingWasEnabledRef.current) map.dragging.enable();
      draggingWasEnabledRef.current = false;
    };

    /** 终止当前手势；中断场景永不写文档，正常结束时才落库。 */
    const finishDrag = (commit: boolean): void => {
      const drag = dragRef.current;
      if (drag === null) return;

      dragRef.current = null;
      restoreMapDragging();
      if (commit && shouldCommitVertexDrag(drag.startPoints, pointsRef.current)) {
        useDocumentStore.getState().applyGeometry(editableFeature.id, pointsRef.current);
      }
      if (ownsGestureRef.current) useDocumentStore.getState().endGesture();
      ownsGestureRef.current = false;
      resetTransient();
    };

    const createHandlers = (index: number): LeafletEventHandlerFnMap => ({
      dragstart: () => {
        if (dragRef.current !== null) return;

        const startPoints = pointsRef.current.map((point) => ({ ...point }));
        dragRef.current = { index, startPoints };
        useDocumentStore.getState().beginGesture();
        ownsGestureRef.current = true;
        draggingWasEnabledRef.current = map.dragging.enabled();
        if (draggingWasEnabledRef.current) map.dragging.disable();

        const candidates = buildVertexSnapCandidates({
          feature: editableFeature,
          features: visibleFeatures,
          layers,
        });
        const edit = useEditStore.getState();
        edit.setSnapCandidates(candidates);
        edit.beginDrag(editableFeature.id, index, startPoints);
        edit.setActiveVertex(index);
      },
      drag: (event) => {
        const drag = dragRef.current;
        if (drag === null) return;

        const handle = event.target as LeafletMarker;
        const position = handle.getLatLng();
        const rawPoint = { lon: position.lng, lat: position.lat };
        const edit = useEditStore.getState();
        const snapped = snapPoint(
          rawPoint,
          edit.snapCandidates,
          {
            enabled: edit.snapEnabled,
            thresholdPx: edit.snapThresholdPx,
            exclude: { featureId: editableFeature.id, index: drag.index },
          },
          projection,
        );
        const nextPoint = snapped?.point ?? rawPoint;
        pointsRef.current = moveVertex(drag.startPoints, drag.index, nextPoint);
        ghost.setLatLngs(toLatLngs(pointsRef.current));
        handle.setLatLng([nextPoint.lat, nextPoint.lon]);

        edit.setSnapPreview(snapped);
        if (snapped === null) {
          if (map.hasLayer(snapIndicator)) map.removeLayer(snapIndicator);
        } else {
          snapIndicator.setLatLng([snapped.point.lat, snapped.point.lon]);
          if (!map.hasLayer(snapIndicator)) snapIndicator.addTo(map);
        }
      },
      dragend: () => finishDrag(true),
    });

    for (const [index, point] of initialPoints.entries()) {
      const handle = marker([point.lat, point.lon], {
        draggable: true,
        icon: vertexHandleIcon(),
        keyboard: false,
        autoPan: true,
        bubblingMouseEvents: false,
        zIndexOffset: 1200,
      });
      handle.on(createHandlers(index));
      handle.addTo(map);
      handles.push(handle);
    }

    return () => {
      finishDrag(false);
      for (const handle of handles) handle.remove();
      ghost.remove();
      snapIndicator.remove();
      resetTransient();
    };
  }, [activeTool, feature, layers, map, selectedIds, visibleFeatures]);

  return null;
}
