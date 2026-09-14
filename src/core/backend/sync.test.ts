/** 验证真实编辑器订阅在断网、并发和手势期间不会覆盖待同步数据。 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { MapDocument } from '@/core/model';

import type * as Sync from './sync';
import type { useDocumentStore as DocumentStore } from '@/stores/useDocumentStore';
import type { useBackendStore as BackendStore } from '@/stores/useBackendStore';
import type { usePreferencesStore as PreferencesStore } from '@/stores/usePreferencesStore';
let sync: typeof Sync;
let documentStore: typeof DocumentStore;
let backendStore: typeof BackendStore;
let preferences: typeof PreferencesStore;
let data: MapDocument;
let revision: number;
let online: boolean;
let writes: { revision: string | null; document: MapDocument }[];
let hold: (() => Promise<void>) | undefined;
const cache = new Map<string, string>();
const tabCache = new Map<string, string>();
const tabStorage = {
  getItem: (key: string) => tabCache.get(key) ?? null,
  setItem: (key: string, value: string) => tabCache.set(key, value),
  removeItem: (key: string) => tabCache.delete(key),
};
const storage = {
  getItem: (key: string) => cache.get(key) ?? null,
  setItem: (key: string, value: string) => cache.set(key, value),
  removeItem: (key: string) => cache.delete(key),
  key: (index: number) => [...cache.keys()][index] ?? null,
  get length() {
    return cache.size;
  },
};
async function modules() {
  sync = await import('./sync');
  documentStore = (await import('@/stores/useDocumentStore')).useDocumentStore;
  backendStore = (await import('@/stores/useBackendStore')).useBackendStore;
  preferences = (await import('@/stores/usePreferencesStore')).usePreferencesStore;
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(async () => {
  vi.resetModules();
  cache.clear();
  tabCache.clear();
  revision = 1;
  online = true;
  writes = [];
  hold = undefined;
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('sessionStorage', tabStorage);
  vi.stubGlobal('window', {
    localStorage: storage,
    location: { search: '', pathname: '/', href: 'http://localhost/' },
    history: { replaceState: vi.fn() },
  });
  await modules();
  data = (await import('@/core/model')).createDocument('服务器项目');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (!online) throw new TypeError('网络不可用');
      if (url === '/api/workspace') return response({ id: 'workspace', name: '测试空间' });
      if (url === '/api/workspace/migrate') return response({});
      if (url === '/api/workspace/settings')
        return response({
          version: 0,
          preferences: {},
          symbol: {},
          favorites: [],
          customSymbols: [],
        });
      if (url === '/api/models?') return response([]);
      if (url === '/api/catalog') return response({ symbol: [] });
      if (url === '/api/projects')
        return response([{ id: 'project', name: data.name, revision, updatedAt: 1 }]);
      if (url === '/api/projects/project' && init.method === 'PUT') {
        const doc = JSON.parse(String(init.body)).document as MapDocument;
        const base = new Headers(init.headers).get('If-Match');
        writes.push({ revision: base, document: structuredClone(doc) });
        await hold?.();
        if (base !== String(revision)) return response({ error: '版本冲突' }, 409);
        data = doc;
        revision++;
      }
      if (url === '/api/projects/project')
        return response({ id: 'project', revision, document: data, updatedAt: 1 });
      throw new Error('未处理测试接口 ' + url);
    }),
  );
});
afterEach(() => {
  sync.stopBackend();
  vi.unstubAllGlobals();
});
async function start() {
  await sync.initializeBackend(false, new AbortController().signal);
}
function rename(name: string) {
  documentStore.getState().replaceDocument({ ...documentStore.getState().document, name });
}

test('保存过程中发生的新修改随后用新版本号写入', async () => {
  await start();
  rename('第一笔');
  let release!: () => void;
  hold = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  const saving = sync.flushBackend();
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  rename('第二笔');
  release();
  await saving;
  hold = undefined;
  expect(backendStore.getState().dirty).toBe(true);
  await sync.flushBackend();
  expect(writes.map((write) => write.revision)).toEqual(['1', '2']);
  expect(data.name).toBe('第二笔');
  expect(backendStore.getState().dirty).toBe(false);
});

test('409 后刷新恢复待保存项目及原始版本，禁止自动覆盖', async () => {
  await start();
  rename('保留的本地修改');
  revision = 2;
  await sync.flushBackend();
  expect(backendStore.getState().projectConflict).toBe(true);
  sync.stopBackend();
  vi.resetModules();
  await modules();
  await start();
  expect(documentStore.getState().document.name).toBe('保留的本地修改');
  expect(backendStore.getState().revision).toBe(1);
  await sync.flushBackend();
  expect(writes).toHaveLength(1);
});

test('启动时离线，重新连接不覆盖已恢复项目的新编辑', async () => {
  await start();
  sync.stopBackend();
  vi.resetModules();
  await modules();
  online = false;
  await start();
  rename('断网编辑');
  online = true;
  await sync.retryBackend();
  expect(data.name).toBe('断网编辑');
  expect(backendStore.getState().dirty).toBe(false);
});

test('刷新恢复待同步偏好且保留 store 操作方法', async () => {
  await start();
  online = false;
  preferences.getState().update({ language: 'de' });
  await sync.flushBackend();
  sync.stopBackend();
  vi.resetModules();
  await modules();
  await start();
  expect(preferences.getState().language).toBe('de');
  expect(typeof preferences.getState().update).toBe('function');
});

test('持续拖动只在手势完成后保存', async () => {
  await start();
  const layer = documentStore.getState().document.layers[0];
  documentStore.getState().beginGesture();
  documentStore.getState().previewLayer(layer.id, { opacity: 0.4 });
  await sync.flushBackend();
  expect(writes).toHaveLength(0);
  documentStore.getState().endGesture();
  await sync.flushBackend();
  expect(writes).toHaveLength(1);
  expect(data.layers[0].opacity).toBe(0.4);
});

test('另一标签页保存不覆盖或清理本页离线文档与偏好，刷新仍恢复原稿', async () => {
  await start();
  online = false;
  rename('甲页离线稿');
  preferences.getState().update({ language: 'de' });
  await sync.flushBackend();
  const firstTab = new Map(tabCache);
  sync.stopBackend();
  tabCache.clear();
  vi.resetModules();
  await modules();
  online = true;
  await start();
  rename('乙页已保存');
  await sync.flushBackend();
  expect(data.name).toBe('乙页已保存');
  sync.stopBackend();
  tabCache.clear();
  for (const [key, value] of firstTab) tabCache.set(key, value);
  vi.resetModules();
  await modules();
  await start();
  expect(documentStore.getState().document.name).toBe('甲页离线稿');
  expect(preferences.getState().language).toBe('de');
  expect(backendStore.getState().projectConflict).toBe(true);
  expect(backendStore.getState().revision).toBe(1);
});

test('关闭标签页后可从工作空间恢复独立持久草稿', async () => {
  await start();
  online = false;
  rename('关闭前的草稿');
  await sync.flushBackend();
  sync.stopBackend();
  tabCache.clear();
  vi.resetModules();
  await modules();
  online = true;
  await start();
  const draft = sync.listLocalDrafts().find((entry) => entry.name === '关闭前的草稿');
  expect(draft).toBeDefined();
  sync.restoreLocalDraft(draft!.key);
  expect(documentStore.getState().document.name).toBe('关闭前的草稿');
  await sync.flushBackend();
  expect(data.name).toBe('关闭前的草稿');
  expect(sync.listLocalDrafts()).toEqual([]);
});
