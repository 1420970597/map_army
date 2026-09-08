/** 会话可靠性纯逻辑单元测试。 */

import { describe, expect, it } from 'vitest';

import {
  classifyError,
  CONFLICT_WINDOW_MS,
  estimateBytes,
  isConflict,
  QUOTA_WARN_BYTES,
  STORAGE_KEY,
  URL_PAYLOAD_VERSION,
  type SessionMeta,
} from './session';

const currentTabId = 'tab-current';
const now = 1_000_000;

/** 构造可用于冲突判定的会话元数据。 */
function createMeta(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    savedAt: now,
    appVersion: '1.0.0',
    tabId: 'tab-other',
    featureCount: 3,
    ...overrides,
  };
}

describe('estimateBytes', () => {
  it('应按 UTF-8 字节数估算 ASCII JSON', () => {
    const value = { name: 'map' };
    const expected = new TextEncoder().encode(JSON.stringify(value)).length;

    expect(estimateBytes(value)).toBe(expected);
  });

  it('应按 UTF-8 字节数估算中文 JSON', () => {
    const value = { name: '标图' };
    const expected = new TextEncoder().encode(JSON.stringify(value)).length;

    expect(estimateBytes(value)).toBe(expected);
  });

  it('循环引用导致无法序列化时应返回 0', () => {
    const value: { self?: unknown } = {};
    value.self = value;

    expect(estimateBytes(value)).toBe(0);
  });
});

describe('classifyError', () => {
  it.each([
    [{ name: 'QuotaExceededError' }, 'quota'],
    [{ name: 'NS_ERROR_DOM_QUOTA_REACHED' }, 'quota'],
    [{ code: 22 }, 'quota'],
    [{ message: 'storage full' }, 'quota'],
    [{ name: 'SyntaxError' }, 'corrupt'],
    [{ message: 'cannot parse corrupt session' }, 'corrupt'],
    [{ name: 'SecurityError' }, 'unavailable'],
    [{ name: 'NotAllowedError' }, 'unavailable'],
    [{ message: 'localStorage unavailable' }, 'unavailable'],
    [{ name: 'NetworkError', message: 'request failed' }, 'unknown'],
  ] as const)('应把 %# 归类为 %s', (error, expected) => {
    expect(classifyError(error)).toBe(expected);
  });
});

describe('isConflict', () => {
  it('没有已保存元数据时不应冲突', () => {
    expect(isConflict(null, currentTabId, now)).toBe(false);
  });

  it('同一标签页保存时不应冲突', () => {
    expect(isConflict(createMeta({ tabId: currentTabId }), currentTabId, now)).toBe(false);
  });

  it('其他标签页刚保存时应冲突', () => {
    expect(isConflict(createMeta({ savedAt: now - 1 }), currentTabId, now)).toBe(true);
  });

  it('正好处于 30 秒边界时应冲突', () => {
    expect(isConflict(createMeta({ savedAt: now - CONFLICT_WINDOW_MS }), currentTabId, now)).toBe(
      true,
    );
  });

  it('超过 30 秒窗口时不应冲突', () => {
    expect(
      isConflict(createMeta({ savedAt: now - CONFLICT_WINDOW_MS - 1 }), currentTabId, now),
    ).toBe(false);
  });

  it('保存时间在未来时不应冲突', () => {
    expect(isConflict(createMeta({ savedAt: now + 1 }), currentTabId, now)).toBe(false);
  });

  it('空标签页标识时不应冲突', () => {
    expect(isConflict(createMeta({ tabId: '' }), currentTabId, now)).toBe(false);
  });

  it('保存时间不是有限数字时不应冲突', () => {
    expect(isConflict(createMeta({ savedAt: Number.NaN }), currentTabId, now)).toBe(false);
  });
});

describe('会话可靠性常量', () => {
  it('应保持稳定的协议与诊断阈值', () => {
    expect(STORAGE_KEY).toBe('map-army.session.v1');
    expect(QUOTA_WARN_BYTES).toBe(4 * 1024 * 1024);
    expect(CONFLICT_WINDOW_MS).toBe(30_000);
    expect(URL_PAYLOAD_VERSION).toBe(1);
  });
});
