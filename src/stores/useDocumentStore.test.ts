/**
 * 文档 store 的手势事务单测。
 *
 * 验证预览阶段不污染撤销栈，结束手势时仅提交一次起始快照。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  createDocument,
  createFeature,
  createLineGeometry,
  createPointGeometry,
} from '@/core/model';
import type { MapDocument, MapFeature } from '@/core/model';

import { useDocumentStore } from './useDocumentStore';

const firstPoint = { lon: 100, lat: 30 };
const secondPoint = { lon: 101, lat: 31 };
const thirdPoint = { lon: 102, lat: 32 };
const movedPoint = { lon: 103, lat: 33 };

function createFixture(): { document: MapDocument; line: MapFeature; point: MapFeature } {
  const document = createDocument('手势测试');
  const layerId = document.layers[0].id;
  const line = createFeature({
    layerId,
    sidc: 'SFGPUCI----K---',
    geometry: createLineGeometry([firstPoint, secondPoint]),
  });
  const point = createFeature({
    layerId,
    sidc: 'SFGPUCI----K---',
    geometry: createPointGeometry(firstPoint.lon, firstPoint.lat),
  });

  return { document: { ...document, features: [line, point] }, line, point };
}

function resetStore(): { document: MapDocument; line: MapFeature; point: MapFeature } {
  useDocumentStore.getState().endGesture();
  const fixture = createFixture();
  useDocumentStore.setState({
    document: fixture.document,
    activeLayerId: fixture.document.layers[0].id,
    selectedIds: [],
    past: [],
    future: [],
  });
  return fixture;
}

function geometryOf(id: string): MapFeature['geometry'] {
  const feature = useDocumentStore.getState().document.features.find((item) => item.id === id);
  if (!feature) throw new Error(`找不到要素 ${id}`);
  return feature.geometry;
}

describe('useDocumentStore 手势事务', () => {
  beforeEach(() => {
    resetStore();
  });

  it('多次几何预览在结束手势时只提交一次历史', () => {
    const { line } = resetStore();
    const store = useDocumentStore.getState();

    store.beginGesture();
    store.previewFeatureGeometry(line.id, [firstPoint, movedPoint]);
    store.previewFeatureGeometry(line.id, [firstPoint, thirdPoint], [45, 90]);
    store.endGesture();

    expect(useDocumentStore.getState().past).toHaveLength(1);
    expect(geometryOf(line.id)).toEqual({ kind: 'line', points: [firstPoint, thirdPoint] });
    expect(
      useDocumentStore.getState().document.features.find((item) => item.id === line.id)
        ?.vertexBearings,
    ).toEqual([45, 90]);
  });

  it('没有预览的手势不会提交历史', () => {
    const store = useDocumentStore.getState();

    store.beginGesture();
    store.endGesture();

    expect(useDocumentStore.getState().past).toHaveLength(0);
    expect(useDocumentStore.getState().future).toHaveLength(0);
  });

  it('预览恢复起始值后不会提交历史或清空 future', () => {
    const { document } = resetStore();
    const store = useDocumentStore.getState();
    store.updateLayer(document.layers[0].id, { opacity: 0.7 });
    store.undo();
    const future = useDocumentStore.getState().future;

    store.beginGesture();
    store.previewLayer(document.layers[0].id, { opacity: 0.5 });
    store.previewLayer(document.layers[0].id, { opacity: 1 });
    store.endGesture();

    expect(useDocumentStore.getState().past).toHaveLength(0);
    expect(useDocumentStore.getState().future).toEqual(future);
  });

  it('多次图层预览结束后保留最后的不透明度并提交一次历史', () => {
    const { document } = resetStore();
    const store = useDocumentStore.getState();
    const layerId = document.layers[0].id;

    store.beginGesture();
    store.previewLayer(layerId, { opacity: 0.8 });
    store.previewLayer(layerId, { opacity: 0.35 });
    store.endGesture();

    expect(useDocumentStore.getState().past).toHaveLength(1);
    expect(useDocumentStore.getState().document.layers[0].opacity).toBe(0.35);
  });

  it('预览期间不改变 past 与 future', () => {
    const { line } = resetStore();
    const store = useDocumentStore.getState();
    store.updateLayer(useDocumentStore.getState().document.layers[0].id, { opacity: 0.7 });
    store.undo();
    const before = useDocumentStore.getState();

    store.beginGesture();
    store.previewFeatureGeometry(line.id, [firstPoint, movedPoint]);

    expect(useDocumentStore.getState().past).toEqual(before.past);
    expect(useDocumentStore.getState().future).toEqual(before.future);
    store.endGesture();
  });

  it('applyGeometry 一次操作只提交一条历史', () => {
    const { line } = resetStore();

    useDocumentStore.getState().applyGeometry(line.id, [firstPoint, movedPoint]);

    expect(useDocumentStore.getState().past).toHaveLength(1);
    expect(geometryOf(line.id)).toEqual({ kind: 'line', points: [firstPoint, movedPoint] });
  });

  it('applyGeometry 对无变化不提交历史', () => {
    const { line } = resetStore();

    useDocumentStore.getState().applyGeometry(line.id, [firstPoint, secondPoint]);

    expect(useDocumentStore.getState().past).toHaveLength(0);
  });

  it('applyGeometry 拒绝低于最小点数的线几何', () => {
    const { line } = resetStore();

    useDocumentStore.getState().applyGeometry(line.id, [firstPoint]);

    expect(useDocumentStore.getState().past).toHaveLength(0);
    expect(geometryOf(line.id)).toEqual({ kind: 'line', points: [firstPoint, secondPoint] });
  });

  it('Point 几何将 points 首项写入 position', () => {
    const { point } = resetStore();

    useDocumentStore.getState().applyGeometry(point.id, [movedPoint]);

    expect(geometryOf(point.id)).toEqual({ kind: 'point', position: movedPoint });
    expect(useDocumentStore.getState().past).toHaveLength(1);
  });

  it('嵌套 beginGesture 保留第一次开始时的快照', () => {
    const { line } = resetStore();
    const store = useDocumentStore.getState();

    store.beginGesture();
    store.previewFeatureGeometry(line.id, [firstPoint, movedPoint]);
    store.beginGesture();
    store.previewFeatureGeometry(line.id, [firstPoint, thirdPoint]);
    store.endGesture();
    store.undo();

    expect(geometryOf(line.id)).toEqual({ kind: 'line', points: [firstPoint, secondPoint] });
  });

  it('手势结果可通过一次 undo 和 redo 往返', () => {
    const { line } = resetStore();
    const store = useDocumentStore.getState();

    store.beginGesture();
    store.previewFeatureGeometry(line.id, [firstPoint, movedPoint]);
    store.endGesture();
    store.undo();
    expect(geometryOf(line.id)).toEqual({ kind: 'line', points: [firstPoint, secondPoint] });

    store.redo();
    expect(geometryOf(line.id)).toEqual({ kind: 'line', points: [firstPoint, movedPoint] });
  });

  it('预览不存在的要素不会记录历史', () => {
    const store = useDocumentStore.getState();

    store.beginGesture();
    store.previewFeatureGeometry('missing', [firstPoint, secondPoint]);
    store.endGesture();

    expect(useDocumentStore.getState().past).toHaveLength(0);
  });

  it('预览不存在的图层不会记录历史', () => {
    const store = useDocumentStore.getState();

    store.beginGesture();
    store.previewLayer('missing', { opacity: 0.5 });
    store.endGesture();

    expect(useDocumentStore.getState().past).toHaveLength(0);
  });

  it('方向数组长度不匹配时不会写入非法几何', () => {
    const { line } = resetStore();

    useDocumentStore.getState().applyGeometry(line.id, [firstPoint, movedPoint], [90]);

    expect(useDocumentStore.getState().past).toHaveLength(0);
    expect(geometryOf(line.id)).toEqual({ kind: 'line', points: [firstPoint, secondPoint] });
  });

  it('未开启手势时预览安全无操作', () => {
    const { line } = resetStore();

    useDocumentStore.getState().previewFeatureGeometry(line.id, [firstPoint, movedPoint]);

    expect(useDocumentStore.getState().past).toHaveLength(0);
    expect(geometryOf(line.id)).toEqual({ kind: 'line', points: [firstPoint, secondPoint] });
  });
});
