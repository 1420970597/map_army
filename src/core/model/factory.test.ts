/**
 * 文档工厂单测。
 *
 * 验证新建对象的 schema 与图层默认值，以及复制要素不会共享可变嵌套数据。
 */

import { describe, expect, it } from 'vitest';

import { CURRENT_SCHEMA_VERSION } from './migrate';
import {
  cloneFeature,
  createAreaGeometry,
  createDocument,
  createFeature,
  createLayer,
  createLineGeometry,
  createPointGeometry,
} from './factory';
import { LayerKind, LayerStatus, SymbolKind, TacticalGraphicType } from './types';

describe('文档工厂', () => {
  it('新建文档从第一刻起使用当前 schema', () => {
    expect(createDocument().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('默认图层带工作状态和要素种类', () => {
    const layer = createDocument().layers[0];

    expect(layer.status).toBe(LayerStatus.Working);
    expect(layer.kind).toBe(LayerKind.Feature);
  });

  it('createLayer 保留显式的状态、种类和分组', () => {
    const layer = createLayer({
      name: '蓝方',
      status: LayerStatus.Approved,
      kind: LayerKind.Wargame,
      group: 'blue',
    });

    expect(layer).toMatchObject({
      status: LayerStatus.Approved,
      kind: LayerKind.Wargame,
      group: 'blue',
    });
  });

  it('复制点要素不会共享位置、文本和样式', () => {
    const document = createDocument();
    const source = createFeature({
      layerId: document.layers[0].id,
      sidc: '10031000001211000000',
      geometry: createPointGeometry(116.4, 39.9),
      textFields: { uniqueDesignation: 'A-01' },
      style: { color: '#ff0000' },
    });
    const copy = cloneFeature(source);

    if (copy.geometry.kind !== 'point' || source.geometry.kind !== 'point') {
      throw new Error('测试要素必须为点。');
    }
    copy.geometry.position.lon = 120;
    copy.textFields.uniqueDesignation = 'B-02';
    copy.style!.color = '#00ff00';

    expect(source.geometry.position.lon).toBe(116.4);
    expect(source.textFields.uniqueDesignation).toBe('A-01');
    expect(source.style!.color).toBe('#ff0000');
  });

  it('复制线要素不会共享顶点和顶点方向', () => {
    const document = createDocument();
    const source = createFeature({
      layerId: document.layers[0].id,
      sidc: '10061500001101000000',
      geometry: createLineGeometry([
        { lon: 1, lat: 2 },
        { lon: 3, lat: 4 },
      ]),
    });
    source.vertexBearings = [10, 20];
    const copy = cloneFeature(source);

    if (copy.geometry.kind === 'point' || source.geometry.kind === 'point') {
      throw new Error('测试要素必须为线。');
    }
    copy.geometry.points[0].lon = 99;
    copy.vertexBearings![0] = 270;

    expect(source.geometry.points[0].lon).toBe(1);
    expect(source.vertexBearings).toEqual([10, 20]);
  });

  it('复制面要素会深复制全部顶点', () => {
    const document = createDocument();
    const source = createFeature({
      layerId: document.layers[0].id,
      sidc: '10031000000000000000',
      geometry: createAreaGeometry([
        { lon: 1, lat: 1 },
        { lon: 2, lat: 1 },
        { lon: 1, lat: 2 },
      ]),
    });
    const copy = cloneFeature(source);

    if (copy.geometry.kind === 'point' || source.geometry.kind === 'point') {
      throw new Error('测试要素必须为面。');
    }
    copy.geometry.points[2].lat = 88;

    expect(source.geometry.points[2].lat).toBe(2);
  });

  it('复制战术图形字段并深拷贝参数', () => {
    const document = createDocument();
    const source = createFeature({
      layerId: document.layers[0].id,
      sidc: '10062500001101000000',
      geometry: createLineGeometry([
        { lon: 1, lat: 2 },
        { lon: 3, lat: 4 },
      ]),
      symbolKind: SymbolKind.MultiPoint,
      graphicType: TacticalGraphicType.AxisOfAdvance,
      graphicParams: { headRatio: 0.2, smooth: true },
    });
    const copy = cloneFeature(source);

    copy.graphicParams!.headRatio = 0.4;
    expect(copy.symbolKind).toBe(SymbolKind.MultiPoint);
    expect(copy.graphicType).toBe(TacticalGraphicType.AxisOfAdvance);
    expect(source.graphicParams).toEqual({ headRatio: 0.2, smooth: true });
  });

  it('覆盖字段仍生效且复制结果总是换用新标识', () => {
    const document = createDocument();
    const source = createFeature({
      layerId: document.layers[0].id,
      sidc: '10031000001211000000',
      name: '原要素',
      geometry: createPointGeometry(1, 2),
    });
    const copy = cloneFeature(source, { name: '副本' });

    expect(copy.name).toBe('副本');
    expect(copy.id).not.toBe(source.id);
    expect(copy.createdAt).toBeGreaterThanOrEqual(source.createdAt);
  });
});
