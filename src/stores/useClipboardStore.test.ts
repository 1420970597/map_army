/**
 * 要素剪贴板瞬态与持久化状态容器单测。
 *
 * 使用注入式内存存储验证恢复、持久化、异常分类与载荷深拷贝，不访问全局浏览器存储。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  createDocument,
  createFeature,
  createLineGeometry,
  createPointGeometry,
  serializeClipboard,
  type ClipboardPayload,
} from '@/core/model';

import { CLIPBOARD_STORAGE_KEY, useClipboardStore } from './useClipboardStore';

const firstPoint = { lon: 100, lat: 30 };
const secondPoint = { lon: 101, lat: 31 };

/** 构造用于剪贴板状态测试的合法载荷。 */
function createPayload(): ClipboardPayload {
  const document = createDocument('剪贴板测试');
  const feature = createFeature({
    layerId: document.layers[0].id,
    sidc: 'SFGPUCI----K---',
    name: '测试要素',
    geometry: createLineGeometry([firstPoint, secondPoint]),
    textFields: { uniqueDesignation: 'A' },
    style: { color: '#123456', weight: 2 },
  });
  feature.vertexBearings = [45, 90];
  return serializeClipboard([feature], { [document.layers[0].id]: '源图层' }, firstPoint, 10);
}

/** 简单的注入式内存存储。 */
function createMemoryStorage(initial: Record<string, string> = {}): {
  values: Map<string, string>;
  setItem: (key: string, value: string) => void;
  getItem: (key: string) => string | null;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    setItem: (key, value) => values.set(key, value),
    getItem: (key) => values.get(key) ?? null,
  };
}

function resetStore(): void {
  useClipboardStore.getState().reset();
}

describe.sequential('useClipboardStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('使用空剪贴板默认状态', () => {
    expect(useClipboardStore.getState()).toMatchObject({
      payload: null,
      pasteCount: 0,
      lastError: null,
    });
  });

  it('setPayload 深拷贝几何、文本、样式、方向、图层名称和锚点', () => {
    const payload = createPayload();

    useClipboardStore.getState().setPayload(payload);
    payload.features[0].geometry = createPointGeometry(0, 0);
    payload.features[0].textFields.uniqueDesignation = 'B';
    payload.features[0].style!.color = '#ffffff';
    payload.features[0].vertexBearings![0] = 180;
    payload.layerNames[payload.features[0].layerId] = '已修改';
    payload.anchor.lon = 0;

    const stored = useClipboardStore.getState().payload;
    expect(stored?.features[0].geometry).toEqual(createLineGeometry([firstPoint, secondPoint]));
    expect(stored?.features[0].textFields.uniqueDesignation).toBe('A');
    expect(stored?.features[0].style?.color).toBe('#123456');
    expect(stored?.features[0].vertexBearings).toEqual([45, 90]);
    expect(stored?.layerNames[stored.features[0].layerId]).toBe('源图层');
    expect(stored?.anchor).toEqual(firstPoint);
  });

  it('setPayload(null) 清空载荷、计数和错误', () => {
    const state = useClipboardStore.getState();
    state.setPayload(createPayload());
    state.recordPaste();
    state.restore('{invalid');

    state.setPayload(null);

    expect(useClipboardStore.getState()).toMatchObject({
      payload: null,
      pasteCount: 0,
      lastError: null,
    });
  });

  it('setPayload 对语义相同载荷保持状态引用', () => {
    const state = useClipboardStore.getState();
    const payload = createPayload();
    state.setPayload(payload);
    const afterSet = useClipboardStore.getState();

    afterSet.setPayload(structuredClone(payload));

    expect(useClipboardStore.getState()).toBe(afterSet);
  });

  it('recordPaste 无载荷时返回 0 且不改变状态', () => {
    const initial = useClipboardStore.getState();

    expect(initial.recordPaste()).toBe(0);
    expect(useClipboardStore.getState()).toBe(initial);
  });

  it('recordPaste 连续递增并返回新计数', () => {
    const state = useClipboardStore.getState();
    state.setPayload(createPayload());

    expect(state.recordPaste()).toBe(1);
    expect(useClipboardStore.getState().recordPaste()).toBe(2);
    expect(useClipboardStore.getState().pasteCount).toBe(2);
  });

  it('restore 恢复合法载荷并重置计数与错误', () => {
    const source = createPayload();
    const state = useClipboardStore.getState();
    state.setPayload(createPayload());
    state.recordPaste();

    expect(state.restore(JSON.stringify(source))).toBe(true);
    expect(useClipboardStore.getState().payload).toEqual(source);
    expect(useClipboardStore.getState().pasteCount).toBe(0);
    expect(useClipboardStore.getState().lastError).toBeNull();
  });

  it('restore 非空非法内容保留旧载荷和计数并标记 corrupt', () => {
    const state = useClipboardStore.getState();
    state.setPayload(createPayload());
    state.recordPaste();
    const before = useClipboardStore.getState().payload;

    expect(state.restore('{invalid')).toBe(false);
    expect(useClipboardStore.getState().payload).toBe(before);
    expect(useClipboardStore.getState().pasteCount).toBe(1);
    expect(useClipboardStore.getState().lastError).toBe('corrupt');
  });

  it('restore(null) 表示无缓存，不设置 corrupt', () => {
    const state = useClipboardStore.getState();

    expect(state.restore(null)).toBe(false);
    expect(useClipboardStore.getState().lastError).toBeNull();
  });

  it('persist 在无载荷时返回 false', () => {
    const storage = createMemoryStorage();

    expect(useClipboardStore.getState().persist(storage)).toBe(false);
    expect(storage.values.size).toBe(0);
  });

  it('persist 与 hydrate 可通过注入式存储往返载荷', () => {
    const storage = createMemoryStorage();
    const payload = createPayload();
    const state = useClipboardStore.getState();
    state.setPayload(payload);

    expect(state.persist(storage)).toBe(true);
    expect(storage.values.get(CLIPBOARD_STORAGE_KEY)).toBeTypeOf('string');
    state.reset();

    expect(useClipboardStore.getState().hydrate(storage)).toBe(true);
    expect(useClipboardStore.getState().payload).toEqual(payload);
    expect(useClipboardStore.getState().lastError).toBeNull();
  });

  it('persist 将配额与安全错误分类', () => {
    const state = useClipboardStore.getState();
    state.setPayload(createPayload());
    const quotaStorage = {
      setItem: () => {
        throw { name: 'QuotaExceededError' };
      },
    };
    const securityStorage = {
      setItem: () => {
        throw { name: 'SecurityError' };
      },
    };

    expect(state.persist(quotaStorage)).toBe(false);
    expect(useClipboardStore.getState().lastError).toBe('quota');
    expect(useClipboardStore.getState().persist(securityStorage)).toBe(false);
    expect(useClipboardStore.getState().lastError).toBe('unavailable');
  });

  it('hydrate 对非法内容返回 false 并标记 corrupt', () => {
    const storage = createMemoryStorage({ [CLIPBOARD_STORAGE_KEY]: '{invalid' });

    expect(useClipboardStore.getState().hydrate(storage)).toBe(false);
    expect(useClipboardStore.getState().lastError).toBe('corrupt');
  });

  it('hydrate 对 getItem 异常分类且不抛出', () => {
    const storage = {
      getItem: () => {
        throw { name: 'SecurityError' };
      },
    };

    expect(useClipboardStore.getState().hydrate(storage)).toBe(false);
    expect(useClipboardStore.getState().lastError).toBe('unavailable');
  });

  it('Node 环境无 window 时 persist 和 hydrate 不抛出且标记 unavailable', () => {
    if (typeof window !== 'undefined') return;
    const state = useClipboardStore.getState();
    state.setPayload(createPayload());

    expect(state.persist()).toBe(false);
    expect(useClipboardStore.getState().lastError).toBe('unavailable');
    expect(useClipboardStore.getState().hydrate()).toBe(false);
    expect(useClipboardStore.getState().lastError).toBe('unavailable');
  });

  it('稀疏顶点方向可经 JSON 持久化与恢复保持自动方向槽位', () => {
    const payload = createPayload();
    delete payload.features[0].vertexBearings![1];
    const storage = createMemoryStorage();
    const state = useClipboardStore.getState();
    state.setPayload(payload);

    expect(state.persist(storage)).toBe(true);
    state.reset();
    expect(useClipboardStore.getState().hydrate(storage)).toBe(true);
    const bearings = useClipboardStore.getState().payload?.features[0].vertexBearings;
    expect(bearings).toHaveLength(2);
    expect(bearings?.[0]).toBe(45);
    expect(bearings?.[1]).toBeUndefined();
  });

  it('clearPayload 与 reset 都恢复默认状态', () => {
    const state = useClipboardStore.getState();
    state.setPayload(createPayload());
    state.recordPaste();
    state.clearPayload();
    expect(useClipboardStore.getState()).toMatchObject(defaultState());

    state.setPayload(createPayload());
    state.recordPaste();
    state.reset();
    expect(useClipboardStore.getState()).toMatchObject(defaultState());
  });
});

/** 返回测试断言所需的默认状态字段。 */
function defaultState(): Pick<
  ReturnType<typeof useClipboardStore.getState>,
  'payload' | 'pasteCount' | 'lastError'
> {
  return { payload: null, pasteCount: 0, lastError: null };
}
