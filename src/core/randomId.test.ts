import { afterEach, describe, expect, it, vi } from 'vitest';

describe('createRandomId', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('支持原生 UUID 并保留方法接收者', async () => {
    const source = {
      randomUUID() {
        expect(this).toBe(source);
        return 'b3b52baa-9380-4dfc-b053-8b1e9dce100d';
      },
    };
    vi.stubGlobal('crypto', source);
    const { createRandomId } = await import('./randomId');
    expect(createRandomId()).toBe('b3b52baa-9380-4dfc-b053-8b1e9dce100d');
  });

  it('在 randomUUID 不可用时使用 getRandomValues', async () => {
    const source = {
      getRandomValues(values: Uint8Array) {
        expect(this).toBe(source);
        values.fill(0x11);
        return values;
      },
    };
    vi.stubGlobal('crypto', source);

    const { createRandomId } = await import('./randomId');
    expect(createRandomId()).toBe('11111111-1111-4111-9111-111111111111');
  });

  it('在加密随机源不可用且同一毫秒连续创建时仍保留不同标识', async () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const { createRandomId } = await import('./randomId');
    const ids = Array.from({ length: 100 }, () => createRandomId());
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(100);
  });

  it('随机源拒绝调用时仍可生成标识', async () => {
    const denied = () => {
      throw new Error('随机源不可用');
    };
    vi.stubGlobal('crypto', { randomUUID: denied, getRandomValues: denied });
    const { createRandomId } = await import('./randomId');
    expect(createRandomId()).not.toBe(createRandomId());
  });
});
