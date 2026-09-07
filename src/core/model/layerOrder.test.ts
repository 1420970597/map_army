/**
 * 图层排序纯函数单测。
 *
 * 关注以下不变量：
 * - sortLayersByDisplay 不修改入参、严格按 order 降序排列；
 * - reorderLayers 的边界：拖到自己、id 不存在、单图层时返回原引用；
 * - 拖动后所有 order 在 `[0, count-1]` 连续且互不相同；
 * - 拖动后展示顺序与目标位置一致。
 */

import { describe, expect, it } from 'vitest';

import { createLayer } from './factory';
import type { Layer } from './types';
import { reorderLayers, sortLayersByDisplay } from './layerOrder';

/** 构造指定 order 的图层，便于测试断言 */
function makeLayers(): Layer[] {
  return [
    createLayer({ name: 'A', order: 10 }),
    createLayer({ name: 'B', order: 5 }),
    createLayer({ name: 'C', order: 0 }),
  ];
}

describe('sortLayersByDisplay', () => {
  it('按 order 降序排列，最上层在最前', () => {
    const layers = makeLayers();
    const sorted = sortLayersByDisplay(layers);
    expect(sorted.map((layer) => layer.name)).toEqual(['A', 'B', 'C']);
  });

  it('不修改入参', () => {
    const layers = makeLayers();
    const snapshot = layers.map((layer) => layer.order);
    sortLayersByDisplay(layers);
    expect(layers.map((layer) => layer.order)).toEqual(snapshot);
  });

  it('空数组返回空数组', () => {
    expect(sortLayersByDisplay([])).toEqual([]);
  });
});

describe('reorderLayers', () => {
  it('把最上层 A 拖到 C，落到 C 所在位置', () => {
    // 展示序列 [A, B, C]，把 A 拖到 C 的位置（index 2）
    // 摘除 A 后 [B, C]，在 index 2 插入 → [B, C, A]
    const layers = makeLayers();
    const [a, , c] = layers;
    const next = reorderLayers(layers, a.id, c.id);
    expect(next.map((layer) => layer.name)).toEqual(['B', 'C', 'A']);
    // order 重新归一化到 2/1/0，仍保持"越大越靠上"
    expect(next.map((layer) => layer.order)).toEqual([2, 1, 0]);
    // 应当返回新数组、不修改入参
    expect(next).not.toBe(layers);
    expect(layers.map((layer) => layer.name)).toEqual(['A', 'B', 'C']);
  });

  it('把最下层 C 拖到 B 的位置', () => {
    // 展示序列 [A, B, C]，把 C 拖到 B（index 1）
    // 摘除 C 后 [A, B]，在 index 1 插入 → [A, C, B]
    const layers = makeLayers();
    const [, b, c] = layers;
    const next = reorderLayers(layers, c.id, b.id);
    expect(next.map((layer) => layer.name)).toEqual(['A', 'C', 'B']);
    expect(next.map((layer) => layer.order)).toEqual([2, 1, 0]);
  });

  it('sourceId 等于 targetId 时返回原引用，不产生历史记录', () => {
    const layers = makeLayers();
    const next = reorderLayers(layers, layers[1].id, layers[1].id);
    expect(next).toBe(layers);
  });

  it('sourceId 不存在时返回原引用', () => {
    const layers = makeLayers();
    const next = reorderLayers(layers, 'nope', layers[0].id);
    expect(next).toBe(layers);
  });

  it('targetId 不存在时返回原引用', () => {
    const layers = makeLayers();
    const next = reorderLayers(layers, layers[0].id, 'nope');
    expect(next).toBe(layers);
  });

  it('单图层拖动返回原引用', () => {
    const single: Layer[] = [createLayer({ name: 'X', order: 0 })];
    const next = reorderLayers(single, single[0].id, single[0].id);
    expect(next).toBe(single);
  });

  it('重排后消除并列 order，使全部 order 互不相同', () => {
    // 构造两个 order 相同的图层（脏数据场景）
    const layers: Layer[] = [
      createLayer({ name: 'A', order: 5 }),
      createLayer({ name: 'B', order: 5 }),
      createLayer({ name: 'C', order: 5 }),
    ];
    const next = reorderLayers(layers, layers[0].id, layers[2].id);
    const orders = next.map((layer) => layer.order);
    expect(new Set(orders).size).toBe(orders.length);
  });
});
