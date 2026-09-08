/**
 * 均匀网格空间索引单测。
 *
 * 覆盖分桶规则、圆形范围过滤、跨桶查询、写入顺序保持及输入不可变性。
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SPATIAL_CELL_SIZE,
  createSpatialIndex,
  querySpatialIndex,
  type SpatialPoint,
} from './spatialIndex';

const points: SpatialPoint[] = [
  { id: 'origin', x: 0, y: 0 },
  { id: 'east', x: 64, y: 0 },
  { id: 'northwest', x: -1, y: 64 },
];

describe('createSpatialIndex', () => {
  it('空输入创建空索引并使用默认单元边长', () => {
    const index = createSpatialIndex([]);

    expect(index.cellSize).toBe(DEFAULT_SPATIAL_CELL_SIZE);
    expect(index.cells.size).toBe(0);
  });

  it('未指定单元边长时使用默认值', () => {
    expect(createSpatialIndex(points).cellSize).toBe(DEFAULT_SPATIAL_CELL_SIZE);
  });

  it.each([0, -1, Infinity])('无效单元边长 %s 回退默认值', (cellSize) => {
    expect(createSpatialIndex(points, cellSize).cellSize).toBe(DEFAULT_SPATIAL_CELL_SIZE);
  });

  it('使用 floor 规则正确分入正负坐标网格', () => {
    const index = createSpatialIndex(points, 64);

    expect(index.cells.get('0,0')?.map((point) => point.id)).toEqual(['origin']);
    expect(index.cells.get('1,0')?.map((point) => point.id)).toEqual(['east']);
    expect(index.cells.get('-1,1')?.map((point) => point.id)).toEqual(['northwest']);
  });

  it('创建索引不修改输入点数组', () => {
    const input = [...points];
    const snapshot = input.map((point) => ({ ...point }));

    createSpatialIndex(input, 32);

    expect(input).toEqual(snapshot);
  });
});

describe('querySpatialIndex', () => {
  it('按欧氏距离过滤范围内外点，并包含圆周边界', () => {
    const index = createSpatialIndex([
      { id: 'inside', x: 3, y: 4 },
      { id: 'boundary', x: 5, y: 0 },
      { id: 'outside', x: 5.1, y: 0 },
    ]);

    expect(querySpatialIndex(index, 0, 0, 5).map((point) => point.id)).toEqual([
      'inside',
      'boundary',
    ]);
  });

  it('查询可跨越多个网格桶', () => {
    const index = createSpatialIndex(
      [
        { id: 'left', x: -65, y: 0 },
        { id: 'middle', x: 0, y: 0 },
        { id: 'right', x: 65, y: 0 },
      ],
      64,
    );

    expect(querySpatialIndex(index, 0, 0, 70).map((point) => point.id)).toEqual([
      'left',
      'middle',
      'right',
    ]);
  });

  it('结果保持输入写入顺序而非网格桶遍历顺序', () => {
    const index = createSpatialIndex(
      [
        { id: 'later-bucket', x: 65, y: 0 },
        { id: 'earlier-bucket', x: 0, y: 0 },
      ],
      64,
    );

    expect(querySpatialIndex(index, 0, 0, 100).map((point) => point.id)).toEqual([
      'later-bucket',
      'earlier-bucket',
    ]);
  });

  it.each([-1, Infinity])('负数或非有限半径 %s 返回空数组', (radius) => {
    const index = createSpatialIndex(points);
    expect(querySpatialIndex(index, 0, 0, radius)).toEqual([]);
  });

  it('查询不修改输入点数组', () => {
    const input = [...points];
    const snapshot = input.map((point) => ({ ...point }));
    const index = createSpatialIndex(input);

    querySpatialIndex(index, 0, 0, 100);

    expect(input).toEqual(snapshot);
  });
});
