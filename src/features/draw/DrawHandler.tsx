/**
 * 绘制交互处理器。
 *
 * 负责把用户的地图点击转换为要素：
 *
 * - **符号工具**：单击即在该处放置一个点符号，随后自动回到选择模式；
 * - **线/面工具**：连续单击采集顶点，双击或按 Enter 结束，按 Esc 放弃；
 * - **量距工具**：与线工具相同的交互，但不落库，只显示实时距离。
 *
 * 之所以把交互集中在单个组件内，是因为三种工具共享同一套
 * "草稿点集合" 状态机，拆开反而要在多个组件间同步状态。
 *
 * 采点时同样复用顶点编辑的吸附引擎：草稿顶点与可见未锁定图层的要素顶点
 * 都会进入候选，命中后采集吸附点而非原始鼠标点（详见 drawSnapLogic）。
 *
 * 实现要点：草稿点同时保存在 state（驱动渲染）与 ref（供事件回调读取）。
 * Leaflet 的事件回调是命令式的，闭包中读到的是注册时的旧 state，
 * 用 ref 可以规避这一"闭包过期"问题。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { circleMarker, type CircleMarker as LeafletCircleMarker } from 'leaflet';
import { CircleMarker, Polyline, Tooltip, useMap, useMapEvent } from 'react-leaflet';

import type { LonLat, SnapCandidate, SnapResult } from '@/core/geo';
import {
  createAreaGeometry,
  createFeature,
  createLineGeometry,
  createPointGeometry,
  formatDistance,
  measurePath,
  Tool,
} from '@/core/model';
import { createLeafletProjection } from '@/features/map/leafletProjection';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useEditStore } from '@/stores/useEditStore';
import { useViewStore } from '@/stores/useViewStore';

import { buildDrawSnapCandidates, resolveDrawSnap, sameDrawSnapTarget } from './drawSnapLogic';

/** 草稿线的视觉样式 */
const DRAFT_STYLE = { color: '#076391', weight: 2, dashArray: '6 4' };

/** 顶点控制点半径 */
const VERTEX_RADIUS = 5;

/** 吸附指示器半径，与顶点编辑器保持一致以便视觉统一 */
const SNAP_INDICATOR_RADIUS = 9;

/** 非绘制期间的空候选，避免每次渲染产生新数组 */
const NO_CANDIDATES: readonly SnapCandidate[] = [];

/**
 * 绘制处理器组件。
 *
 * 未激活任何绘制工具时返回 null，不注册任何地图事件，
 * 从而避免在选择模式下拦截本该用于选中要素的点击。
 */
export function DrawHandler() {
  const map = useMap();
  const activeTool = useViewStore((state) => state.activeTool);
  const pendingSidc = useViewStore((state) => state.pendingSidc);
  const setActiveTool = useViewStore((state) => state.setActiveTool);

  const addFeature = useDocumentStore((state) => state.addFeature);
  const activeLayerId = useDocumentStore((state) => state.activeLayerId);
  const features = useDocumentStore((state) => state.document.features);
  const layers = useDocumentStore((state) => state.document.layers);

  const [draft, setDraft] = useState<LonLat[]>([]);
  const draftRef = useRef<LonLat[]>([]);
  const toolRef = useRef(activeTool);
  toolRef.current = activeTool;

  const isDrawing =
    activeTool === Tool.Line || activeTool === Tool.Area || activeTool === Tool.Measure;

  const projection = useMemo(() => createLeafletProjection(map), [map]);

  /**
   * 绘制期吸附候选：草稿顶点 + 可见未锁定图层的要素顶点。
   *
   * 只在草稿、文档或工具变化时重建，mousemove 中通过 ref 读取，
   * 避免每次鼠标移动都遍历整份文档。
   */
  const snapCandidates = useMemo(
    () => (isDrawing ? buildDrawSnapCandidates({ draft, features, layers }) : NO_CANDIDATES),
    [draft, features, isDrawing, layers],
  );
  const candidatesRef = useRef<readonly SnapCandidate[]>(NO_CANDIDATES);
  candidatesRef.current = snapCandidates;

  /** 当前吸附命中结果，供 click 采点直接复用，避免重复计算。 */
  const snapRef = useRef<SnapResult | null>(null);
  /** 吸附指示器；命令式增删，不进 React state，以免每帧重渲染地图。 */
  const indicatorRef = useRef<LeafletCircleMarker | null>(null);

  // 绘制期间挂载指示器，切工具或卸载时移除，避免图层泄漏
  useEffect(() => {
    if (!isDrawing) return;

    const indicator = circleMarker([0, 0], {
      className: 'draw-snap-indicator',
      color: '#f59e0b',
      weight: 2,
      fillColor: '#fff',
      fillOpacity: 0.75,
      radius: SNAP_INDICATOR_RADIUS,
      interactive: false,
    });
    indicatorRef.current = indicator;

    return () => {
      indicatorRef.current = null;
      indicator.remove();
    };
  }, [isDrawing]);

  // 离开绘制状态或卸载时清理吸附预览，避免残留指示器与过期的预览点
  useEffect(
    () => () => {
      snapRef.current = null;
      const edit = useEditStore.getState();
      if (edit.snapPreview !== null) edit.setSnapPreview(null);
    },
    [isDrawing],
  );

  /** 清除当前吸附命中与指示器。 */
  const clearSnap = useCallback(() => {
    snapRef.current = null;
    useEditStore.getState().setSnapPreview(null);
    const indicator = indicatorRef.current;
    if (indicator !== null && map.hasLayer(indicator)) map.removeLayer(indicator);
  }, [map]);

  /**
   * 按鼠标位置刷新吸附结果。
   *
   * 与目标未变化时直接返回，命中变化时才写 edit store（库内另有同值守卫）
   * 并移动指示器；此处绝不提交草稿。
   */
  const updateSnap = useCallback(
    (origin: LonLat) => {
      const edit = useEditStore.getState();
      const next = resolveDrawSnap({
        origin,
        candidates: candidatesRef.current,
        enabled: edit.snapEnabled,
        thresholdPx: edit.snapThresholdPx,
        projection,
      });
      if (sameDrawSnapTarget(snapRef.current, next)) return;

      snapRef.current = next;
      edit.setSnapPreview(next);

      const indicator = indicatorRef.current;
      if (indicator === null) return;
      if (next === null) {
        if (map.hasLayer(indicator)) map.removeLayer(indicator);
      } else {
        indicator.setLatLng([next.point.lat, next.point.lon]);
        if (!map.hasLayer(indicator)) indicator.addTo(map);
      }
    },
    [map, projection],
  );

  /** 更新草稿，保持 state 与 ref 同步 */
  const updateDraft = useCallback((points: LonLat[]) => {
    draftRef.current = points;
    setDraft(points);
  }, []);

  const reset = useCallback(() => updateDraft([]), [updateDraft]);

  /**
   * 结束当前绘制并提交要素。
   *
   * 量距工具不产生要素，仅清空草稿。
   *
   * @param dropLast 是否丢弃最后一个顶点——双击结束时会多采一个点
   */
  const commitDraft = useCallback(
    (dropLast = false) => {
      const tool = toolRef.current;
      const points = dropLast ? draftRef.current.slice(0, -1) : draftRef.current;

      if (tool === Tool.Line && points.length >= 2) {
        addFeature(
          createFeature({
            layerId: activeLayerId,
            sidc: pendingSidc,
            geometry: createLineGeometry(points),
          }),
        );
      } else if (tool === Tool.Area && points.length >= 3) {
        addFeature(
          createFeature({
            layerId: activeLayerId,
            sidc: pendingSidc,
            geometry: createAreaGeometry(points),
          }),
        );
      }
      reset();
    },
    [addFeature, activeLayerId, pendingSidc, reset],
  );

  // 本地 Enter/Esc 与全局快捷键命令桥共用同一提交/取消路径。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isDrawing) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        commitDraft(false);
      } else if (event.key === 'Escape') {
        reset();
      }
    };
    const confirm = (): void => {
      if (isDrawing) commitDraft(false);
    };
    const cancel = (): void => {
      if (isDrawing) reset();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('map-army:confirm-draw', confirm);
    window.addEventListener('map-army:cancel-draw', cancel);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('map-army:confirm-draw', confirm);
      window.removeEventListener('map-army:cancel-draw', cancel);
    };
  }, [isDrawing, commitDraft, reset]);

  // 切换工具时丢弃未完成的草稿，避免残留顶点混入下一次绘制
  useEffect(() => {
    reset();
  }, [activeTool, reset]);

  // 鼠标移动：仅刷新吸附预览，不改动草稿
  useMapEvent('mousemove', (event) => {
    if (!isDrawing) return;
    // 顶点拖拽期间由 VertexEditor 独占吸附预览，避免两者互相覆盖
    if (useEditStore.getState().drag !== null) return;
    updateSnap({ lon: event.latlng.lng, lat: event.latlng.lat });
  });

  // 地图点击：采点或放置符号
  useMapEvent('click', (event) => {
    const raw: LonLat = { lon: event.latlng.lng, lat: event.latlng.lat };

    if (toolRef.current === Tool.Symbol) {
      addFeature(
        createFeature({
          layerId: activeLayerId,
          sidc: pendingSidc,
          geometry: createPointGeometry(raw.lon, raw.lat),
        }),
      );
      // 放置后回到选择模式，避免连续误放
      setActiveTool(Tool.Select);
      return;
    }

    if (
      toolRef.current === Tool.Line ||
      toolRef.current === Tool.Area ||
      toolRef.current === Tool.Measure
    ) {
      // 复用 mousemove 已算好的吸附结果，命中时采集吸附点，否则用原始坐标
      const snapped = snapRef.current;
      const point: LonLat =
        snapped === null ? raw : { lon: snapped.point.lon, lat: snapped.point.lat };
      updateDraft([...draftRef.current, point]);
      clearSnap();
    }
  });

  // 双击结束绘制。Leaflet 会先派发两次 click 再派发 dblclick，
  // 因此此处丢弃最后采集到的那个多余顶点。
  useMapEvent('dblclick', () => {
    const tool = toolRef.current;
    if (tool === Tool.Line || tool === Tool.Area || tool === Tool.Measure) {
      commitDraft(true);
    }
  });

  if (!isDrawing || draft.length === 0) return null;

  const positions = draft.map((point) => [point.lat, point.lon] as [number, number]);
  const isMeasure = activeTool === Tool.Measure;

  return (
    <>
      <Polyline positions={positions} pathOptions={DRAFT_STYLE} />

      {draft.map((point, index) => (
        <CircleMarker
          key={`${index}-${point.lon}-${point.lat}`}
          center={[point.lat, point.lon]}
          radius={VERTEX_RADIUS}
          pathOptions={{ color: '#076391', weight: 2, fillOpacity: 0.9 }}
        />
      ))}

      {isMeasure && draft.length >= 2 ? (
        <Polyline positions={positions} pathOptions={{ opacity: 0 }}>
          <Tooltip permanent direction="top" className="measure-badge" opacity={0.9}>
            总长 {formatDistance(measurePath(draft).length)}
          </Tooltip>
        </Polyline>
      ) : null}
    </>
  );
}
