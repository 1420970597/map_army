/**
 * 符号收藏集合纯函数。
 *
 * 收藏只保存稳定目录键，不持有全局状态，便于由偏好层或 store 复用。
 */

/** 收藏数据格式版本。 */
export const FAVORITES_VERSION = 1;

/**
 * 规范化收藏键：去重、保序，并可按当前目录剔除已经失效的键。
 */
export function normalizeFavorites(keys: unknown, validKeys?: ReadonlySet<string>): string[] {
  if (!Array.isArray(keys)) return [];

  const result: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    if (typeof key !== 'string') continue;
    const normalized = key.trim();
    if (!normalized || seen.has(normalized) || (validKeys !== undefined && !validKeys.has(normalized))) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

/** 切换一个收藏键；无效键不会写入集合。 */
export function toggleFavorite(keys: readonly string[], key: string): string[] {
  const normalizedKey = key.trim();
  const normalizedKeys = normalizeFavorites(keys);
  if (!normalizedKey) return normalizedKeys;

  return normalizedKeys.includes(normalizedKey)
    ? normalizedKeys.filter((candidate) => candidate !== normalizedKey)
    : [...normalizedKeys, normalizedKey];
}

/** 判断给定键是否已收藏。 */
export function isFavorite(keys: readonly string[], key: string): boolean {
  return normalizeFavorites(keys).includes(key.trim());
}

/** 将收藏键安全序列化为 JSON。 */
export function serializeFavorites(keys: readonly string[]): string {
  return JSON.stringify(normalizeFavorites(keys));
}

/** 解析收藏 JSON；无效 JSON 或不合规结构返回空集合。 */
export function parseFavorites(raw: string | null): string[] {
  if (typeof raw !== 'string') return [];
  try {
    return normalizeFavorites(JSON.parse(raw));
  } catch {
    return [];
  }
}
