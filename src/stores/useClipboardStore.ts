/**
 * 要素剪贴板瞬态与持久化状态容器。
 *
 * 本模块在 action 执行时按需访问浏览器存储；模块加载本身不读取 localStorage，
 * 避免服务端渲染和非浏览器环境产生副作用。
 */

import { create } from 'zustand';

import { classifyError, type SessionErrorKind } from '@/core/io/session';
import { parseClipboard, serializeClipboard, type ClipboardPayload } from '@/core/model';

/** 剪贴板载荷在本地存储中的键。 */
export const CLIPBOARD_STORAGE_KEY = 'map-army.clipboard.v1';

/** 剪贴板状态与操作。 */
export interface ClipboardState {
  /** 当前剪贴板载荷；无内容时为 null。 */
  payload: ClipboardPayload | null;
  /** 当前载荷已连续粘贴的次数。 */
  pasteCount: number;
  /** 最近一次恢复或持久化错误。 */
  lastError: SessionErrorKind | null;

  /** 设置剪贴板载荷，深拷贝后清空粘贴计数与错误。 */
  setPayload: (payload: ClipboardPayload | null) => void;
  /** 记录一次粘贴并返回新的粘贴次数；无载荷时返回 0。 */
  recordPaste: () => number;
  /** 清空剪贴板载荷及关联状态。 */
  clearPayload: () => void;
  /** 从 JSON 文本恢复剪贴板载荷。 */
  restore: (raw: string | null) => boolean;
  /** 将当前剪贴板安全持久化到存储。 */
  persist: (storage?: Pick<Storage, 'setItem'>) => boolean;
  /** 从存储读取剪贴板并恢复；成功恢复时返回 true。 */
  hydrate: (storage?: Pick<Storage, 'getItem'>) => boolean;
  /** 重置全部剪贴板状态。 */
  reset: () => void;
}

/** 返回剪贴板载荷的深拷贝。 */
function clonePayload(payload: ClipboardPayload): ClipboardPayload {
  return serializeClipboard(payload.features, payload.layerNames, payload.anchor, payload.zoom);
}

/** 判断两个载荷的可序列化语义是否相同。 */
function samePayload(first: ClipboardPayload | null, second: ClipboardPayload | null): boolean {
  if (first === null || second === null) return first === second;
  return JSON.stringify(first) === JSON.stringify(second);
}

/** 创建默认剪贴板状态。 */
function defaultClipboardState(): Pick<ClipboardState, 'payload' | 'pasteCount' | 'lastError'> {
  return { payload: null, pasteCount: 0, lastError: null };
}

/** 在 action 调用期间获取默认浏览器本地存储。 */
function defaultStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

/** 要素剪贴板 Zustand 状态容器。 */
export const useClipboardStore = create<ClipboardState>((set, get) => ({
  ...defaultClipboardState(),

  setPayload: (payload) =>
    set((state) => {
      if (samePayload(state.payload, payload)) return state;
      return payload === null
        ? defaultClipboardState()
        : { payload: clonePayload(payload), pasteCount: 0, lastError: null };
    }),

  recordPaste: () => {
    const state = get();
    if (state.payload === null) return 0;
    const pasteCount = state.pasteCount + 1;
    set({ pasteCount });
    return pasteCount;
  },

  clearPayload: () => set(defaultClipboardState()),

  restore: (raw) => {
    if (raw === null) return false;

    const payload = parseClipboard(raw);
    if (payload === null) {
      set({ lastError: 'corrupt' });
      return false;
    }

    set({ payload: clonePayload(payload), pasteCount: 0, lastError: null });
    return true;
  },

  persist: (storage) => {
    const payload = get().payload;
    if (payload === null) return false;

    try {
      const target = storage ?? defaultStorage();
      if (target === undefined) throw new Error('storage unavailable');
      target.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(payload));
      set({ lastError: null });
      return true;
    } catch (error) {
      set({ lastError: classifyError(error) });
      return false;
    }
  },

  hydrate: (storage) => {
    try {
      const source = storage ?? defaultStorage();
      if (source === undefined) throw new Error('storage unavailable');
      return get().restore(source.getItem(CLIPBOARD_STORAGE_KEY));
    } catch (error) {
      set({ lastError: classifyError(error) });
      return false;
    }
  },

  reset: () => set(defaultClipboardState()),
}));
