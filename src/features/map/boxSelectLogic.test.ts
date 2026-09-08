import { describe, expect, it } from 'vitest';

import {
  BOX_SELECT_MIN_DRAG_PX,
  isBoxSelectDrag,
  lonLatBoundsFromCorners,
  selectionForBox,
} from './boxSelectLogic';

describe('isBoxSelectDrag', () => {
  it('导出五像素阈值', () => {
    expect(BOX_SELECT_MIN_DRAG_PX).toBe(5);
  });

  it('零位移不是框选拖拽', () => {
    expect(isBoxSelectDrag({ start: { x: 4, y: 8 }, end: { x: 4, y: 8 } })).toBe(false);
  });

  it('小于阈值的水平位移不是框选拖拽', () => {
    expect(isBoxSelectDrag({ start: { x: 0, y: 0 }, end: { x: 4.99, y: 0 } })).toBe(false);
  });

  it('恰好五像素的水平位移是框选拖拽', () => {
    expect(isBoxSelectDrag({ start: { x: 0, y: 0 }, end: { x: 5, y: 0 } })).toBe(true);
  });

  it('使用欧氏距离而非单轴距离', () => {
    expect(isBoxSelectDrag({ start: { x: 0, y: 0 }, end: { x: 3, y: 4 } })).toBe(true);
  });

  it('反向拖动同样按距离判断', () => {
    expect(isBoxSelectDrag({ start: { x: 10, y: 10 }, end: { x: 6, y: 7 } })).toBe(true);
  });
});

describe('lonLatBoundsFromCorners', () => {
  it('保持左下到右上的标准坐标', () => {
    expect(lonLatBoundsFromCorners({ lon: 1, lat: 2 }, { lon: 3, lat: 4 })).toEqual({
      minLon: 1,
      minLat: 2,
      maxLon: 3,
      maxLat: 4,
    });
  });

  it('归一化右上到左下的坐标', () => {
    expect(lonLatBoundsFromCorners({ lon: 30, lat: 40 }, { lon: 10, lat: 20 })).toEqual({
      minLon: 10,
      minLat: 20,
      maxLon: 30,
      maxLat: 40,
    });
  });

  it('归一化交叉方向的对角坐标', () => {
    expect(lonLatBoundsFromCorners({ lon: 8, lat: 1 }, { lon: 2, lat: 9 })).toEqual({
      minLon: 2,
      minLat: 1,
      maxLon: 8,
      maxLat: 9,
    });
  });

  it('不修改输入坐标', () => {
    const first = { lon: 3, lat: 7 };
    const second = { lon: 1, lat: 9 };

    lonLatBoundsFromCorners(first, second);

    expect(first).toEqual({ lon: 3, lat: 7 });
    expect(second).toEqual({ lon: 1, lat: 9 });
  });
});

describe('selectionForBox', () => {
  it('替换选择时仅保留命中项', () => {
    expect(selectionForBox(['alpha', 'bravo'], ['charlie', 'delta'], false)).toEqual([
      'charlie',
      'delta',
    ]);
  });

  it('替换选择时去重命中项', () => {
    expect(selectionForBox(['alpha'], ['bravo', 'bravo', 'charlie'], false)).toEqual([
      'bravo',
      'charlie',
    ]);
  });

  it('追加选择时保留现有选择并追加新命中项', () => {
    expect(selectionForBox(['alpha', 'bravo'], ['bravo', 'charlie'], true)).toEqual([
      'alpha',
      'bravo',
      'charlie',
    ]);
  });

  it('追加选择时清理输入中的重复标识', () => {
    expect(selectionForBox(['alpha', 'alpha'], ['bravo', 'alpha', 'bravo'], true)).toEqual([
      'alpha',
      'bravo',
    ]);
  });

  it('空命中在替换模式清空选择', () => {
    expect(selectionForBox(['alpha'], [], false)).toEqual([]);
  });

  it('不修改输入数组', () => {
    const selected = ['alpha', 'bravo'];
    const hits = ['bravo', 'charlie'];

    selectionForBox(selected, hits, true);

    expect(selected).toEqual(['alpha', 'bravo']);
    expect(hits).toEqual(['bravo', 'charlie']);
  });
});
