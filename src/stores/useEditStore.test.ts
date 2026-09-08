/**
 * 几何编辑瞬态状态容器单测。
 *
 * 验证拖拽、吸附与框选状态仅保存在内存中，并保持输入隔离与语义 no-op。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { SNAP_THRESHOLD_PX, type SnapCandidate, type SnapResult } from '@/core/geo';

import { useEditStore } from './useEditStore';

const origin = { lon: 100, lat: 30 };
const destination = { lon: 101, lat: 31 };

function candidate(overrides: Partial<SnapCandidate> = {}): SnapCandidate {
  return {
    point: { ...origin },
    source: 'feature',
    featureId: 'feature-a',
    index: 1,
    ...overrides,
  };
}

function preview(overrides: Partial<SnapResult> = {}): SnapResult {
  return {
    point: { ...destination },
    source: 'feature',
    distancePx: 5,
    candidate: candidate(),
    ...overrides,
  };
}

function resetStore(): void {
  useEditStore.getState().reset();
}

describe('useEditStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('使用默认编辑瞬态状态', () => {
    const state = useEditStore.getState();

    expect(state.drag).toBeNull();
    expect(state.activeVertex).toBeNull();
    expect(state.snapEnabled).toBe(true);
    expect(state.snapThresholdPx).toBe(SNAP_THRESHOLD_PX);
    expect(state.snapCandidates).toEqual([]);
    expect(state.snapPreview).toBeNull();
    expect(state.boxSelect).toBeNull();
  });

  it('beginDrag 深拷贝起始顶点坐标', () => {
    const points = [{ ...origin }, { ...destination }];

    useEditStore.getState().beginDrag('feature-a', 1, points);
    points[0].lon = 0;

    expect(useEditStore.getState().drag).toEqual({
      featureId: 'feature-a',
      index: 1,
      startPoints: [origin, destination],
    });
    expect(useEditStore.getState().drag?.startPoints).not.toBe(points);
    expect(useEditStore.getState().drag?.startPoints[0]).not.toBe(points[0]);
  });

  it('endDrag 仅清空拖拽并保留活动顶点', () => {
    const state = useEditStore.getState();
    state.beginDrag('feature-a', 2, [origin]);
    state.setActiveVertex(2);
    state.endDrag();

    expect(useEditStore.getState().drag).toBeNull();
    expect(useEditStore.getState().activeVertex).toBe(2);
  });

  it('setActiveVertex 支持设置与清空活动顶点', () => {
    const state = useEditStore.getState();
    state.setActiveVertex(3);
    expect(useEditStore.getState().activeVertex).toBe(3);
    state.setActiveVertex(null);
    expect(useEditStore.getState().activeVertex).toBeNull();
  });

  it('toggleSnap 可往返切换吸附状态', () => {
    const state = useEditStore.getState();
    state.toggleSnap();
    expect(useEditStore.getState().snapEnabled).toBe(false);
    state.toggleSnap();
    expect(useEditStore.getState().snapEnabled).toBe(true);
  });

  it('setSnapThresholdPx 接受有效的非负有限阈值', () => {
    useEditStore.getState().setSnapThresholdPx(12.5);

    expect(useEditStore.getState().snapThresholdPx).toBe(12.5);
  });

  it.each([Number.NaN, Infinity, -1])('setSnapThresholdPx 拒绝无效阈值 %s', (threshold) => {
    const initial = useEditStore.getState();

    initial.setSnapThresholdPx(threshold);

    expect(useEditStore.getState()).toBe(initial);
    expect(useEditStore.getState().snapThresholdPx).toBe(SNAP_THRESHOLD_PX);
  });

  it('setSnapThresholdPx 对相同阈值保持状态引用', () => {
    const initial = useEditStore.getState();

    initial.setSnapThresholdPx(SNAP_THRESHOLD_PX);

    expect(useEditStore.getState()).toBe(initial);
  });

  it('setSnapCandidates 深拷贝数组、候选和坐标', () => {
    const candidates = [candidate(), candidate({ point: { lon: 102, lat: 32 }, index: 2 })];

    useEditStore.getState().setSnapCandidates(candidates);
    candidates[0].point.lon = 0;
    candidates.push(candidate({ featureId: 'later' }));

    const stored = useEditStore.getState().snapCandidates;
    expect(stored).toEqual([candidate(), candidate({ point: { lon: 102, lat: 32 }, index: 2 })]);
    expect(stored).not.toBe(candidates);
    expect(stored[0]).not.toBe(candidates[0]);
    expect(stored[0].point).not.toBe(candidates[0].point);
  });

  it('setSnapPreview 支持设置和清空预览', () => {
    const result = preview();
    const state = useEditStore.getState();

    state.setSnapPreview(result);
    expect(useEditStore.getState().snapPreview).toEqual(result);
    state.setSnapPreview(null);
    expect(useEditStore.getState().snapPreview).toBeNull();
  });

  it('setSnapPreview 深拷贝结果、候选和坐标', () => {
    const result = preview();

    useEditStore.getState().setSnapPreview(result);
    result.point.lon = 0;
    result.candidate.point.lat = 0;

    const stored = useEditStore.getState().snapPreview;
    expect(stored).toEqual(preview());
    expect(stored).not.toBe(result);
    expect(stored?.candidate).not.toBe(result.candidate);
    expect(stored?.point).not.toBe(result.point);
    expect(stored?.candidate.point).not.toBe(result.candidate.point);
  });

  it('setSnapPreview 对语义相同结果保持状态引用', () => {
    const state = useEditStore.getState();
    state.setSnapPreview(preview());
    const afterSet = useEditStore.getState();

    afterSet.setSnapPreview(preview());

    expect(useEditStore.getState()).toBe(afterSet);
  });

  it.each([
    ['distance', preview({ distancePx: 6 })],
    ['source', preview({ source: 'grid' })],
    ['candidate index', preview({ candidate: candidate({ index: 2 }) })],
    ['candidate point', preview({ candidate: candidate({ point: { lon: 99, lat: 29 } }) })],
  ])('setSnapPreview 在 %s 改变时更新状态', (_name, changed) => {
    const state = useEditStore.getState();
    state.setSnapPreview(preview());
    const beforeChange = useEditStore.getState();

    beforeChange.setSnapPreview(changed);

    expect(useEditStore.getState()).not.toBe(beforeChange);
    expect(useEditStore.getState().snapPreview).toEqual(changed);
  });

  it('setBoxSelect 深拷贝框选坐标', () => {
    const box = { a: { ...origin }, b: { ...destination } };

    useEditStore.getState().setBoxSelect(box);
    box.a.lon = 0;
    box.b.lat = 0;

    expect(useEditStore.getState().boxSelect).toEqual({ a: origin, b: destination });
    expect(useEditStore.getState().boxSelect?.a).not.toBe(box.a);
    expect(useEditStore.getState().boxSelect?.b).not.toBe(box.b);
  });

  it('setBoxSelect 对相同坐标与 null 保持状态引用', () => {
    const state = useEditStore.getState();
    state.setBoxSelect({ a: origin, b: destination });
    const afterSet = useEditStore.getState();

    afterSet.setBoxSelect({ a: { ...origin }, b: { ...destination } });
    expect(useEditStore.getState()).toBe(afterSet);
    afterSet.setBoxSelect(null);
    const afterClear = useEditStore.getState();
    afterClear.setBoxSelect(null);
    expect(useEditStore.getState()).toBe(afterClear);
  });

  it('reset 恢复默认瞬态状态', () => {
    const state = useEditStore.getState();
    state.beginDrag('feature-a', 0, [origin]);
    state.setActiveVertex(0);
    state.toggleSnap();
    state.setSnapThresholdPx(20);
    state.setSnapCandidates([candidate()]);
    state.setSnapPreview(preview());
    state.setBoxSelect({ a: origin, b: destination });

    state.reset();

    const reset = useEditStore.getState();
    expect(reset.drag).toBeNull();
    expect(reset.activeVertex).toBeNull();
    expect(reset.snapEnabled).toBe(true);
    expect(reset.snapThresholdPx).toBe(SNAP_THRESHOLD_PX);
    expect(reset.snapCandidates).toEqual([]);
    expect(reset.snapPreview).toBeNull();
    expect(reset.boxSelect).toBeNull();
  });
});
