import { beforeEach, describe, expect, it } from 'vitest';

import { createDocument, createFeature, createPointGeometry, createLayer } from '@/core/model';
import { useDocumentStore } from '@/stores/useDocumentStore';

import { applyImportedDocument } from './importDocument';

describe('导入到指定图层', () => {
  beforeEach(() => {
    const document = createDocument('目标文档');
    useDocumentStore.setState({
      document,
      activeLayerId: document.layers[0].id,
      selectedIds: [],
      past: [],
      future: [],
    });
  });

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
});
