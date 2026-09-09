/**
 * 文档 store 的手势事务与批量操作单测。
 *
 * 验证预览阶段不污染撤销栈，结束手势时仅提交一次起始快照，
 * 并覆盖多选、批量图层迁移与顶点编辑操作的历史边界。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  createAreaGeometry,
  createDocument,
  createFeature,
  createLayer,
  createLineGeometry,
  createPointGeometry,
  LayerStatus,
} from '@/core/model';
import type { MapDocument, MapFeature } from '@/core/model';

import { selectPrimaryFeature, selectSelectedFeatures, useDocumentStore } from './useDocumentStore';

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

function featureOf(id: string): MapFeature {
  const feature = useDocumentStore.getState().document.features.find((item) => item.id === id);
  if (!feature) throw new Error(`找不到要素 ${id}`);
  return feature;
}

function prepareMultiLayerFixture(): {
  sourceLayerId: string;
  targetLayerId: string;
  lockedLayerId: string;
  features: MapFeature[];
} {
  const document = createDocument('批量操作');
  const sourceLayerId = document.layers[0].id;
  const targetLayer = createLayer({ name: '目标图层', order: 1 });
  const lockedLayer = { ...createLayer({ name: '锁定图层', order: 2 }), locked: true };
  const features = [
    createFeature({
      layerId: sourceLayerId,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(0, 0),
    }),
    createFeature({
      layerId: sourceLayerId,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(1, 1),
    }),
    createFeature({
      layerId: sourceLayerId,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(2, 2),
    }),
    createFeature({
      layerId: targetLayer.id,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(3, 3),
    }),
    createFeature({
      layerId: sourceLayerId,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(4, 4),
    }),
  ];
  useDocumentStore.setState({
    document: { ...document, layers: [document.layers[0], targetLayer, lockedLayer], features },
    activeLayerId: sourceLayerId,
    selectedIds: [],
    past: [],
    future: [],
  });
  return { sourceLayerId, targetLayerId: targetLayer.id, lockedLayerId: lockedLayer.id, features };
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
    expect(featureOf(line.id).vertexBearings).toEqual([45, 90]);
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

describe('useDocumentStore 多选操作', () => {
  beforeEach(() => {
    resetStore();
  });

  it('toggleSelect 追加和移除选择，末位为主选且不进入历史', () => {
    const { line, point } = resetStore();
    const store = useDocumentStore.getState();

    store.toggleSelect(line.id);
    store.toggleSelect(point.id);
    expect(useDocumentStore.getState().selectedIds).toEqual([line.id, point.id]);
    expect(useDocumentStore.getState().selectedIds.at(-1)).toBe(point.id);
    store.toggleSelect(line.id);

    expect(useDocumentStore.getState().selectedIds).toEqual([point.id]);
    expect(useDocumentStore.getState().past).toHaveLength(0);
  });

  it('add、remove 和 clear 维护稳定去重顺序且不进入历史', () => {
    const { line, point } = resetStore();
    const store = useDocumentStore.getState();

    store.addToSelection([line.id, point.id, line.id]);
    expect(useDocumentStore.getState().selectedIds).toEqual([line.id, point.id]);
    store.removeFromSelection([line.id]);
    expect(useDocumentStore.getState().selectedIds).toEqual([point.id]);
    store.clearSelection();

    expect(useDocumentStore.getState().selectedIds).toEqual([]);
    expect(useDocumentStore.getState().past).toHaveLength(0);
  });

  it('selectAllInLayer 按文档要素顺序替换选择，缺失图层返回空集', () => {
    const { document, line, point } = resetStore();
    const otherLayer = createLayer({ name: '其他', order: 1 });
    const other = createFeature({
      layerId: otherLayer.id,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(4, 4),
    });
    useDocumentStore.setState({
      document: {
        ...document,
        layers: [...document.layers, otherLayer],
        features: [point, other, line],
      },
    });

    useDocumentStore.getState().selectAllInLayer(document.layers[0].id);
    expect(useDocumentStore.getState().selectedIds).toEqual([point.id, line.id]);
    useDocumentStore.getState().selectAllInLayer('missing');
    expect(useDocumentStore.getState().selectedIds).toEqual([]);
  });

  it('selectInBounds 以点线命中结果替换选择', () => {
    const { document, line, point } = resetStore();
    const outside = createFeature({
      layerId: document.layers[0].id,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(150, 60),
    });
    useDocumentStore.setState({ document: { ...document, features: [line, point, outside] } });

    useDocumentStore
      .getState()
      .selectInBounds({ minLon: 99, minLat: 29, maxLon: 102, maxLat: 32 }, 'intersect');

    expect(useDocumentStore.getState().selectedIds).toEqual([line.id, point.id]);
  });

  it('纯 selector 以末位为主选，并按选择顺序去重过滤缺失要素', () => {
    const { line, point } = resetStore();
    const state = {
      document: useDocumentStore.getState().document,
      selectedIds: [point.id, 'missing', line.id, point.id],
    };

    expect(selectPrimaryFeature(state)).toBe(point);
    expect(selectSelectedFeatures(state)).toEqual([point, line]);
  });

  it('select 也会去重且不进入历史', () => {
    const { line, point } = resetStore();

    useDocumentStore.getState().select([line.id, point.id, line.id]);

    expect(useDocumentStore.getState().selectedIds).toEqual([line.id, point.id]);
    expect(useDocumentStore.getState().past).toHaveLength(0);
  });

  it('selectInBounds 的 inside 模式会排除部分落入范围的线', () => {
    const { line } = resetStore();

    useDocumentStore
      .getState()
      .selectInBounds({ minLon: 99, minLat: 29, maxLon: 100.5, maxLat: 30.5 }, 'inside');

    expect(useDocumentStore.getState().selectedIds).not.toContain(line.id);
  });
});

describe('useDocumentStore 原子批量新增要素', () => {
  beforeEach(() => {
    resetStore();
  });

  it('空数组不改变文档、选择或历史', () => {
    const before = useDocumentStore.getState();

    useDocumentStore.getState().addFeatures([]);

    expect(useDocumentStore.getState().document).toBe(before.document);
    expect(useDocumentStore.getState().selectedIds).toEqual([]);
    expect(useDocumentStore.getState().past).toHaveLength(0);
  });

  it('单个要素追加后产生一条历史并选中新增项', () => {
    const { document } = resetStore();
    const feature = createFeature({
      layerId: document.layers[0].id,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(10, 10),
    });

    useDocumentStore.getState().addFeatures([feature]);

    expect(useDocumentStore.getState().document.features.at(-1)).toEqual(feature);
    expect(useDocumentStore.getState().selectedIds).toEqual([feature.id]);
    expect(useDocumentStore.getState().past).toHaveLength(1);
  });

  it('多个要素仅产生一个撤销快照', () => {
    const { document } = resetStore();
    const features = [
      createFeature({
        layerId: document.layers[0].id,
        sidc: 'SFGPUCI----K---',
        geometry: createPointGeometry(10, 10),
      }),
      createFeature({
        layerId: document.layers[0].id,
        sidc: 'SFGPUCI----K---',
        geometry: createPointGeometry(20, 20),
      }),
    ];

    useDocumentStore.getState().addFeatures(features);

    expect(useDocumentStore.getState().document.features.slice(-2)).toEqual(features);
    expect(useDocumentStore.getState().past).toHaveLength(1);
  });

  it('过滤与文档既有标识冲突的要素', () => {
    const { document, line } = resetStore();
    const accepted = createFeature({
      layerId: document.layers[0].id,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(10, 10),
    });
    const conflict = { ...accepted, id: line.id };

    useDocumentStore.getState().addFeatures([conflict, accepted]);

    expect(useDocumentStore.getState().document.features.map((feature) => feature.id)).toEqual([
      line.id,
      useDocumentStore.getState().document.features[1].id,
      accepted.id,
    ]);
    expect(useDocumentStore.getState().selectedIds).toEqual([accepted.id]);
    expect(useDocumentStore.getState().past).toHaveLength(1);
  });

  it('过滤批次内部的重复标识并保留首项', () => {
    const { document } = resetStore();
    const first = createFeature({
      layerId: document.layers[0].id,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(10, 10),
    });
    const duplicate = { ...first, geometry: createPointGeometry(20, 20) };

    useDocumentStore.getState().addFeatures([first, duplicate]);

    expect(useDocumentStore.getState().document.features.at(-1)).toEqual(first);
    expect(useDocumentStore.getState().document.features).toHaveLength(3);
    expect(useDocumentStore.getState().past).toHaveLength(1);
  });

  it('按输入顺序去重设置新增要素选择', () => {
    const { document } = resetStore();
    const first = createFeature({
      layerId: document.layers[0].id,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(10, 10),
    });
    const second = createFeature({
      layerId: document.layers[0].id,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(20, 20),
    });

    useDocumentStore.getState().addFeatures([second, first, second]);

    expect(useDocumentStore.getState().selectedIds).toEqual([second.id, first.id]);
  });

  it('深拷贝输入要素，后续修改不会影响文档', () => {
    const { document } = resetStore();
    const feature: MapFeature = {
      ...createFeature({
        layerId: document.layers[0].id,
        sidc: 'SFGPUCI----K---',
        geometry: createLineGeometry([
          { lon: 100, lat: 30 },
          { lon: 101, lat: 31 },
        ]),
      }),
      geometry: createLineGeometry([
        { lon: 100, lat: 30 },
        { lon: 101, lat: 31 },
      ]),
      textFields: { uniqueDesignation: '原始标号' },
    };

    useDocumentStore.getState().addFeatures([feature]);
    if (feature.geometry.kind !== 'line') throw new Error('测试要素必须是线');
    feature.geometry.points[0].lon = 999;
    feature.textFields.uniqueDesignation = '已修改标号';

    const stored = featureOf(feature.id);
    expect(stored.geometry).toEqual({
      kind: 'line',
      points: [
        { lon: 100, lat: 30 },
        { lon: 101, lat: 31 },
      ],
    });
    expect(stored.textFields.uniqueDesignation).toBe('原始标号');
  });

  it('一次 undo 恢复批量新增前的文档', () => {
    const { document } = resetStore();
    const features = [
      createFeature({
        layerId: document.layers[0].id,
        sidc: 'SFGPUCI----K---',
        geometry: createPointGeometry(10, 10),
      }),
      createFeature({
        layerId: document.layers[0].id,
        sidc: 'SFGPUCI----K---',
        geometry: createPointGeometry(20, 20),
      }),
    ];

    useDocumentStore.getState().addFeatures(features);
    useDocumentStore.getState().undo();

    expect(useDocumentStore.getState().document.features).toEqual(document.features);
    expect(useDocumentStore.getState().past).toHaveLength(0);
    expect(useDocumentStore.getState().future).toHaveLength(1);
  });

  it('批量新增会清空已有 future', () => {
    const { document } = resetStore();
    const oldFeature = createFeature({
      layerId: document.layers[0].id,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(10, 10),
    });
    const nextFeature = createFeature({
      layerId: document.layers[0].id,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(20, 20),
    });
    useDocumentStore.getState().addFeature(oldFeature);
    useDocumentStore.getState().undo();

    useDocumentStore.getState().addFeatures([nextFeature]);

    expect(useDocumentStore.getState().future).toEqual([]);
    expect(useDocumentStore.getState().past).toHaveLength(1);
  });
});

describe('useDocumentStore 批量图层与顶点操作', () => {
  beforeEach(() => {
    resetStore();
  });

  it('批量移动五个要素只提交一次、选择实际移动项并支持 undo', () => {
    const { sourceLayerId, targetLayerId, features } = prepareMultiLayerFixture();
    const store = useDocumentStore.getState();

    store.moveFeaturesToLayer(
      [features[2].id, features[0].id, features[2].id, 'missing', features[3].id],
      targetLayerId,
    );

    expect(useDocumentStore.getState().past).toHaveLength(1);
    expect(useDocumentStore.getState().selectedIds).toEqual([features[2].id, features[0].id]);
    expect(featureOf(features[0].id).layerId).toBe(targetLayerId);
    expect(featureOf(features[2].id).layerId).toBe(targetLayerId);
    expect(featureOf(features[1].id).layerId).toBe(sourceLayerId);

    store.undo();
    expect(featureOf(features[0].id).layerId).toBe(sourceLayerId);
    expect(featureOf(features[2].id).layerId).toBe(sourceLayerId);
  });

  it('锁定目标、无有效项和原地移动均不提交历史', () => {
    const { targetLayerId, lockedLayerId, features } = prepareMultiLayerFixture();
    const store = useDocumentStore.getState();

    store.moveFeaturesToLayer([features[0].id], lockedLayerId);
    store.moveFeaturesToLayer(['missing'], targetLayerId);
    store.moveFeaturesToLayer([features[3].id], targetLayerId);

    expect(useDocumentStore.getState().past).toHaveLength(0);
  });

  it('锁定源图层后所有要素编辑入口均保持只读且不写历史', () => {
    const { sourceLayerId, features } = prepareMultiLayerFixture();
    const locked = useDocumentStore
      .getState()
      .document.layers.map((layer) =>
        layer.id === sourceLayerId ? { ...layer, locked: true } : layer,
      );
    useDocumentStore.setState({
      document: { ...useDocumentStore.getState().document, layers: locked },
    });
    const store = useDocumentStore.getState();
    store.updateFeature(features[0].id, { name: '不应写入' });
    store.removeFeatures([features[0].id]);
    store.insertVertexAt(features[0].id, 0, movedPoint);
    store.deleteVertexAt(features[0].id, 0);
    store.resetVertexBearing(features[0].id, 'all');
    store.beginGesture();
    store.previewFeatureGeometry(features[0].id, [movedPoint]);
    store.endGesture();

    expect(featureOf(features[0].id).name).not.toBe('不应写入');
    expect(featureOf(features[0].id)).toBeDefined();
    expect(useDocumentStore.getState().past).toHaveLength(0);
  });

  it('setLayerStatus 将缺省状态视为 working，仅在实际变化时提交历史', () => {
    const { document } = resetStore();
    const layerId = document.layers[0].id;
    const store = useDocumentStore.getState();

    useDocumentStore.setState({
      document: {
        ...document,
        layers: document.layers.map((layer) => {
          const { status: _status, ...layerWithoutStatus } = layer;
          return layerWithoutStatus;
        }),
      },
    });
    store.setLayerStatus(layerId, LayerStatus.Working);
    expect(useDocumentStore.getState().past).toHaveLength(0);
    store.setLayerStatus(layerId, LayerStatus.Approved);
    expect(useDocumentStore.getState().past).toHaveLength(1);
    expect(useDocumentStore.getState().document.layers[0].status).toBe(LayerStatus.Approved);
    store.setLayerStatus(layerId, LayerStatus.Approved);

    expect(useDocumentStore.getState().past).toHaveLength(1);
  });

  it('insertVertexAt 插入顶点并对齐方向数组，Point 和无效要素不提交历史', () => {
    const { line, point } = resetStore();
    useDocumentStore.setState({
      document: {
        ...useDocumentStore.getState().document,
        features: [{ ...line, vertexBearings: [45, 90] }, point],
      },
    });
    const store = useDocumentStore.getState();

    store.insertVertexAt(line.id, 1, thirdPoint);
    expect(useDocumentStore.getState().past).toHaveLength(1);
    expect(geometryOf(line.id)).toEqual({
      kind: 'line',
      points: [firstPoint, thirdPoint, secondPoint],
    });
    expect(featureOf(line.id).vertexBearings).toEqual([45, undefined, 90]);
    store.insertVertexAt(point.id, 0, movedPoint);
    store.insertVertexAt('missing', 0, movedPoint);

    expect(useDocumentStore.getState().past).toHaveLength(1);
  });

  it('deleteVertexAt 合法删除一次，删除到下限时拒绝', () => {
    const { document, line } = resetStore();
    const editable = {
      ...line,
      geometry: createLineGeometry([firstPoint, secondPoint, thirdPoint]),
      vertexBearings: [45, 90, 135],
    };
    useDocumentStore.setState({ document: { ...document, features: [editable] } });
    const store = useDocumentStore.getState();

    store.deleteVertexAt(line.id, 1);
    expect(useDocumentStore.getState().past).toHaveLength(1);
    expect(geometryOf(line.id)).toEqual({ kind: 'line', points: [firstPoint, thirdPoint] });
    expect(featureOf(line.id).vertexBearings).toEqual([45, 135]);
    store.deleteVertexAt(line.id, 0);

    expect(useDocumentStore.getState().past).toHaveLength(1);
  });

  it('resetVertexBearing 单点保留稀疏对齐，全部重置移除字段，无效不提交', () => {
    const { document, line } = resetStore();
    useDocumentStore.setState({
      document: {
        ...document,
        features: [{ ...line, vertexBearings: [45, 90] }],
      },
    });
    const store = useDocumentStore.getState();

    store.resetVertexBearing(line.id, 1);
    expect(useDocumentStore.getState().past).toHaveLength(1);
    expect(featureOf(line.id).vertexBearings).toEqual([45, undefined]);
    store.resetVertexBearing(line.id, 'all');
    expect(useDocumentStore.getState().past).toHaveLength(2);
    expect(featureOf(line.id).vertexBearings).toBeUndefined();
    store.resetVertexBearing(line.id, 0);

    expect(useDocumentStore.getState().past).toHaveLength(2);
  });

  it('面积顶点插入与删除使用面积最小点数', () => {
    const { document } = resetStore();
    const area = createFeature({
      layerId: document.layers[0].id,
      sidc: 'SFGPUCI----K---',
      geometry: createAreaGeometry([firstPoint, secondPoint, thirdPoint]),
    });
    useDocumentStore.setState({ document: { ...document, features: [area] } });
    const store = useDocumentStore.getState();

    store.deleteVertexAt(area.id, 0);
    expect(useDocumentStore.getState().past).toHaveLength(0);
    store.insertVertexAt(area.id, 1, movedPoint);
    expect(useDocumentStore.getState().past).toHaveLength(1);
  });

  it('批量移动会刷新实际移动要素的更新时间', () => {
    const { targetLayerId, features } = prepareMultiLayerFixture();
    const previous = features[0].updatedAt;

    useDocumentStore.getState().moveFeaturesToLayer([features[0].id], targetLayerId);

    expect(featureOf(features[0].id).updatedAt).toBeGreaterThanOrEqual(previous);
  });

  it('resetVertexBearing 对不存在要素和 Point 保持无历史', () => {
    const { point } = resetStore();
    const store = useDocumentStore.getState();

    store.resetVertexBearing('missing', 0);
    store.resetVertexBearing(point.id, 0);

    expect(useDocumentStore.getState().past).toHaveLength(0);
  });

  it('deleteVertexAt 非法索引不提交历史', () => {
    const { line } = resetStore();

    useDocumentStore.getState().deleteVertexAt(line.id, 9);

    expect(useDocumentStore.getState().past).toHaveLength(0);
  });
});
