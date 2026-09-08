/**
 * 符号库用户偏好持久化。
 *
 * 偏好不属于标图文档，独立保存为本地用户设置；所有脏数据与存储错误均安全降级。
 */

import { DEFAULT_SYMBOL_DEFAULTS, normalizeSymbolDefaults, type SymbolDefaults } from '../symbology/defaults';
import { normalizeFavorites } from '../symbology/favorites';
import type { StorageLike } from './persistence';

/** 符号偏好的 localStorage 键。 */
export const PREFS_STORAGE_KEY = 'map-army.prefs.v1';

/** 当前偏好数据版本。 */
export const PREFS_VERSION = 1;

/** 应用可持久化的符号偏好。 */
export interface AppPrefs {
  version: typeof PREFS_VERSION;
  favorites: string[];
  symbolDefaults: SymbolDefaults;
  symbolMode: 'standard' | 'extended';
}

/** 首次使用或损坏数据时的偏好默认值。 */
export const DEFAULT_APP_PREFS: AppPrefs = {
  version: PREFS_VERSION,
  favorites: [],
  symbolDefaults: DEFAULT_SYMBOL_DEFAULTS,
  symbolMode: 'standard',
};

/** 将未知 JSON 文本解析为完整且安全的偏好。 */
export function parsePrefs(raw: string | null): AppPrefs {
  if (typeof raw !== 'string') return cloneDefaults();

  try {
    return normalizePrefs(JSON.parse(raw));
  } catch {
    return cloneDefaults();
  }
}

/** 将偏好规范化后序列化，避免写入不合规字段。 */
export function serializePrefs(prefs: unknown): string {
  return JSON.stringify(normalizePrefs(prefs));
}

/** 从可注入存储读取偏好；不可用时回退默认值。 */
export function loadPrefs(storage?: StorageLike): AppPrefs {
  try {
    return parsePrefs((storage ?? getBrowserStorage()).getItem(PREFS_STORAGE_KEY));
  } catch {
    return cloneDefaults();
  }
}

/**
 * 保存偏好到可注入存储。
 *
 * @returns 是否成功写入，失败时返回 false 而不向调用方抛出异常。
 */
export function savePrefs(prefs: unknown, storage?: StorageLike): boolean {
  try {
    (storage ?? getBrowserStorage()).setItem(PREFS_STORAGE_KEY, serializePrefs(prefs));
    return true;
  } catch {
    return false;
  }
}

/** 将未知结构收敛为完整偏好。 */
function normalizePrefs(value: unknown): AppPrefs {
  const record = isRecord(value) ? value : {};
  return {
    version: PREFS_VERSION,
    favorites: normalizeFavorites(record.favorites),
    symbolDefaults: normalizeSymbolDefaults(record.symbolDefaults),
    symbolMode: record.symbolMode === 'extended' ? 'extended' : 'standard',
  };
}

/** 返回可安全修改的默认值副本。 */
function cloneDefaults(): AppPrefs {
  return {
    version: PREFS_VERSION,
    favorites: [],
    symbolDefaults: { ...DEFAULT_SYMBOL_DEFAULTS },
    symbolMode: 'standard',
  };
}

/** 判断未知值是否为可读取字段的对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 延迟访问浏览器 localStorage，避免 Node 环境在模块导入时触碰 window。 */
function getBrowserStorage(): StorageLike {
  if (typeof window === 'undefined') throw new Error('localStorage unavailable');
  return window.localStorage;
}
