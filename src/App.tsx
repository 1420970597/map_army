/**
 * 应用根组件。
 *
 * 组装顶栏、符号面板、地图、图层面板、属性面板与状态栏，
 * 并注册全局快捷键（撤销、重做、删除）。
 */

import { useEffect } from 'react';

import { autoSave, loadDocument } from '@/core/io';
import { Inspector } from '@/features/inspector/Inspector';
import { LayerPanel } from '@/features/layers/LayerPanel';
import { MapView } from '@/features/map/MapView';
import { ShortcutHelp } from '@/features/shell/ShortcutHelp';
import { useKeyboardShortcuts } from '@/features/shell/useKeyboardShortcuts';
import { StatusBar } from '@/features/statusbar/StatusBar';
import { SymbolPanel } from '@/features/symbol/SymbolPanel';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useViewStore } from '@/stores/useViewStore';

/**
 * 应用根组件。
 */
export function App() {
  const symbolPanelOpen = useViewStore((state) => state.symbolPanelOpen);
  const layerPanelOpen = useViewStore((state) => state.layerPanelOpen);

  // 启动时恢复上次未导出的标图，并开启自动保存
  useEffect(() => {
    const restored = loadDocument();
    if (restored) {
      useDocumentStore.getState().replaceDocument(restored);
    }

    const stopAutoSave = autoSave(() => useDocumentStore.getState().document);
    return stopAutoSave;
  }, []);

  useKeyboardShortcuts();

  return (
    <div className="app">
      <Toolbar />

      <div className="app-body">
        {symbolPanelOpen ? <SymbolPanel /> : null}
        <MapView />
        {layerPanelOpen ? <LayerPanel /> : null}
      </div>

      <Inspector />
      <ShortcutHelp />
      <StatusBar />
    </div>
  );
}
