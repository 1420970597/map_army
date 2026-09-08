/**
 * 标图文档 schema 迁移链单测。
 *
 * 覆盖缺省版本、当前版本、未来版本、迁移结果不可变性及旧字段保留，
 * 确保历史文档可安全升级且未知未来数据不会被篡改。
 */

import { describe, expect, it } from 'vitest';

import { CURRENT_SCHEMA_VERSION, migrateDocument } from './migrate';
import { createDocument } from './factory';
import type { MapDocument } from './types';

/** 构造指定 schema 版本的最小有效文档。 */
function makeDocument(schemaVersion?: number): MapDocument {
  const document = createDocument('迁移测试');
  return schemaVersion === undefined ? document : { ...document, schemaVersion };
}

describe('migrateDocument', () => {
  it('将缺少 schemaVersion 的旧文档按 v1 迁移到当前版本', () => {
    const document = makeDocument();
    const result = migrateDocument(document);

    expect(result.document.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.warnings).toEqual([]);
  });

  it('当前版本文档返回当前版本', () => {
    const document = makeDocument(CURRENT_SCHEMA_VERSION);
    const result = migrateDocument(document);

    expect(result.document.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.warnings).toEqual([]);
  });

  it('未来版本保留数据和版本并返回可观察警告', () => {
    const futureVersion = CURRENT_SCHEMA_VERSION + 1;
    const document = makeDocument(futureVersion);
    const result = migrateDocument(document);

    expect(result.document.schemaVersion).toBe(futureVersion);
    expect(result.document).toEqual(document);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'future-schema-version',
        schemaVersion: futureVersion,
      }),
    ]);
  });

  it('迁移结果是与输入完全独立的副本', () => {
    const document = makeDocument();
    const result = migrateDocument(document);

    result.document.name = '已修改结果';
    result.document.layers[0].name = '已修改图层';

    expect(document.name).toBe('迁移测试');
    expect(document.layers[0].name).toBe('默认图层');
  });

  it('迁移旧文档时保留既有字段与嵌套数据', () => {
    const document = makeDocument();
    document.features.push({
      id: 'feature-1',
      layerId: document.layers[0].id,
      sidc: 'SFGPUCI----K---',
      name: '旧要素',
      geometry: { kind: 'point', position: { lon: 116.4, lat: 39.9 } },
      textFields: { uniqueDesignation: 'A-01' },
      createdAt: 1,
      updatedAt: 2,
    });

    const result = migrateDocument(document);

    expect(result.document.features).toEqual(document.features);
  });

  it('不修改输入文档的缺省版本字段', () => {
    const document = makeDocument();
    const result = migrateDocument(document);

    expect(document.schemaVersion).toBeUndefined();
    expect(result.document.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});
