/**
 * 会话保存与恢复瞬态状态容器单测。
 *
 * 验证持久化结果映射、恢复候选深拷贝和冲突提示均与文档及撤销状态隔离。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { createDocument, createFeature, createPointGeometry, type MapDocument } from '@/core/model';
import type { PersistenceSaveResult, SessionErrorKind, SessionMeta } from '@/core/io';

import { useSessionStore } from './useSessionStore';

const errorMessages: Record<SessionErrorKind, string> = {
  quota: '浏览器存储已满，请导出 .milxly 保存副本。',
  corrupt: '检测到损坏的本地会话，已备份，可恢复或丢弃。',
  unavailable: '浏览器不允许本地存储，自动保存已关闭。',
  conflict: '另一标签页正在编辑本图，可能发生覆盖。',
  unknown: '自动保存失败，请导出标图副本。',
};

/** 构造可恢复文档及其元数据。 */
function createCandidate(): { document: MapDocument; meta: SessionMeta } {
  const document = createDocument('恢复测试');
  const feature = createFeature({
    layerId: document.layers[0].id,
    sidc: 'SFGPUCI----K---',
    geometry: createPointGeometry(100, 30),
  });
  return {
    document: { ...document, features: [feature] },
    meta: { savedAt: 1000, appVersion: '1.0.0', tabId: 'tab-a', featureCount: 1 },
  };
}

/** 构造指定错误类型的保存结果。 */
function errorResult(kind: SessionErrorKind): PersistenceSaveResult {
  return { status: 'error', ok: false, error: { kind, error: new Error(kind) } };
}

function resetStore(): void {
  useSessionStore.getState().reset();
}

describe('useSessionStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('使用默认会话瞬态状态', () => {
    expect(useSessionStore.getState()).toMatchObject({
      status: 'idle',
      lastSavedAt: null,
      error: null,
      pendingRestore: null,
      conflict: false,
    });
  });

  it('beginSaving 标记为 saving', () => {
    useSessionStore.getState().beginSaving();

    expect(useSessionStore.getState().status).toBe('saving');
  });

  it('recordSaveResult scheduled 映射为 saving', () => {
    useSessionStore.getState().recordSaveResult({ status: 'scheduled', ok: true });

    expect(useSessionStore.getState().status).toBe('saving');
  });

  it('recordSaveResult saved 记录指定时间并清空错误', () => {
    const state = useSessionStore.getState();
    state.recordSaveResult(errorResult('quota'));
    state.recordSaveResult({ status: 'saved', ok: true, bytes: 12, nearQuota: false }, 12345);

    expect(useSessionStore.getState()).toMatchObject({
      status: 'saved',
      lastSavedAt: 12345,
      error: null,
    });
  });

  it.each(Object.entries(errorMessages) as [SessionErrorKind, string][])(
    'recordSaveResult 将 %s 映射为中文错误且不抛出',
    (kind, message) => {
      const result = errorResult(kind);

      expect(() => useSessionStore.getState().recordSaveResult(result)).not.toThrow();
      expect(useSessionStore.getState()).toMatchObject({
        status: 'error',
        error: { kind, message },
      });
    },
  );

  it('recordSaveResult 不修改传入结果', () => {
    const result = errorResult('unknown');
    const snapshot = structuredClone(result);

    useSessionStore.getState().recordSaveResult(result);

    expect(result).toEqual(snapshot);
  });

  it('setPendingRestore 深拷贝文档、图层、要素和元数据', () => {
    const candidate = createCandidate();

    useSessionStore.getState().setPendingRestore(candidate);
    candidate.document.name = '已修改';
    candidate.document.layers[0].name = '已修改图层';
    candidate.document.features[0].geometry = createPointGeometry(0, 0);
    candidate.meta.tabId = 'tab-b';

    const stored = useSessionStore.getState().pendingRestore;
    expect(stored?.document.name).toBe('恢复测试');
    expect(stored?.document.layers[0].name).toBe('默认图层');
    expect(stored?.document.features[0].geometry).toEqual(createPointGeometry(100, 30));
    expect(stored?.meta.tabId).toBe('tab-a');
    expect(stored).not.toBe(candidate);
    expect(stored?.document).not.toBe(candidate.document);
    expect(stored?.meta).not.toBe(candidate.meta);
  });

  it('setPendingRestore 对同语义候选保持状态引用', () => {
    const state = useSessionStore.getState();
    const candidate = createCandidate();
    state.setPendingRestore(candidate);
    const afterSet = useSessionStore.getState();

    afterSet.setPendingRestore(structuredClone(candidate));

    expect(useSessionStore.getState()).toBe(afterSet);
  });

  it('acceptRestore 返回独立文档副本并清空候选', () => {
    const candidate = createCandidate();
    const state = useSessionStore.getState();
    state.setPendingRestore(candidate);

    const accepted = state.acceptRestore();
    if (accepted === null) throw new Error('应返回恢复文档');
    accepted.name = '已接受后修改';

    expect(useSessionStore.getState().pendingRestore).toBeNull();
    expect(candidate.document.name).toBe('恢复测试');
    expect(accepted).not.toBe(candidate.document);
  });

  it('acceptRestore 无候选时返回 null', () => {
    expect(useSessionStore.getState().acceptRestore()).toBeNull();
  });

  it('discardRestore 清空恢复候选', () => {
    const state = useSessionStore.getState();
    state.setPendingRestore(createCandidate());
    state.discardRestore();

    expect(useSessionStore.getState().pendingRestore).toBeNull();
  });

  it('setConflict 仅在值变化时更新状态', () => {
    const state = useSessionStore.getState();
    state.setConflict(true);
    const conflicted = useSessionStore.getState();

    expect(conflicted.conflict).toBe(true);
    conflicted.setConflict(true);
    expect(useSessionStore.getState()).toBe(conflicted);
    conflicted.setConflict(false);
    expect(useSessionStore.getState().conflict).toBe(false);
  });

  it('clearError 清空最近错误', () => {
    const state = useSessionStore.getState();
    state.recordSaveResult(errorResult('corrupt'));
    state.clearError();

    expect(useSessionStore.getState().error).toBeNull();
  });

  it('reset 恢复所有默认瞬态状态', () => {
    const state = useSessionStore.getState();
    state.beginSaving();
    state.recordSaveResult({ status: 'saved', ok: true, bytes: 12, nearQuota: false }, 123);
    state.setPendingRestore(createCandidate());
    state.setConflict(true);
    state.recordSaveResult(errorResult('unavailable'));

    state.reset();

    expect(useSessionStore.getState()).toMatchObject({
      status: 'idle',
      lastSavedAt: null,
      error: null,
      pendingRestore: null,
      conflict: false,
    });
  });

  it('setPendingRestore 不修改传入候选', () => {
    const candidate = createCandidate();
    const snapshot = structuredClone(candidate);

    useSessionStore.getState().setPendingRestore(candidate);

    expect(candidate).toEqual(snapshot);
  });
});
