/**
 * 会话可靠性纯逻辑：统一处理本地存储容量、损坏、冲突与可用性判断。
 */

/** 本地会话持久化使用的存储键。 */
export const STORAGE_KEY = 'map-army.session.v1';

/** 建议向用户提示清理空间的会话体积阈值。 */
export const QUOTA_WARN_BYTES = 4 * 1024 * 1024;

/** 不同标签页保存同一会话时的冲突判定时间窗口。 */
export const CONFLICT_WINDOW_MS = 30_000;

/** URL 中会话载荷的当前格式版本。 */
export const URL_PAYLOAD_VERSION = 1;

/**
 * 会话持久化或恢复过程中可识别的错误类别。
 */
export type SessionErrorKind = 'quota' | 'corrupt' | 'conflict' | 'unavailable' | 'unknown';

/**
 * 用于识别会话来源及保存状态的元数据。
 */
export interface SessionMeta {
  savedAt: number;
  appVersion: string;
  tabId: string;
  featureCount: number;
}

/**
 * 估算值序列化为 JSON 后所占用的 UTF-8 字节数。
 *
 * 无法序列化或运行环境不支持 TextEncoder 时返回 0。
 */
export function estimateBytes(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string' || typeof TextEncoder === 'undefined') {
      return 0;
    }

    return new TextEncoder().encode(serialized).length;
  } catch {
    return 0;
  }
}

/**
 * 将未知异常归类为会话恢复或持久化可处理的错误类别。
 */
export function classifyError(error: unknown): SessionErrorKind {
  const details = getErrorDetails(error);
  const searchable = `${details.name} ${details.message}`.toLowerCase();

  if (
    details.name === 'QuotaExceededError' ||
    details.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    details.code === 22 ||
    /quota|storage\s+full/.test(searchable)
  ) {
    return 'quota';
  }

  if (details.name === 'SyntaxError' || /parse|corrupt/.test(searchable)) {
    return 'corrupt';
  }

  if (
    details.name === 'SecurityError' ||
    details.name === 'NotAllowedError' ||
    /storage\s+(?:unavailable|disabled|denied|not\s+available)|localstorage.*(?:unavailable|disabled|denied|not\s+available)/.test(
      searchable,
    )
  ) {
    return 'unavailable';
  }

  return 'unknown';
}

/**
 * 判断最近保存的会话是否来自另一个标签页，从而需要提示潜在覆盖冲突。
 */
export function isConflict(
  meta: SessionMeta | null,
  currentTabId: string,
  now = Date.now(),
): boolean {
  if (!meta || !meta.tabId || meta.tabId === currentTabId || !Number.isFinite(meta.savedAt)) {
    return false;
  }

  const elapsed = now - meta.savedAt;
  return elapsed >= 0 && elapsed <= CONFLICT_WINDOW_MS;
}

function getErrorDetails(error: unknown): {
  name: string;
  message: string;
  code: number | undefined;
} {
  if (typeof error !== 'object' || error === null) {
    return { name: '', message: '', code: undefined };
  }

  const candidate = error as Record<string, unknown>;
  return {
    name: typeof candidate.name === 'string' ? candidate.name : '',
    message: typeof candidate.message === 'string' ? candidate.message : '',
    code: typeof candidate.code === 'number' ? candidate.code : undefined,
  };
}
