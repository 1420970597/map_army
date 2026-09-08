/**
 * 本地会话持久化单测。
 *
 * 使用局部 fake Storage 验证正常保存、兼容读取、迁移、损坏备份和错误分类，
 * 不依赖或污染测试环境的全局 localStorage。
 */

import { describe, expect, it } from 'vitest';

import { createDocument } from '../model/factory';
import { CURRENT_SCHEMA_VERSION } from '../model/migrate';
import { serializeMilxly } from './milxly';
import {
  CORRUPT_BACKUP_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  loadDocument,
  loadDocumentResult,
  saveDocument,
  trySaveDocument,
  type StorageLike,
} from './persistence';
import { STORAGE_KEY } from './session';

class FakeStorage implements StorageLike {
  readonly values = new Map<string, string>();
  writeError: unknown = null;
  readError: unknown = null;

  getItem(key: string): string | null {
    if (this.readError) throw this.readError;
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.writeError) throw this.writeError;
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    if (this.writeError) throw this.writeError;
    this.values.delete(key);
  }
}

function oldDocumentText(): string {
  const document = createDocument('旧会话');
  const { schemaVersion: _schemaVersion, ...legacy } = document;
  return serializeMilxly(legacy);
}

describe('会话持久化', () => {
  it('保存成功返回可观察的体积与配额预警结果', () => {
    const storage = new FakeStorage();
    const result = trySaveDocument(createDocument('保存成功'), storage);

    expect(result.status).toBe('saved');
    expect(result).toMatchObject({ ok: true, nearQuota: false });
    if (result.status === 'saved') expect(result.bytes).toBeGreaterThan(0);
    expect(storage.values.get(STORAGE_KEY)).toContain('保存成功');
  });

  it('立即保存保持兼容且返回实际结果', () => {
    const storage = new FakeStorage();
    const result = saveDocument(createDocument(), true, storage);

    expect(result.status).toBe('saved');
  });

  it('延迟保存返回已计划结果而不需要调用方捕获异常', () => {
    const storage = new FakeStorage();
    const result = saveDocument(createDocument(), false, storage);

    expect(result).toEqual({ status: 'scheduled', ok: true });
  });

  it('配额异常被归类为 quota 而非抛出', () => {
    const storage = new FakeStorage();
    storage.writeError = Object.assign(new Error('满了'), { name: 'QuotaExceededError' });

    const result = trySaveDocument(createDocument(), storage);

    expect(result).toMatchObject({ status: 'error', ok: false, error: { kind: 'quota' } });
  });

  it('不可用存储被归类为 unavailable', () => {
    const storage = new FakeStorage();
    storage.readError = Object.assign(new Error('denied'), { name: 'SecurityError' });

    const result = loadDocumentResult(storage);

    expect(result).toMatchObject({ status: 'error', error: { kind: 'unavailable' } });
  });

  it('空存储返回 empty', () => {
    expect(loadDocumentResult(new FakeStorage())).toEqual({ status: 'empty', document: null });
  });

  it('主键读取结果经过迁移链升级旧文档', () => {
    const storage = new FakeStorage();
    storage.values.set(STORAGE_KEY, oldDocumentText());

    const result = loadDocumentResult(storage);

    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.source).toBe('primary');
      expect(result.document.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    }
  });

  it('主键不存在时回退读取旧版会话键', () => {
    const storage = new FakeStorage();
    storage.values.set(LEGACY_STORAGE_KEY, serializeMilxly(createDocument('旧键')));

    const result = loadDocumentResult(storage);

    expect(result).toMatchObject({ status: 'loaded', source: 'legacy' });
    if (result.status === 'loaded') expect(result.document.name).toBe('旧键');
  });

  it('优先读取新主键而非旧键', () => {
    const storage = new FakeStorage();
    storage.values.set(STORAGE_KEY, serializeMilxly(createDocument('主键')));
    storage.values.set(LEGACY_STORAGE_KEY, serializeMilxly(createDocument('旧键')));

    const result = loadDocumentResult(storage);

    expect(result).toMatchObject({ status: 'loaded', source: 'primary' });
    if (result.status === 'loaded') expect(result.document.name).toBe('主键');
  });

  it('损坏主会话会备份原文、清理主键并返回 corrupt', () => {
    const storage = new FakeStorage();
    storage.values.set(STORAGE_KEY, '{坏掉的 JSON');

    const result = loadDocumentResult(storage);

    expect(result).toMatchObject({
      status: 'corrupt',
      error: { kind: 'corrupt' },
      backupSaved: true,
    });
    expect(storage.values.get(CORRUPT_BACKUP_STORAGE_KEY)).toBe('{坏掉的 JSON');
    expect(storage.values.has(STORAGE_KEY)).toBe(false);
  });

  it('损坏旧会话同样备份并清理旧键', () => {
    const storage = new FakeStorage();
    storage.values.set(LEGACY_STORAGE_KEY, '{坏掉的旧 JSON');

    const result = loadDocumentResult(storage);

    expect(result.status).toBe('corrupt');
    expect(storage.values.get(CORRUPT_BACKUP_STORAGE_KEY)).toBe('{坏掉的旧 JSON');
    expect(storage.values.has(LEGACY_STORAGE_KEY)).toBe(false);
  });

  it('旧式 loadDocument 对已迁移会话仍直接返回文档', () => {
    const storage = new FakeStorage();
    storage.values.set(STORAGE_KEY, oldDocumentText());

    const document = loadDocument(storage);

    expect(document?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('保存不会修改传入文档', () => {
    const storage = new FakeStorage();
    const document = createDocument('不可变');
    const before = structuredClone(document);

    trySaveDocument(document, storage);

    expect(document).toEqual(before);
  });
});
