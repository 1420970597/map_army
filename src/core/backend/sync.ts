/** 文档与资料分别保留待保存快照，所有写入串行执行，版本冲突必须显式处理。 */
import { api, ApiError } from './api';
import { useBackendStore, type ProjectSummary } from '@/stores/useBackendStore';
import { committedDocument, gestureInProgress, useDocumentStore } from '@/stores/useDocumentStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useSymbolStore } from '@/stores/useSymbolStore';
import { useCustomSymbolStore } from '@/stores/useCustomSymbolStore';
import { useViewStore } from '@/stores/useViewStore';
import { useAccessStore } from '@/stores/useAccessStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { loadDocumentResult, trySaveDocument } from '@/core/io/persistence';
import { normalizeSymbolDefaults } from '@/core/symbology/defaults';
import { registerEquipmentModels, type EquipmentModelDefinition } from '@/core/model/equipment3d';
import { registerCatalog, type CatalogEntry } from '@/core/symbology/catalog';
import { createDocument, type MapDocument } from '@/core/model';

interface SavedProject {
  id: string;
  revision: number;
  document: MapDocument;
  updatedAt: number;
}
interface SettingsRecord {
  version: number;
  preferences: Record<string, unknown>;
  symbol: Record<string, unknown>;
  view?: Record<string, unknown>;
  favorites: string[];
  customSymbols: ReturnType<typeof useCustomSymbolStore.getState>['symbols'];
}
interface Pending {
  unlockedLayerIds?: string[];
  projectId: string | null;
  clientId: string;
  revision: number;
  document: MapDocument;
}
interface PendingSettings {
  version: number;
  settings: Omit<SettingsRecord, 'version'>;
}
interface Connection {
  workspaceId: string;
  workspaceName: string;
  projectId: string | null;
  revision: number;
  settingsVersion: number;
}
let muted = false;
let documentDirty = false;
let settingsDirty = false;
let writing: Promise<void> | null = null;
let connecting: Promise<boolean> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let externalDocument = false;
let enabled = false;
let initialized = false;
let generation = 0;
let clientId = '';
const unlockedLayers = new Set<string>();
let stopSubscriptions = () => {};

function stored<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    useBackendStore.setState({ message: '浏览器备份不可用，请保持页面打开直到保存成功。' });
  }
}
function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 后端保存不依赖缓存清理。 */
  }
}
const scope = () => useBackendStore.getState().workspaceId ?? 'unbound';
const pendingKey = (id = scope()) => `map-army.pending.${id}`;
const settingsKey = (id = scope()) => `map-army.settings-pending.${id}`;
const cacheKey = (id = scope()) => `map-army.project-cache.${id}`;
const legacyKey = () => `map-army.legacy-restore.${scope()}`;
const newId = () => crypto.randomUUID().replaceAll('-', '');
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function rememberConnection() {
  const { workspaceId, workspaceName, projectId, revision, settingsVersion } =
    useBackendStore.getState();
  if (workspaceId)
    store('map-army.connection', {
      workspaceId,
      workspaceName,
      projectId,
      revision,
      settingsVersion,
    });
}
function bundle() {
  const symbol = useSymbolStore.getState();
  const view = useViewStore.getState();
  return JSON.parse(
    JSON.stringify({
      preferences: usePreferencesStore.getState(),
      symbol: { symbolMode: symbol.symbolMode, symbolDefaults: symbol.symbolDefaults },
      view: { baseMap: view.baseMap, grid: view.grid, gridLabels: view.gridLabels },
      favorites: symbol.favorites,
      customSymbols: useCustomSymbolStore.getState().symbols,
    }),
  ) as Omit<SettingsRecord, 'version'>;
}
function applySettings(data: SettingsRecord) {
  muted = true;
  // 只接收数据字段，不允许服务器字典覆盖 Zustand 的操作函数。
  const defaults = usePreferencesStore.getInitialState();
  const preferences = Object.fromEntries(
    Object.entries(defaults)
      .filter(([, value]) => typeof value !== 'function')
      .map(([key, value]) => [
        key,
        typeof data.preferences?.[key] === typeof value ? data.preferences[key] : value,
      ]),
  );
  usePreferencesStore.setState(preferences);
  useSymbolStore.setState({
    symbolMode: data.symbol?.symbolMode === 'extended' ? 'extended' : 'standard',
    symbolDefaults: normalizeSymbolDefaults(data.symbol?.symbolDefaults),
    favorites: data.favorites ?? [],
  });
  useCustomSymbolStore.setState({ symbols: data.customSymbols ?? [] });
  const viewDefaults = useViewStore.getInitialState();
  const view = data.view ?? {};
  useViewStore.setState({
    baseMap:
      typeof view.baseMap === 'string'
        ? (view.baseMap as typeof viewDefaults.baseMap)
        : viewDefaults.baseMap,
    grid:
      typeof view.grid === 'string' ? (view.grid as typeof viewDefaults.grid) : viewDefaults.grid,
    gridLabels: typeof view.gridLabels === 'boolean' ? view.gridLabels : viewDefaults.gridLabels,
  });
  useBackendStore.setState({ settingsVersion: data.version });
  muted = false;
}
function install(project: SavedProject) {
  muted = true;
  useAccessStore.getState().setReadOnly(false);
  useDocumentStore.getState().replaceDocument(project.document);
  useDocumentStore.setState({ past: [], future: [] });
  useSessionStore.getState().discardRestore();
  useBackendStore.setState({
    projectId: project.id,
    revision: project.revision,
    dirty: false,
    projectConflict: false,
  });
  store(cacheKey(), project);
  rememberConnection();
  trySaveDocument(project.document);
  documentDirty = false;
  clientId = newId();
  unlockedLayers.clear();
  muted = false;
}
function remember() {
  if (externalDocument || !documentDirty) return;
  const state = useBackendStore.getState();
  store(pendingKey(), {
    projectId: state.projectId,
    unlockedLayerIds: [...unlockedLayers],
    clientId: clientId || (clientId = newId()),
    revision: state.revision,
    document: committedDocument(),
  } satisfies Pending);
  useBackendStore.setState({ dirty: true });
  trySaveDocument(committedDocument());
}
function rememberSettings() {
  if (settingsDirty)
    store(settingsKey(), {
      version: useBackendStore.getState().settingsVersion,
      settings: bundle(),
    });
}
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => void flushBackend(), 700);
}
function showSettledStatus() {
  const state = useBackendStore.getState();
  const conflict = state.projectConflict || state.settingsConflict;
  useBackendStore.setState({
    status: conflict ? 'conflict' : externalDocument ? 'external' : 'saved',
    message: conflict ? '服务器已有新版本；当前修改已保留。项目可另存副本，偏好可单独处理。' : '',
  });
}
function fail(error: unknown, kind?: 'project' | 'settings') {
  const conflict = error instanceof ApiError && error.status === 409;
  useBackendStore.setState({
    ...(conflict && kind
      ? { [kind === 'project' ? 'projectConflict' : 'settingsConflict']: true }
      : {}),
    status: conflict
      ? 'conflict'
      : error instanceof ApiError && error.status < 500
        ? 'error'
        : 'offline',
    message: error instanceof Error ? error.message : '保存失败',
  });
}
export async function refreshCatalog(signal?: AbortSignal) {
  const params = new URLSearchParams(window.location.search);
  const query = new URLSearchParams();
  for (const key of ['share', 'version']) if (params.has(key)) query.set(key, params.get(key)!);
  const [models, catalog] = await Promise.all([
    api<EquipmentModelDefinition[]>(`/models?${query}`, { signal }),
    api<{ symbol: CatalogEntry[] }>('/catalog', { signal }),
  ]);
  if (signal?.aborted) return;
  const scoped = models.map((model) => {
    if (!query.has('share')) return model;
    const url = (address: string) =>
      address.startsWith('/api/assets/') ? `${address}?${query}` : address;
    return {
      ...model,
      url: url(model.url),
      attachments: model.attachments.map((part) => ({ ...part, url: url(part.url) })),
    };
  });
  registerEquipmentModels(scoped);
  registerCatalog(catalog.symbol);
  useBackendStore.setState((state) => ({ catalogVersion: state.catalogVersion + 1 }));
}
export async function refreshProjects(signal?: AbortSignal) {
  const projects = await api<ProjectSummary[]>('/projects', { signal });
  if (!signal?.aborted) useBackendStore.setState({ projects });
  return projects;
}
function startSubscriptions() {
  stopSubscriptions();
  const stops = [
    useDocumentStore.subscribe((state, prev) => {
      if (
        muted ||
        state.document === prev.document ||
        gestureInProgress() ||
        useAccessStore.getState().readOnly ||
        externalDocument
      )
        return;
      for (const before of prev.document.layers) {
        const after = state.document.layers.find((layer) => layer.id === before.id);
        if (before.locked && (!after || !after.locked)) unlockedLayers.add(before.id);
      }
      documentDirty = true;
      remember();
      schedule();
    }),
  ];
  let previous = JSON.stringify(bundle());
  const settingsChanged = () => {
    const next = JSON.stringify(bundle());
    if (muted) {
      previous = next;
      return;
    }
    if (next === previous) return;
    previous = next;
    settingsDirty = true;
    rememberSettings();
    schedule();
  };
  stops.push(
    usePreferencesStore.subscribe(settingsChanged),
    useSymbolStore.subscribe(settingsChanged),
    useCustomSymbolStore.subscribe(settingsChanged),
    useViewStore.subscribe(settingsChanged),
  );
  stopSubscriptions = () => stops.forEach((stop) => stop());
}
export function initializeBackend(external: boolean, signal: AbortSignal): Promise<boolean> {
  externalDocument = external;
  const current = ++generation;
  const alive = () => current === generation && !signal.aborted;
  if (!initialized) {
    const connection = stored<Connection>('map-army.connection');
    if (connection) useBackendStore.setState(connection);
    if (!external) {
      const cache = stored<SavedProject>(cacheKey());
      const pending = stored<Pending>(pendingKey());
      if (cache) install(cache);
      if (pending?.document) {
        muted = true;
        useDocumentStore.getState().replaceDocument(pending.document);
        muted = false;
        documentDirty = true;
        clientId = pending.clientId || newId();
        for (const id of pending.unlockedLayerIds ?? []) unlockedLayers.add(id);
        useBackendStore.setState({
          projectId: pending.projectId,
          revision: pending.revision,
          dirty: true,
        });
      }
    }
    const profile = stored<PendingSettings>(settingsKey());
    if (profile) {
      applySettings({ ...profile.settings, version: profile.version });
      settingsDirty = true;
    }
    initialized = true;
  }
  startSubscriptions();
  const task = async () => {
    try {
      let owner: { id: string; name: string };
      try {
        owner = await api('/workspace', { signal });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        const token = workspaceCode();
        if (token)
          owner = await api('/workspace/connect', {
            method: 'POST',
            body: JSON.stringify({ token }),
            signal,
          });
        else {
          const created = await api<{ id: string; name: string; token: string }>('/workspaces', {
            method: 'POST',
            body: '{}',
            signal,
          });
          // 即使组件卸载，已创建凭证仍需保存，下一次初始化可连接该空间。
          store('map-army.workspace-code', created.token);
          owner = created;
        }
      }
      if (!alive()) return false;
      const previousOwner = useBackendStore.getState().workspaceId;
      if (previousOwner && previousOwner !== owner.id)
        throw new Error('当前凭证已连接另一工作空间，请导出未保存内容后刷新页面。');
      useBackendStore.setState({ workspaceId: owner.id, workspaceName: owner.name });
      remember();
      rememberSettings();
      rememberConnection();
      const migrationKey = 'map-army.browser-migrated';
      if (!stored(migrationKey)) {
        const cached = loadDocumentResult();
        const id = stored<string>('map-army.browser-id') ?? newId();
        store('map-army.browser-id', id);
        const migrated = await api<{ project?: SavedProject }>('/workspace/migrate', {
          method: 'POST',
          signal,
          body: JSON.stringify({
            sourceKey: 'browser-' + id,
            document:
              !external && !previousOwner && !documentDirty && cached.status === 'loaded'
                ? cached.document
                : undefined,
            settings: bundle(),
          }),
        });
        if (!alive()) return false;
        if (migrated.project) store(legacyKey(), migrated.project);
        store(migrationKey, owner.id);
      }
      const [profile, projects] = await Promise.all([
        api<SettingsRecord>('/workspace/settings', { signal }),
        refreshProjects(signal),
        refreshCatalog(signal),
      ]);
      if (!alive()) return false;
      if (settingsDirty) {
        // 新空间的资料迁移就是这份浏览器快照，可安全采用迁移后的版本号。
        if (
          same(bundle(), {
            preferences: profile.preferences,
            symbol: profile.symbol,
            view: profile.view,
            favorites: profile.favorites,
            customSymbols: profile.customSymbols,
          })
        ) {
          settingsDirty = false;
          applySettings(profile);
          remove(settingsKey());
        } else if (previousOwner && profile.version !== useBackendStore.getState().settingsVersion)
          useBackendStore.setState({ settingsConflict: true });
        else useBackendStore.setState({ settingsVersion: profile.version });
      } else applySettings(profile);
      const legacy = stored<SavedProject>(legacyKey());
      if (!external && legacy && !documentDirty) {
        useSessionStore
          .getState()
          .setPendingRestore({
            document: legacy.document,
            meta: {
              savedAt: legacy.updatedAt,
              appVersion: 'map-army',
              tabId: 'migration',
              featureCount: legacy.document.features.length,
            },
          });
      } else if (!external) {
        const active = useBackendStore.getState().projectId;
        const project =
          projects.find((p) => p.id === active) ?? (!documentDirty ? projects[0] : undefined);
        if (project) {
          const saved = await api<SavedProject>(`/projects/${project.id}`, { signal });
          if (!alive()) return false;
          if (documentDirty) {
            if (saved.revision !== useBackendStore.getState().revision)
              useBackendStore.setState({ projectConflict: true });
          } else install(saved);
        } else if (!documentDirty) {
          documentDirty = true;
        } else if (active) useBackendStore.setState({ projectConflict: true });
      }
      enabled = true;
      showSettledStatus();
      remember();
      rememberSettings();
      rememberConnection();
      remove(pendingKey('unbound'));
      remove(settingsKey('unbound'));
      schedule();
      return true;
    } catch (error) {
      if (alive()) {
        enabled = false;
        fail(error);
        remember();
        rememberSettings();
      }
      return false;
    }
  };
  const promise = task();
  connecting = promise;
  void promise.finally(() => {
    if (connecting === promise) connecting = null;
  });
  return promise;
}
export async function retryBackend() {
  if (!enabled) {
    if (connecting) await connecting;
    else await initializeBackend(externalDocument, new AbortController().signal);
  }
  await flushBackend();
}
export async function flushBackend(): Promise<void> {
  if (writing) {
    await writing;
    return;
  }
  if (!enabled) return;
  const current = generation;
  writing = Promise.resolve().then(async () => {
    let failed = false;
    try {
      if (
        documentDirty &&
        !externalDocument &&
        !useAccessStore.getState().readOnly &&
        !useBackendStore.getState().projectConflict
      ) {
        useBackendStore.setState({ status: 'saving', message: '' });
        const state = useBackendStore.getState();
        const snapshot = committedDocument();
        try {
          const saved = await api<SavedProject>(
            state.projectId ? `/projects/${state.projectId}` : '/projects',
            {
              method: state.projectId ? 'PUT' : 'POST',
              headers: state.projectId ? { 'If-Match': String(state.revision) } : undefined,
              body: JSON.stringify({
                document: snapshot,
                unlockedLayerIds: [...unlockedLayers],
                clientId: clientId || (clientId = newId()),
              }),
            },
          );
          if (current !== generation) return;
          useBackendStore.setState({ projectId: saved.id, revision: saved.revision });
          store(cacheKey(), saved);
          rememberConnection();
          if (
            same(committedDocument(), snapshot) &&
            (state.projectId || same(saved.document, snapshot))
          ) {
            documentDirty = false;
            unlockedLayers.clear();
            // 不替换正在进行的手势或撤销栈；稳定资产地址在下一次打开项目时应用。
            remove(pendingKey());
            useBackendStore.setState({ dirty: false });
          } else remember();
        } catch (error) {
          failed = true;
          fail(error, 'project');
          remember();
        }
      }
      if (settingsDirty && !useBackendStore.getState().settingsConflict && current === generation) {
        const snapshot = bundle();
        const state = useBackendStore.getState();
        try {
          const saved = await api<SettingsRecord>('/workspace/settings', {
            method: 'PUT',
            headers: { 'If-Match': String(state.settingsVersion) },
            body: JSON.stringify(snapshot),
          });
          if (current !== generation) return;
          useBackendStore.setState({ settingsVersion: saved.version });
          rememberConnection();
          if (same(bundle(), snapshot)) {
            settingsDirty = false;
            remove(settingsKey());
          } else rememberSettings();
        } catch (error) {
          failed = true;
          fail(error, 'settings');
          rememberSettings();
        }
      }
      if (!failed && current === generation) showSettledStatus();
    } finally {
      writing = null;
    }
  });
  await writing;
  const state = useBackendStore.getState();
  if (
    ((documentDirty && !state.projectConflict) || (settingsDirty && !state.settingsConflict)) &&
    ['saved', 'external'].includes(state.status)
  )
    schedule();
}
export function stopBackend() {
  generation++;
  enabled = false;
  stopSubscriptions();
  clearTimeout(timer);
}
export function backendAvailable() {
  return enabled && useBackendStore.getState().status !== 'offline';
}
function leaveExternal() {
  externalDocument = false;
  useAccessStore.getState().setShared(null);
  window.history.replaceState(null, '', window.location.pathname);
}
async function requireSaved() {
  await retryBackend();
  if (!enabled || documentDirty || settingsDirty)
    throw new Error('当前修改尚未保存，请先重试、处理偏好冲突或将项目另存副本。');
}
export async function openProject(id: string) {
  await requireSaved();
  const project = await api<SavedProject>(`/projects/${id}`);
  leaveExternal();
  install(project);
  showSettledStatus();
  await refreshCatalog();
}
export async function saveAsProject(name?: string) {
  if (writing) await writing;
  const document = { ...committedDocument(), name: name ?? committedDocument().name + ' 副本' };
  const saved = await api<SavedProject>(`/projects${window.location.search}`, {
    method: 'POST',
    body: JSON.stringify({ document }),
  });
  remove(pendingKey());
  leaveExternal();
  install(saved);
  showSettledStatus();
  await refreshProjects();
  await refreshCatalog();
}
export async function newProject(name: string) {
  await requireSaved();
  const saved = await api<SavedProject>('/projects', {
    method: 'POST',
    body: JSON.stringify({ document: createDocument(name) }),
  });
  leaveExternal();
  install(saved);
  showSettledStatus();
  await refreshProjects();
  await refreshCatalog();
}
export async function reloadServerProject() {
  if (writing) await writing;
  if (documentDirty) throw new Error('请先将当前修改保存为副本，再加载服务器版本。');
  const state = useBackendStore.getState();
  if (state.projectId) install(await api<SavedProject>(`/projects/${state.projectId}`));
  showSettledStatus();
}
export async function resolveSettingsConflict(choice: 'local' | 'server') {
  if (writing) await writing;
  const profile = await api<SettingsRecord>('/workspace/settings');
  if (choice === 'server') {
    applySettings(profile);
    settingsDirty = false;
    remove(settingsKey());
  } else {
    useBackendStore.setState({ settingsVersion: profile.version });
    settingsDirty = true;
    rememberSettings();
  }
  useBackendStore.setState({ settingsConflict: false });
  rememberConnection();
  showSettledStatus();
  await flushBackend();
}
export async function connectWorkspace(token: string) {
  await requireSaved();
  await api('/workspace/connect', { method: 'POST', body: JSON.stringify({ token }) });
  store('map-army.workspace-code', token);
  remove('map-army.connection');
  // 显式换空间时禁止把旧空间的缓存再次当作首次浏览器数据迁移。
  store('map-army.browser-migrated', true);
  window.location.assign(window.location.pathname);
}
/** 旧浏览器会话仍由用户决定是否打开，迁移不会用空文档覆盖原项目。 */
export function restoreLegacyProject() {
  const legacy = stored<SavedProject>(legacyKey());
  if (!legacy) return false;
  remove(legacyKey());
  install(legacy);
  showSettledStatus();
  return true;
}
export function discardLegacyProject() {
  const legacy = stored<SavedProject>(legacyKey());
  if (!legacy) return;
  remove(legacyKey());
  useBackendStore.setState({ projectId: null, revision: 0 });
  documentDirty = true;
  remember();
  schedule();
}
export function workspaceCode() {
  return stored<string>('map-army.workspace-code') ?? '';
}
