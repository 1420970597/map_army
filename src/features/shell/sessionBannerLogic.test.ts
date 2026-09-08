import { describe, expect, it } from 'vitest';

import { createDocument, createFeature, createPointGeometry } from '@/core/model';
import type { PendingRestore } from '@/stores/useSessionStore';

import {
  isExternalSessionNewer,
  restoreSummary,
  savedStatusText,
  sessionBannerKind,
  type SessionBannerStateInput,
} from './sessionBannerLogic';

const now = 1_000_000_000;

/** 构造指定要素数和保存时间的恢复候选。 */
function createCandidate(featureCount: number, savedAt = now): PendingRestore {
  const document = createDocument('恢复会话');
  const features = Array.from({ length: featureCount }, () =>
    createFeature({
      layerId: document.layers[0].id,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(100, 30),
    }),
  );

  return {
    document: { ...document, features },
    meta: { savedAt, appVersion: '1.0.0', tabId: 'tab-a', featureCount },
  };
}

function state(overrides: Partial<SessionBannerStateInput> = {}): SessionBannerStateInput {
  return {
    pendingRestore: null,
    error: null,
    conflict: false,
    status: 'idle',
    lastSavedAt: null,
    ...overrides,
  };
}

describe('sessionBannerLogic', () => {
  it('恢复候选优先于其余横幅状态', () => {
    expect(
      sessionBannerKind(
        state({
          pendingRestore: createCandidate(1),
          error: { kind: 'unknown', message: '失败' },
          conflict: true,
          status: 'saving',
        }),
      ),
    ).toBe('restore');
  });

  it('错误优先于冲突和保存状态', () => {
    expect(
      sessionBannerKind(
        state({ error: { kind: 'unknown', message: '失败' }, conflict: true, status: 'saving' }),
      ),
    ).toBe('error');
  });

  it('冲突优先于保存状态', () => {
    expect(sessionBannerKind(state({ conflict: true, status: 'saving' }))).toBe('conflict');
  });

  it('保存中显示 saving 横幅', () => {
    expect(sessionBannerKind(state({ status: 'saving' }))).toBe('saving');
  });

  it('已保存显示 saved 横幅', () => {
    expect(sessionBannerKind(state({ status: 'saved', lastSavedAt: now }))).toBe('saved');
  });

  it('无可展示状态时返回 null', () => {
    expect(sessionBannerKind(state())).toBeNull();
  });

  it.each([
    [0, now, '发现 0 个要素的未恢复会话，保存于刚刚'],
    [1, now - 59_000, '发现 1 个要素的未恢复会话，保存于刚刚'],
    [2, now - 3 * 60_000, '发现 2 个要素的未恢复会话，保存于3 分钟前'],
    [5, now - 2 * 60 * 60_000, '发现 5 个要素的未恢复会话，保存于2 小时前'],
    [8, now - 3 * 24 * 60 * 60_000, '发现 8 个要素的未恢复会话，保存于3 天前'],
  ])('恢复摘要包含 %i 个要素和相对时间', (featureCount, savedAt, expected) => {
    expect(restoreSummary(createCandidate(featureCount, savedAt), now)).toBe(expected);
  });

  it('恢复摘要对未来保存时间按刚刚处理', () => {
    expect(restoreSummary(createCandidate(1, now + 1_000), now)).toBe(
      '发现 1 个要素的未恢复会话，保存于刚刚',
    );
  });

  it.each([
    [100, 101, true],
    [100, 100, false],
    [100, 99, false],
    [100, Number.NaN, false],
    [100, Number.POSITIVE_INFINITY, false],
  ])(
    '外部会话新旧比较: current=%s incoming=%s',
    (currentUpdatedAt, incomingUpdatedAt, expected) => {
      expect(isExternalSessionNewer(currentUpdatedAt, incomingUpdatedAt)).toBe(expected);
    },
  );

  it.each([
    [now, now, '已自动保存'],
    [now - 10_000, now, '已自动保存'],
    [now - 10_001, now, null],
    [now + 1, now, null],
    [null, now, null],
  ])('最近保存文案在允许时间范围内展示', (savedAt, currentTime, expected) => {
    expect(savedStatusText(savedAt, currentTime)).toBe(expected);
  });

  it('所有纯函数均不修改输入', () => {
    const candidate = createCandidate(2, now - 60_000);
    const input = state({
      pendingRestore: candidate,
      error: { kind: 'unknown', message: '失败' },
      conflict: true,
      status: 'saving',
      lastSavedAt: now,
    });
    const inputSnapshot = structuredClone(input);
    const candidateSnapshot = structuredClone(candidate);

    sessionBannerKind(input);
    restoreSummary(candidate, now);
    isExternalSessionNewer(100, 101);
    savedStatusText(now, now);

    expect(input).toEqual(inputSnapshot);
    expect(candidate).toEqual(candidateSnapshot);
  });
});
