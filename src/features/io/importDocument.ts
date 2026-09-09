/** 将导入结果追加或合并到当前文档，整批操作只生成一次撤销历史。 */
import { createId, type MapDocument } from '@/core/model';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useAccessStore } from '@/stores/useAccessStore';

export function applyImportedDocument(
  imported: MapDocument,
  mode: 'append' | 'replace' | 'active' | 'target' = 'append',
  targetLayerId?: string,
): void {
  if (useAccessStore.getState().readOnly) throw new Error('当前为只读分享，请先打开编辑副本');
  const state = useDocumentStore.getState();
  if (mode === 'replace') {
    state.replaceDocument(imported);
    return;
  }
  const destinationId = mode === 'target' ? targetLayerId : state.activeLayerId;
  const active = state.document.layers.find((l) => l.id === destinationId);
  if ((mode === 'active' || mode === 'target') && (!active || active.locked))
    throw new Error('目标图层不可编辑');
  const ids = new Map(
    imported.layers.map((l) => [
      l.id,
      mode === 'active' || mode === 'target' ? destinationId! : createId('lyr'),
    ]),
  );
  state.replaceDocument({
    ...state.document,
    layers:
      mode === 'active' || mode === 'target'
        ? state.document.layers
        : [
            ...state.document.layers,
            ...imported.layers.map((l, i) => ({
              ...l,
              id: ids.get(l.id)!,
              order: state.document.layers.length + i,
            })),
          ],
    features: [
      ...state.document.features,
      ...imported.features.map((f) => ({
        ...f,
        id: createId('ft'),
        layerId: ids.get(f.layerId) ?? destinationId ?? state.activeLayerId,
      })),
    ],
  });
  if (mode === 'append' && imported.layers[0])
    state.setActiveLayer(ids.get(imported.layers[0].id)!);
}
