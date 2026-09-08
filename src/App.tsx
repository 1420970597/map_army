/**
 * 应用根组件。
 *
 * 组装顶栏、符号面板、地图、图层面板、属性面板与状态栏，
 * 并注册全局快捷键、会话恢复和自动保存。
 */

import { useEffect, useRef } from 'react';

import { autoSave, loadDocumentResult, STORAGE_KEY } from '@/core/io';
import { Inspector } from '@/features/inspector/Inspector';
import { LayerPanel } from '@/features/layers/LayerPanel';
import { MapView } from '@/features/map/MapView';
import { SessionBanner } from '@/features/shell/SessionBanner';
import {
  isExternalSessionUpdate,
  sessionLoadIntegration,
} from '@/features/shell/sessionBannerIntegrationLogic';
import { ShortcutHelp } from '@/features/shell/ShortcutHelp';
import { useKeyboardShortcuts } from '@/features/shell/useKeyboardShortcuts';
import { StatusBar } from '@/features/statusbar/StatusBar';
import { SymbolPanel } from '@/features/symbol/SymbolPanel';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useViewStore } from '@/stores/useViewStore';

/** 生成本次挂载期间稳定的标签页标识。 */
function createTabId(): string {
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 应用根组件。
 */
export function App() {
  const symbolPanelOpen = useViewStore((state) => state.symbolPanelOpen);
  const layerPanelOpen = useViewStore((state) => state.layerPanelOpen);
  const tabId = useRef(createTabId()).current;

  useEffect(() => {
    const applyLoadResult = (): void => {
      const integration = sessionLoadIntegration(loadDocumentResult(), tabId);
      const session = useSessionStore.getState();
      session.setPendingRestore(integration.pendingRestore);
      session.setError(integration.error);
    };

    applyLoadResult();
    const stopAutoSave = autoSave(
      () => useDocumentStore.getState().document,
      (result) => useSessionStore.getState().recordSaveResult(result),
    );
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== STORAGE_KEY || event.newValue === null) return;
      const incoming = loadDocumentResult();
      if (isExternalSessionUpdate(useDocumentStore.getState().document, incoming)) {
        useSessionStore.getState().setConflict(true);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      stopAutoSave();
      window.removeEventListener('storage', onStorage);
    };
  }, [tabId]);

  useKeyboardShortcuts();

  return (
    <div className="app">
      <Toolbar />
      <SessionBanner />

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
