/** 工作空间、项目与资产共用管理入口；失败时保留当前编辑内容。 */
import { useEffect, useState } from 'react';
import { api, uploadAsset, type AssetRecord } from '@/core/backend/api';
import {
  connectWorkspace,
  flushBackend,
  retryBackend,
  resolveSettingsConflict,
  newProject,
  openProject,
  refreshCatalog,
  refreshProjects,
  reloadServerProject,
  saveAsProject,
  workspaceCode,
  listLocalDrafts,
  restoreLocalDraft,
} from '@/core/backend/sync';
import { useBackendStore } from '@/stores/useBackendStore';
import { listEquipmentModels, type EquipmentModelDefinition } from '@/core/model/equipment3d';
import './workspace.css';

interface ModelJob {
  id: string;
  name: string;
  status: string;
  error?: string;
  result?: EquipmentModelDefinition;
}
export function WorkspacePanel({ onClose }: { onClose(): void }) {
  const state = useBackendStore();
  const [tab, setTab] = useState<'projects' | 'models' | 'assets' | 'access'>('projects');
  const [name, setName] = useState('新项目');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [jobs, setJobs] = useState<ModelJob[]>([]);
  const [deleting, setDeleting] = useState('');
  const [editing, setEditing] = useState<EquipmentModelDefinition | null>(null);
  const [historyProjectId, setHistoryProjectId] = useState<string | null>(null);
  const [versions, setVersions] = useState<{ revision: number; name: string; createdAt: number }[]>(
    [],
  );
  const refresh = async () => {
    const [, files, tasks] = await Promise.all([
      refreshProjects(),
      api<AssetRecord[]>('/assets'),
      api<ModelJob[]>('/model-imports'),
    ]);
    setAssets(files);
    setJobs(tasks);
  };
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [, files, tasks] = await Promise.all([
          refreshProjects(),
          api<AssetRecord[]>('/assets'),
          api<ModelJob[]>('/model-imports'),
        ]);
        if (!cancelled) {
          setAssets(files);
          setJobs(tasks);
          await refreshCatalog();
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : '加载失败');
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  const allModels = listEquipmentModels();
  const latestModels = [...new Map(allModels.map((model) => [model.id, model])).values()];
  const anchors = latestModels.filter((model) => model.hasAttachmentAnchor);
  const drafts = listLocalDrafts();

  return (
    <div className="modal-backdrop">
      <section
        className="app-dialog workspace-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="工作空间"
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape' && !busy) onClose();
        }}
      >
        <div className="panel-header">
          {state.workspaceName || '工作空间'}
          <button onClick={onClose} disabled={busy} aria-label="关闭工作空间">
            ×
          </button>
        </div>
        <div className="panel-body">
          <nav className="workspace-tabs" aria-label="工作空间功能">
            {(
              [
                ['projects', '项目'],
                ['models', '模型库'],
                ['assets', '文件资产'],
                ['access', '连接工作空间'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>
          {message && <p role="alert">{message}</p>}
          {state.settingsConflict && (
            <div role="alert">
              <p>偏好、收藏或自定义军标有并发修改，请选择保留哪一份。</p>
              <button
                disabled={busy}
                onClick={() => void run(() => resolveSettingsConflict('local'))}
              >
                用本地资料更新服务器
              </button>
              <button
                disabled={busy}
                onClick={() => void run(() => resolveSettingsConflict('server'))}
              >
                放弃本地资料，加载服务器资料
              </button>
            </div>
          )}
          {tab === 'projects' && (
            <>
              <label className="field">
                项目名称
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <div className="workspace-actions">
                <button
                  disabled={busy || !name.trim()}
                  onClick={() => void run(() => newProject(name))}
                >
                  新建项目
                </button>
                <button
                  disabled={busy}
                  onClick={() => void run(() => saveAsProject(name || undefined))}
                >
                  当前标图另存为项目
                </button>
                <button disabled={busy} onClick={() => void run(retryBackend)}>
                  立即保存
                </button>
              </div>
              <ul className="workspace-list">
                {drafts.map((draft) => (
                  <li key={draft.key}>
                    <span>{draft.name} · 本机未同步草稿</span>
                    <button
                      disabled={busy}
                      onClick={() => void run(async () => restoreLocalDraft(draft.key))}
                    >
                      恢复草稿
                    </button>
                  </li>
                ))}
                {state.projects.map((project) => (
                  <li key={project.id}>
                    <div>
                      <strong>{project.name}</strong>
                      <small>
                        版本 {project.revision}
                        {state.projectId === project.id ? ' · 当前项目' : ''}
                      </small>
                    </div>
                    <button disabled={busy} onClick={() => void run(() => openProject(project.id))}>
                      打开
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await openProject(project.id);
                          setVersions(await api(`/projects/${project.id}/versions`));
                          setHistoryProjectId(project.id);
                        })
                      }
                    >
                      历史
                    </button>
                    {state.projectId !== project.id && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (deleting !== project.id) {
                            setDeleting(project.id);
                            return;
                          }
                          void run(() =>
                            api(`/projects/${project.id}`, {
                              method: 'DELETE',
                              headers: { 'If-Match': String(project.revision) },
                            }),
                          );
                        }}
                      >
                        {deleting === project.id ? '确认删除项目' : '删除'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {versions.length > 0 && historyProjectId === state.projectId && (
                <details open>
                  <summary>当前项目历史</summary>
                  <ul>
                    {versions.map((version) => (
                      <li key={version.revision}>
                        版本 {version.revision} · {version.name}{' '}
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await flushBackend();
                              if (useBackendStore.getState().dirty)
                                throw new Error('请先保存当前修改。');
                              const current = useBackendStore.getState();
                              await api(
                                `/projects/${current.projectId}/versions/${version.revision}/restore`,
                                {
                                  method: 'POST',
                                  headers: { 'If-Match': String(current.revision) },
                                },
                              );
                              await reloadServerProject();
                            })
                          }
                        >
                          恢复为新版本
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
          {tab === 'models' && (
            <>
              <p>内置模型可直接在军标详情中选择。自定义模型入库后，也会出现在同一目录。</p>
              <label className="field">
                添加自定义模型
                <input
                  type="file"
                  accept=".glb,.obj"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    void run(async () => {
                      const source = await uploadAsset(file, file.name, 'model-source');
                      await api('/model-imports', {
                        method: 'POST',
                        body: JSON.stringify({
                          assetId: source.id,
                          name: file.name.replace(/\.[^.]+$/, ''),
                        }),
                      });
                    });
                  }}
                />
              </label>
              <p className="field-hint">
                GLB 应包含贴图；OBJ 导入几何。安装锚点和挂点可随 Blender 导出的 GLB 一起读取。
              </p>
              <ul className="workspace-list">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <span>
                      {job.name} ·{' '}
                      {
                        (
                          {
                            queued: '排队中',
                            running: '处理中',
                            complete: '可用',
                            failed: '失败',
                          } as Record<string, string>
                        )[job.status]
                      }
                      {job.error && <small>{job.error}</small>}
                    </span>
                    {job.status === 'failed' && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(() => api(`/model-imports/${job.id}/retry`, { method: 'POST' }))
                        }
                      >
                        重试
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <ul className="workspace-list">
                {latestModels.map((model) => (
                  <li key={model.id}>
                    <div>
                      <strong>{model.name}</strong>
                      <small>
                        {model.category} · {model.sockets.length} 个挂点
                      </small>
                    </div>
                    {model.source === 'custom' && !model.readOnly && (
                      <button onClick={() => setEditing(structuredClone(model))}>
                        编辑模型资料
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {editing && (
                <fieldset>
                  <legend>模型资料与可视化挂载</legend>
                  <label className="field">
                    名称
                    <input
                      value={editing.name}
                      onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    类型
                    <input
                      value={editing.category}
                      onChange={(event) => setEditing({ ...editing, category: event.target.value })}
                    />
                  </label>
                  {editing.sockets.map((socket) => (
                    <fieldset key={socket.id}>
                      <legend>{socket.name}：允许的部件</legend>
                      {anchors
                        .filter((part) => part.id !== editing.id)
                        .map((part) => (
                          <label key={part.id}>
                            <input
                              type="checkbox"
                              checked={socket.accepts.includes(part.id)}
                              onChange={(event) => {
                                setEditing({
                                  ...editing,
                                  sockets: editing.sockets.map((item) =>
                                    item.id !== socket.id
                                      ? item
                                      : {
                                          ...item,
                                          accepts: event.target.checked
                                            ? [...item.accepts, part.id]
                                            : item.accepts.filter((id) => id !== part.id),
                                        },
                                  ),
                                });
                              }}
                            />
                            {part.name}
                          </label>
                        ))}
                    </fieldset>
                  ))}
                  {!editing.sockets.length && (
                    <p>该模型没有挂点。可在 Blender 中添加安装节点后作为新模型入库。</p>
                  )}
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const accepted = new Set(
                          editing.sockets.flatMap((socket) => socket.accepts),
                        );
                        await api(`/models/${editing.id}/metadata`, {
                          method: 'PUT',
                          body: JSON.stringify({
                            baseVersion: editing.version,
                            name: editing.name,
                            category: editing.category,
                            sockets: editing.sockets,
                            attachments: anchors
                              .filter((part) => accepted.has(part.id))
                              .map((part) => ({ id: part.id, version: part.version })),
                          }),
                        });
                        await refreshCatalog();
                        setEditing(null);
                      })
                    }
                  >
                    保存为新模型版本
                  </button>
                  <button onClick={() => setEditing(null)}>取消</button>
                </fieldset>
              )}
            </>
          )}
          {tab === 'assets' && (
            <>
              <p>原始导入文件、模型、图像和导出成果统一保存。被历史版本引用的文件会保留。</p>
              <ul className="workspace-list">
                {assets.map((asset) => (
                  <li key={asset.id}>
                    <a href={asset.url} target="_blank" rel="noreferrer">
                      {asset.name}
                    </a>
                    <small>
                      {Math.ceil(asset.size / 1024)} KB · {asset.kind}
                    </small>
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (deleting !== asset.id) {
                          setDeleting(asset.id);
                          return;
                        }
                        void run(() => api(`/assets/${asset.id}`, { method: 'DELETE' }));
                      }}
                    >
                      {deleting === asset.id ? '确认删除文件' : '删除'}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {tab === 'access' && (
            <>
              <p>
                在另一设备输入同一访问码，可打开此工作空间。访问码拥有此空间的读写权限，请妥善保存。
              </p>
              <button
                disabled={!workspaceCode()}
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(workspaceCode());
                    setMessage('工作空间访问码已复制。');
                  })
                }
              >
                复制当前访问码
              </button>
              <label className="field">
                工作空间访问码
                <input
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                disabled={busy || !token.trim()}
                onClick={() => void run(() => connectWorkspace(token.trim()))}
              >
                连接
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export function BackendStatus() {
  const state = useBackendStore();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const label = {
    connecting: '正在连接工作空间',
    saved: '已保存到工作空间',
    saving: '正在保存到工作空间',
    offline: '离线 · 可继续编辑',
    conflict: '保存冲突 · 当前修改已保留',
    error: '保存未完成',
    external: '外部标图 · 通过分享更新或另存项目',
  }[state.status];
  return (
    <>
      <div className="session-banner backend-status" role="status" aria-label="工作空间保存状态">
        <span>
          {label}
          {state.message ? `：${state.message}` : ''}
        </span>
        <button onClick={() => setOpen(true)}>工作空间</button>
        {['offline', 'error'].includes(state.status) && (
          <button onClick={() => void retryBackend()}>重试保存</button>
        )}
        {state.status === 'conflict' && (
          <>
            <button onClick={() => void saveAsProject().catch((error) => setError(error.message))}>
              当前修改另存副本
            </button>
            <button
              onClick={() => void reloadServerProject().catch((error) => setError(error.message))}
            >
              加载服务器版本
            </button>
          </>
        )}
        {error && <span role="alert">{error}</span>}
      </div>
      {open && <WorkspacePanel onClose={() => setOpen(false)} />}
    </>
  );
}
