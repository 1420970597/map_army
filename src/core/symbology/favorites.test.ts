import { describe, expect, it } from 'vitest';

import { isFavorite, normalizeFavorites, parseFavorites, serializeFavorites, toggleFavorite } from './favorites';

describe('收藏集合', () => {
  it('规范化去除重复项并保持顺序', () => {
    expect(normalizeFavorites(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('规范化去除空字符串和非字符串', () => {
    expect(normalizeFavorites(['a', '', '  ', 1, null])).toEqual(['a']);
  });

  it('规范化去除首尾空白', () => {
    expect(normalizeFavorites([' a ', 'a'])).toEqual(['a']);
  });

  it('按有效键集合剔除失效项', () => {
    expect(normalizeFavorites(['a', 'missing', 'b'], new Set(['a', 'b']))).toEqual(['a', 'b']);
  });

  it('非数组输入返回空集合', () => {
    expect(normalizeFavorites('a')).toEqual([]);
  });

  it('切换未收藏键会追加到末尾', () => {
    expect(toggleFavorite(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('切换已收藏键会移除', () => {
    expect(toggleFavorite(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('切换时先去重既有键', () => {
    expect(toggleFavorite(['a', 'a'], 'b')).toEqual(['a', 'b']);
  });

  it('空键不写入集合', () => {
    expect(toggleFavorite(['a'], '  ')).toEqual(['a']);
  });

  it('判断收藏状态时忽略输入空白', () => {
    expect(isFavorite(['a'], ' a ')).toBe(true);
  });

  it('序列化可往返', () => {
    expect(parseFavorites(serializeFavorites(['a', 'a', 'b']))).toEqual(['a', 'b']);
  });

  it('非法 JSON 返回空集合', () => {
    expect(parseFavorites('{invalid')).toEqual([]);
  });

  it('非数组 JSON 返回空集合', () => {
    expect(parseFavorites('{"key":"a"}')).toEqual([]);
  });

  it('null 返回空集合', () => {
    expect(parseFavorites(null)).toEqual([]);
  });
});
