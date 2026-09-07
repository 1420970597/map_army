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
import { StatusBar } from '@/features/statusbar/StatusBar';
import { SymbolPanel } from '@/features/symbol/SymbolPanel';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { Tool } from '@/core/model';
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

  // 全局快捷键：撤销、重做、删除选中要素
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      // 在输入框内不拦截快捷键，避免影响文本编辑
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const documentStore = useDocumentStore.getState();
      const viewStore = useViewStore.getState();
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const accel = isMac ? event.metaKey : event.ctrlKey;

      if (accel && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) documentStore.redo();
        else documentStore.undo();
        return;
      }
      if (accel && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        documentStore.redo();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (documentStore.selectedIds.length === 0) return;
        event.preventDefault();
        documentStore.removeFeatures(documentStore.selectedIds);
        return;
      }
      if (event.key === 'Escape') {
        documentStore.select([]);
        viewStore.setActiveTool(Tool.Select);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app">
      <Toolbar />

      <div className="app-body">
        {symbolPanelOpen ? <SymbolPanel /> : null}
        <MapView />
        {layerPanelOpen ? <LayerPanel /> : null}
      </div>

      <Inspector />
      <StatusBar />
    </div>
  );
}
