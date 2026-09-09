import { useAccessStore } from './useAccessStore';
/**
 * 标图文档的状态容器。
 *
 * 职责边界：本 store 只管理**文档数据**（图层与要素）及其变更历史，
 * 不感知任何地图与 UI 概念；视图状态（中心、缩放、当前工具）由
 * {@link useViewStore} 负责。二者分离使得文档可以脱离界面被导入导出与单测。
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type { LonLat } from '@/core/geo';
import {
  addToSelection as addSelectionIds,
  createDocument,
  createLayer,
  LayerStatus,
  deleteVertex,
  featuresInBounds,
  insertVertex,
  minVertexCountOf,
  removeFromSelection as removeSelectionIds,
  reorderLayers,
  resetAllBearings,
  resetBearing,
  toggleInSelection,
} from '@/core/model';
import type {
  Bounds,
  FeatureStyle,
  FeatureTextFields,
  Layer,
  MapDocument,
  MapFeature,
  SelectMode,
} from '@/core/model';

/** 撤销栈的最大深度，防止长时间编辑后内存无界增长 */
const MAX_HISTORY = 100;

/** 文档状态与操作 */
export interface DocumentState {
  /** 当前文档 */
  document: MapDocument;
  /** 当前活动图层标识，新建要素将归入该图层 */
  activeLayerId: string;
  /** 当前选中的要素标识集合 */
  selectedIds: string[];
  /** 撤销栈，保存历史快照 */
  past: MapDocument[];
  /** 重做栈 */
  future: MapDocument[];

  // ── 要素操作 ─────────────────────────────────────────────
  addFeature: (feature: MapFeature) => void;
  /** 原子追加多个要素；重复标识会被过滤，成功项会成为当前选择。 */
  addFeatures: (features: readonly MapFeature[]) => void;
  updateFeature: (id: string, patch: Partial<MapFeature>) => void;
  removeFeatures: (ids: string[]) => void;
  moveFeatureToLayer: (featureId: string, layerId: string) => void;
  /** 批量将实际可移动的要素迁移至未锁定目标图层。 */
  moveFeaturesToLayer: (ids: string[], layerId: string) => void;
  /** 在非点要素的指定位置插入一个顶点。 */
  insertVertexAt: (id: string, index: number, point: LonLat) => void;
  /** 删除非点要素的指定顶点，且不得低于几何最小点数。 */
  deleteVertexAt: (id: string, index: number) => void;
  /** 重置一个顶点或显式清除全部顶点的手动方向。 */
  resetVertexBearing: (id: string, index?: number | 'all') => void;

  // ── 图层操作 ─────────────────────────────────────────────
  addLayer: (name: string) => string;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  /**
   * 把 sourceId 图层移动到 targetId 图层所在的展示位置。
   *
   * 与逐层 `updateLayer` 相比，此方法只提交一次历史记录，
   * 避免一次拖拽在撤销栈里留下 N 个快照。位置计算委托给
   * {@link reorderLayers}，使其可在单测中独立验证。
   */
  moveLayer: (sourceId: string, targetId: string) => void;
  /** 设置图层状态，状态未变化时不产生历史。 */
  setLayerStatus: (id: string, status: NonNullable<Layer['status']>) => void;

  // ── 手势事务与几何预览 ────────────────────────────────────
  /** 开启一次手势事务；嵌套调用保留最初的快照。 */
  beginGesture: () => void;
  /** 结束当前手势事务；仅在预览实际改动后提交一条历史记录。 */
  endGesture: () => void;
  /** 在已开启手势内预览要素几何，不写入撤销栈。 */
  previewFeatureGeometry: (id: string, points: LonLat[], bearings?: number[]) => void;
  /** 在已开启手势内预览图层变更，不写入撤销栈。 */
  previewLayer: (id: string, patch: Partial<Layer>) => void;
  /** 原子应用要素几何，成功时只产生一条历史记录。 */
  applyGeometry: (id: string, points: LonLat[], bearings?: number[]) => void;

  // ── 选择与文档级操作 ──────────────────────────────────────
  select: (ids: string[]) => void;
  /** 切换一个要素的选中状态。 */
  toggleSelect: (id: string) => void;
  /** 向当前选择追加要素标识。 */
  addToSelection: (ids: string[]) => void;
  /** 从当前选择移除要素标识。 */
  removeFromSelection: (ids: string[]) => void;
  /** 清空当前选择。 */
  clearSelection: () => void;
  /** 选择指定图层内全部要素，保持文档要素顺序。 */
  selectAllInLayer: (layerId: string) => void;
  /** 以框选命中结果替换当前选择。 */
  selectInBounds: (bounds: Bounds, mode: SelectMode) => void;
  renameDocument: (name: string) => void;
  replaceDocument: (document: MapDocument) => void;
  clear: () => void;

  // ── 历史 ─────────────────────────────────────────────────
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

/** 深拷贝文档，用于历史快照。文档中只含纯数据，结构化克隆足够 */
function snapshot(document: MapDocument): MapDocument {
  return structuredClone(document);
}

/** 生成变更后的文档，并统一刷新修改时间 */
function touch(document: MapDocument): MapDocument {
  return { ...document, updatedAt: Date.now() };
}

/**
 * 记录一次变更。
 *
 * 把当前文档压入撤销栈并清空重做栈——一旦产生新的编辑分支，
 * 原先被撤销的操作就不再可重做，这与主流编辑器的行为一致。
 */
function commit(
  state: DocumentState,
  next: MapDocument,
): Pick<DocumentState, 'document' | 'past' | 'future'> {
  const past = appendHistory(state.past, snapshot(state.document));

  return {
    document: touch(next),
    past,
    future: [],
  };
}

/** 把快照加入历史，并保持撤销栈在容量上限内。 */
function appendHistory(past: MapDocument[], document: MapDocument): MapDocument[] {
  const next = [...past, document];
  if (next.length > MAX_HISTORY) next.shift();
  return next;
}

/** 两个坐标数组是否具有完全相同的经纬度值。 */
function samePoints(first: readonly LonLat[], second: readonly LonLat[]): boolean {
  return (
    first.length === second.length &&
    first.every(
      (point, index) => point.lon === second[index]?.lon && point.lat === second[index]?.lat,
    )
  );
}

/** 两个可选方向数组是否值相等，空槽与 undefined 均表示自动方向。 */
function sameBearings(
  first: readonly number[] | undefined,
  second: readonly number[] | undefined,
): boolean {
  if (first === undefined || second === undefined) return first === second;
  if (first.length !== second.length) return false;

  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) return false;
  }

  return true;
}

/** 图层补丁是否会改变图层的任意字段。 */
function changesLayer(layer: Layer, patch: Partial<Layer>): boolean {
  return Object.entries(patch).some(([key, value]) => layer[key as keyof Layer] !== value);
}

/** 校验几何编辑的点数与方向平行数组。 */
function isValidGeometryUpdate(
  feature: MapFeature,
  points: LonLat[],
  bearings?: number[],
): boolean {
  return (
    points.length >= minVertexCountOf(feature.geometry.kind) &&
    (bearings === undefined || bearings.length === points.length)
  );
}

/** 文档仅包含可序列化数据，可用稳定序列化判断手势最终是否回到起点。 */
function sameDocument(first: MapDocument, second: MapDocument): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

/**
 * 取出文档中可见的要素，并保持文档原有顺序。
 *
 * 口径与 MapView 的渲染过滤一致：隐藏图层下的要素不渲染，因此也不应被框选命中，
 * 否则会出现「看不见却能选中」、随后的删除/批量移动静默作用于不可见要素的问题。
 * 锁定只限制编辑、不限制选择，故此处不剔除锁定图层。
 */
export function visibleFeatures(document: MapDocument): MapFeature[] {
  const byId = new Map(document.layers.map((layer) => [layer.id, layer]));
  return document.features.filter((feature) => byId.get(feature.layerId)?.visible !== false);
}

/** 手势事务只存在 store 闭包中，绝不写入文档或持久化状态。 */
let pendingGesture: { snapshot: MapDocument; dirty: boolean } | null = null;

/** 初始文档 */
const initialDocument = createDocument();

export const useDocumentStore = create<DocumentState>((rawSet, get) => {
  // 只读保护位于所有写入共享的入口，覆盖快捷键、手势、属性表单及撤销重做。
  const set = (
    update: Partial<DocumentState> | ((state: DocumentState) => Partial<DocumentState>),
  ) =>
    rawSet((state) => {
      const next = typeof update === 'function' ? update(state) : update;
      if (
        useAccessStore.getState().readOnly &&
        (next.document !== undefined || next.past !== undefined || next.future !== undefined)
      )
        return state;
      return next;
    });
  return {
    document: initialDocument,
    activeLayerId: initialDocument.layers[0].id,
    selectedIds: [],
    past: [],
    future: [],

    addFeature: (feature) =>
      set((state) =>
        commit(state, {
          ...state.document,
          features: [...state.document.features, feature],
        }),
      ),

    addFeatures: (features) =>
      set((state) => {
        if (features.length === 0) return state;

        const featureIds = new Set(state.document.features.map((feature) => feature.id));
        const added: MapFeature[] = [];
        for (const feature of features) {
          if (featureIds.has(feature.id)) continue;
          featureIds.add(feature.id);
          // 剪贴板要素必须与调用方对象彻底隔离，避免后续修改穿透文档。
          added.push(structuredClone(feature));
        }
        if (added.length === 0) return state;

        return {
          ...commit(state, {
            ...state.document,
            features: [...state.document.features, ...added],
          }),
          selectedIds: added.map((feature) => feature.id),
        };
      }),

    updateFeature: (id, patch) =>
      set((state) => {
        const feature = state.document.features.find((item) => item.id === id);
        const layer = feature && state.document.layers.find((item) => item.id === feature.layerId);
        if (!feature || layer?.locked) return state;
        return commit(state, {
          ...state.document,
          features: state.document.features.map((feature) =>
            feature.id === id ? { ...feature, ...patch, updatedAt: Date.now() } : feature,
          ),
        });
      }),

    removeFeatures: (ids) =>
      set((state) => {
        const target = new Set(ids);
        const editable = new Set(
          state.document.layers.filter((layer) => !layer.locked).map((layer) => layer.id),
        );
        const remaining = state.document.features.filter(
          (feature) => !target.has(feature.id) || !editable.has(feature.layerId),
        );
        // 一个都没删掉时不提交历史，避免出现「按一次 Ctrl+Z 什么都没发生」的空记录。
        if (remaining.length === state.document.features.length) return state;

        return commit(state, { ...state.document, features: remaining });
      }),

    moveFeatureToLayer: (featureId, layerId) =>
      set((state) => {
        const feature = state.document.features.find((item) => item.id === featureId);
        const source = feature && state.document.layers.find((item) => item.id === feature.layerId);
        const target = state.document.layers.find((item) => item.id === layerId);
        if (
          !feature ||
          !source ||
          source.locked ||
          !target ||
          target.locked ||
          feature.layerId === layerId
        )
          return state;
        return commit(state, {
          ...state.document,
          features: state.document.features.map((feature) =>
            feature.id === featureId ? { ...feature, layerId, updatedAt: Date.now() } : feature,
          ),
        });
      }),

    moveFeaturesToLayer: (ids, layerId) =>
      set((state) => {
        const targetLayer = state.document.layers.find((layer) => layer.id === layerId);
        if (!targetLayer || targetLayer.locked) return state;

        const requestedIds = [...new Set(ids)];
        const featuresById = new Map(
          state.document.features.map((feature) => [feature.id, feature]),
        );
        const movedIds = requestedIds.filter((id) => {
          const feature = featuresById.get(id);
          const source =
            feature && state.document.layers.find((layer) => layer.id === feature.layerId);
          return (
            feature !== undefined &&
            source !== undefined &&
            !source.locked &&
            feature.layerId !== layerId
          );
        });
        if (movedIds.length === 0) return state;

        const movedIdSet = new Set(movedIds);
        const now = Date.now();
        return {
          ...commit(state, {
            ...state.document,
            features: state.document.features.map((feature) =>
              movedIdSet.has(feature.id) ? { ...feature, layerId, updatedAt: now } : feature,
            ),
          }),
          selectedIds: movedIds,
        };
      }),

    insertVertexAt: (id, index, point) =>
      set((state) => {
        const feature = state.document.features.find((item) => item.id === id);
        const layer = feature && state.document.layers.find((item) => item.id === feature.layerId);
        if (!feature || layer?.locked || feature.geometry.kind === 'point') return state;

        const result = insertVertex(feature.geometry.points, index, point, feature.vertexBearings);
        const nextFeature: MapFeature = {
          ...feature,
          geometry: { ...feature.geometry, points: result.points },
          vertexBearings: result.bearings,
          updatedAt: Date.now(),
        };
        return commit(state, {
          ...state.document,
          features: state.document.features.map((item) => (item.id === id ? nextFeature : item)),
        });
      }),

    deleteVertexAt: (id, index) =>
      set((state) => {
        const feature = state.document.features.find((item) => item.id === id);
        const layer = feature && state.document.layers.find((item) => item.id === feature.layerId);
        if (!feature || layer?.locked || feature.geometry.kind === 'point') return state;

        const points = deleteVertex(
          feature.geometry.points,
          index,
          minVertexCountOf(feature.geometry.kind),
        );
        if (points === null) return state;

        const bearings =
          feature.vertexBearings === undefined
            ? undefined
            : [
                ...feature.vertexBearings.slice(0, index),
                ...feature.vertexBearings.slice(index + 1),
              ];
        const nextFeature: MapFeature = {
          ...feature,
          geometry: { ...feature.geometry, points },
          vertexBearings: bearings,
          updatedAt: Date.now(),
        };
        return commit(state, {
          ...state.document,
          features: state.document.features.map((item) => (item.id === id ? nextFeature : item)),
        });
      }),

    resetVertexBearing: (id, index) =>
      set((state) => {
        const feature = state.document.features.find((item) => item.id === id);
        const layer = feature && state.document.layers.find((item) => item.id === feature.layerId);
        if (!feature || layer?.locked || feature.geometry.kind === 'point') return state;

        const bearings =
          index === undefined || index === 'all'
            ? resetAllBearings(feature.vertexBearings)
            : resetBearing(feature.vertexBearings, index);
        if (bearings === feature.vertexBearings) return state;

        const nextFeature: MapFeature = {
          ...feature,
          vertexBearings: bearings,
          updatedAt: Date.now(),
        };
        return commit(state, {
          ...state.document,
          features: state.document.features.map((item) => (item.id === id ? nextFeature : item)),
        });
      }),

    addLayer: (name) => {
      const layer = createLayer({
        name,
        order: Math.max(0, ...get().document.layers.map((item) => item.order)) + 1,
      });
      set((state) =>
        commit(state, {
          ...state.document,
          layers: [...state.document.layers, layer],
        }),
      );
      set({ activeLayerId: layer.id });
      return layer.id;
    },

    updateLayer: (id, patch) =>
      set((state) => {
        const current = state.document.layers.find((layer) => layer.id === id);
        if (
          !current ||
          Object.entries(patch).every(
            ([key, value]) => current[key as keyof typeof current] === value,
          )
        ) {
          return state;
        }
        return commit(state, {
          ...state.document,
          layers: state.document.layers.map((layer) =>
            layer.id === id ? { ...layer, ...patch } : layer,
          ),
        });
      }),

    removeLayer: (id) =>
      set((state) => {
        // 至少保留一个图层，否则用户将无处放置新要素
        if (state.document.layers.length <= 1) return state;

        const remaining = state.document.layers.filter((layer) => layer.id !== id);
        const next: MapDocument = {
          ...state.document,
          layers: remaining,
          // 图层被删除时，其上的要素一并删除
          features: state.document.features.filter((feature) => feature.layerId !== id),
        };

        const activeLayerId =
          state.activeLayerId === id ? remaining[remaining.length - 1].id : state.activeLayerId;

        return { ...commit(state, next), activeLayerId, selectedIds: [] };
      }),

    setActiveLayer: (id) => set({ activeLayerId: id }),

    moveLayer: (sourceId, targetId) =>
      set((state) => {
        // reorderLayers 在没有变化时返回原引用，便于直接判等跳过提交
        const next = reorderLayers(state.document.layers, sourceId, targetId);
        if (next === state.document.layers) return state;
        return commit(state, { ...state.document, layers: next });
      }),

    setLayerStatus: (id, status) =>
      set((state) => {
        const layer = state.document.layers.find((item) => item.id === id);
        if (!layer || (layer.status ?? LayerStatus.Working) === status) return state;
        return commit(state, {
          ...state.document,
          layers: state.document.layers.map((item) =>
            item.id === id ? { ...item, status } : item,
          ),
        });
      }),

    beginGesture: () => {
      if (pendingGesture !== null) return;
      pendingGesture = { snapshot: snapshot(get().document), dirty: false };
    },

    endGesture: () => {
      if (pendingGesture === null) return;

      const gesture = pendingGesture;
      pendingGesture = null;
      if (!gesture.dirty || sameDocument(gesture.snapshot, get().document)) return;

      set((state) => ({
        document: touch(state.document),
        past: appendHistory(state.past, gesture.snapshot),
        future: [],
      }));
    },

    previewFeatureGeometry: (id, points, bearings) => {
      if (pendingGesture === null) return;

      set((state) => {
        const feature = state.document.features.find((item) => item.id === id);
        const layer = feature && state.document.layers.find((item) => item.id === feature.layerId);
        if (!feature || layer?.locked || !isValidGeometryUpdate(feature, points, bearings))
          return state;

        const currentPoints =
          feature.geometry.kind === 'point' ? [feature.geometry.position] : feature.geometry.points;
        if (samePoints(currentPoints, points) && sameBearings(feature.vertexBearings, bearings))
          return state;

        const geometry =
          feature.geometry.kind === 'point'
            ? { ...feature.geometry, position: { ...points[0] } }
            : { ...feature.geometry, points: points.map((point) => ({ ...point })) };
        const nextFeature: MapFeature = {
          ...feature,
          geometry,
          // bearings 为 undefined 表示「本次不改动方向」，需保留要素既有手动方向；
          // 只有显式传入数组时才整体覆盖（isValidGeometryUpdate 已保证与顶点等长）。
          vertexBearings: bearings ? [...bearings] : feature.vertexBearings,
        };
        pendingGesture!.dirty = true;

        return {
          document: {
            ...state.document,
            features: state.document.features.map((item) => (item.id === id ? nextFeature : item)),
          },
        };
      });
    },

    previewLayer: (id, patch) => {
      if (pendingGesture === null) return;

      set((state) => {
        const layer = state.document.layers.find((item) => item.id === id);
        if (!layer || !changesLayer(layer, patch)) return state;

        pendingGesture!.dirty = true;
        return {
          document: {
            ...state.document,
            layers: state.document.layers.map((item) =>
              item.id === id ? { ...item, ...patch } : item,
            ),
          },
        };
      });
    },

    applyGeometry: (id, points, bearings) => {
      const state = get();
      const feature = state.document.features.find((item) => item.id === id);
      if (!feature || !isValidGeometryUpdate(feature, points, bearings)) return;

      const currentPoints =
        feature.geometry.kind === 'point' ? [feature.geometry.position] : feature.geometry.points;
      if (samePoints(currentPoints, points) && sameBearings(feature.vertexBearings, bearings))
        return;

      const ownsGesture = pendingGesture === null;
      if (ownsGesture) state.beginGesture();
      get().previewFeatureGeometry(id, points, bearings);
      if (ownsGesture) get().endGesture();
    },

    select: (ids) => set({ selectedIds: [...new Set(ids)] }),

    toggleSelect: (id) =>
      set((state) => ({ selectedIds: toggleInSelection(state.selectedIds, id) })),

    addToSelection: (ids) =>
      set((state) => ({ selectedIds: addSelectionIds(state.selectedIds, ids) })),

    removeFromSelection: (ids) =>
      set((state) => ({ selectedIds: removeSelectionIds(state.selectedIds, ids) })),

    clearSelection: () => set({ selectedIds: [] }),

    selectAllInLayer: (layerId) =>
      set((state) => ({
        selectedIds: state.document.features
          .filter((feature) => feature.layerId === layerId)
          .map((feature) => feature.id),
      })),

    selectInBounds: (bounds, mode) =>
      set((state) => ({
        selectedIds: featuresInBounds(visibleFeatures(state.document), bounds, mode),
      })),

    renameDocument: (name) => set((state) => commit(state, { ...state.document, name })),

    replaceDocument: (document) =>
      set((state) => {
        const base = commit(state, document);
        return {
          ...base,
          activeLayerId: document.layers[0]?.id ?? '',
          selectedIds: [],
        };
      }),

    clear: () =>
      set((state) => {
        const fresh = createDocument(state.document.name);
        return {
          ...commit(state, fresh),
          activeLayerId: fresh.layers[0].id,
          selectedIds: [],
        };
      }),

    undo: () => {
      const { past, document, future } = get();
      if (past.length === 0) return;

      const previous = past[past.length - 1];
      set({
        document: previous,
        past: past.slice(0, -1),
        future: [snapshot(document), ...future],
        selectedIds: [],
      });
    },

    redo: () => {
      const { future, document, past } = get();
      if (future.length === 0) return;

      const next = future[0];
      set({
        document: next,
        past: [...past, snapshot(document)],
        future: future.slice(1),
        selectedIds: [],
      });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  };
});

/** 用于选择 selector 的最小状态形状。 */
type SelectionState = Pick<DocumentState, 'document' | 'selectedIds'>;

/** 返回选择队列末位仍存在的主选要素。 */
export function selectPrimaryFeature(state: SelectionState): MapFeature | null {
  for (const id of [...state.selectedIds].reverse()) {
    const feature = state.document.features.find((item) => item.id === id);
    if (feature) return feature;
  }
  return null;
}

/** 返回按选择队列顺序去重并过滤缺失项后的已选要素。 */
export function selectSelectedFeatures(state: SelectionState): MapFeature[] {
  const featuresById = new Map(state.document.features.map((feature) => [feature.id, feature]));
  const seenIds = new Set<string>();
  const selected: MapFeature[] = [];

  for (const id of state.selectedIds) {
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const feature = featuresById.get(id);
    if (feature) selected.push(feature);
  }

  return selected;
}

/** 返回当前主选要素，即选择队列末位仍存在的要素。 */
export function usePrimaryFeature(): MapFeature | null {
  return useDocumentStore(selectPrimaryFeature);
}

/** 返回全部已选要素，按选择队列顺序过滤缺失项和重复项。 */
export function useSelectedFeatures(): MapFeature[] {
  return useDocumentStore(useShallow(selectSelectedFeatures));
}

/** @deprecated 请使用 usePrimaryFeature。 */
export const useSelectedFeature = usePrimaryFeature;

/** 按图层取出其下的要素，返回时已按创建时间升序 */
export function selectFeaturesOfLayer(document: MapDocument, layerId: string): MapFeature[] {
  return document.features.filter((feature) => feature.layerId === layerId);
}

/**
 * 合并式更新要素的文本修饰符。
 *
 * 抽取为独立函数而非 hook，是为了让 selector 始终返回**稳定引用**——
 * 若在此处返回闭包，zustand 每次比较都会判定为变化并触发重渲染。
 *
 * @param id 要素标识
 * @param patch 需要合并的字段
 */
export function mergeFeatureText(id: string, patch: FeatureTextFields): void {
  const state = useDocumentStore.getState();
  const feature = state.document.features.find((item) => item.id === id);
  if (!feature) return;
  state.updateFeature(id, { textFields: { ...feature.textFields, ...patch } });
}

/** 合并式更新要素的样式 */
export function mergeFeatureStyle(id: string, patch: FeatureStyle): void {
  const state = useDocumentStore.getState();
  const feature = state.document.features.find((item) => item.id === id);
  if (!feature) return;
  state.updateFeature(id, { style: { ...feature.style, ...patch } });
}
