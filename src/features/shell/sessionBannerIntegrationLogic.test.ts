/** 会话横幅集成纯逻辑单测。 */

import { describe, expect, it } from 'vitest';

import { createDocument, createFeature, createPointGeometry } from '@/core/model';
import type { PersistenceLoadResult } from '@/core/io';

import {
  createPendingRestore,
  isExternalSessionUpdate,
  sessionLoadIntegration,
} from './sessionBannerIntegrationLogic';

function documentAt(updatedAt: number) {
  const document = createDocument('会话');
  const feature = createFeature({
    layerId: document.layers[0].id,
    sidc: 'SFGPUCI----K---',
    geometry: createPointGeometry(100, 30),
  });
  return { ...document, updatedAt, features: [feature] };
}

function loadedResult(updatedAt = 100): PersistenceLoadResult {
  return { status: 'loaded', document: documentAt(updatedAt), source: 'primary', warnings: [] };
}

describe('sessionBannerIntegrationLogic', () => {
  it('loaded 创建恢复候选而不直接替换文档', () => {
    const result = sessionLoadIntegration(loadedResult(), 'tab-a');

    expect(result.error).toBeNull();
    expect(result.pendingRestore?.document.name).toBe('会话');
    expect(result.pendingRestore?.meta.tabId).toBe('tab-a');
  });

  it('empty 不创建会话状态', () => {
    expect(sessionLoadIntegration({ status: 'empty', document: null }, 'tab-a')).toEqual({
      pendingRestore: null,
      error: null,
    });
  });

  it.each([
    ['corrupt', 'corrupt', '检测到损坏的本地会话，已备份，可恢复或丢弃。'],
    ['error', 'unavailable', '浏览器不允许本地存储，自动保存已关闭。'],
  ] as const)('%s 结果映射会话错误', (status, kind, message) => {
    const result: PersistenceLoadResult =
      status === 'corrupt'
        ? { status, document: null, error: { kind, error: new Error(kind) }, backupSaved: true }
        : { status, document: null, error: { kind, error: new Error(kind) } };

    expect(sessionLoadIntegration(result, 'tab-a')).toEqual({
      pendingRestore: null,
      error: { kind, message },
    });
  });

  it('createPendingRestore 深拷贝文档和元数据', () => {
    const document = documentAt(200);
    const candidate = createPendingRestore(document, 'tab-a');
    document.name = '已修改';
    document.features[0].geometry = createPointGeometry(0, 0);

    expect(candidate.document.name).toBe('会话');
    expect(candidate.document.features[0].geometry).toEqual(createPointGeometry(100, 30));
    expect(candidate.meta).toMatchObject({ savedAt: 200, featureCount: 1, tabId: 'tab-a' });
  });

  it('空标签页标识回退 local-tab', () => {
    expect(createPendingRestore(documentAt(1), '').meta.tabId).toBe('local-tab');
  });

  it('外部 loaded 且更新时间严格更新时提示冲突', () => {
    expect(isExternalSessionUpdate(documentAt(100), loadedResult(101))).toBe(true);
  });

  it('同一或更旧外部会话不提示冲突', () => {
    const current = documentAt(100);
    expect(isExternalSessionUpdate(current, loadedResult(100))).toBe(false);
    expect(isExternalSessionUpdate(current, loadedResult(99))).toBe(false);
  });

  it('外部 empty/corrupt/error 不提示冲突', () => {
    const current = documentAt(100);
    expect(isExternalSessionUpdate(current, { status: 'empty', document: null })).toBe(false);
    expect(
      isExternalSessionUpdate(current, {
        status: 'corrupt',
        document: null,
        error: { kind: 'corrupt', error: new Error() },
        backupSaved: false,
      }),
    ).toBe(false);
    expect(
      isExternalSessionUpdate(current, {
        status: 'error',
        document: null,
        error: { kind: 'unknown', error: new Error() },
      }),
    ).toBe(false);
  });

  it('loaded 结果保留当前入参独立性', () => {
    const result = loadedResult(300);
    const integration = sessionLoadIntegration(result, 'tab-a');
    if (result.status !== 'loaded') throw new Error('应加载文档');
    result.document.name = '外部修改';

    expect(integration.pendingRestore?.document.name).toBe('会话');
  });

  it.each([0, 1, 99, 1000, 9999])('任意有效更新时间都写入候选元数据：%s', (updatedAt) => {
    expect(createPendingRestore(documentAt(updatedAt), 'tab-a').meta.savedAt).toBe(updatedAt);
  });
});
