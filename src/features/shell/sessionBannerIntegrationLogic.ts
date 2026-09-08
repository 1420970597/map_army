/**
 * 会话横幅与持久化读取结果的纯集成逻辑。
 *
 * 本模块将会话读取结果转换为恢复候选或可展示错误，不接触 React、Zustand 或浏览器存储。
 */

import type { PersistenceLoadResult, SessionMeta } from '@/core/io';
import type { MapDocument } from '@/core/model';
import type { PendingRestore, SessionStoreError } from '@/stores/useSessionStore';

/** 会话读取结果转化后的状态更新描述。 */
export interface SessionLoadIntegration {
  /** 等待用户确认的恢复候选；不自动覆盖当前文档。 */
  pendingRestore: PendingRestore | null;
  /** 可展示的读取错误。 */
  error: SessionStoreError | null;
}

/**
 * 为加载的文档创建独立恢复候选。
 *
 * @param document 从持久化层读取的文档
 * @param tabId 当前标签页标识；空值时使用稳定回退值
 * @returns 包含深拷贝文档与元数据的恢复候选
 */
export function createPendingRestore(document: MapDocument, tabId: string): PendingRestore {
  return {
    document: structuredClone(document),
    meta: createSessionMeta(document, tabId),
  };
}

/**
 * 将持久化读取结果映射为会话横幅状态。
 *
 * loaded 只创建恢复候选，不会自动替换当前文档；empty 不显示状态。
 *
 * @param result 持久化读取结果
 * @param tabId 当前标签页标识
 * @returns 可供会话状态容器消费的更新描述
 */
export function sessionLoadIntegration(
  result: PersistenceLoadResult,
  tabId: string,
): SessionLoadIntegration {
  if (result.status === 'loaded') {
    return { pendingRestore: createPendingRestore(result.document, tabId), error: null };
  }
  if (result.status === 'empty') return { pendingRestore: null, error: null };

  return {
    pendingRestore: null,
    error: { kind: result.error.kind, message: errorMessage(result.error.kind) },
  };
}

/**
 * 判断外部加载会话是否值得提示为冲突。
 *
 * @param current 当前文档
 * @param incoming 外部读取结果
 * @returns 仅在外部会话已加载且更新时间严格更新时为 true
 */
export function isExternalSessionUpdate(
  current: MapDocument,
  incoming: PersistenceLoadResult,
): boolean {
  return incoming.status === 'loaded' && incoming.document.updatedAt > current.updatedAt;
}

/** 根据文档生成会话元数据。 */
function createSessionMeta(document: MapDocument, tabId: string): SessionMeta {
  return {
    savedAt: document.updatedAt,
    appVersion: 'map-army',
    tabId: tabId || 'local-tab',
    featureCount: document.features.length,
  };
}

/** 返回错误类别对应的中文提示。 */
function errorMessage(kind: SessionStoreError['kind']): string {
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
