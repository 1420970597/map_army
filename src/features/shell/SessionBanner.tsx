/**
 * 会话恢复、保存与冲突状态横幅。
 *
 * 组件只消费会话瞬态状态；恢复文档必须由用户明确确认后才交给文档 store。
 */

import { useState } from 'react';

import { clearDocument } from '@/core/io';
import {
  restoreSummary,
  savedStatusText,
  sessionBannerKind,
} from '@/features/shell/sessionBannerLogic';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useSessionStore } from '@/stores/useSessionStore';

/** 会话横幅。 */
export function SessionBanner() {
  const session = useSessionStore();
  const [now] = useState(() => Date.now());
  const kind = sessionBannerKind(session);

  if (kind === null) return null;

  const restore = (): void => {
    const document = useSessionStore.getState().acceptRestore();
    if (document !== null) useDocumentStore.getState().replaceDocument(document);
  };
  const discard = (): void => {
    useSessionStore.getState().discardRestore();
    clearDocument();
  };

  if (kind === 'restore' && session.pendingRestore !== null) {
    return (
      <section className="session-banner session-banner--restore" aria-label="会话恢复提示">
        <span>{restoreSummary(session.pendingRestore, now)}</span>
        <div className="session-banner-actions">
          <button type="button" onClick={restore}>
            恢复
          </button>
          <button type="button" onClick={discard}>
            丢弃
          </button>
        </div>
      </section>
    );
  }

  if (kind === 'error' && session.error !== null) {
    return (
      <section className="session-banner session-banner--error" role="alert">
        <span>{session.error.message}</span>
        <button
          type="button"
          onClick={() => useSessionStore.getState().clearError()}
          aria-label="关闭错误提示"
        >
          关闭
        </button>
      </section>
    );
  }

  if (kind === 'conflict') {
    return (
      <section className="session-banner session-banner--conflict" role="status">
        <span>检测到其他标签页有更新的会话，当前编辑内容未被覆盖。</span>
        <button type="button" onClick={() => useSessionStore.getState().setConflict(false)}>
          知道了
        </button>
      </section>
    );
  }

  if (kind === 'saving') {
    return (
      <section className="session-banner session-banner--saving" role="status">
        正在自动保存
      </section>
    );
  }

  // 已保存提示只在最近一段时间内可见：过期后不再占用界面，避免横幅常驻。
  if (kind === 'saved') {
    const savedText = savedStatusText(session.lastSavedAt, now);
    if (savedText === null) return null;

    return (
      <section className="session-banner session-banner--saved" role="status">
        {savedText}
      </section>
    );
  }

  return (
    <section className="session-banner session-banner--saved" role="status">
      已自动保存
    </section>
  );
}
