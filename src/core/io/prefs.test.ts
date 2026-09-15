import { describe, expect, it } from 'vitest';

import {
  DEFAULT_APP_PREFS,
  loadPrefs,
  parsePrefs,
  PREFS_STORAGE_KEY,
  savePrefs,
  serializePrefs,
} from './prefs';

function createStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

describe('符号偏好', () => {
  it('空值解析为默认偏好', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_APP_PREFS);
  });

  it('非法 JSON 解析为默认偏好', () => {
    expect(parsePrefs('{bad')).toEqual(DEFAULT_APP_PREFS);
  });

  it('非对象 JSON 解析为默认偏好', () => {
    expect(parsePrefs('[]')).toEqual(DEFAULT_APP_PREFS);
  });

  it('缺失字段补全默认值', () => {
    expect(parsePrefs('{"favorites":["a"]}')).toEqual({
      ...DEFAULT_APP_PREFS,
      favorites: ['a'],
    });
  });

  it('读取 extended 模式', () => {
    expect(parsePrefs('{"symbolMode":"extended"}').symbolMode).toBe('extended');
  });

  it('非法模式回退 standard', () => {
    expect(parsePrefs('{"symbolMode":"other"}').symbolMode).toBe('standard');
  });

  it('规范化收藏并保持顺序', () => {
    expect(parsePrefs('{"favorites":["a","a"," b ",1]}').favorites).toEqual(['a', 'b']);
  });

  it('规范化符号默认值', () => {
    expect(
      parsePrefs('{"symbolDefaults":{"lineWeight":100,"fillColor":"bad","fontSize":1}}')
        .symbolDefaults,
    ).toEqual({
      lineWeight: 8,
      fillColor: '#0B82D6',
      fontSize: 10,
      fontFamily: 'system-ui, "Segoe UI", sans-serif',
    });
  });

  it('序列化与解析可往返', () => {
    const prefs = {
      version: 1,
      favorites: ['a', 'a', 'b'],
      symbolDefaults: { lineWeight: 5, fillColor: '#123456', fontSize: 18, fontFamily: 'serif' },
      symbolMode: 'extended' as const,
    };
    expect(parsePrefs(serializePrefs(prefs))).toEqual({ ...prefs, favorites: ['a', 'b'] });
  });

  it('可保存并读取偏好', () => {
    const storage = createStorage();
    expect(savePrefs({ favorites: ['a'] }, storage)).toBe(true);
    expect(loadPrefs(storage).favorites).toEqual(['a']);
  });

  it('写入使用稳定存储键', () => {
    const storage = createStorage();
    savePrefs({ favorites: ['a'] }, storage);
    expect(storage.getItem(PREFS_STORAGE_KEY)).not.toBeNull();
  });

  it('存储 getItem 失败时读取默认值', () => {
    expect(
      loadPrefs({
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {},
        removeItem: () => {},
      }),
    ).toEqual(DEFAULT_APP_PREFS);
  });

  it('存储 setItem 失败时返回 false', () => {
    expect(
      savePrefs(
        {},
        {
          getItem: () => null,
          setItem: () => {
            throw new Error('quota');
          },
          removeItem: () => {},
        },
      ),
    ).toBe(false);
  });

  it('无浏览器存储时不抛出', () => {
    expect(loadPrefs()).toEqual(DEFAULT_APP_PREFS);
    expect(savePrefs({})).toBe(false);
  });
});
