/** 浏览器创作保存完整参数快照；撤销、预览和发布状态分别管理。 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Download, Eye, Plus, Redo2, Save, Trash2, Undo2, Upload, X } from 'lucide-react';
import { api, apiBlob, uploadAsset } from '@/core/backend/api';
import { refreshCatalog } from '@/core/backend/sync';
import { listEquipmentModels, type EquipmentModelDefinition } from '@/core/model/equipment3d';
import { useBackendStore } from '@/stores/useBackendStore';
import { useMoverText } from './moverText';
import { moverPreview } from './moverPreview';
import {
  componentDefaults,
  componentType,
  parameterOptions,
  type Amc,
  type JsonValue,
  type MoverBundle,
  type MoverDesign,
  type MoverEntry,
  type Parameters,
} from './moverTypes';

interface Job {
  id?: string;
  status: string;
  error?: string;
  result?: EquipmentModelDefinition;
}
type History = { present: MoverBundle; past: MoverBundle[]; future: MoverBundle[] };
const empty: MoverBundle = {
  amc: { VehicleType: 'Aircraft', standardTemplate: false, geometry: {} },
  mounts: [],
};

export function MoverCreatorDialog({
  onClose,
  initialModel,
}: {
  onClose(): void;
  initialModel?: EquipmentModelDefinition;
}) {
  const t = useMoverText();
  const workspace = useBackendStore((s) => s.workspaceId);
  const [parents, setParents] = useState<{ id: string; name: string }[]>([]);
  const [catalog, setCatalog] = useState<MoverEntry[]>([]),
    [designs, setDesigns] = useState<MoverDesign[]>([]);
  const [history, setHistory] = useState<History>({ present: empty, past: [], future: [] });
  const bundle = history.present;
  const [design, setDesign] = useState<MoverDesign | null>(null),
    [name, setName] = useState(t('新建三维设计'));
  const [saved, setSaved] = useState(''),
    [selected, setSelected] = useState(''),
    [search, setSearch] = useState('');
  const [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(!!initialModel);
  const [wire, setWire] = useState(false),
    [mode, setMode] = useState<'translate' | 'rotate'>('translate');
  const [job, setJob] = useState<Job | null>(null),
    [revision, setRevision] = useState('');
  const [category, setCategory] = useState(t('航空器')),
    [newType, setNewType] = useState('GeometryBody');
  const [discard, setDiscard] = useState(false),
    [retry, setRetry] = useState(0);
  const host = useRef<HTMLDivElement>(null),
    preview = useRef<ReturnType<typeof moverPreview> | null>(null);
  const current = useRef(bundle),
    latestName = useRef(name);
  current.current = bundle;
  latestName.current = name;
  const dirty = JSON.stringify({ name, bundle }) !== saved;
  const draftKey = 'map-army.mover-draft.' + workspace;
  const [draft, setDraft] = useState<{
    name: string;
    bundle: MoverBundle;
    design: MoverDesign | null;
  } | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(draftKey) ?? 'null');
    } catch {
      return null;
    }
  });
  const change = (next: MoverBundle) => {
    setHistory((h) => ({ present: next, past: [...h.past, h.present].slice(-60), future: [] }));
    setDiscard(false);
  };
  const fail = useCallback(
    (e: unknown) => setError(e instanceof Error ? t(e.message) : t('操作失败')),
    [t],
  );
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const install = (next: MoverBundle, label: string, savedDesign: MoverDesign | null = null) => {
    setHistory({ present: next, past: [], future: [] });
    setName(label);
    setDesign(savedDesign);
    setSelected('');
    setSaved(savedDesign ? JSON.stringify({ name: label, bundle: next }) : '');
    setJob(null);
    setRevision('');
    preview.current?.reset();
  };
  const undo = () =>
    setHistory((h) =>
      h.past.length
        ? {
            present: h.past[h.past.length - 1],
            past: h.past.slice(0, -1),
            future: [h.present, ...h.future],
          }
        : h,
    );
  const redo = () =>
    setHistory((h) =>
      h.future.length
        ? { present: h.future[0], past: [...h.past, h.present], future: h.future.slice(1) }
        : h,
    );

  useEffect(() => {
    let alive = true;
    void Promise.all([api<MoverEntry[]>('/mover/catalog'), api<MoverDesign[]>('/mover/designs')])
      .then(([entries, items]) => {
        if (!alive) return;
        setCatalog(entries);
        setDesigns(items);
      })
      .catch(fail);
    if (initialModel)
      void api<MoverBundle>(
        `/mover/from-model/${encodeURIComponent(initialModel.id)}/${encodeURIComponent(initialModel.version)}`,
      )
        .then((data) => {
          if (!alive) return;
          install(data, initialModel.name + t(' 副本'));
          setCategory(initialModel.category);
        })
        .catch((e) => {
          if (alive) fail(e);
        })
        .finally(() => {
          if (alive) setBusy(false);
        });
    return () => {
      alive = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!host.current) return;
    try {
      preview.current = moverPreview(
        host.current,
        setSelected,
        (mount) => {
          change({
            ...current.current,
            mounts: current.current.mounts.map((m) => (m.id === mount.id ? mount : m)),
          });
        },
        fail,
        setParents,
      );
      return () => {
        preview.current?.dispose();
        preview.current = null;
      };
    } catch (e) {
      fail(e);
    }
  }, [retry, fail]);
  useEffect(() => {
    preview.current?.select(selected);
  }, [selected, retry]);
  useEffect(() => {
    preview.current?.mounts(bundle.mounts);
  }, [bundle.mounts, retry]);
  useEffect(() => {
    preview.current?.wire(wire);
  }, [wire, retry]);
  useEffect(() => {
    preview.current?.mode(mode);
  }, [mode, retry]);
  useEffect(() => {
    if (!bundle.assetId && !Object.keys(bundle.amc?.geometry ?? {}).length) {
      preview.current?.reset();
      setStatus('');
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus(t('正在更新三维预览…'));
      void apiBlob('/mover/preview', {
        method: 'POST',
        body: JSON.stringify(bundle),
        signal: controller.signal,
      })
        .then(async (blob) => {
          if (controller.signal.aborted) return;
          await preview.current?.load(blob, controller.signal, bundle.transform);
          if (!controller.signal.aborted) {
            setStatus(t('三维预览已更新'));
            setError('');
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            fail(e);
            setStatus(t('保留上一次有效预览'));
          }
        });
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [bundle, retry, fail, t]);
  useEffect(() => {
    if (dirty && (bundle.assetId || Object.keys(bundle.amc?.geometry ?? {}).length)) {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({ name, bundle, design }));
      } catch {
        /* 存储配额不足时仍保留当前内存草稿。 */
      }
    }
  }, [bundle, name, design, draftKey, dirty]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!job?.id || ['complete', 'failed'].includes(job.status)) return;
    let alive = true;
    const timer = setInterval(() => {
      void api<Job[]>('/model-imports')
        .then((items) => {
          const next = items.find((j) => j.id === job.id);
          if (alive && next) {
            setJob(next);
            if (next.status === 'complete') void refreshCatalog();
          }
        })
        .catch(fail);
    }, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [job, fail]);

  const save = async (copy = false) => {
    const snapshot = current.current,
      label = latestName.current;
    const next = await api<MoverDesign>(
      design && !copy ? `/mover/designs/${design.id}` : '/mover/designs',
      {
        method: design && !copy ? 'PUT' : 'POST',
        headers: design && !copy ? { 'If-Match': String(design.headRevision) } : undefined,
        body: JSON.stringify({ name: label, bundle: snapshot }),
      },
    );
    setDesign(next);
    setHistory((h) => (h.present === snapshot ? { ...h, present: next.bundle } : h));
    setSaved(JSON.stringify({ name: label, bundle: next.bundle }));
    setStatus(t('已保存版本') + ' ' + next.revision);
    setDesigns(await api('/mover/designs'));
    if (
      latestName.current === label &&
      (current.current === snapshot ||
        JSON.stringify(current.current) === JSON.stringify(next.bundle))
    ) {
      sessionStorage.removeItem(draftKey);
      setDraft(null);
    }
    return next;
  };
  const derive = async (id: string) => {
    const amc = await api<Amc>(`/mover/templates/vehicle/${encodeURIComponent(id)}`);
    amc.standardTemplate = false;
    amc.inheritedFileName = amc.fileName ?? '';
    install({ amc, mounts: [] }, id + t(' 自定义'));
    setCategory(amc.VehicleType === 'Weapon' ? t('外挂部件') : t('航空器'));
  };
  const componentId = selected.split('::')[0];
  const component = bundle.amc?.geometry[componentId],
    mount = bundle.mounts.find((m) => '@' + m.id === selected);
  const putComponent = (g: Parameters) => {
    if (bundle.amc)
      change({
        ...bundle,
        amc: { ...bundle.amc, geometry: { ...bundle.amc.geometry, [componentId]: g } },
      });
  };
  const rename = (next: string) => {
    if (
      !bundle.amc ||
      !component ||
      component['May Not Be Deleted'] ||
      !next.trim() ||
      next === componentId
    )
      return;
    if (bundle.amc.geometry[next]) {
      setError(t('组件名称已存在'));
      return;
    }
    const geometry = { ...bundle.amc.geometry };
    delete geometry[componentId];
    geometry[next] = component;
    change({
      ...bundle,
      amc: { ...bundle.amc, geometry },
      mounts: bundle.mounts.map((m) =>
        m.parent?.startsWith(componentId + '::')
          ? { ...m, parent: next + m.parent.slice(componentId.length) }
          : m,
      ),
    });
    setSelected(next);
  };
  const addComponent = (copy = false) => {
    if (!bundle.amc || (copy && !component)) return;
    if (!copy && newType === 'GeometryLandingGear' && bundle.amc.VehicleType !== 'Aircraft') return;
    let key = copy ? componentId + t(' 副本') : newType.replace('Geometry', '');
    while (bundle.amc.geometry[key]) key += ' 1';
    const g: Parameters =
      copy && component
        ? structuredClone(component)
        : {
            ...structuredClone(componentDefaults[newType]),
            GeometryObjectType: newType,
            'Reference Point': { x: 0, y: 0, z: 0 },
          };
    g['May Not Be Deleted'] = false;
    change({ ...bundle, amc: { ...bundle.amc, geometry: { ...bundle.amc.geometry, [key]: g } } });
    setSelected(key);
  };
  const remove = () => {
    if (mount) {
      change({
        ...bundle,
        mounts: bundle.mounts.filter((m) => m.id !== mount.id),
        assembly: bundle.assembly?.filter((a) => a.socketId !== mount.id),
      });
      setSelected('');
    } else if (bundle.amc && component && !component['May Not Be Deleted']) {
      const geometry = { ...bundle.amc.geometry };
      delete geometry[componentId];
      const removed = bundle.mounts
        .filter((m) => m.parent?.startsWith(componentId + '::'))
        .map((m) => m.id);
      change({
        ...bundle,
        amc: { ...bundle.amc, geometry },
        mounts: bundle.mounts.filter((m) => !removed.includes(m.id)),
        assembly: bundle.assembly?.filter((a) => !removed.includes(a.socketId)),
      });
      setSelected('');
    }
  };
  const addMount = (role: 'socket' | 'anchor') => {
    const id = crypto.randomUUID();
    change({
      ...bundle,
      mounts: [
        ...bundle.mounts,
        {
          id,
          name: role === 'socket' ? t('新挂点') : t('安装锚点'),
          role,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          accepts: [],
        },
      ],
    });
    setSelected('@' + id);
  };
  const close = () => {
    if (dirty && !discard) {
      setDiscard(true);
      return;
    }
    onClose();
  };
  const parts = listEquipmentModels().filter((m) => m.hasAttachmentAnchor);
  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div
      className="modal-backdrop mover-backdrop"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (
          (e.ctrlKey || e.metaKey) &&
          e.key.toLowerCase() === 'z' &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement)
        ) {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        }
        if (e.key === 'Escape') close();
      }}
    >
      <section
        className="app-dialog mover-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Mover Creator"
        aria-busy={busy}
        inert={busy}
      >
        <header className="panel-header">
          <span>{t('AFSIM Mover Creator · 三维建模')}</span>
          <button title={t('关闭编辑器')} aria-label={t('关闭编辑器')} onClick={close}>
            <X size={18} />
          </button>
        </header>
        <div className="mover-toolbar">
          <input
            aria-label={t('设计名称')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <span>
            {design ? t('版本') + ' ' + design.revision : t('新设计')}
            {dirty ? t(' · 未保存') : ''}
          </span>
          <button
            title={t('撤销')}
            aria-label={t('撤销')}
            disabled={!history.past.length || busy}
            onClick={undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            title={t('重做')}
            aria-label={t('重做')}
            disabled={!history.future.length || busy}
            onClick={redo}
          >
            <Redo2 size={17} />
          </button>
          <button
            disabled={busy || !name.trim()}
            onClick={() =>
              void run(async () => {
                await save();
              })
            }
          >
            <Save size={16} />
            {t('保存版本')}
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await save(true);
              })
            }
          >
            <Copy size={16} />
            {t('另存副本')}
          </button>
          <input
            aria-label={t('模型分类')}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <button
            disabled={busy || !category.trim()}
            onClick={() =>
              void run(async () => {
                const savedDesign = dirty || !design ? await save() : design;
                setJob(
                  await api(`/mover/designs/${savedDesign.id}/publish`, {
                    method: 'POST',
                    body: JSON.stringify({ revision: savedDesign.revision, category }),
                  }),
                );
              })
            }
          >
            <Upload size={16} />
            {t('发布到模型库')}
          </button>
        </div>
        {discard && (
          <div className="mover-notice">
            {t('当前修改尚未保存，刷新恢复草稿已保留。')}
            <button
              onClick={() =>
                void run(async () => {
                  await save();
                  onClose();
                })
              }
            >
              {t('保存后关闭')}
            </button>
            <button onClick={onClose}>{t('关闭并保留草稿')}</button>
            <button onClick={() => setDiscard(false)}>{t('继续编辑')}</button>
          </div>
        )}
        {draft && (
          <div className="mover-notice">
            {t('发现未保存的三维草稿：')}
            {draft.name}
            <button
              onClick={() => {
                install(draft.bundle, draft.name, draft.design);
                setSaved('');
                setDraft(null);
              }}
            >
              {t('恢复草稿')}
            </button>
            <button
              onClick={() => {
                setDraft(null);
                sessionStorage.removeItem(draftKey);
              }}
            >
              {t('忽略提示')}
            </button>
          </div>
        )}
        <div className="mover-layout" inert={busy}>
          <aside className="mover-library">
            <h3>
              {t('内置模板 ·')}
              {catalog.filter((e) => e.kind === 'vehicle').length}
            </h3>
            <input
              aria-label={t('搜索三维模板')}
              placeholder={t('搜索模板名称')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="mover-template-list">
              {catalog
                .filter(
                  (e) => e.kind === 'vehicle' && e.id.toLowerCase().includes(search.toLowerCase()),
                )
                .map((e) => (
                  <button
                    key={e.id}
                    disabled={busy}
                    title={e.path}
                    onClick={() =>
                      void run(async () => {
                        if (
                          dirty &&
                          (bundle.assetId || Object.keys(bundle.amc?.geometry ?? {}).length)
                        )
                          await save();
                        await derive(e.id);
                      })
                    }
                  >
                    <strong>{e.id}</strong>
                    <small>{e.path.split('/').at(-2)}</small>
                  </button>
                ))}
            </div>
            <p>
              {catalog.filter((e) => e.kind === 'engine').length}
              {t('个发动机 ·')} {catalog.filter((e) => e.kind === 'airfoil').length}
              {t('份翼型数据')}
            </p>
            <label className="field">
              {t('导入 AMC / 依赖 ZIP / GLB')}
              <input
                aria-label={t('导入三维设计')}
                type="file"
                accept=".amc,.zip,.glb"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  void run(async () => {
                    if (dirty && (bundle.assetId || Object.keys(bundle.amc?.geometry ?? {}).length))
                      await save();
                    if (file.name.toLowerCase().endsWith('.glb')) {
                      const asset = await uploadAsset(file, file.name, 'model-source');
                      const imported = await api<MoverBundle>('/mover/from-asset/' + asset.id);
                      install(imported, file.name.replace(/\.glb$/i, ''));
                    } else {
                      const form = new FormData();
                      form.append('file', file);
                      install(
                        await api('/mover/import', { method: 'POST', body: form }),
                        file.name.replace(/\.[^.]+$/, ''),
                      );
                    }
                  });
                }}
              />
            </label>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (dirty && (bundle.assetId || Object.keys(bundle.amc?.geometry ?? {}).length))
                    await save();
                  install(structuredClone(empty), t('新建三维设计'));
                })
              }
            >
              <Plus size={16} />
              {t('空白设计')}
            </button>
            <h3>{t('已保存设计')}</h3>
            <select
              aria-label={t('打开已保存设计')}
              value={design?.id ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                if (id)
                  void run(async () => {
                    if (dirty && (bundle.assetId || Object.keys(bundle.amc?.geometry ?? {}).length))
                      await save();
                    const d = await api<MoverDesign>('/mover/designs/' + id);
                    install(d.bundle, d.name, d);
                  });
              }}
            >
              <option value="">{t('选择设计')}</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · v{d.revision}
                </option>
              ))}
            </select>
            {design && (
              <>
                <select
                  aria-label={t('设计历史版本')}
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                >
                  <option value="">{t('历史版本')}</option>
                  {Array.from({ length: design.headRevision }, (_, i) => i + 1)
                    .reverse()
                    .map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                </select>
                <button
                  disabled={!revision || busy}
                  onClick={() =>
                    void run(async () => {
                      const old = await api<MoverDesign>(
                        `/mover/designs/${design.id}?revision=${revision}`,
                      );
                      change(old.bundle);
                      setStatus(t('历史参数已恢复到草稿，保存会创建新版本'));
                    })
                  }
                >
                  {t('恢复历史参数')}
                </button>
              </>
            )}
          </aside>
          <main className="mover-stage">
            <div className="mover-view-tools">
              <button onClick={() => setSelected('')}>{t('整机')}</button>
              <button onClick={() => setWire(!wire)} aria-pressed={wire}>
                {t('线框')}
              </button>
              {(['perspective', 'top', 'side', 'front'] as const).map((v, i) => (
                <button key={v} onClick={() => preview.current?.view(v)}>
                  {[t('适应窗口'), t('俯视'), t('侧视'), t('正视')][i]}
                </button>
              ))}
              <button title={t('重新生成预览')} onClick={() => setRetry(retry + 1)}>
                <Eye size={16} />
              </button>
              <button
                disabled={!selected || selected.startsWith('@')}
                onClick={() => preview.current?.hide(selected)}
              >
                {t('隐藏选中组件')}
              </button>
              <button onClick={() => preview.current?.hide('')}>{t('显示全部组件')}</button>
            </div>
            <div
              className="mover-canvas"
              ref={host}
              onDragOver={(e) => {
                if (mount?.role === 'socket') e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const part = bundle.attachments?.find(
                  (p) => p.id + '/' + p.version === e.dataTransfer.getData('text/plain'),
                );
                if (mount?.role === 'socket' && part && mount.accepts.includes(part.id))
                  change({
                    ...bundle,
                    assembly: [
                      ...(bundle.assembly ?? []).filter((a) => a.socketId !== mount.id),
                      { ...part, socketId: mount.id },
                    ],
                  });
              }}
            />
            <div className="mover-coordinate-note">
              {t('AMC：X 前 / Y 右 / Z 下，英尺、度。挂点：X 前 / Y 上 / Z 右，米、度。')}
              <br />
              {t('下载包含预览挂载；发布保留基体与挂点，详情页可自由装配。')}
            </div>
            <div className="mover-bottom">
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    download(
                      await apiBlob('/mover/preview', {
                        method: 'POST',
                        body: JSON.stringify(bundle),
                      }),
                      name + '.glb',
                    );
                  })
                }
              >
                <Download size={16} />
                {t('下载 GLB')}
              </button>
              <button
                disabled={!bundle.amc || busy}
                onClick={() =>
                  void run(async () => {
                    const d = dirty || !design ? await save() : design;
                    download(
                      await apiBlob(`/mover/designs/${d.id}/export?revision=${d.revision}`),
                      name + '.zip',
                    );
                  })
                }
              >
                <Download size={16} />
                {t('下载 AMC 与依赖')}
              </button>
              <span role="status">{status}</span>
            </div>
            {error && (
              <p className="mover-error" role="alert">
                {error}
              </p>
            )}
            {job && (
              <p role="status">
                {t('发布：')}
                {{
                  queued: t('排队中'),
                  running: t('生成中'),
                  complete: t('已进入模型库'),
                  failed: t('失败'),
                }[job.status] ?? job.status}{' '}
                {job.error}
                {job.status === 'failed' && (
                  <button
                    onClick={() =>
                      void run(async () => {
                        setJob(await api(`/model-imports/${job.id}/retry`, { method: 'POST' }));
                      })
                    }
                  >
                    {t('重试发布')}
                  </button>
                )}
              </p>
            )}
          </main>
          <aside className="mover-properties">
            <h3>{t('组件与挂点')}</h3>
            <label className="field">
              {t('组件实例')}
              <select
                aria-label={t('组件实例')}
                value={parents.some((p) => p.id === selected) ? selected : ''}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">{t('整机')}</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mover-component-tree">
              {Object.entries(bundle.amc?.geometry ?? {}).map(([id, g]) => (
                <button key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>
                  {g['May Not Be Deleted'] ? '● ' : ''}
                  {id}
                  <small>{componentType(g).replace('Geometry', '')}</small>
                </button>
              ))}
              {bundle.mounts.map((m) => (
                <button
                  key={m.id}
                  aria-pressed={selected === '@' + m.id}
                  onClick={() => setSelected('@' + m.id)}
                >
                  {m.role === 'anchor' ? '⚓ ' : '＋ '}
                  {m.name}
                </button>
              ))}
            </div>
            {bundle.amc && (
              <div className="mover-component-actions">
                <select
                  aria-label={t('新增组件类型')}
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                >
                  {Object.keys(componentDefaults).map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <button
                  title={t('增加组件')}
                  aria-label={t('增加组件')}
                  onClick={() => addComponent()}
                >
                  <Plus size={16} />
                </button>
                <button
                  title={t('复制组件')}
                  aria-label={t('复制组件')}
                  disabled={!component}
                  onClick={() => addComponent(true)}
                >
                  <Copy size={16} />
                </button>
              </div>
            )}
            <div className="mover-component-actions">
              <button onClick={() => addMount('socket')}>{t('增加挂点')}</button>
              <button
                disabled={bundle.mounts.some((m) => m.role === 'anchor')}
                onClick={() => addMount('anchor')}
              >
                {t('增加安装锚点')}
              </button>
              <button
                title={t('删除选中组件或挂点')}
                aria-label={t('删除选中组件或挂点')}
                disabled={(!mount && !component) || !!component?.['May Not Be Deleted']}
                onClick={remove}
              >
                <Trash2 size={16} />
              </button>
            </div>
            {component && (
              <>
                <label className="field">
                  {t('组件名称')}
                  <input
                    key={selected}
                    defaultValue={componentId}
                    disabled={!!component['May Not Be Deleted']}
                    onBlur={(e) => rename(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') rename(e.currentTarget.value);
                    }}
                  />
                </label>
                <ParametersEditor
                  value={component}
                  onChange={putComponent}
                  catalog={[
                    ...catalog,
                    ...Object.entries(bundle.dependencies?.engine ?? {}).map(([id, value]) => ({
                      id,
                      kind: 'engine' as const,
                      path: 'Engines/' + value.engine_type + '/' + id,
                      assetId: '',
                    })),
                    ...Object.keys(bundle.dependencies?.airfoil ?? {}).map((id) => ({
                      id,
                      kind: 'airfoil' as const,
                      path: id,
                      assetId: '',
                    })),
                  ].filter(
                    (entry, index, all) =>
                      all.findIndex((e) => e.kind === entry.kind && e.id === entry.id) === index,
                  )}
                  fixed={!!component['Symmetry Cannot Be Changed']}
                />
              </>
            )}
            {mount && (
              <>
                <label className="field">
                  {t('挂点名称')}
                  <input
                    value={mount.name}
                    onChange={(e) =>
                      change({
                        ...bundle,
                        mounts: bundle.mounts.map((m) =>
                          m.id === mount.id ? { ...m, name: e.target.value } : m,
                        ),
                      })
                    }
                  />
                </label>
                <label className="field">
                  {t('父组件')}
                  <select
                    aria-label={t('父组件')}
                    value={mount.parent ?? ''}
                    onChange={(e) => {
                      const updated = preview.current?.reparent(mount, e.target.value);
                      if (updated)
                        change({
                          ...bundle,
                          mounts: bundle.mounts.map((m) => (m.id === mount.id ? updated : m)),
                        });
                    }}
                  >
                    <option value="">{t('整机')}</option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mover-component-actions">
                  <button aria-pressed={mode === 'translate'} onClick={() => setMode('translate')}>
                    {t('拖动位置')}
                  </button>
                  <button aria-pressed={mode === 'rotate'} onClick={() => setMode('rotate')}>
                    {t('拖动方向')}
                  </button>
                </div>
                {(['position', 'rotation', 'scale'] as const).map((field) => (
                  <fieldset key={field}>
                    <legend>
                      {field === 'position'
                        ? t('位置（米）')
                        : field === 'rotation'
                          ? t('方向（度）')
                          : t('缩放')}
                    </legend>
                    {(mount[field] ?? [1, 1, 1]).map((v, i) => (
                      <label key={i}>
                        {['X', 'Y', 'Z'][i]}
                        <input
                          type="number"
                          step="any"
                          value={v}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const next = structuredClone(mount);
                            next[field] ??= [1, 1, 1];
                            next[field][i] = Number(e.target.value);
                            change({
                              ...bundle,
                              mounts: bundle.mounts.map((m) => (m.id === mount.id ? next : m)),
                            });
                          }}
                        />
                      </label>
                    ))}
                  </fieldset>
                ))}
                {mount.role === 'socket' && (
                  <fieldset>
                    <legend>{t('允许挂载的部件版本')}</legend>
                    {parts.map((p) => (
                      <label
                        className="mover-part"
                        key={p.id + '/' + p.version}
                        draggable={mount.accepts.includes(p.id)}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', p.id + '/' + p.version);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            mount.accepts.includes(p.id) &&
                            bundle.attachments?.some(
                              (a) => a.id === p.id && a.version === p.version,
                            )
                          }
                          onChange={(e) => {
                            const accepted = e.target.checked
                              ? [...new Set([...mount.accepts, p.id])]
                              : mount.accepts.filter((id) => id !== p.id);
                            const updated = bundle.mounts.map((m) =>
                              m.id === mount.id ? { ...m, accepts: accepted } : m,
                            );
                            const used = new Set(updated.flatMap((m) => m.accepts));
                            const attachments = [
                              ...(bundle.attachments ?? []).filter(
                                (a) => used.has(a.id) && a.id !== p.id,
                              ),
                              ...(used.has(p.id)
                                ? [
                                    {
                                      id: p.id,
                                      version: e.target.checked
                                        ? p.version
                                        : (bundle.attachments?.find((a) => a.id === p.id)
                                            ?.version ?? p.version),
                                    },
                                  ]
                                : []),
                            ];
                            change({
                              ...bundle,
                              mounts: updated,
                              attachments,
                              assembly: bundle.assembly?.filter(
                                (a) =>
                                  updated
                                    .find((m) => m.id === a.socketId)
                                    ?.accepts.includes(a.id) &&
                                  attachments.some((p) => p.id === a.id && p.version === a.version),
                              ),
                            });
                          }}
                        />
                        {p.name} · {p.version}
                      </label>
                    ))}
                  </fieldset>
                )}
                {mount.role === 'socket' && (
                  <label className="field">
                    {t('装配预览')}
                    <select
                      aria-label={t('装配预览')}
                      value={bundle.assembly?.find((a) => a.socketId === mount.id)?.id ?? ''}
                      onChange={(e) => {
                        const part = bundle.attachments?.find((p) => p.id === e.target.value);
                        change({
                          ...bundle,
                          assembly: [
                            ...(bundle.assembly ?? []).filter((a) => a.socketId !== mount.id),
                            ...(part ? [{ ...part, socketId: mount.id }] : []),
                          ],
                        });
                      }}
                    >
                      <option value="">{t('空')}</option>
                      {(bundle.attachments ?? [])
                        .filter((p) => mount.accepts.includes(p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {parts.find((m) => m.id === p.id && m.version === p.version)?.name ??
                              p.id}{' '}
                            · {p.version}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </>
            )}
            {bundle.amc && (
              <details>
                <summary>{t('AMC 原始字段与依赖')}</summary>
                <p>{t('保留气动、质量、控制等原始数据；本页生成三维几何，不运行性能求解。')}</p>
                <JsonEditor
                  key={design?.id ?? 'top-fields'}
                  value={Object.fromEntries(
                    Object.entries(bundle.amc).filter(([key]) => key !== 'geometry'),
                  )}
                  onApply={(value) => {
                    if (!value || typeof value !== 'object' || Array.isArray(value))
                      throw new Error(t('JSON 格式无效'));
                    change({ ...bundle, amc: { ...value, geometry: bundle.amc!.geometry } });
                  }}
                />
                <JsonEditor
                  key={JSON.stringify(bundle.dependencies)}
                  value={bundle.dependencies ?? {}}
                  onApply={(value) =>
                    change({ ...bundle, dependencies: value as MoverBundle['dependencies'] })
                  }
                />
              </details>
            )}
            {bundle.assetId && (
              <details>
                <summary>
                  GLB · {t('位置（米）')} / {t('方向（度）')} / {t('缩放')}
                </summary>
                <JsonEditor
                  value={
                    bundle.transform ?? {
                      position: [0, 0, 0],
                      rotation: [0, 0, 0],
                      scale: [1, 1, 1],
                    }
                  }
                  onApply={(value) =>
                    change({ ...bundle, transform: value as MoverBundle['transform'] })
                  }
                />
              </details>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

function ParametersEditor({
  value,
  onChange,
  catalog,
  fixed = false,
}: {
  value: Parameters;
  onChange(value: Parameters): void;
  catalog: MoverEntry[];
  fixed?: boolean;
}) {
  const immutable = ['GeometryObjectType', 'May Not Be Deleted', 'Symmetry Cannot Be Changed'];
  return (
    <div className="mover-parameters">
      {Object.entries(value)
        .filter(([key]) => !immutable.includes(key))
        .map(([key, v]) => {
          const update = (next: JsonValue) => onChange({ ...value, [key]: next });
          if (v !== null && typeof v === 'object' && !Array.isArray(v))
            return (
              <fieldset key={key}>
                <legend>{key}</legend>
                <ParametersEditor value={v} onChange={update} catalog={catalog} />
              </fieldset>
            );
          let options = parameterOptions[key];
          if (key === 'Symmetry Type' && componentType(value) === 'GeometrySpeedBrake')
            options = ['Single', 'Horizontal', 'Vertical'];
          if (key === 'Quad Control Fins Pattern') options = ['X Pattern', '+ Pattern'];
          if (key === 'Airfoil')
            options = catalog.filter((e) => e.kind === 'airfoil').map((e) => e.id);
          if (key === 'EngineModel')
            options = catalog.filter((e) => e.kind === 'engine').map((e) => e.id);
          if (options)
            return (
              <label className="field" key={key}>
                {key}
                <select
                  disabled={key === 'Symmetry Type' && fixed}
                  value={String(v)}
                  onChange={(e) => {
                    const next = { ...value, [key]: e.target.value };
                    if (key === 'Quad Control Fins Pattern') {
                      next['Symmetry Type'] = e.target.value;
                      next['Quad Control Fins'] = true;
                    }
                    if (key === 'EngineModel') {
                      const entry = catalog.find(
                        (c) => c.kind === 'engine' && c.id === e.target.value,
                      );
                      if (entry) next.EngineType = entry.path.split('/')[1];
                    }
                    if (key === 'Symmetry Type' && 'Quad Control Fins' in next) {
                      next['Quad Control Fins'] = ['X Pattern', '+ Pattern'].includes(
                        e.target.value,
                      );
                      if (next['Quad Control Fins'])
                        next['Quad Control Fins Pattern'] = e.target.value;
                    }
                    onChange(next);
                  }}
                >
                  {!options.includes(String(v)) && <option>{String(v)}</option>}
                  {options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            );
          if (typeof v === 'boolean')
            return (
              <label className="mover-checkbox" key={key}>
                <input
                  type="checkbox"
                  checked={v}
                  onChange={(e) => {
                    if (key === 'Quad Control Fins')
                      onChange({
                        ...value,
                        [key]: e.target.checked,
                        'Symmetry Type': e.target.checked
                          ? String(value['Quad Control Fins Pattern'] || 'X Pattern')
                          : 'Single',
                      });
                    else update(e.target.checked);
                  }}
                />
                {key}
              </label>
            );
          if (typeof v === 'number')
            return (
              <label className="field" key={key}>
                {key}
                <input
                  type="number"
                  step="any"
                  value={v}
                  onChange={(e) => {
                    if (e.target.value && Number.isFinite(Number(e.target.value)))
                      update(Number(e.target.value));
                  }}
                />
              </label>
            );
          if (typeof v === 'string')
            return (
              <label className="field" key={key}>
                {key}
                <input value={v} onChange={(e) => update(e.target.value)} />
              </label>
            );
          return (
            <details key={key}>
              <summary>{key}</summary>
              <JsonEditor value={v} onApply={update} />
            </details>
          );
        })}
    </div>
  );
}
function JsonEditor({ value, onApply }: { value: unknown; onApply(value: JsonValue): void }) {
  const t = useMoverText();
  const [text, setText] = useState(JSON.stringify(value, null, 2)),
    [error, setError] = useState('');
  const serialized = JSON.stringify(value, null, 2);
  useEffect(() => {
    setText(serialized);
    setError('');
  }, [serialized]);
  return (
    <>
      <textarea
        aria-label={t('JSON 参数')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={() => {
          try {
            onApply(JSON.parse(text));
            setError('');
          } catch {
            setError(t('JSON 格式无效'));
          }
        }}
      >
        {t('应用参数')}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
