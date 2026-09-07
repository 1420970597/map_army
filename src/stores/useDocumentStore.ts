/**
 * 标图文档的状态容器。
 *
 * 职责边界：本 store 只管理**文档数据**（图层与要素）及其变更历史，
 * 不感知任何地图与 UI 概念；视图状态（中心、缩放、当前工具）由
 * {@link useViewStore} 负责。二者分离使得文档可以脱离界面被导入导出与单测。
 */

import { create } from 'zustand';

import { createDocument, createLayer } from '@/core/model';
import type { FeatureStyle, FeatureTextFields, Layer, MapDocument, MapFeature } from '@/core/model';

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
  updateFeature: (id: string, patch: Partial<MapFeature>) => void;
  removeFeatures: (ids: string[]) => void;
  moveFeatureToLayer: (featureId: string, layerId: string) => void;

  // ── 图层操作 ─────────────────────────────────────────────
  addLayer: (name: string) => string;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;

  // ── 选择与文档级操作 ──────────────────────────────────────
  select: (ids: string[]) => void;
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
  const past = [...state.past, snapshot(state.document)];
  if (past.length > MAX_HISTORY) past.shift();

  return {
    document: touch(next),
    past,
    future: [],
  };
}

/** 初始文档 */
const initialDocument = createDocument();

export const useDocumentStore = create<DocumentState>((set, get) => ({
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

  updateFeature: (id, patch) =>
    set((state) =>
      commit(state, {
        ...state.document,
        features: state.document.features.map((feature) =>
          feature.id === id ? { ...feature, ...patch, updatedAt: Date.now() } : feature,
        ),
      }),
    ),

  removeFeatures: (ids) =>
    set((state) => {
      const target = new Set(ids);
      return commit(state, {
        ...state.document,
        features: state.document.features.filter((feature) => !target.has(feature.id)),
      });
    }),

  moveFeatureToLayer: (featureId, layerId) =>
    set((state) =>
      commit(state, {
        ...state.document,
        features: state.document.features.map((feature) =>
          feature.id === featureId ? { ...feature, layerId, updatedAt: Date.now() } : feature,
        ),
      }),
    ),

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
    set((state) =>
      commit(state, {
        ...state.document,
        layers: state.document.layers.map((layer) =>
          layer.id === id ? { ...layer, ...patch } : layer,
        ),
      }),
    ),

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

  select: (ids) => set({ selectedIds: ids }),

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
}));

/** 选中单个要素时读取其完整对象，未选中时返回 null */
export function useSelectedFeature(): MapFeature | null {
  return useDocumentStore((state) => {
    const id = state.selectedIds[0];
    if (!id) return null;
    return state.document.features.find((feature) => feature.id === id) ?? null;
  });
}

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
