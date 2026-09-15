/** 战术图形二维向量与折线基元测试。 */

import { describe, expect, it } from 'vitest';

import {
  add,
  dot,
  hatch45,
  length,
  lerp,
  normalize,
  offsetPolyline,
  perpendicular,
  roundPolyline,
  samplePolyline,
  scale,
  sub,
  variableOffsetPolyline,
} from './vec';

describe('二维向量基元', () => {
  it('支持加法、减法和数乘', () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
    expect(sub({ x: 4, y: 6 }, { x: 3, y: 4 })).toEqual({ x: 1, y: 2 });
    expect(scale({ x: 2, y: -3 }, 4)).toEqual({ x: 8, y: -12 });
  });

  it('计算长度、点积与线性插值', () => {
    expect(length({ x: 3, y: 4 })).toBe(5);
    expect(dot({ x: 2, y: 3 }, { x: 4, y: -1 })).toBe(5);
    expect(lerp({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.25)).toEqual({ x: 2.5, y: 5 });
  });

  it('单位化零向量不会产生 NaN', () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(normalize({ x: 3, y: 4 })).toEqual({ x: 0.6, y: 0.8 });
  });

  it('左法线与原向量垂直', () => {
    const normal = perpendicular({ x: 5, y: 0 });

    expect(normal).toEqual({ x: 0, y: 5 });
    expect(dot(normal, { x: 5, y: 0 })).toBe(0);
  });
});

describe('折线偏移与采样', () => {
  it('水平线的左偏移朝北', () => {
    expect(
      offsetPolyline(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        2,
      ),
    ).toEqual([
      { x: 0, y: 2 },
      { x: 10, y: 2 },
    ]);
  });

  it('负距离向右偏移', () => {
    expect(
      offsetPolyline(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        -3,
      ),
    ).toEqual([
      { x: 0, y: -3 },
      { x: 10, y: -3 },
    ]);
  });

  it('变宽偏移在左右两侧保持对应半宽', () => {
    const result = variableOffsetPolyline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [2, 6],
    );

    expect(result.left).toEqual([
      { x: 0, y: 1 },
      { x: 10, y: 3 },
    ]);
    expect(result.right).toEqual([
      { x: 0, y: -1 },
      { x: 10, y: -3 },
    ]);
  });

  it('等距采样保留首尾且插入中间样本', () => {
    expect(
      samplePolyline(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        3,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 6, y: 0 },
      { x: 9, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it('连续重复点会被压缩且输入不变', () => {
    const input = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ];
    const snapshot = structuredClone(input);

    expect(offsetPolyline(input, 1)).toEqual([
      { x: 0, y: 1 },
      { x: 5, y: 1 },
    ]);
    expect(input).toEqual(snapshot);
  });

  it('零长和单点折线不产生 NaN', () => {
    const outputs = [
      offsetPolyline([{ x: 1, y: 1 }], 5),
      offsetPolyline(
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
        ],
        5,
      ),
      variableOffsetPolyline([{ x: 1, y: 1 }], [10]).left,
      samplePolyline(
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
        ],
        2,
      ),
    ];

    for (const output of outputs) {
      expect(output.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(
        true,
      );
    }
  });
});

describe('圆角与阴影线', () => {
  it('圆角采样保留折线首尾', () => {
    const result = roundPolyline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      2,
      3,
    );

    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result.at(-1)).toEqual({ x: 10, y: 10 });
    expect(result.length).toBeGreaterThan(3);
  });

  it('共线折线圆角化不会产生 NaN', () => {
    const result = roundPolyline(
      [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ],
      3,
    );

    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it('在方形内生成四十五度阴影线', () => {
    const lines = hatch45(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      2,
    );

    expect(lines.length).toBeGreaterThan(0);
    expect(
      lines.every(
        (line) =>
          line.length === 2 && Math.abs(line[1].y - line[1].x - (line[0].y - line[0].x)) < 1e-9,
      ),
    ).toBe(true);
  });

  it('退化多边形和非法间距不生成阴影线', () => {
    expect(
      hatch45(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        1,
      ),
    ).toEqual([]);
    expect(
      hatch45(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
        ],
        0,
      ),
    ).toEqual([]);
  });
});
