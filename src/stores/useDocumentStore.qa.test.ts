/**
 * QA 独立验证：批次 1 文档 store 的高风险不变量。
 *
 * 与工程师自验用例的区别在于：
 * 1. 撤销粒度用「完全相等」而非「长度」断言，确保一次手势后历史里只有一条且能被一次 undo 精确还原；
 * 2. 批量操作按需求文档的真实规模（5 个要素）验证，而非退化后的 2 个；
 * 3. 针对 `vertexBearings` 平行数组的保持语义补充显式断言。
 *
 * 标记为 `it.fails` 的用例代表**已确认的源码缺陷**：
 * 修复后该用例会转为失败（vitest 会提示 "Expected test to fail"），
 * 届时请将 `it.fails` 改回 `it` 并把断言固化为回归防线。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  createAreaGeometry,
  createDocument,
  createFeature,
  createLayer,
  createLineGeometry,
  createPointGeometry,
} from '@/core/model';
import type { MapDocument, MapFeature } from '@/core/model';

import { selectPrimaryFeature, selectSelectedFeatures, useDocumentStore } from './useDocumentStore';

const firstPoint = { lon: 100, lat: 30 };
const secondPoint = { lon: 101, lat: 31 };
const thirdPoint = { lon: 102, lat: 32 };
const movedPoint = { lon: 103, lat: 33 };

/** 安装一份只含一条线要素的文档，并清空历史与手势。 */
function installLineDocument(): { document: MapDocument; line: MapFeature } {
  useDocumentStore.getState().endGesture();
  const document = createDocument('QA 撤销粒度');
  const layerId = document.layers[0].id;
  const line = createFeature({
    layerId,
    sidc: 'SFGPUCI----K---',
    geometry: createLineGeometry([firstPoint, secondPoint, thirdPoint]),
  });

  const next: MapDocument = { ...document, features: [line] };
  useDocumentStore.setState({
    document: next,
    activeLayerId: layerId,
    selectedIds: [],
    past: [],
    future: [],
  });
  return { document: next, line };
}

/** 安装 source / target / locked 三个图层与若干点要素。 */
function installLayerFixture(count: number): {
  sourceLayerId: string;
  targetLayerId: string;
  lockedLayerId: string;
  features: MapFeature[];
} {
  const document = createDocument('QA 批量操作');
  const sourceLayerId = document.layers[0].id;
  const targetLayer = createLayer({ name: '目标图层', order: 1 });
  const lockedLayer = { ...createLayer({ name: '锁定图层', order: 2 }), locked: true };
  const features = Array.from({ length: count }, (_unused, index) =>
    createFeature({
      layerId: sourceLayerId,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(index, index),
    }),
  );

  useDocumentStore.setState({
    document: {
      ...document,
      layers: [document.layers[0], targetLayer, lockedLayer],
      features,
    },
    activeLayerId: sourceLayerId,
    selectedIds: [],
    past: [],
    future: [],
  });

  return { sourceLayerId, targetLayerId: targetLayer.id, lockedLayerId: lockedLayer.id, features };
}

function featureOf(id: string): MapFeature {
  const feature = useDocumentStore.getState().document.features.find((item) => item.id === id);
  if (!feature) throw new Error(`找不到要素 ${id}`);
  return feature;
}

describe('QA 撤销粒度', () => {
  beforeEach(() => {
    installLineDocument();
  });

  it('一次顶点拖拽（12 帧预览）只产生一条历史，且一次 undo 精确还原起始文档', () => {
    const { document, line } = installLineDocument();
    const store = useDocumentStore.getState();

    store.beginGesture();
    // 模拟手柄拖拽过程中的 12 次 mousemove 预览，落点逐帧逼近终点。
    for (let frame = 1; frame <= 12; frame += 1) {
      const ratio = frame / 12;
      store.previewFeatureGeometry(line.id, [
        firstPoint,
        {
          lon: secondPoint.lon + (movedPoint.lon - secondPoint.lon) * ratio,
          lat: secondPoint.lat + (movedPoint.lat - secondPoint.lat) * ratio,
        },
        thirdPoint,
      ]);
    }
    store.endGesture();

    expect(useDocumentStore.getState().past).toHaveLength(1);
    expect(useDocumentStore.getState().future).toHaveLength(0);

    useDocumentStore.getState().undo();
    // 关键：不只是长度相等，而是整份文档（要素与几何）回到手势开始前。
    expect(useDocumentStore.getState().document.features).toEqual(document.features);
    expect(useDocumentStore.getState().past).toHaveLength(0);
    expect(useDocumentStore.getState().future).toHaveLength(1);
  });

  it('无变化手势提交 0 条历史，且不清空已有 future', () => {
    const { document, line } = installLineDocument();
    const store = useDocumentStore.getState();
    store.updateLayer(document.layers[0].id, { opacity: 0.6 });
    store.undo();
    expect(useDocumentStore.getState().future).toHaveLength(1);

    store.beginGesture();
    store.previewFeatureGeometry(line.id, [firstPoint, secondPoint, thirdPoint]);
    store.endGesture();

    expect(useDocumentStore.getState().past).toHaveLength(0);
    expect(useDocumentStore.getState().future).toHaveLength(1);
  });

  it('不透明度滑块一次拖动只产生一条历史', () => {
    const { document } = installLineDocument();
    const layerId = document.layers[0].id;
    const store = useDocumentStore.getState();

    store.beginGesture();
    for (const opacity of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
      store.previewLayer(layerId, { opacity });
    }
    store.endGesture();

    expect(useDocumentStore.getState().past).toHaveLength(1);
    expect(useDocumentStore.getState().document.layers[0].opacity).toBe(0.4);

    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().document.layers[0].opacity).toBe(1);
  });

  it('一次手势内预览多个要素仍只提交一条历史', () => {
    const { document, line } = installLineDocument();
    const layerId = document.layers[0].id;
    const other = createFeature({
      layerId,
      sidc: 'SFGPUCI----K---',
      geometry: createLineGeometry([firstPoint, secondPoint]),
    });
    useDocumentStore.setState({
      document: { ...useDocumentStore.getState().document, features: [line, other] },
    });
    const store = useDocumentStore.getState();

    store.beginGesture();
    store.previewFeatureGeometry(line.id, [firstPoint, movedPoint, thirdPoint]);
    store.previewFeatureGeometry(other.id, [firstPoint, movedPoint]);
    store.previewLayer(layerId, { opacity: 0.5 });
    store.endGesture();

    expect(useDocumentStore.getState().past).toHaveLength(1);
    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().document.layers[0].opacity).toBe(1);
    expect(featureOf(other.id).geometry).toEqual({
      kind: 'line',
      points: [firstPoint, secondPoint],
    });
  });

  it('未开启手势时 endGesture 安全无操作', () => {
    const store = useDocumentStore.getState();

    store.endGesture();

    expect(useDocumentStore.getState().past).toHaveLength(0);
    expect(useDocumentStore.getState().future).toHaveLength(0);
  });

  it('撤销栈长度不超过上限，且超限时丢弃最旧快照', () => {
    const { document } = installLineDocument();
    const layerId = document.layers[0].id;
    const store = useDocumentStore.getState();

    for (let index = 0; index < 105; index += 1) {
      store.updateLayer(layerId, { name: `图层-${index}` });
    }

    const past = useDocumentStore.getState().past;
    expect(past).toHaveLength(100);
    // 第 5 次改名（下标 4）留下的快照是最早还保留在栈里的那一份。
    expect(past[0].layers[0].name).toBe('图层-4');
    expect(useDocumentStore.getState().document.layers[0].name).toBe('图层-104');
  });

  it('undo 与 redo 都会清空当前选择', () => {
    const { line } = installLineDocument();
    const store = useDocumentStore.getState();
    store.select([line.id]);
    store.updateLayer(useDocumentStore.getState().document.layers[0].id, { opacity: 0.4 });

    store.undo();
    expect(useDocumentStore.getState().selectedIds).toEqual([]);
    store.redo();
    expect(useDocumentStore.getState().selectedIds).toEqual([]);
  });
});

describe('QA 批量操作的历史粒度', () => {
  it('批量移动 5 个要素只提交一条历史，并按请求顺序设置选择', () => {
    const { sourceLayerId, targetLayerId, features } = installLayerFixture(5);
    const requested = features.map((feature) => feature.id);

    useDocumentStore.getState().moveFeaturesToLayer(requested, targetLayerId);

    expect(useDocumentStore.getState().past).toHaveLength(1);
    expect(useDocumentStore.getState().selectedIds).toEqual(requested);
    for (const id of requested) expect(featureOf(id).layerId).toBe(targetLayerId);

    useDocumentStore.getState().undo();
    for (const id of requested) expect(featureOf(id).layerId).toBe(sourceLayerId);
  });

  it('批量移动重复标识与缺失标识只提交一条历史', () => {
    const { targetLayerId, features } = installLayerFixture(3);
    const store = useDocumentStore.getState();

    store.moveFeaturesToLayer(
      [features[0].id, features[0].id, 'missing', features[1].id],
      targetLayerId,
    );

    expect(useDocumentStore.getState().past).toHaveLength(1);
    expect(useDocumentStore.getState().selectedIds).toEqual([features[0].id, features[1].id]);
  });

  it('粘贴 3 个要素只提交一条历史，且一次 undo 全部撤销', () => {
    const document = createDocument('QA 粘贴');
    const layerId = document.layers[0].id;
    useDocumentStore.getState().endGesture();
    useDocumentStore.setState({
      document,
      activeLayerId: layerId,
      selectedIds: [],
      past: [],
      future: [],
    });
    const pasted = [1, 2, 3].map((index) =>
      createFeature({
        layerId,
        sidc: 'SFGPUCI----K---',
        geometry: createPointGeometry(index, index),
      }),
    );

    useDocumentStore.getState().addFeatures(pasted);

    expect(useDocumentStore.getState().past).toHaveLength(1);
    expect(useDocumentStore.getState().document.features).toHaveLength(3);
    expect(useDocumentStore.getState().selectedIds).toEqual(pasted.map((item) => item.id));

    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().document.features).toEqual([]);
  });

  it('连续三次粘贴各产生一条历史', () => {
    const { sourceLayerId } = installLayerFixture(0);
    const store = useDocumentStore.getState();

    for (let batch = 0; batch < 3; batch += 1) {
      store.addFeatures([
        createFeature({
          layerId: sourceLayerId,
          sidc: 'SFGPUCI----K---',
          geometry: createPointGeometry(batch, batch),
        }),
        createFeature({
          layerId: sourceLayerId,
          sidc: 'SFGPUCI----K---',
          geometry: createPointGeometry(batch + 10, batch + 10),
        }),
      ]);
    }

    expect(useDocumentStore.getState().past).toHaveLength(3);
    expect(useDocumentStore.getState().document.features).toHaveLength(6);
  });

  it('锁定图层与隐藏图层上的要素不可通过批量移动落入锁定图层', () => {
    const { lockedLayerId, features } = installLayerFixture(2);

    useDocumentStore.getState().moveFeaturesToLayer([features[0].id], lockedLayerId);

    expect(useDocumentStore.getState().past).toHaveLength(0);
    expect(featureOf(features[0].id).layerId).not.toBe(lockedLayerId);
  });
});

describe('QA vertexBearings 平行数组保持', () => {
  /** 安装带手动顶点方向的线要素。 */
  function installLineWithBearings(): MapFeature {
    const { document, line } = installLineDocument();
    useDocumentStore.setState({
      document: {
        ...document,
        features: [{ ...line, vertexBearings: [45, 90, 135] }],
      },
    });
    return line;
  }

  // 回归 BUG-01：预览未显式给出方向数组时必须视为「不改动方向」。
  // 旧实现把它当成「清空整个方向字段」，拖拽任一顶点会抹掉全部手动方向。
  it('顶点拖拽未指定方向时应保留既有手动方向', () => {
    const line = installLineWithBearings();

    useDocumentStore.getState().applyGeometry(line.id, [firstPoint, movedPoint, thirdPoint]);

    expect(featureOf(line.id).vertexBearings).toEqual([45, 90, 135]);
  });

  it('显式传入方向数组时按传入值整体覆盖', () => {
    const line = installLineWithBearings();

    useDocumentStore
      .getState()
      .applyGeometry(line.id, [firstPoint, movedPoint, thirdPoint], [10, 20, 30]);

    expect(featureOf(line.id).vertexBearings).toEqual([10, 20, 30]);
  });

  it('插入顶点时方向数组与顶点数组保持等长且对齐', () => {
    const line = installLineWithBearings();

    useDocumentStore.getState().insertVertexAt(line.id, 1, movedPoint);

    const feature = featureOf(line.id);
    if (feature.geometry.kind === 'point') throw new Error('测试要素必须是线');
    expect(feature.geometry.points).toHaveLength(4);
    expect(feature.vertexBearings).toHaveLength(4);
    expect(feature.vertexBearings?.[1]).toBeUndefined();
    expect(feature.vertexBearings?.[2]).toBe(90);
  });

  it('删除顶点后方向数组同步收缩且不产生长度错位', () => {
    const line = installLineWithBearings();

    useDocumentStore.getState().deleteVertexAt(line.id, 1);

    const feature = featureOf(line.id);
    if (feature.geometry.kind === 'point') throw new Error('测试要素必须是线');
    expect(feature.geometry.points).toHaveLength(2);
    expect(feature.vertexBearings).toEqual([45, 135]);
  });

  it('面积要素顶点数低于 3 时拒绝删除', () => {
    const document = createDocument('QA 面积下限');
    const area = createFeature({
      layerId: document.layers[0].id,
      sidc: 'SFGPUCI----K---',
      geometry: createAreaGeometry([firstPoint, secondPoint, thirdPoint]),
    });
    useDocumentStore.setState({
      document: { ...document, features: [area] },
      activeLayerId: document.layers[0].id,
      selectedIds: [],
      past: [],
      future: [],
    });

    useDocumentStore.getState().deleteVertexAt(area.id, 0);
    expect(useDocumentStore.getState().past).toHaveLength(0);
    useDocumentStore.getState().deleteVertexAt(area.id, 1);
    expect(useDocumentStore.getState().past).toHaveLength(0);

    useDocumentStore.getState().insertVertexAt(area.id, 0, movedPoint);
    expect(useDocumentStore.getState().past).toHaveLength(1);
  });
});

describe('QA 多选语义', () => {
  /** 安装三个要素并给出指定选择队列。 */
  function installSelection(selectedIds: string[]): {
    first: MapFeature;
    second: MapFeature;
    third: MapFeature;
  } {
    const { document } = installLineDocument();
    const layerId = document.layers[0].id;
    const first = createFeature({
      layerId,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(0, 0),
    });
    const second = createFeature({
      layerId,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(1, 1),
    });
    const third = createFeature({
      layerId,
      sidc: 'SFGPUCI----K---',
      geometry: createPointGeometry(2, 2),
    });
    useDocumentStore.setState({
      document: { ...document, features: [first, second, third] },
      selectedIds,
    });
    return { first, second, third };
  }

  function selectionState(): Parameters<typeof selectPrimaryFeature>[0] {
    const { document, selectedIds } = useDocumentStore.getState();
    return { document, selectedIds };
  }

  it('主选恒为选择队列末位', () => {
    const { first, second, third } = installSelection([]);
    useDocumentStore.getState().select([first.id]);
    expect(selectPrimaryFeature(selectionState())).toEqual(first);
    useDocumentStore.getState().addToSelection([second.id, third.id]);
    expect(selectPrimaryFeature(selectionState())).toEqual(third);
  });

  it('Ctrl 反复点击同一要素后主选仍为末位存在的要素', () => {
    const { first, second } = installSelection([]);
    const store = useDocumentStore.getState();

    store.toggleSelect(first.id);
    store.toggleSelect(second.id);
    store.toggleSelect(first.id);
    store.toggleSelect(first.id);

    expect(useDocumentStore.getState().selectedIds).toEqual([second.id, first.id]);
    expect(selectPrimaryFeature(selectionState())).toEqual(first);
  });

  it('已选要素按选择队列顺序返回并过滤重复与缺失项', () => {
    const { first, second } = installSelection([]);
    useDocumentStore.getState().select([first.id, second.id, first.id, 'missing']);

    expect(selectSelectedFeatures(selectionState())).toEqual([first, second]);
  });

  it('重复追加不改变既有顺序', () => {
    const { first, second, third } = installSelection([]);
    useDocumentStore.getState().select([first.id, second.id]);

    useDocumentStore.getState().addToSelection([third.id, first.id, second.id]);

    expect(useDocumentStore.getState().selectedIds).toEqual([first.id, second.id, third.id]);
  });

  it('选择操作不进入撤销栈', () => {
    const { first, second } = installSelection([]);
    const store = useDocumentStore.getState();

    store.select([first.id, second.id]);
    store.toggleSelect(first.id);
    store.addToSelection([first.id]);
    store.removeFromSelection([second.id]);
    store.clearSelection();

    expect(useDocumentStore.getState().past).toHaveLength(0);
    expect(useDocumentStore.getState().future).toHaveLength(0);
  });

  // BUG-02（低）：`selectPrimaryFeature` 只检查队列末位，末位要素缺失时直接返回 null，
  // 与 `selectSelectedFeatures`「过滤缺失项」的语义不一致，也与自己的 JSDoc（末位仍存在）不符。
  it.fails('末位标识缺失时主选应回退到队列中最后一个仍存在的要素', () => {
    const { first, second } = installSelection([]);
    useDocumentStore.getState().select([first.id, second.id, 'missing']);

    expect(selectPrimaryFeature(selectionState())).toEqual(second);
  });
});

describe('QA 隐藏与锁定图层的边界', () => {
  /** 安装一个隐藏图层与一个锁定图层，各含一个落在框选范围内的点要素。 */
  function installLayerVisibilityFixture(): {
    visible: MapFeature;
    hidden: MapFeature;
    locked: MapFeature;
  } {
    const document = createDocument('QA 图层可见性');
    const base = document.layers[0];
    const hiddenLayer = { ...createLayer({ name: '隐藏图层', order: 1 }), visible: false };
    const lockedLayer = { ...createLayer({ name: '锁定图层', order: 2 }), locked: true };
    const make = (layerId: string, lon: number) =>
      createFeature({
        layerId,
        sidc: 'SFGPUCI----K---',
        geometry: createPointGeometry(lon, 10),
      });
    const visible = make(base.id, 1);
    const hidden = make(hiddenLayer.id, 2);
    const locked = make(lockedLayer.id, 3);

    useDocumentStore.setState({
      document: {
        ...document,
        layers: [base, hiddenLayer, lockedLayer],
        features: [visible, hidden, locked],
      },
      activeLayerId: base.id,
      selectedIds: [],
      past: [],
      future: [],
    });
    return { visible, hidden, locked };
  }

  const coveringBounds = { minLon: -10, minLat: -10, maxLon: 10, maxLat: 20 };

  // BUG-03：`selectInBounds` 直接使用全部文档要素做命中判定，
  // 未过滤隐藏图层——用户看不见的要素会被框选选中，后续删除/移动会静默作用于它们。
  it.fails('框选不应命中隐藏图层上的要素', () => {
    const { visible, hidden } = installLayerVisibilityFixture();

    useDocumentStore.getState().selectInBounds(coveringBounds, 'intersect');

    const selectedIds = useDocumentStore.getState().selectedIds;
    expect(selectedIds).toContain(visible.id);
    expect(selectedIds).not.toContain(hidden.id);
  });

  it('框选当前会命中锁定图层上的要素（锁定只限制编辑，不限制选择）', () => {
    const { locked } = installLayerVisibilityFixture();

    useDocumentStore.getState().selectInBounds(coveringBounds, 'intersect');

    // 该用例记录当前实现：锁定图层要素可被选中。
    // 若产品后续确认"锁定即不可选中"，请把断言改为 not.toContain。
    expect(useDocumentStore.getState().selectedIds).toContain(locked.id);
  });

  it('锁定图层上的要素无法作为批量移动的目标', () => {
    const { visible, locked } = installLayerVisibilityFixture();

    useDocumentStore.getState().moveFeaturesToLayer([visible.id], locked.layerId);

    expect(useDocumentStore.getState().past).toHaveLength(0);
    expect(featureOf(visible.id).layerId).not.toBe(locked.layerId);
  });

  it('删除操作当前不区分图层锁定状态（需求待确认，见报告 OBS-2）', () => {
    const { locked } = installLayerVisibilityFixture();

    useDocumentStore.getState().removeFeatures([locked.id]);

    // 该用例记录当前实现：锁定图层上的要素仍可被删除。
    // 若产品确认"锁定图层不可删除"，请把断言改为断言要素仍存在且不产生历史。
    expect(useDocumentStore.getState().document.features).toHaveLength(2);
    expect(useDocumentStore.getState().past).toHaveLength(1);
  });

  // 回归 BUG-04：`removeFeatures` 曾无条件提交历史，即使一个要素都没删掉。
  // 这会让撤销栈里出现"按一次 Ctrl+Z 什么都没发生"的空记录，
  // 与批次 1「无变化手势不产生历史」的既定语义不一致。
  it('删除不存在的标识不应产生历史', () => {
    installLayerVisibilityFixture();

    useDocumentStore.getState().removeFeatures(['missing']);

    expect(useDocumentStore.getState().document.features).toHaveLength(3);
    expect(useDocumentStore.getState().past).toHaveLength(0);
  });

  it('删除部分存在的标识只提交一条历史', () => {
    const { visible } = installLayerVisibilityFixture();

    useDocumentStore.getState().removeFeatures([visible.id, 'missing']);

    expect(useDocumentStore.getState().document.features).toHaveLength(2);
    expect(useDocumentStore.getState().past).toHaveLength(1);
  });
});
