/**
 * QA 独立验证：会话恢复「不自动覆盖当前文档」的端到端不变量。
 *
 * 真实性要求：工程师侧的用例分别在持久化层与状态容器层各自验证，
 * 但「读取结果 → 恢复候选 → 用户确认 → 写入文档」这条链路没有被串起来；
 * 一旦有人在中间步骤直接 `replaceDocument`，现有单测仍会全绿。
 * 这里的用例把三层串起来，锁死「未经确认绝不改文档」。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  loadDocumentResult,
  saveDocument,
  STORAGE_KEY,
  type PersistenceLoadResult,
  type StorageLike,
} from '@/core/io';
import { createDocument, createFeature, createPointGeometry } from '@/core/model';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useSessionStore } from '@/stores/useSessionStore';

import {
  createPendingRestore,
  isExternalSessionUpdate,
  sessionLoadIntegration,
} from './sessionBannerIntegrationLogic';

/** 内存存储，用于隔离测试环境。 */
class FakeStorage implements StorageLike {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

/** 构造带一个点要素的文档。 */
function documentWithOneFeature(name: string) {
  const document = createDocument(name);
  const feature = createFeature({
    layerId: document.layers[0].id,
    sidc: 'SFGPUCI----K---',
    geometry: createPointGeometry(100, 30),
  });
  return { ...document, features: [feature] };
}

beforeEach(() => {
  useSessionStore.getState().reset();
  useDocumentStore.getState().endGesture();
});

describe('QA 读取结果到恢复候选', () => {
  it('loaded 只生成恢复候选，不修改传入文档', () => {
    const incoming = documentWithOneFeature('待恢复会话');
    const snapshot = structuredClone(incoming);

    const integration = sessionLoadIntegration(
      { status: 'loaded', document: incoming, source: 'primary', warnings: [] },
      'tab-a',
    );

    expect(integration.pendingRestore?.document).toEqual(incoming);
    expect(integration.error).toBeNull();
    expect(incoming).toEqual(snapshot);
  });

  it('恢复候选与来源文档不共享引用', () => {
    const incoming = documentWithOneFeature('待恢复会话');

    const candidate = createPendingRestore(incoming, 'tab-a');
    candidate.document.features[0].name = '被改动的副本';

    expect(incoming.features[0].name).toBe('');
  });

  it('corrupt 与 error 都不抛出，且不产生恢复候选', () => {
    const corrupt: PersistenceLoadResult = {
      status: 'corrupt',
      document: null,
      error: { kind: 'corrupt', error: new SyntaxError('坏 JSON') },
      backupSaved: true,
    };

    const integration = sessionLoadIntegration(corrupt, 'tab-a');

    expect(integration.pendingRestore).toBeNull();
    expect(integration.error).toEqual({
      kind: 'corrupt',
      message: '检测到损坏的本地会话，已备份，可恢复或丢弃。',
    });
  });

  it('empty 不产生任何横幅状态', () => {
    expect(sessionLoadIntegration({ status: 'empty', document: null }, 'tab-a')).toEqual({
      pendingRestore: null,
      error: null,
    });
  });

  it('仅当外部会话更新且已加载时才判为可提示的更新', () => {
    const current = documentWithOneFeature('当前');
    const incoming = documentWithOneFeature('外部');
    incoming.updatedAt = current.updatedAt + 1;

    expect(
      isExternalSessionUpdate(current, {
        status: 'loaded',
        document: incoming,
        source: 'primary',
        warnings: [],
      }),
    ).toBe(true);
    expect(
      isExternalSessionUpdate(current, {
        status: 'loaded',
        document: current,
        source: 'primary',
        warnings: [],
      }),
    ).toBe(false);
    expect(isExternalSessionUpdate(current, { status: 'empty', document: null })).toBe(false);
  });
});

describe('QA 端到端：恢复必须经用户确认', () => {
  it('读取到历史会话后不自动覆盖当前文档', () => {
    const storage = new FakeStorage();
    const saved = documentWithOneFeature('历史会话');
    saveDocument(saved, true, storage);
    const current = documentWithOneFeature('当前编辑中的文档');
    useDocumentStore.setState({
      document: current,
      activeLayerId: current.layers[0].id,
      selectedIds: [],
      past: [],
      future: [],
    });

    const result = loadDocumentResult(storage);
    const integration = sessionLoadIntegration(result, 'tab-a');
    useSessionStore.getState().setPendingRestore(integration.pendingRestore);

    // 关键断言：文档仍然是最初的那一份，且撤销栈为空。
    expect(useDocumentStore.getState().document).toBe(current);
    expect(useDocumentStore.getState().past).toHaveLength(0);
    expect(useSessionStore.getState().pendingRestore).not.toBeNull();
  });

  it('用户拒绝恢复后当前文档保持不变', () => {
    const storage = new FakeStorage();
    saveDocument(documentWithOneFeature('历史会话'), true, storage);
    const current = documentWithOneFeature('当前编辑中的文档');
    useDocumentStore.setState({
      document: current,
      activeLayerId: current.layers[0].id,
      selectedIds: [],
      past: [],
      future: [],
    });

    const integration = sessionLoadIntegration(loadDocumentResult(storage), 'tab-a');
    useSessionStore.getState().setPendingRestore(integration.pendingRestore);
    useSessionStore.getState().discardRestore();

    expect(useSessionStore.getState().pendingRestore).toBeNull();
    expect(useDocumentStore.getState().document).toBe(current);
  });

  it('用户接受恢复后才写入文档，且可一次撤销回退', () => {
    const storage = new FakeStorage();
    saveDocument(documentWithOneFeature('历史会话'), true, storage);
    const current = documentWithOneFeature('当前编辑中的文档');
    useDocumentStore.setState({
      document: current,
      activeLayerId: current.layers[0].id,
      selectedIds: [],
      past: [],
      future: [],
    });

    const integration = sessionLoadIntegration(loadDocumentResult(storage), 'tab-a');
    useSessionStore.getState().setPendingRestore(integration.pendingRestore);
    const accepted = useSessionStore.getState().acceptRestore();
    if (accepted === null) throw new Error('应返回可恢复文档');
    useDocumentStore.getState().replaceDocument(accepted);

    expect(useDocumentStore.getState().document.name).toBe('历史会话');
    expect(useDocumentStore.getState().past).toHaveLength(1);
    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().document.name).toBe('当前编辑中的文档');
  });

  it('损坏的本地会话不会中断启动流程', () => {
    const storage = new FakeStorage();
    storage.values.set(STORAGE_KEY, '{坏掉的 JSON');

    const result = loadDocumentResult(storage);
    const integration = sessionLoadIntegration(result, 'tab-a');

    expect(result.status).toBe('corrupt');
    expect(integration.pendingRestore).toBeNull();
    expect(integration.error?.kind).toBe('corrupt');
    expect(storage.values.has(STORAGE_KEY)).toBe(false);
  });
});
