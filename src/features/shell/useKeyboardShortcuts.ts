import { useEffect } from 'react';

import { executeCommand, type CommandContext } from '@/core/shell/commands';
import { isTypingTarget, SHORTCUTS } from '@/core/shell/shortcuts';
import { getMapCommandContext } from '@/features/map/mapCommandRegistry';
import { useClipboardStore } from '@/stores/useClipboardStore';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useEditStore } from '@/stores/useEditStore';
import { useViewStore } from '@/stores/useViewStore';

import { shouldHandleShortcut, shortcutSpecForEvent } from './keyboardLogic';

function commandContext(): CommandContext {
  const map = getMapCommandContext();
  return {
    undo: () => useDocumentStore.getState().undo(),
    redo: () => useDocumentStore.getState().redo(),
    copy: () => {
      map?.copy();
    },
    paste: () => {
      map?.paste();
    },
    deleteSelection: () => {
      const documentState = useDocumentStore.getState();
      if (documentState.selectedIds.length > 0)
        documentState.removeFeatures(documentState.selectedIds);
    },
    selectAll: () => {
      const documentState = useDocumentStore.getState();
      documentState.selectAllInLayer(documentState.activeLayerId);
    },
    escape: () => {
      useDocumentStore.getState().clearSelection();
      useViewStore.getState().setActiveTool('select');
      map?.cancelDraw();
    },
    toggleFullscreen: () => {
      map?.toggleFullscreen();
    },
    reload: () => window.location.reload(),
    zoomBy: (delta) => {
      map?.zoomBy(delta);
    },
    panBy: (x, y) => {
      map?.panBy(x, y);
    },
    resetNorth: () => {
      map?.resetNorth();
    },
    confirm: () => {
      map?.confirm();
    },
    toggleSnap: () => useEditStore.getState().toggleSnap(),
    stepVertex: (delta) => {
      const { activeVertex, setActiveVertex } = useEditStore.getState();
      const documentState = useDocumentStore.getState();
      const activeId = documentState.selectedIds.at(-1);
      const feature = documentState.document.features.find((item) => item.id === activeId);
      if (!feature || feature.geometry.kind === 'point') return;
      const length = feature.geometry.points.length;
      setActiveVertex(
        activeVertex === null
          ? delta > 0
            ? 0
            : length - 1
          : (activeVertex + delta + length) % length,
      );
    },
    activateBoxSelect: () => useViewStore.getState().setActiveTool('boxSelect'),
    toggleShortcutHelp: () => useViewStore.getState().toggleShortcutHelp(),
  };
}

function canExecute(id: string): boolean {
  const documentState = useDocumentStore.getState();
  const map = getMapCommandContext();
  switch (id) {
    case 'edit.copy':
      return map !== null && documentState.selectedIds.length > 0;
    case 'edit.paste': {
      const activeLayer = documentState.document.layers.find(
        (layer) => layer.id === documentState.activeLayerId,
      );
      return (
        map !== null &&
        clipboardPayloadAvailable() &&
        activeLayer !== undefined &&
        !activeLayer.locked
      );
    }
    case 'edit.delete':
      return documentState.selectedIds.length > 0;
    case 'app.fullscreen':
    case 'view.zoomIn':
    case 'view.zoomOut':
    case 'view.panUp':
    case 'view.panDown':
    case 'view.panLeft':
    case 'view.panRight':
    case 'view.north':
    case 'edit.confirm':
      return map !== null;
    default:
      return true;
  }
}

function clipboardPayloadAvailable(): boolean {
  return useClipboardStore.getState().payload !== null;
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const shortcut = shortcutSpecForEvent(event, SHORTCUTS);
      if (!shouldHandleShortcut(shortcut, isTypingTarget(event.target)) || !canExecute(shortcut.id))
        return;
      if (executeCommand(shortcut.id, commandContext())) {
        event.preventDefault();
        if (shortcut.id === 'edit.previousVertex' || shortcut.id === 'edit.nextVertex') {
          event.stopImmediatePropagation();
        }
      }
    };

    const onPaste = (event: ClipboardEvent): void => {
      if (isTypingTarget(event.target) || !canExecute('edit.paste')) return;
      if (executeCommand('edit.paste', commandContext())) event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
  }, []);
}
