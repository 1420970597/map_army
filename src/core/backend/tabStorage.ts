/** 每个页面保留独立恢复快照；持久草稿只清理本次页面保存过的内容。 */
const writer = crypto.randomUUID();
const inherited = new Map<string, { backup: string; raw: string }>();
const journal = (key: string) => `${key}.tab.${writer}`;
const isDraft = (key: string) => /map-army\.(pending|settings-pending)\./.test(key);

export function readTabValue<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const entry = JSON.parse(raw) as { value: T; backup?: string };
      if (entry.backup)
        inherited.set(key, { backup: entry.backup, raw: JSON.stringify(entry.value) });
      return entry.value;
    }
    // 旧版本的单份缓存仍可读取，其他页面的新草稿从恢复列表显式选择。
    const legacy = localStorage.getItem(key);
    if (legacy && isDraft(key)) inherited.set(key, { backup: key, raw: legacy });
    return JSON.parse(legacy ?? 'null') as T | null;
  } catch {
    return null;
  }
}

export function writeTabValue(key: string, value: unknown) {
  const backup = isDraft(key) ? journal(key) : key;
  localStorage.setItem(backup, JSON.stringify(value));
  sessionStorage.setItem(key, JSON.stringify({ value, backup: isDraft(key) ? backup : undefined }));
}

export function removeTabValue(key: string) {
  sessionStorage.removeItem(key);
  localStorage.removeItem(isDraft(key) ? journal(key) : key);
  const source = inherited.get(key);
  if (source && localStorage.getItem(source.backup) === source.raw)
    localStorage.removeItem(source.backup);
  inherited.delete(key);
}

export interface LocalDraft {
  key: string;
  name: string;
  kind: 'project' | 'settings';
}

export function localDrafts(workspace: string): LocalDraft[] {
  const drafts: LocalDraft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      const project = key.startsWith(`map-army.pending.${workspace}.tab.`);
      const settings = key.startsWith(`map-army.settings-pending.${workspace}.tab.`);
      if ((!project && !settings) || key.endsWith(`.tab.${writer}`)) continue;
      try {
        const value = JSON.parse(localStorage.getItem(key)!);
        drafts.push({
          key,
          name: project ? value.document.name : '偏好、收藏和自定义军标',
          kind: project ? 'project' : 'settings',
        });
      } catch {
        // 损坏的草稿保持原样，避免一次读取失败删除恢复来源。
      }
    }
  } catch {
    // 浏览器禁用存储时仍允许访问已入库的项目。
  }
  return drafts;
}

export function readDraft<T>(key: string, destination: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  inherited.set(destination, { backup: key, raw });
  return JSON.parse(raw) as T;
}
