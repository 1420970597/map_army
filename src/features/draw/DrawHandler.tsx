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
 * 实现要点：草稿点同时保存在 state（驱动渲染）与 ref（供事件回调读取）。
 * Leaflet 的事件回调是命令式的，闭包中读到的是注册时的旧 state，
 * 用 ref 可以规避这一"闭包过期"问题。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleMarker, Polyline, Tooltip, useMapEvent } from 'react-leaflet';

import type { LonLat } from '@/core/geo';
import {
  createAreaGeometry,
  createFeature,
  createLineGeometry,
  createPointGeometry,
  formatDistance,
  measurePath,
  Tool,
} from '@/core/model';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useViewStore } from '@/stores/useViewStore';

/** 草稿线的视觉样式 */
const DRAFT_STYLE = { color: '#076391', weight: 2, dashArray: '6 4' };

/** 顶点控制点半径 */
const VERTEX_RADIUS = 5;

/**
 * 绘制处理器组件。
 *
 * 未激活任何绘制工具时返回 null，不注册任何地图事件，
 * 从而避免在选择模式下拦截本该用于选中要素的点击。
 */
export function DrawHandler() {
  const activeTool = useViewStore((state) => state.activeTool);
  const pendingSidc = useViewStore((state) => state.pendingSidc);
  const setActiveTool = useViewStore((state) => state.setActiveTool);

  const addFeature = useDocumentStore((state) => state.addFeature);
  const activeLayerId = useDocumentStore((state) => state.activeLayerId);

  const [draft, setDraft] = useState<LonLat[]>([]);
  const draftRef = useRef<LonLat[]>([]);
  const toolRef = useRef(activeTool);
  toolRef.current = activeTool;

  const isDrawing =
    activeTool === Tool.Line || activeTool === Tool.Area || activeTool === Tool.Measure;

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

  // 地图点击：采点或放置符号
  useMapEvent('click', (event) => {
    const point: LonLat = { lon: event.latlng.lng, lat: event.latlng.lat };

    if (toolRef.current === Tool.Symbol) {
      addFeature(
        createFeature({
          layerId: activeLayerId,
          sidc: pendingSidc,
          geometry: createPointGeometry(point.lon, point.lat),
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
      updateDraft([...draftRef.current, point]);
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
