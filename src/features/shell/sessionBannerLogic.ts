/**
 * 会话横幅展示所需的纯逻辑。
 *
 * 此模块只根据会话瞬态状态生成展示信息，不读取或修改状态容器。
 */

import type { PendingRestore, SessionStatus, SessionStoreError } from '@/stores/useSessionStore';

/** 会话横幅类型，按展示优先级由高到低排列。 */
export type SessionBannerKind = 'restore' | 'error' | 'conflict' | 'saving' | 'saved' | null;

/** 会话横幅判定所需的状态快照。 */
export interface SessionBannerStateInput {
  /** 等待用户确认的恢复候选。 */
  pendingRestore: PendingRestore | null;
  /** 最近一次会话错误。 */
  error: SessionStoreError | null;
  /** 是否检测到跨标签编辑冲突。 */
  conflict: boolean;
  /** 当前会话保存状态。 */
  status: SessionStatus;
  /** 最近成功保存的时间戳。 */
  lastSavedAt: number | null;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const SAVED_VISIBLE_MS = 10_000;

/**
 * 根据会话状态返回应展示的最高优先级横幅。
 */
export function sessionBannerKind(input: SessionBannerStateInput): SessionBannerKind {
  if (input.pendingRestore !== null) return 'restore';
  if (input.error !== null) return 'error';
  if (input.conflict) return 'conflict';
  if (input.status === 'saving') return 'saving';
  if (input.status === 'saved') return 'saved';
  return null;
}

/**
 * 返回恢复候选的要素数量与保存相对时间摘要。
 */
export function restoreSummary(candidate: PendingRestore, now: number): string {
  const featureCount = candidate.meta.featureCount;
  return `发现 ${featureCount} 个要素的未恢复会话，保存于${relativeTime(candidate.meta.savedAt, now)}`;
}

/**
 * 判断外部会话时间是否是严格更新的有效时间。
 */
export function isExternalSessionNewer(
  currentUpdatedAt: number,
  incomingUpdatedAt: number,
): boolean {
  return Number.isFinite(incomingUpdatedAt) && incomingUpdatedAt > currentUpdatedAt;
}

/**
 * 返回最近自动保存提示；超过可见期、未来时间或无时间戳时不展示。
 */
export function savedStatusText(savedAt: number | null, now: number): string | null {
  if (savedAt === null || !Number.isFinite(savedAt) || !Number.isFinite(now)) return null;

  const elapsed = now - savedAt;
  return elapsed >= 0 && elapsed <= SAVED_VISIBLE_MS ? '已自动保存' : null;
}

/**
 * 将有效过去时间格式化为面向用户的简短相对时间。
 */
function relativeTime(savedAt: number, now: number): string {
  if (!Number.isFinite(savedAt) || !Number.isFinite(now)) return '未知时间';

  const elapsed = Math.max(0, now - savedAt);
  if (elapsed < MINUTE_MS) return '刚刚';
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} 分钟前`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)} 小时前`;
  return `${Math.floor(elapsed / DAY_MS)} 天前`;
}
