import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDocument, createFeature, createPointGeometry, createLayer } from '@/core/model';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useAccessStore } from '@/stores/useAccessStore';
import { afsimFilesToDocument } from '@/core/io/afsim';

import { applyImportedDocument } from './importDocument';

describe('导入到指定图层', () => {
  beforeEach(() => {
    useAccessStore.getState().setReadOnly(false);
    const document = createDocument('目标文档');
    useDocumentStore.setState({
      document,
      activeLayerId: document.layers[0].id,
      selectedIds: [],
      past: [],
      future: [],
    });
  });
  afterEach(() => useAccessStore.getState().setReadOnly(false));

  it('把导入要素合并到指定图层且不新增图层', () => {
    const target = useDocumentStore.getState().document.layers[0];
    const imported = createDocument('导入文件');
    imported.features = [
      createFeature({
        layerId: imported.layers[0].id,
        sidc: 'SFGPUCI----K---',
        geometry: createPointGeometry(7, 46),
      }),
    ];

    applyImportedDocument(imported, 'target', target.id);

    const state = useDocumentStore.getState();
    expect(state.document.layers).toHaveLength(1);
    expect(state.document.features).toHaveLength(1);
    expect(state.document.features[0].layerId).toBe(target.id);
    expect(state.past).toHaveLength(1);
  });

  it('拒绝导入到锁定图层', () => {
    const document = useDocumentStore.getState().document;
    const locked = { ...createLayer({ name: '锁定目标', order: 1 }), locked: true };
    useDocumentStore.setState({ document: { ...document, layers: [...document.layers, locked] } });

    expect(() => applyImportedDocument(createDocument('导入文件'), 'target', locked.id)).toThrow(
      '目标图层不可编辑',
    );
    expect(useDocumentStore.getState().past).toHaveLength(0);
  });

  it('AFSIM 结果可整批追加和撤销，解析后切换只读仍拒绝写入', async () => {
    const text =
      'platform a WSF_PLATFORM side red position 12N 34E end_platform platform b WSF_PLATFORM side blue position 13N 35E end_platform';
    const result = await afsimFilesToDocument(
      [{ path: 'main.txt', size: text.length, readText: async () => text }],
      'main.txt',
    );
    applyImportedDocument(result.document);
    expect(useDocumentStore.getState().document.layers).toHaveLength(3);
    expect(useDocumentStore.getState().document.features).toHaveLength(2);
    expect(useDocumentStore.getState().past).toHaveLength(1);
    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().document.features).toHaveLength(0);
    useAccessStore.getState().setReadOnly(true);
    expect(() => applyImportedDocument(result.document)).toThrow('只读');
    expect(useDocumentStore.getState().document.features).toHaveLength(0);
  });
});
