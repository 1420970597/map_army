import { useEffect } from 'react';

import { SHORTCUTS, type ShortcutGroup } from '@/core/shell/shortcuts';
import { useViewStore } from '@/stores/useViewStore';

const GROUPS: readonly ShortcutGroup[] = ['编辑', '选择', '视图', '应用', '文档'];

export function ShortcutHelp() {
  const open = useViewStore((state) => state.shortcutHelpOpen);
  const setOpen = useViewStore((state) => state.setShortcutHelpOpen);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="shortcut-help-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section
        aria-label="快捷键帮助"
        aria-modal="true"
        className="shortcut-help"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="shortcut-help-header">
          <h2>快捷键</h2>
          <button
            aria-label="关闭快捷键帮助"
            className="icon-button"
            type="button"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </header>
        <div className="shortcut-help-body">
          {GROUPS.map((group) => {
            const shortcuts = SHORTCUTS.filter((shortcut) => shortcut.group === group);
            if (shortcuts.length === 0) return null;
            return (
              <section key={group} className="shortcut-help-group">
                <h3>{group}</h3>
                {shortcuts.map((shortcut) => (
                  <div key={`${shortcut.id}-${shortcut.combo}`} className="shortcut-help-row">
                    <span>{shortcut.description}</span>
                    <kbd>{shortcut.combo}</kbd>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
