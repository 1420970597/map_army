/**
 * 顶部工具栏。
 *
 * 承载文档操作与视图开关：撤销/重做、绘制工具组、底图与军网切换、
 * 面板开合。所有状态均读写 store，组件本身不持有业务状态。
 */

import { BaseMapType, Tool } from '@/core/model';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useViewStore } from '@/stores/useViewStore';

/** 绘制工具定义：工具值、显示名、提示 */
const TOOLS: { tool: Tool; label: string; title: string }[] = [
  { tool: Tool.Select, label: '选择', title: '选择并移动要素' },
  { tool: Tool.Symbol, label: '符号', title: '在地图上放置军标符号' },
  { tool: Tool.Line, label: '线', title: '绘制折线（双击或回车结束）' },
  { tool: Tool.Area, label: '面', title: '绘制多边形（双击或回车结束）' },
  { tool: Tool.Measure, label: '量距', title: '测量路径长度（不生成要素）' },
];

/** 底图选项 */
const BASE_MAPS: { value: BaseMapType; label: string }[] = [
  { value: BaseMapType.Streets, label: '街道图' },
  { value: BaseMapType.Topo, label: '地形图' },
  { value: BaseMapType.Satellite, label: '卫星影像' },
];

/** 军网选项 */
const GRIDS: { value: string; label: string }[] = [
  { value: 'none', label: '关闭' },
  { value: 'MGRS', label: 'MGRS' },
  { value: 'UTM', label: 'UTM' },
  { value: 'BNG', label: 'BNG' },
];

/**
 * 顶部工具栏组件。
 */
export function Toolbar() {
  const docName = useDocumentStore((state) => state.document.name);
  const renameDocument = useDocumentStore((state) => state.renameDocument);
  const undo = useDocumentStore((state) => state.undo);
  const redo = useDocumentStore((state) => state.redo);
  const canUndo = useDocumentStore((state) => state.past.length > 0);
  const canRedo = useDocumentStore((state) => state.future.length > 0);

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

  return (
    <header className="toolbar">
      <span className="toolbar-brand">map.army</span>

      <input
        className="toolbar-doc-name"
        value={docName}
        aria-label="文档名称"
        onChange={(event) => renameDocument(event.target.value)}
      />

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
          onChange={(event) => setGrid(event.target.value as 'none' | 'MGRS' | 'UTM' | 'BNG')}
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

      <div className="toolbar-group">
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
