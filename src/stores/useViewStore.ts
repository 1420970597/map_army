/**
 * 视图状态容器。
 *
 * 管理一切与"怎么看"有关的状态：地图位置、底图、军网、当前工具、
 * 面板开合等。与文档数据严格分离，因此切换视图永远不会污染标图内容。
 */

import { create } from 'zustand';

import type { GridType, LonLat } from '@/core/geo';
import { BaseMapType, Tool } from '@/core/model';

/**
 * 军网显示的取值。
 *
 * 在测绘模块的三类网格之外增加一个"关闭"选项，故用联合类型表达，
 * 而不是把 none 塞进测绘模块的枚举里污染领域模型。
 */
export type GridDisplay = GridType | 'none';

/** 视图状态与操作 */
export interface ViewState {
  /** 地图中心 */
  center: LonLat;
  /** 缩放级别 */
  zoom: number;
  /** 底图类型 */
  baseMap: BaseMapType;
  /** 军网类型，'none' 表示关闭军网 */
  grid: GridDisplay;
  /** 网格标签是否可见 */
  gridLabels: boolean;
  /** 当前激活的绘制工具 */
  activeTool: Tool;
  /** 待放置符号的 SIDC，切换到符号工具后点击地图即放置 */
  pendingSidc: string;
  /** 左侧符号面板是否展开 */
  symbolPanelOpen: boolean;
  /** 右侧图层面板是否展开 */
  layerPanelOpen: boolean;
  /** 属性编辑面板是否展开 */
  inspectorOpen: boolean;
  /** 光标当前所在的地理坐标，离开地图时为 null */
  cursor: LonLat | null;

  setCursor: (cursor: LonLat | null) => void;
  setCenter: (center: LonLat) => void;
  setZoom: (zoom: number) => void;
  setView: (center: LonLat, zoom: number) => void;
  setBaseMap: (baseMap: BaseMapType) => void;
  setGrid: (grid: GridDisplay) => void;
  toggleGridLabels: () => void;
  setActiveTool: (tool: Tool) => void;
  setPendingSidc: (sidc: string) => void;
  toggleSymbolPanel: () => void;
  toggleLayerPanel: () => void;
  setInspectorOpen: (open: boolean) => void;
}

/**
 * 默认视图中心位于中欧。
 *
 * 原站面向北约用户，默认视野取阿尔卑斯以北的中欧地区；
 * 此处沿用该约定，使首次打开时能看到典型的陆战地形。
 */
const DEFAULT_CENTER: LonLat = { lon: 8.5, lat: 47.4 };

export const useViewStore = create<ViewState>((set) => ({
  center: DEFAULT_CENTER,
  zoom: 6,
  baseMap: BaseMapType.Topo,
  grid: 'MGRS',
  gridLabels: true,
  activeTool: Tool.Select,
  pendingSidc: '10031000001211000000',
  symbolPanelOpen: true,
  layerPanelOpen: false,
  inspectorOpen: false,
  cursor: null,

  setCursor: (cursor) => set({ cursor }),
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setView: (center, zoom) => set({ center, zoom }),
  setBaseMap: (baseMap) => set({ baseMap }),
  setGrid: (grid) => set({ grid }),
  toggleGridLabels: () => set((state) => ({ gridLabels: !state.gridLabels })),
  setActiveTool: (activeTool) => set({ activeTool }),
  setPendingSidc: (pendingSidc) => set({ pendingSidc }),
  toggleSymbolPanel: () => set((state) => ({ symbolPanelOpen: !state.symbolPanelOpen })),
  toggleLayerPanel: () => set((state) => ({ layerPanelOpen: !state.layerPanelOpen })),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
}));
