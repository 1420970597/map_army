/**
 * 绘制交互处理器。
 *
 * 负责把用户的地图点击转换为要素：
 *
 * - **符号工具**：单击即在该处放置一个点符号，随后自动回到选择模式；
 * - **线/面工具**：连续单击采集顶点，双击或按 Enter 结束，按 Esc 放弃；
 * - **量距/量面积工具**：与线/面工具相同的交互，但不落库，只显示实时量测结果。
 *
 * 之所以把交互集中在单个组件内，是因为各工具共享同一套
 * "草稿点集合" 状态机，拆开反而要在多个组件间同步状态。
 *
 * 实现要点：草稿点同时保存在 state（驱动渲染）与 ref（供事件回调读取）。
 * Leaflet 的事件回调是命令式的，闭包中读到的是注册时的旧 state，
 * 用 ref 可以规避这一"闭包过期"问题。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleMarker, Polygon, Polyline, Tooltip, useMapEvent } from 'react-leaflet';

import type { LonLat } from '@/core/geo';
import {
  centroidOf,
  createAreaGeometry,
  createFeature,
  createLineGeometry,
  createPointGeometry,
  formatArea,
  formatBearing,
  formatDistance,
  measurePath,
  measureSegments,
  polygonArea,
  Tool,
} from '@/core/model';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useViewStore } from '@/stores/useViewStore';

/** 草稿线的视觉样式 */
const DRAFT_STYLE = { color: '#076391', weight: 2, dashArray: '6 4' };

/** 顶点控制点半径 */
const VERTEX_RADIUS = 5;

/** 标注锚点样式：圆点不显示，仅用于承载 Tooltip */
const ANCHOR_STYLE = { opacity: 0, fillOpacity: 0 };

/**
 * 判断工具是否处于"连续采点"模式。
 *
 * 线/面会落库为要素，量距/量面积只显示结果，但四者共享同一套采点交互。
 */
function isPolylineTool(tool: Tool): boolean {
  return (
    tool === Tool.Line || tool === Tool.Area || tool === Tool.Measure || tool === Tool.MeasureArea
  );
}

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

  const isDrawing = isPolylineTool(activeTool);

  /** 更新草稿，保持 state 与 ref 同步 */
  const updateDraft = useCallback((points: LonLat[]) => {
    draftRef.current = points;
    setDraft(points);
  }, []);

  const reset = useCallback(() => updateDraft([]), [updateDraft]);

  /**
   * 结束当前绘制并提交要素。
   *
   * 量距/量面积工具不产生要素，仅清空草稿。
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

  // 键盘控制：Enter 结束绘制，Esc 放弃
  useEffect(() => {
    if (!isDrawing) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitDraft(false);
      } else if (event.key === 'Escape') {
        reset();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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

    if (isPolylineTool(toolRef.current)) {
      updateDraft([...draftRef.current, point]);
    }
  });

  // 双击结束绘制。Leaflet 会先派发两次 click 再派发 dblclick，
  // 因此此处丢弃最后采集到的那个多余顶点。
  useMapEvent('dblclick', () => {
    if (isPolylineTool(toolRef.current)) {
      commitDraft(true);
    }
  });

  if (!isDrawing || draft.length === 0) return null;

  const positions = draft.map((point) => [point.lat, point.lon] as [number, number]);
  const isMeasureDistance = activeTool === Tool.Measure;
  const isMeasureArea = activeTool === Tool.MeasureArea;
  const hasPath = draft.length >= 2;
  const hasPolygon = draft.length >= 3;

  return (
    <>
      {isMeasureArea ? (
        <Polygon positions={positions} pathOptions={DRAFT_STYLE} />
      ) : (
        <Polyline positions={positions} pathOptions={DRAFT_STYLE} />
      )}

      {draft.map((point, index) => (
        <CircleMarker
          key={`${index}-${point.lon}-${point.lat}`}
          center={[point.lat, point.lon]}
          radius={VERTEX_RADIUS}
          pathOptions={{ color: '#076391', weight: 2, fillOpacity: 0.9 }}
        />
      ))}

      {/* 量距：每一段的中点标注该段长度与方位角 */}
      {isMeasureDistance && hasPath
        ? measureSegments(draft).map((segment) => (
            <Polyline
              key={`seg-${segment.index}`}
              positions={[
                [segment.from.lat, segment.from.lon],
                [segment.to.lat, segment.to.lon],
              ]}
              pathOptions={ANCHOR_STYLE}
            >
              <Tooltip permanent direction="top" className="measure-badge" opacity={0.9}>
                {formatDistance(segment.distance)} · {formatBearing(segment.bearing)}
              </Tooltip>
            </Polyline>
          ))
        : null}

      {/*
        量距：总长标注在最后一个顶点上。
        若沿用整条路径的中心作为锚点，两点量测时会与唯一分段标注完全重合。
      */}
      {isMeasureDistance && hasPath ? (
        <CircleMarker
          center={[draft[draft.length - 1].lat, draft[draft.length - 1].lon]}
          radius={0}
          interactive={false}
          pathOptions={ANCHOR_STYLE}
        >
          <Tooltip permanent direction="top" className="measure-badge" opacity={0.9}>
            总长 {formatDistance(measurePath(draft).length)}
          </Tooltip>
        </CircleMarker>
      ) : null}

      {/* 量面积：几何中心标注闭合区域面积 */}
      {isMeasureArea && hasPolygon ? (
        <CircleMarker
          center={[centroidOf(draft).lat, centroidOf(draft).lon]}
          radius={0}
          interactive={false}
          pathOptions={ANCHOR_STYLE}
        >
          <Tooltip permanent direction="top" className="measure-badge" opacity={0.9}>
            面积 {formatArea(polygonArea(draft))}
          </Tooltip>
        </CircleMarker>
      ) : null}
    </>
  );
}
