/** 分享权限与版本入口。读取地址不含编辑令牌，编辑覆盖必须单独授权。 */
import { useState } from 'react';
import { createShareUrl } from '@/core/io/share';
import { serializeMilxly, deserializeMilxly } from '@/core/io/milxly';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useAccessStore } from '@/stores/useAccessStore';

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'view' | 'copy' | 'edit'>('view');
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [inline, setInline] = useState(false);
  const [selected, setSelected] = useState<string[]>(
    useDocumentStore.getState().document.layers.map((l) => l.id),
  );
  const doc = useDocumentStore((s) => s.document);
  const shared = useAccessStore((s) => s.shared);
  const buildUrl = (id: string, token?: string) => {
    const link = new URL(window.location.href);
    link.search = '';
    link.hash = '';
    link.searchParams.set('share', id);
    link.searchParams.set('mode', mode);
    if (mode === 'edit' && token) link.hash = `edit=${token}`;
    return link.toString();
  };
  const create = async () => {
    setBusy(true);
    setMessage('');
    const document = {
      ...doc,
      layers: doc.layers.filter((l) => selected.includes(l.id)),
      features: doc.features.filter((f) => selected.includes(f.layerId)),
    };
    try {
      if (!document.layers.length) throw new Error('请至少选择一个图层');
      if (inline) {
        setUrl(createShareUrl(document, mode === 'view' ? 'view' : 'copy'));
        return;
      }
      const response = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      useAccessStore.getState().setShared(data);
      setUrl(buildUrl(data.id, data.token));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '分享失败');
    } finally {
      setBusy(false);
    }
  };
  const update = async () => {
    if (!shared?.token) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/shares/${shared.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${shared.token}`,
          'If-Match': String(shared.version),
        },
        body: JSON.stringify({ document: doc }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      useAccessStore.getState().setShared({ ...shared, version: result.version });
      setMessage(`已更新至版本 ${result.version}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新失败');
    } finally {
      setBusy(false);
    }
  };
  const reload = async () => {
    if (!shared) return;
    const response = await fetch(`/api/shares/${shared.id}`);
    if (!response.ok) {
      setMessage('读取分享失败');
      return;
    }
    const data = await response.json();
    const loaded = deserializeMilxly(serializeMilxly(data.document));
    const wasReadOnly = useAccessStore.getState().readOnly;
    useAccessStore.getState().setReadOnly(false);
    useDocumentStore.getState().replaceDocument(loaded.document);
    useAccessStore.getState().setReadOnly(wasReadOnly);
    useAccessStore.getState().setShared({ ...shared, version: data.version });
    setMessage(`已加载版本 ${data.version}`);
  };
  const copy = async (value: string) => {
    try {
      if (!navigator.clipboard) throw new Error();
      await navigator.clipboard.writeText(value);
      setMessage('已复制');
    } catch {
      setMessage('请从下方文本框手动复制');
    }
  };
  return (
    <div className="modal-backdrop">
      <section className="app-dialog" role="dialog" aria-modal="true" aria-label="分享地图">
        <div className="panel-header">
          <span>分享地图</span>
          <button onClick={onClose} aria-label="关闭分享">
            ×
          </button>
        </div>
        <div className="panel-body">
          <label className="field">
            链接权限
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as typeof mode);
                setUrl('');
              }}
            >
              <option value="view">只读</option>
              <option value="copy">编辑副本</option>
              <option value="edit" disabled={inline}>
                编辑并覆盖
              </option>
            </select>
          </label>
          <div className="field">
            分享图层
            {doc.layers.map((l) => (
              <label key={l.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(l.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? [...selected, l.id] : selected.filter((id) => id !== l.id),
                    )
                  }
                />
                {l.name}
              </label>
            ))}
          </div>
          <label className="field-row">
            <input
              type="checkbox"
              checked={inline}
              onChange={(e) => {
                setInline(e.target.checked);
                if (e.target.checked && mode === 'edit') setMode('copy');
              }}
            />
            使用离线快照链接
          </label>
          <button disabled={busy} onClick={() => void create()}>
            创建分享
          </button>
          {shared && (
            <div className="field">
              <span>当前分享 · 版本 {shared.version}</span>
              <button disabled={busy || !shared.token} onClick={() => void update()}>
                更新当前分享
              </button>
              <button onClick={() => void reload()}>加载最新版本</button>
              <button onClick={() => setUrl(buildUrl(shared.id, shared.token))}>
                生成所选权限链接
              </button>
              <button
                onClick={() => {
                  const versionUrl = new URL(buildUrl(shared.id));
                  versionUrl.searchParams.set('mode', 'view');
                  versionUrl.searchParams.set('version', String(shared.version));
                  versionUrl.hash = '';
                  setUrl(versionUrl.toString());
                }}
              >
                生成当前版本只读链接
              </button>
            </div>
          )}
          {url && (
            <>
              <textarea
                className="field-input"
                aria-label="分享链接"
                value={url}
                readOnly
                rows={3}
              />
              <button onClick={() => void copy(url)}>复制链接</button>
              <button
                onClick={() =>
                  void copy(
                    `<iframe src="${url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" width="100%" height="600" style="border:0" allow="fullscreen" loading="lazy"></iframe>`,
                  )
                }
              >
                复制 iframe 代码
              </button>
            </>
          )}
          <p role="status">{message}</p>
        </div>
      </section>
    </div>
  );
}
