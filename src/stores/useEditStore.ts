/**
 * 几何编辑瞬态状态容器。
 *
 * 本 store 仅保存拖拽、吸附和框选期间的临时交互数据，不读取或修改文档、历史或持久化状态。
 */

import { create } from 'zustand';

import type { LonLat, SnapCandidate, SnapResult } from '@/core/geo';
import { SNAP_THRESHOLD_PX } from '@/core/geo';

/** 正在拖拽的顶点及其拖拽起始坐标快照。 */
export interface DragState {
  /** 被编辑的要素标识。 */
  featureId: string;
  /** 被拖拽顶点下标。 */
  index: number;
  /** 拖拽开始时的顶点坐标快照。 */
  startPoints: LonLat[];
}

/** 框选操作的起止经纬度坐标。 */
export interface BoxSelectState {
  /** 框选起点。 */
  a: LonLat;
  /** 框选终点。 */
  b: LonLat;
}

/** 编辑期间的瞬态状态与操作。 */
export interface EditState {
  /** 当前拖拽状态；无拖拽时为 null。 */
  drag: DragState | null;
  /** 当前活动顶点下标；无活动顶点时为 null。 */
  activeVertex: number | null;
  /** 是否启用吸附。 */
  snapEnabled: boolean;
  /** 吸附阈值，单位为像素。 */
  snapThresholdPx: number;
  /** 当前可参与吸附的候选点。 */
  snapCandidates: readonly SnapCandidate[];
  /** 当前吸附预览结果；无命中时为 null。 */
  snapPreview: SnapResult | null;
  /** 当前框选状态；无框选时为 null。 */
  boxSelect: BoxSelectState | null;

  /** 开始顶点拖拽并保存独立的起始顶点快照。 */
  beginDrag: (featureId: string, index: number, startPoints: readonly LonLat[]) => void;
  /** 结束当前顶点拖拽，仅清空拖拽状态。 */
  endDrag: () => void;
  /** 设置当前活动顶点。 */
  setActiveVertex: (index: number | null) => void;
  /** 切换吸附启用状态。 */
  toggleSnap: () => void;
  /** 设置吸附阈值；仅接受有限非负数。 */
  setSnapThresholdPx: (thresholdPx: number) => void;
  /** 设置可参与吸附的候选点，并深拷贝候选数据。 */
  setSnapCandidates: (candidates: readonly SnapCandidate[]) => void;
  /** 设置吸附预览；相同结果不更新状态。 */
  setSnapPreview: (preview: SnapResult | null) => void;
  /** 设置框选起止点；相同坐标不更新状态。 */
  setBoxSelect: (boxSelect: BoxSelectState | null) => void;
  /** 重置全部编辑瞬态状态。 */
  reset: () => void;
}

/** 返回坐标的独立副本。 */
function cloneLonLat(point: LonLat): LonLat {
  return { lon: point.lon, lat: point.lat };
}

/** 返回候选点的独立副本。 */
function cloneSnapCandidate(candidate: SnapCandidate): SnapCandidate {
  return {
    ...candidate,
    point: cloneLonLat(candidate.point),
  };
}

/** 返回吸附预览结果的独立副本。 */
function cloneSnapResult(result: SnapResult): SnapResult {
  return {
    ...result,
    point: cloneLonLat(result.point),
    candidate: cloneSnapCandidate(result.candidate),
  };
}

/** 判断两个经纬度坐标是否相同。 */
function sameLonLat(first: LonLat, second: LonLat): boolean {
  return first.lon === second.lon && first.lat === second.lat;
}

/** 判断两个候选点是否具有相同的吸附语义。 */
function sameSnapCandidate(first: SnapCandidate, second: SnapCandidate): boolean {
  return (
    first.source === second.source &&
    first.featureId === second.featureId &&
    first.index === second.index &&
    sameLonLat(first.point, second.point)
  );
}

/** 判断两个吸附预览结果是否相同。 */
function sameSnapResult(first: SnapResult | null, second: SnapResult | null): boolean {
  if (first === null || second === null) return first === second;
  return (
    first.source === second.source &&
    first.distancePx === second.distancePx &&
    sameLonLat(first.point, second.point) &&
    sameSnapCandidate(first.candidate, second.candidate)
  );
}

/** 创建默认编辑瞬态状态。 */
function defaultEditState(): Pick<
  EditState,
  | 'drag'
  | 'activeVertex'
  | 'snapEnabled'
  | 'snapThresholdPx'
  | 'snapCandidates'
  | 'snapPreview'
  | 'boxSelect'
> {
  return {
    drag: null,
    activeVertex: null,
    snapEnabled: true,
    snapThresholdPx: SNAP_THRESHOLD_PX,
    snapCandidates: [],
    snapPreview: null,
    boxSelect: null,
  };
}

/** 编辑瞬态 Zustand 状态容器。 */
export const useEditStore = create<EditState>((set) => ({
  ...defaultEditState(),

  beginDrag: (featureId, index, startPoints) =>
    set({
      drag: {
        featureId,
        index,
        startPoints: startPoints.map(cloneLonLat),
      },
    }),

  endDrag: () => set({ drag: null }),

  setActiveVertex: (index) => set({ activeVertex: index }),

  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),

  setSnapThresholdPx: (thresholdPx) =>
    set((state) => {
      if (
        !Number.isFinite(thresholdPx) ||
        thresholdPx < 0 ||
        state.snapThresholdPx === thresholdPx
      ) {
        return state;
      }
      return { snapThresholdPx: thresholdPx };
    }),

  setSnapCandidates: (candidates) => set({ snapCandidates: candidates.map(cloneSnapCandidate) }),

  setSnapPreview: (preview) =>
    set((state) => {
      if (sameSnapResult(state.snapPreview, preview)) return state;
      return { snapPreview: preview === null ? null : cloneSnapResult(preview) };
    }),

  setBoxSelect: (boxSelect) =>
    set((state) => {
      if (
        (state.boxSelect === null && boxSelect === null) ||
        (state.boxSelect !== null &&
          boxSelect !== null &&
          sameLonLat(state.boxSelect.a, boxSelect.a) &&
          sameLonLat(state.boxSelect.b, boxSelect.b))
      ) {
        return state;
      }
      return boxSelect === null
        ? { boxSelect: null }
        : { boxSelect: { a: cloneLonLat(boxSelect.a), b: cloneLonLat(boxSelect.b) } };
    }),

  reset: () => set(defaultEditState()),
}));
