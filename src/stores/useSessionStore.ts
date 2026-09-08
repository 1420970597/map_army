/**
 * 会话保存与恢复瞬态状态容器。
 *
 * 本 store 仅记录保存进度、恢复候选和跨标签冲突提示，不读取或修改文档 store。
 */

import { create } from 'zustand';

import type { PersistenceSaveResult, SessionErrorKind, SessionMeta } from '@/core/io';
import type { MapDocument } from '@/core/model';

/** 会话保存过程的显示状态。 */
export type SessionStatus = 'idle' | 'saving' | 'saved' | 'error';

/** 可展示的会话错误信息。 */
export interface SessionStoreError {
  /** 可机器处理的错误类别。 */
  kind: SessionErrorKind;
  /** 面向用户的中文错误提示。 */
  message: string;
}

/** 等待用户确认的恢复候选。 */
export interface PendingRestore {
  /** 可恢复的文档快照。 */
  document: MapDocument;
  /** 文档保存元数据。 */
  meta: SessionMeta;
}

/** 会话保存与恢复的瞬态状态及操作。 */
export interface SessionState {
  /** 当前保存状态。 */
  status: SessionStatus;
  /** 最近一次成功保存的时间戳。 */
  lastSavedAt: number | null;
  /** 最近一次保存或恢复错误。 */
  error: SessionStoreError | null;
  /** 等待用户接受或丢弃的恢复候选。 */
  pendingRestore: PendingRestore | null;
  /** 是否检测到跨标签编辑冲突。 */
  conflict: boolean;

  /** 标记会话进入保存中状态。 */
  beginSaving: () => void;
  /** 根据持久化结果更新保存状态。 */
  recordSaveResult: (result: PersistenceSaveResult, now?: number) => void;
  /** 设置等待确认的恢复候选，并深拷贝其数据。 */
  setPendingRestore: (candidate: PendingRestore | null) => void;
  /** 接受恢复候选，返回独立文档副本并清空候选。 */
  acceptRestore: () => MapDocument | null;
  /** 丢弃恢复候选。 */
  discardRestore: () => void;
  /** 设置跨标签编辑冲突状态。 */
  setConflict: (conflict: boolean) => void;
  /** 清空最近错误。 */
  clearError: () => void;
  /** 重置全部会话瞬态状态。 */
  reset: () => void;
}

/** 返回错误类别对应的中文提示。 */
function errorMessage(kind: SessionErrorKind): string {
  switch (kind) {
    case 'quota':
      return '浏览器存储已满，请导出 .milxly 保存副本。';
    case 'corrupt':
      return '检测到损坏的本地会话，已备份，可恢复或丢弃。';
    case 'unavailable':
      return '浏览器不允许本地存储，自动保存已关闭。';
    case 'conflict':
      return '另一标签页正在编辑本图，可能发生覆盖。';
    case 'unknown':
      return '自动保存失败，请导出标图副本。';
  }
}

/** 深拷贝恢复候选，隔离调用方的可变数据。 */
function clonePendingRestore(candidate: PendingRestore): PendingRestore {
  return structuredClone(candidate);
}

/** 判断两个恢复候选是否具有相同的可序列化语义。 */
function samePendingRestore(first: PendingRestore | null, second: PendingRestore | null): boolean {
  if (first === null || second === null) return first === second;
  return JSON.stringify(first) === JSON.stringify(second);
}

/** 创建默认会话瞬态状态。 */
function defaultSessionState(): Pick<
  SessionState,
  'status' | 'lastSavedAt' | 'error' | 'pendingRestore' | 'conflict'
> {
  return {
    status: 'idle',
    lastSavedAt: null,
    error: null,
    pendingRestore: null,
    conflict: false,
  };
}

/** 会话保存与恢复 Zustand 状态容器。 */
export const useSessionStore = create<SessionState>((set, get) => ({
  ...defaultSessionState(),

  beginSaving: () => set({ status: 'saving' }),

  recordSaveResult: (result, now = Date.now()) => {
    if (result.status === 'scheduled') {
      set({ status: 'saving' });
      return;
    }
    if (result.status === 'saved') {
      set({ status: 'saved', lastSavedAt: now, error: null });
      return;
    }

    const kind = result.error.kind;
    set({ status: 'error', error: { kind, message: errorMessage(kind) } });
  },

  setPendingRestore: (candidate) =>
    set((state) => {
      if (samePendingRestore(state.pendingRestore, candidate)) return state;
      return { pendingRestore: candidate === null ? null : clonePendingRestore(candidate) };
    }),

  acceptRestore: () => {
    const candidate = get().pendingRestore;
    if (candidate === null) return null;
    const document = structuredClone(candidate.document);
    set({ pendingRestore: null });
    return document;
  },

  discardRestore: () => set({ pendingRestore: null }),

  setConflict: (conflict) => set((state) => (state.conflict === conflict ? state : { conflict })),

  clearError: () => set({ error: null }),

  reset: () => set(defaultSessionState()),
}));
