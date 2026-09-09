/**
 * 顶部工具栏。
 *
 * 承载文档操作与视图开关：撤销/重做、绘制工具组、底图与军网切换、
 * 面板开合。所有状态均读写 store，组件本身不持有业务状态。
 */

import { parseCoordinateSearch } from '@/core/geo';
import { Tool } from '@/core/model';
import type { BaseMapType } from '@/core/model';
import { ImportExportBar } from '@/features/io/ImportExportBar';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useViewStore } from '@/stores/useViewStore';
import { TILE_SOURCES } from '@/features/map/tileSources';
import { OptionsDialog } from '@/features/shell/OptionsDialog';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useState } from 'react';

/** 绘制工具定义：工具值、显示名、提示 */
const TOOLS: { tool: Tool; label: string; title: string }[] = [
  { tool: Tool.Select, label: '选择', title: '选择并移动要素' },
  { tool: Tool.BoxSelect, label: '框选', title: '拖拽框选要素' },
  { tool: Tool.Symbol, label: '符号', title: '在地图上放置军标符号' },
  { tool: Tool.Line, label: '线', title: '绘制折线（双击或回车结束）' },
  { tool: Tool.Area, label: '面', title: '绘制多边形（双击或回车结束）' },
  { tool: Tool.Measure, label: '量距', title: '测量并保留路径长度' },
  { tool: Tool.MeasureArea, label: '量面积', title: '测量并保留区域面积' },
  { tool: Tool.RangeRing, label: '距离环', title: '点击地图放置距离环，在属性中调整半径' },
];

/** 底图选项 */
const BASE_MAPS = Object.entries(TILE_SOURCES).map(([value, source]) => ({
  value: value as BaseMapType,
  label: source.name,
}));

/** 军网选项 */
const GRIDS: { value: string; label: string }[] = [
  { value: 'none', label: '关闭' },
  { value: 'MGRS', label: 'MGRS' },
  { value: 'UTM', label: 'UTM' },
  { value: 'BNG', label: 'BNG' },
  { value: 'WGS84', label: 'WGS84 经纬网' },
  { value: 'GARS', label: 'GARS' },
  { value: 'LV95', label: 'LV95 瑞士格网' },
  { value: 'LV03', label: 'LV03 瑞士格网' },
  { value: 'HEX', label: '六边形网格' },
];

/**
 * 顶部工具栏组件。
 */
export function Toolbar() {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const coordinateSearch = usePreferencesStore((state) => state.coordinateSearch);
  const [coordinate, setCoordinate] = useState('');
  const [coordinateError, setCoordinateError] = useState(false);
  const docName = useDocumentStore((state) => state.document.name);
  const renameDocument = useDocumentStore((state) => state.renameDocument);
  const undo = useDocumentStore((state) => state.undo);
  const redo = useDocumentStore((state) => state.redo);
  const canUndo = useDocumentStore((state) => state.past.length > 0);
  const canRedo = useDocumentStore((state) => state.future.length > 0);

  const is3d = useViewStore((state) => state.is3d);
  const toggle3d = useViewStore((state) => state.toggle3d);
  const activeTool = useViewStore((state) => state.activeTool);
  const setActiveTool = useViewStore((state) => state.setActiveTool);
  const baseMap = useViewStore((state) => state.baseMap);
  const setBaseMap = useViewStore((state) => state.setBaseMap);
  const grid = useViewStore((state) => state.grid);
  const setGrid = useViewStore((state) => state.setGrid);
  const gridLabels = useViewStore((state) => state.gridLabels);
  const toggleGridLabels = useViewStore((state) => state.toggleGridLabels);
  const toggleSymbolPanel = useViewStore((state) => state.toggleSymbolPanel);
  const toggleLayerPanel = useViewStore((state) => state.toggleLayerPanel);
  const setView = useViewStore((state) => state.setView);

  const locateCoordinate = (): void => {
    const point = parseCoordinateSearch(coordinate);
    if (!point) {
      setCoordinateError(true);
      return;
    }
    setCoordinateError(false);
    setView(point, Math.max(10, useViewStore.getState().zoom));
  };

  const locateMe = (): void => {
    if (!navigator.geolocation) {
      setCoordinateError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinateError(false);
        setView({ lon: position.coords.longitude, lat: position.coords.latitude }, 13);
      },
      () => setCoordinateError(true),
    );
  };

  const toggleFullscreen = (): void => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.();
    else void document.exitFullscreen?.();
  };

  return (
    <header className="toolbar">
      <button type="button" className="tb-button" onClick={() => setOptionsOpen(true)}>
        选项
      </button>
      {optionsOpen && <OptionsDialog onClose={() => setOptionsOpen(false)} />}
      <span className="toolbar-brand">map.army</span>

      <input
        className="toolbar-doc-name"
        value={docName}
        aria-label="文档名称"
        onChange={(event) => renameDocument(event.target.value)}
      />

      <div className="toolbar-group">
        <input
          className="tb-input"
          hidden={!coordinateSearch}
          aria-label="坐标搜索"
          placeholder="坐标搜索"
          value={coordinate}
          onChange={(event) => setCoordinate(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') locateCoordinate();
          }}
        />
        <button type="button" className="tb-button" title="跳转到坐标" onClick={locateCoordinate}>
          定位
        </button>
        <button type="button" className="tb-button" title="使用当前位置" onClick={locateMe}>
          我的位置
        </button>
        <button type="button" className="tb-button" title="切换全屏" onClick={toggleFullscreen}>
          全屏
        </button>
        {coordinateError ? <span className="io-message">坐标无效或定位失败</span> : null}
      </div>

      <div className="toolbar-group">
        <button
          type="button"
          className="tb-button"
          title="撤销 (Ctrl+Z)"
          disabled={!canUndo}
          onClick={undo}
        >
          撤销
        </button>
        <button
          type="button"
          className="tb-button"
          title="重做 (Ctrl+Y)"
          disabled={!canRedo}
          onClick={redo}
        >
          重做
        </button>
      </div>

      <div className="toolbar-group">
        {TOOLS.map(({ tool, label, title }) => (
          <button
            key={tool}
            type="button"
            title={title}
            className={`tb-button${activeTool === tool ? ' is-active' : ''}`}
            onClick={() => setActiveTool(tool)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="toolbar-group">
        <select
          className="tb-select"
          aria-label="底图"
          value={baseMap}
          onChange={(event) => setBaseMap(event.target.value as BaseMapType)}
        >
          {BASE_MAPS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <select
          className="tb-select"
          aria-label="军网"
          value={grid}
          onChange={(event) =>
            setGrid(
              event.target.value as
                'none' | 'MGRS' | 'UTM' | 'BNG' | 'WGS84' | 'GARS' | 'LV95' | 'LV03' | 'HEX',
            )
          }
        >
          {GRIDS.map((item) => (
            <option key={item.value} value={item.value}>
              军网：{item.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`tb-button${gridLabels ? ' is-active' : ''}`}
          title="显示或隐藏军网标注"
          disabled={grid === 'none'}
          onClick={toggleGridLabels}
        >
          网格标注
        </button>
      </div>

      <span className="toolbar-spacer" />

      <ImportExportBar />

      {/** 站点导航：指向生成器产出的静态介绍页，复刻原站的 关于/示例/文档 入口 */}
      <div className="toolbar-group">
        <a className="tb-link" href="/about/zh.html" target="_blank" rel="noreferrer">
          关于
        </a>
        <a className="tb-link" href="/example/zh.html" target="_blank" rel="noreferrer">
          示例
        </a>
        <a className="tb-link" href="/doc/zh/" target="_blank" rel="noreferrer">
          文档
        </a>
      </div>

      <div className="toolbar-group">
        <button
          type="button"
          className={`tb-button${is3d ? ' is-active' : ''}`}
          title="切换二维/三维只读视图"
          onClick={toggle3d}
        >
          {is3d ? '二维' : '三维'}
        </button>
        <button
          type="button"
          className="tb-button"
          title="显示或隐藏符号面板"
          onClick={toggleSymbolPanel}
        >
          符号面板
        </button>
        <button
          type="button"
          className="tb-button"
          title="显示或隐藏图层面板"
          onClick={toggleLayerPanel}
        >
          图层面板
        </button>
      </div>
    </header>
  );
}
