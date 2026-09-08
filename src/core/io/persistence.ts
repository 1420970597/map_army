/**
 * 本地会话持久化。
 *
 * 旧版本使用 `map-army:document` 保存会话。当前版本统一改用会话模块的
 * 命名空间，并在读取时回退到旧键，避免升级后丢失用户已有缓存。
 */

import { migrateDocument } from '../model/migrate';
import type { MapDocument } from '../model/types';
import { deserializeMilxly, serializeMilxly } from './milxly';
import {
  classifyError,
  estimateBytes,
  QUOTA_WARN_BYTES,
  STORAGE_KEY,
  type SessionErrorKind,
} from './session';

/** 旧版会话存储键，仅用于向后兼容读取。 */
export const LEGACY_STORAGE_KEY = 'map-army:document';

/** 损坏会话原始文本的稳定备份键。 */
export const CORRUPT_BACKUP_STORAGE_KEY = `${STORAGE_KEY}.bak`;

/** 变更停止后写入的延迟（毫秒）。 */
const WRITE_DEBOUNCE = 500;

/** 两次写入之间的最小间隔（毫秒）。 */
const WRITE_THROTTLE = 2000;

/** 可注入的最小存储接口，便于在非浏览器环境安全测试。 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 会话持久化失败的可观察错误。 */
export interface PersistenceError {
  kind: SessionErrorKind;
  error: unknown;
}

/** 一次实际保存的结果。 */
export type PersistenceSaveResult =
  | { status: 'saved'; ok: true; bytes: number; nearQuota: boolean }
  | { status: 'scheduled'; ok: true }
  | { status: 'error'; ok: false; error: PersistenceError };

/** 一次读取会话的结果。 */
export type PersistenceLoadResult =
  | { status: 'empty'; document: null }
  | {
      status: 'loaded';
      document: MapDocument;
      source: 'primary' | 'legacy';
      warnings: ReturnType<typeof migrateDocument>['warnings'];
    }
  | { status: 'corrupt'; document: null; error: PersistenceError; backupSaved: boolean }
  | { status: 'error'; document: null; error: PersistenceError };

/** 待执行的写入定时器。 */
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

/** 上次实际写入的时刻。 */
let lastWrite = 0;

/** 最近一次保存操作的结果，供延迟自动保存的调用方读取。 */
let lastSaveResult: PersistenceSaveResult | null = null;

/**
 * 立即保存文档并返回可消费结果。
 *
 * 序列化不会修改传入文档。存储错误会被归类并返回，正常编辑流程无需捕获异常。
 */
export function trySaveDocument(
  document: MapDocument,
  storage?: StorageLike,
): PersistenceSaveResult {
  try {
    const text = serializeMilxly(document);
    const resolvedStorage = storage ?? getBrowserStorage();
    resolvedStorage.setItem(STORAGE_KEY, text);
    lastWrite = Date.now();

    const bytes = estimateBytes(text);
    const result: PersistenceSaveResult = {
      status: 'saved',
      ok: true,
      bytes,
      nearQuota: bytes >= QUOTA_WARN_BYTES,
    };
    lastSaveResult = result;
    return result;
  } catch (error) {
    const result: PersistenceSaveResult = {
      status: 'error',
      ok: false,
      error: { kind: classifyError(error), error },
    };
    lastSaveResult = result;
    return result;
  }
}

/** 返回最近一次实际或计划保存的结果。 */
export function getLastSaveResult(): PersistenceSaveResult | null {
  return lastSaveResult;
}

/**
 * 保存文档到本地存储。
 *
 * 保持旧有调用方式；立即保存返回实际结果，延迟保存返回已计划状态，最终结果可由
 * `getLastSaveResult` 获取。存储错误永不向编辑流程抛出。
 */
export function saveDocument(
  document: MapDocument,
  immediate = false,
  storage?: StorageLike,
): PersistenceSaveResult {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }

  if (immediate) {
    return trySaveDocument(document, storage);
  }

  const elapsed = Date.now() - lastWrite;
  const delay = Math.max(WRITE_DEBOUNCE, WRITE_THROTTLE - elapsed);
  const scheduled: PersistenceSaveResult = { status: 'scheduled', ok: true };
  lastSaveResult = scheduled;
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    trySaveDocument(document, storage);
  }, delay);
  return scheduled;
}

/**
 * 读取本地会话并统一经过 schema 迁移链。
 *
 * 主键不存在时才读取旧键。主键内容损坏时会先保留原始文本到备份键，再删除主键，
 * 避免每次启动重复解析同一损坏缓存。
 */
export function loadDocumentResult(storage?: StorageLike): PersistenceLoadResult {
  let resolvedStorage: StorageLike;
  try {
    resolvedStorage = storage ?? getBrowserStorage();
  } catch (error) {
    return { status: 'error', document: null, error: { kind: classifyError(error), error } };
  }

  let primaryText: string | null;
  try {
    primaryText = resolvedStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return { status: 'error', document: null, error: { kind: classifyError(error), error } };
  }

  if (primaryText !== null) {
    return decodeDocument(primaryText, 'primary', resolvedStorage);
  }

  let legacyText: string | null;
  try {
    legacyText = resolvedStorage.getItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    return { status: 'error', document: null, error: { kind: classifyError(error), error } };
  }

  if (legacyText === null) return { status: 'empty', document: null };
  return decodeDocument(legacyText, 'legacy', resolvedStorage);
}

/** 保持旧版 API：未找到、损坏或不可用时均返回 null。 */
export function loadDocument(storage?: StorageLike): MapDocument | null {
  const result = loadDocumentResult(storage);
  return result.status === 'loaded' ? result.document : null;
}

/**
 * 清除当前主会话，旧版缓存保留以避免误删升级前数据。
 */
export function clearDocument(storage?: StorageLike): void {
  try {
    const resolvedStorage = storage ?? getBrowserStorage();
    resolvedStorage.removeItem(STORAGE_KEY);
  } catch {
    // 清除失败不会影响继续编辑，结果型读取和保存 API 会提供可观察错误。
  }
}

/**
 * 订阅文档变化并自动保存。
 *
 * 返回取消订阅函数，便于在组件卸载时清理。
 */
export function autoSave(getDocument: () => MapDocument): () => void {
  let previous = getDocument();
  const timer = setInterval(() => {
    const current = getDocument();
    if (current !== previous) {
      previous = current;
      saveDocument(current);
    }
  }, 1000);

  return () => clearInterval(timer);
}

/** 解析、迁移并返回统一的读取结果。 */
function decodeDocument(
  text: string,
  source: 'primary' | 'legacy',
  storage: StorageLike,
): PersistenceLoadResult {
  try {
    const parsed = deserializeMilxly(text).document;
    const migration = migrateDocument(parsed);
    return {
      status: 'loaded',
      document: migration.document,
      source,
      warnings: migration.warnings,
    };
  } catch (error) {
    const persistenceError: PersistenceError = { kind: 'corrupt', error };
    const backupSaved = backupAndClearCorruptSession(text, source, storage);
    return { status: 'corrupt', document: null, error: persistenceError, backupSaved };
  }
}

/** 将损坏原文备份到稳定键并移除对应会话键。 */
function backupAndClearCorruptSession(
  text: string,
  source: 'primary' | 'legacy',
  storage: StorageLike,
): boolean {
  let backupSaved = false;
  try {
    storage.setItem(CORRUPT_BACKUP_STORAGE_KEY, text);
    backupSaved = true;
  } catch {
    // 仍继续清理损坏键，避免启动时循环解析失败。
  }

  try {
    storage.removeItem(source === 'primary' ? STORAGE_KEY : LEGACY_STORAGE_KEY);
  } catch {
    // 清理失败时已返回损坏状态，调用方仍可提示用户处理。
  }

  return backupSaved;
}

/** 延迟访问浏览器存储，避免 Node/Vitest 在模块导入时触碰 window。 */
function getBrowserStorage(): StorageLike {
  if (typeof window === 'undefined') {
    throw new Error('localStorage unavailable: 当前环境未提供 window。');
  }

  return window.localStorage;
}
