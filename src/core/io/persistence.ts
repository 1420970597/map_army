/**
 * 本地持久化。
 *
 * 把当前文档写入 localStorage，使用户在刷新或意外关闭页面后
 * 仍能恢复未导出的标图。写入采用**节流 + 防抖结合**策略：
 * 变更停止 500 毫秒后写入，且两次写入间隔不小于 2 秒，
 * 避免拖拽要素时高频序列化拖慢交互。
 */

import { deserializeMilxly, serializeMilxly } from './milxly';
import type { MapDocument } from '../model';

/** 存储键名 */
const STORAGE_KEY = 'map-army:document';

/** 变更停止后写入的延迟（毫秒） */
const WRITE_DEBOUNCE = 500;

/** 两次写入之间的最小间隔（毫秒） */
const WRITE_THROTTLE = 2000;

/** 待执行的写入定时器 */
let pendingTimer: number | null = null;

/** 上次实际写入的时刻 */
let lastWrite = 0;

/**
 * 保存文档到本地存储。
 *
 * @param document 待保存的文档
 * @param immediate 是否跳过防抖立即写入
 */
export function saveDocument(document: MapDocument, immediate = false): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }

  const write = (): void => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeMilxly(document));
      lastWrite = Date.now();
    } catch {
      // 存储配额不足或处于隐私模式时静默失败：
      // 本地缓存不是关键路径，不应因此打断用户编辑
    }
  };

  if (immediate) {
    write();
    return;
  }

  const elapsed = Date.now() - lastWrite;
  const delay = Math.max(WRITE_DEBOUNCE, WRITE_THROTTLE - elapsed);

  pendingTimer = window.setTimeout(write, delay);
}

/**
 * 从本地存储读取文档。
 *
 * @returns 文档，不存在或已损坏时返回 null
 */
export function loadDocument(): MapDocument | null {
  let text: string | null = null;
  try {
    text = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!text) return null;

  try {
    return deserializeMilxly(text).document;
  } catch {
    // 缓存损坏时清除，避免每次启动都解析失败
    clearDocument();
    return null;
  }
}

/** 清除本地存储的文档 */
export function clearDocument(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略：清除失败不影响后续使用
  }
}

/**
 * 订阅文档变化并自动保存。
 *
 * 返回取消订阅的函数，便于在组件卸载时清理。
 *
 * @param getDocument 读取当前文档的函数
 */
export function autoSave(getDocument: () => MapDocument): () => void {
  let previous = getDocument();

  const timer = window.setInterval(() => {
    const current = getDocument();
    // 引用比较即可判断文档是否变化：store 中的更新总是产生新对象
    if (current !== previous) {
      previous = current;
      saveDocument(current);
    }
  }, 1000);

  return () => window.clearInterval(timer);
}
