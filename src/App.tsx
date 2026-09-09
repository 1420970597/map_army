/**
 * 应用根组件。
 *
 * 组装顶栏、符号面板、地图、图层面板、属性面板与状态栏，
 * 并注册全局快捷键、会话恢复和自动保存。
 */

import { Inspector } from '@/features/inspector/Inspector';
import { LayerPanel } from '@/features/layers/LayerPanel';
import { MapView } from '@/features/map/MapView';
import { SessionBanner } from '@/features/shell/SessionBanner';
import { ShortcutHelp } from '@/features/shell/ShortcutHelp';
import { useKeyboardShortcuts } from '@/features/shell/useKeyboardShortcuts';
import { useEffect, useState } from 'react';
import { StatusBar } from '@/features/statusbar/StatusBar';
import { SymbolPanel } from '@/features/symbol/SymbolPanel';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { useAppRuntime } from '@/features/shell/useAppRuntime';
import { useAccessStore } from '@/stores/useAccessStore';
import { useViewStore } from '@/stores/useViewStore';

export function App() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const symbolPanelOpen = useViewStore((state) => state.symbolPanelOpen);
  const layerPanelOpen = useViewStore((state) => state.layerPanelOpen);
  const readOnly = useAccessStore((state) => state.readOnly);
  const notice = useAccessStore((state) => state.notice);
  useAppRuntime();

  useEffect(() => {
    const onUpdate = () => setUpdateAvailable(true);
    window.addEventListener('map-army:update-available', onUpdate);
    return () => window.removeEventListener('map-army:update-available', onUpdate);
  }, []);

  useKeyboardShortcuts();

  return (
    <div className="app">
      <Toolbar />
      <SessionBanner />
      {readOnly && (
        <div className="session-banner">
          当前为只读视图
          <button
            onClick={() => {
              useAccessStore.getState().setReadOnly(false);
              useAccessStore.getState().setShared(null);
              window.history.replaceState(null, '', window.location.pathname);
            }}
          >
            编辑独立副本
          </button>
        </div>
      )}
      {notice && (
        <div className="session-banner" role="status">
          {notice}
          <button onClick={() => useAccessStore.getState().notify('')}>关闭</button>
        </div>
      )}
      {updateAvailable && (
        <div className="session-banner" role="status">
          新版本已就绪
          <button
            onClick={() => {
              navigator.serviceWorker?.controller?.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }}
          >
            立即刷新
          </button>
          <button onClick={() => setUpdateAvailable(false)}>稍后</button>
        </div>
      )}

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
