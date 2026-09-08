/**
 * QA 独立验证：吸附引擎的优先级、阈值边界与排除语义。
 *
 * 工程师用例已覆盖基本分支，这里补足三类最容易回归的不变量：
 * 1. 优先级只在「距离完全相同」时生效，更近的低优先级来源必须胜出；
 * 2. 阈值边界为闭区间（距离恰等于阈值时命中）；
 * 3. 关闭吸附时对任意候选都恒为 null，包括零距离候选。
 *
 * 同距用例的坐标全部取自勾股数（5 与 (3,4)），避免三角函数浮点误差
 * 让「同距」变成「略有差异」，从而误判优先级未生效。
 */

import { describe, expect, it } from 'vitest';

import { snapPoint, type Projection, type SnapCandidate } from './snap';

/**
 * 构造可缩放的恒等投影。
 *
 * @param scale 每个经纬度单位对应的像素数，用于精确控制像素距离。
 */
function projectionAt(scale: number): Projection {
  return {
    toPixel: (point) => ({ x: point.lon * scale, y: point.lat * scale }),
    toLonLat: (pixel) => ({ lon: pixel.x / scale, lat: pixel.y / scale }),
  };
}

const origin = { lon: 0, lat: 0 };
const identity = projectionAt(1);

/** 构造候选；坐标为整数勾股数时可保证像素距离在浮点下仍精确相等。 */
function candidate(
  source: SnapCandidate['source'],
  lon: number,
  lat: number,
  featureId?: string,
  index?: number,
): SnapCandidate {
  return { point: { lon, lat }, source, featureId, index };
}

describe('QA 吸附优先级', () => {
  it('三源同距时 self > feature > grid', () => {
    const candidates = [
      candidate('grid', 5, 0, 'grid-1', 0),
      candidate('feature', 3, 4, 'feature-1', 1),
      candidate('self', 0, -5, 'self-1', 2),
    ];

    const result = snapPoint(origin, candidates, { enabled: true, thresholdPx: 5 }, identity);

    expect(result?.source).toBe('self');
    expect(result?.distancePx).toBe(5);
  });

  it('移除 self 后同距的 feature 胜过 grid', () => {
    const candidates = [
      candidate('grid', 5, 0, 'grid-1', 0),
      candidate('feature', 3, 4, 'feature-1', 1),
    ];

    expect(snapPoint(origin, candidates, { enabled: true, thresholdPx: 5 }, identity)?.source).toBe(
      'feature',
    );
  });

  it('更近的低优先级来源胜过更远的高优先级来源', () => {
    const candidates = [candidate('self', 9, 0, 'self-1', 0), candidate('grid', 0, 2, 'grid-1', 1)];

    const result = snapPoint(origin, candidates, { enabled: true, thresholdPx: 10 }, identity);

    expect(result?.source).toBe('grid');
    expect(result?.distancePx).toBe(2);
  });

  it('候选顺序不影响最终命中', () => {
    const feature = candidate('feature', 4, 3, 'feature-1', 0);
    const self = candidate('self', -4, -3, 'self-1', 1);

    const forward = snapPoint(origin, [feature, self], { enabled: true, thresholdPx: 5 }, identity);
    const backward = snapPoint(
      origin,
      [self, feature],
      { enabled: true, thresholdPx: 5 },
      identity,
    );

    expect(forward?.source).toBe('self');
    expect(backward?.source).toBe('self');
  });
});

describe('QA 吸附阈值边界', () => {
  it('距离恰等于阈值时命中（闭区间）', () => {
    const candidates = [candidate('grid', 10, 0, 'grid-1', 0)];

    expect(
      snapPoint(origin, candidates, { enabled: true, thresholdPx: 10 }, identity)?.distancePx,
    ).toBe(10);
  });

  it('距离略超阈值时不命中', () => {
    const candidates = [candidate('grid', 10.5, 0, 'grid-1', 0)];

    expect(snapPoint(origin, candidates, { enabled: true, thresholdPx: 10 }, identity)).toBeNull();
  });

  it('阈值 0 时仅精确重合的候选命中', () => {
    const exact = candidate('grid', 0, 0, 'grid-1', 0);
    const nearby = candidate('grid', 0.5, 0, 'grid-1', 1);

    expect(
      snapPoint(origin, [exact], { enabled: true, thresholdPx: 0 }, identity)?.distancePx,
    ).toBe(0);
    expect(snapPoint(origin, [nearby], { enabled: true, thresholdPx: 0 }, identity)).toBeNull();
  });

  it('关闭吸附时对零距离候选也恒返回 null', () => {
    const candidates = [
      candidate('self', 0, 0, 'self-1', 0),
      candidate('feature', 1, 0, 'feature-1', 0),
    ];

    expect(snapPoint(origin, candidates, { enabled: false, thresholdPx: 10 }, identity)).toBeNull();
  });

  it('按投影缩放换算像素距离，而非按经纬度差值', () => {
    const candidates = [candidate('grid', 1, 0, 'grid-1', 0)];

    // 每经度 100 像素时，1 经度的原始距离是 100 像素，超过 10 像素阈值。
    expect(
      snapPoint(origin, candidates, { enabled: true, thresholdPx: 10 }, projectionAt(100)),
    ).toBeNull();
    // 每经度 5 像素时，同一坐标只差 5 像素，应当命中。
    expect(
      snapPoint(origin, candidates, { enabled: true, thresholdPx: 10 }, projectionAt(5))?.source,
    ).toBe('grid');
  });

  it('sources 为空数组时不命中任何候选', () => {
    const candidates = [candidate('self', 1, 0, 'self-1', 0)];

    expect(
      snapPoint(origin, candidates, { enabled: true, thresholdPx: 10, sources: [] }, identity),
    ).toBeNull();
  });
});

describe('QA 吸附排除自身顶点', () => {
  const selfVertices: SnapCandidate[] = [
    candidate('self', 0, 0, 'line-1', 0),
    candidate('self', 1, 0, 'line-1', 1),
    candidate('self', 2, 0, 'line-1', 2),
  ];

  it('拖动某个顶点时该顶点不参与吸附', () => {
    const dragged = { lon: 1, lat: 0.5 };

    // 被拖顶点距自身仅 0.5 像素，若未排除则必然命中 index 1。
    expect(
      snapPoint(
        dragged,
        selfVertices,
        { enabled: true, thresholdPx: 10, exclude: { featureId: 'line-1', index: 1 } },
        identity,
      )?.candidate.index,
    ).not.toBe(1);
  });

  it('不同要素的同下标顶点不会被 exclude 误排除', () => {
    const candidates = [...selfVertices, candidate('feature', 1, 0.2, 'line-2', 1)];

    const result = snapPoint(
      { lon: 1, lat: 0.5 },
      candidates,
      { enabled: true, thresholdPx: 10, exclude: { featureId: 'line-1', index: 1 } },
      identity,
    );

    expect(result?.candidate.featureId).toBe('line-2');
    expect(result?.candidate.index).toBe(1);
  });

  it('exclude 只按 featureId 匹配时不会排除同要素的其他顶点', () => {
    const result = snapPoint(
      { lon: 2, lat: 0.3 },
      selfVertices,
      { enabled: true, thresholdPx: 10, exclude: { featureId: 'line-1', index: 0 } },
      identity,
    );

    expect(result?.candidate.index).toBe(2);
  });
});
