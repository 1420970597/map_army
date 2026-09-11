import { beforeEach, describe, expect, it } from 'vitest';
import {
  createEquipment3D,
  EQUIPMENT_MODELS,
  equipment3DProblem,
  findEquipmentModel,
  mountAttachment,
  readEquipment3D,
} from './equipment3d';
import { cloneFeature, createDocument, createFeature, createPointGeometry } from './factory';
import { deserializeMilxly, serializeMilxly } from '../io/milxly';
import { documentToGeoJson, geoJsonToDocument } from '../io/geojson';
import { documentToMilxXml, milxExportWarnings, milxXmlToDocument } from '../io/milxNative';
import { exportMilxArchive, parseMapFile } from '../io/files';
import { createShareUrl, readShareUrl } from '../io/share';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useAccessStore } from '@/stores/useAccessStore';

const configured = () => mountAttachment(createEquipment3D(), 'left_wing', 'demo-tank');
const fixture = () => {
  const document = createDocument('三维装配');
  document.features.push(
    createFeature({
      layerId: document.layers[0].id,
      sidc: 'SFFPMF---------',
      geometry: createPointGeometry(7.45, 46.95),
      equipment3d: configured(),
    }),
  );
  return document;
};

describe('三维挂点装配', () => {
  it('提供页面内置模型目录并可创建不同模型的空装配', () => {
    expect(EQUIPMENT_MODELS.length).toBeGreaterThanOrEqual(2);
    const vehicle = findEquipmentModel('demo-vehicle', '1');
    expect(vehicle?.category).toBe('车辆');
    expect(createEquipment3D(vehicle)).toEqual({
      modelId: 'demo-vehicle',
      assetVersion: '1',
      attachments: [],
    });
    expect(equipment3DProblem(createEquipment3D(vehicle!))).toBeNull();
  });

  it('切换模型时不保留旧模型的挂载', () => {
    const mounted = configured();
    const vehicle = findEquipmentModel('demo-vehicle', '1')!;
    const switched = createEquipment3D(vehicle);
    expect(switched.attachments).toEqual([]);
    expect(equipment3DProblem({ ...switched, attachments: mounted.attachments })).toContain(
      '已保留',
    );
  });

  it('兼容安装、替换、拆卸且不修改源对象', () => {
    const initial = createEquipment3D();
    const tank = mountAttachment(initial, 'left_wing', 'demo-tank');
    const sensor = mountAttachment(tank, 'left_wing', 'demo-sensor');
    expect(initial.attachments).toEqual([]);
    expect(tank.attachments[0].attachmentId).toBe('demo-tank');
    expect(sensor.attachments).toEqual([
      { socketId: 'left_wing', attachmentId: 'demo-sensor', assetVersion: '1' },
    ]);
    expect(mountAttachment(sensor, 'left_wing', null).attachments).toEqual([]);
  });
  it('拒绝不兼容挂点、未知部件、未知资产版本和重复操作', () => {
    const value = configured();
    expect(mountAttachment(value, 'center', 'demo-tank')).toBe(value);
    expect(mountAttachment(value, 'missing', 'demo-sensor')).toBe(value);
    expect(mountAttachment(value, 'left_wing', 'missing')).toBe(value);
    expect(mountAttachment(value, 'left_wing', 'demo-tank')).toBe(value);
    expect(mountAttachment(value, 'center', null)).toBe(value);
    const future = { ...value, assetVersion: '2' };
    expect(mountAttachment(future, 'center', 'demo-sensor')).toBe(future);
    expect(equipment3DProblem(future)).toContain('已保留');
  });
  it('导入保留未知版本引用并拒绝重复插槽和畸形数据', () => {
    const value = { ...configured(), modelId: 'future-aircraft', assetVersion: '2' };
    expect(readEquipment3D(value)).toEqual(value);
    expect(
      readEquipment3D({ ...value, attachments: [...value.attachments, ...value.attachments] }),
    ).toBeUndefined();
    expect(readEquipment3D({ ...value, attachments: [null] })).toBeUndefined();
    expect(readEquipment3D(null)).toBeUndefined();
  });
});

describe('装配的保存与交换', () => {
  it('项目 JSON、GeoJSON、XML 扩展、ZIP、分享快照均保留装配', () => {
    const document = fixture();
    const copies = [
      deserializeMilxly(serializeMilxly(document)).document,
      geoJsonToDocument(documentToGeoJson(document), '三维装配', document.layers[0].id).document,
      milxXmlToDocument(documentToMilxXml(document), 'test').document,
      parseMapFile(exportMilxArchive(document), 'test.milxlyz').document,
      readShareUrl(new URL(createShareUrl(document, 'view', 'http://localhost/')).hash)?.document,
    ];
    for (const copy of copies)
      expect(copy?.features[0].equipment3d).toEqual(document.features[0].equipment3d);
    expect(milxExportWarnings(document).join('')).toContain('私有扩展');
  });
  it('旧文档可读取，复制后不会共享嵌套挂载数据', () => {
    const source = fixture().features[0];
    const clone = cloneFeature(source);
    clone.equipment3d!.attachments[0].attachmentId = 'demo-sensor';
    expect(source.equipment3d?.attachments[0].attachmentId).toBe('demo-tank');
    const document = fixture();
    document.features[0].equipment3d = undefined;
    expect(
      deserializeMilxly(serializeMilxly(document)).document.features[0].equipment3d,
    ).toBeUndefined();
  });
});

describe('装配文档提交', () => {
  beforeEach(() => {
    useAccessStore.setState({ readOnly: false });
    useDocumentStore.setState({ document: fixture(), past: [], future: [], selectedIds: [] });
  });
  it('一次挂载形成一次撤销；重复提交不增加历史', () => {
    const state = useDocumentStore.getState();
    const feature = state.document.features[0];
    const next = mountAttachment(feature.equipment3d!, 'center', 'demo-sensor');
    state.updateFeature(feature.id, { equipment3d: next });
    state.updateFeature(feature.id, { equipment3d: structuredClone(next) });
    expect(useDocumentStore.getState().past).toHaveLength(1);
    state.undo();
    expect(useDocumentStore.getState().document.features[0].equipment3d).toEqual(
      feature.equipment3d,
    );
    state.redo();
    expect(useDocumentStore.getState().document.features[0].equipment3d).toEqual(next);
  });
  it.each(['locked', 'readonly', 'invalid'] as const)('%s 拒绝提交且不污染历史', (mode) => {
    const state = useDocumentStore.getState();
    const feature = state.document.features[0];
    if (mode === 'locked') state.document.layers[0].locked = true;
    if (mode === 'readonly') useAccessStore.setState({ readOnly: true });
    state.updateFeature(feature.id, {
      equipment3d:
        mode === 'invalid' ? { ...configured(), modelId: 'missing' } : createEquipment3D(),
    });
    expect(useDocumentStore.getState().document).toBe(state.document);
    expect(useDocumentStore.getState().past).toHaveLength(0);
  });
});
