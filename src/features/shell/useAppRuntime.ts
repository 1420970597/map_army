/** 应用启动与文件关联：外部分享优先于本地会话，异步取消避免卸载后覆盖文档。 */
import { useEffect } from 'react';
import {
  autoSave,
  loadDocumentResult,
  STORAGE_KEY,
  readShareUrl,
  deserializeMilxly,
  serializeMilxly,
} from '@/core/io';
import { parseMapFile, MAX_FILE_BYTES } from '@/core/io/files';
import { boundsOf, type MapDocument } from '@/core/model';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useAccessStore } from '@/stores/useAccessStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useViewStore } from '@/stores/useViewStore';
import { sessionLoadIntegration, isExternalSessionUpdate } from './sessionBannerIntegrationLogic';
import { applyImportedDocument } from '../io/importDocument';

/** 依据要素范围调整地图，保留现有地图中心作为空文档的降级值。 */
export function fitDocument(doc: MapDocument): void {
  const bounds = boundsOf(doc.features);
  if (!bounds) return;
  const span = Math.max(
    bounds.maxLon - bounds.minLon,
    (bounds.maxLat - bounds.minLat) * 1.5,
    0.002,
  );
  useViewStore
    .getState()
    .setView(
      { lon: (bounds.minLon + bounds.maxLon) / 2, lat: (bounds.minLat + bounds.maxLat) / 2 },
      Math.min(16, Math.max(2, Math.floor(Math.log2(280 / span)))),
    );
}

/** 挂载外部加载、自动保存、跨标签提示和 PWA 文件打开处理器。 */
export function useAppRuntime() {
  useEffect(() => {
    const abort = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const inline = readShareUrl();
    const shareId = params.get('share');
    const layerUrl = params.get('layer');
    const external = Boolean(inline || shareId || layerUrl);
    let stopSave = () => {};
    const open = (doc: MapDocument, readOnly: boolean) => {
      if (abort.signal.aborted) return;
      useAccessStore.getState().setReadOnly(false);
      useDocumentStore.getState().replaceDocument(doc);
      useDocumentStore.setState({ past: [], future: [] });
      useAccessStore.getState().setReadOnly(readOnly);
      useSessionStore.getState().discardRestore();
      fitDocument(doc);
    };
    const initialize = async () => {
      try {
        if (inline) {
          open(inline.document, inline.mode === 'view');
          return;
        }
        if (shareId) {
          useAccessStore.getState().setReadOnly(true);
          const version = params.get('version');
          const response = await fetch(
            `/api/shares/${encodeURIComponent(shareId)}${version ? `?version=${encodeURIComponent(version)}` : ''}`,
            { signal: abort.signal },
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          const loaded = deserializeMilxly(serializeMilxly(data.document));
          const token = window.location.hash.startsWith('#edit=')
            ? window.location.hash.slice(6)
            : undefined;
          open(
            loaded.document,
            params.get('mode') !== 'copy' && !(params.get('mode') === 'edit' && token),
          );
          useAccessStore.getState().setShared({
            id: shareId,
            version: data.version,
            token: params.get('mode') === 'edit' ? token : undefined,
          });
          return;
        }
        if (layerUrl) {
          const readOnly = layerUrl.endsWith(';readonly') || params.has('readonly');
          const raw = layerUrl.replace(/;readonly$/, '');
          const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
          if (!['http:', 'https:'].includes(url.protocol))
            throw new Error('图层地址仅支持 HTTP 或 HTTPS');
          const response = await fetch(url, { signal: abort.signal });
          if (!response.ok) throw new Error('在线图层无法读取，请检查地址与 CORS 设置');
          if (Number(response.headers.get('Content-Length')) > MAX_FILE_BYTES)
            throw new Error('在线图层文件过大');
          const result = parseMapFile(
            new Uint8Array(await response.arrayBuffer()),
            url.pathname.split('/').pop() ?? '在线图层',
          );
          open(result.document, readOnly);
          return;
        }
        useAccessStore.getState().setReadOnly(false);
        const result = sessionLoadIntegration(loadDocumentResult(), `tab-${Date.now()}`);
        useSessionStore.getState().setPendingRestore(result.pendingRestore);
        useSessionStore.getState().setError(result.error);
        stopSave = autoSave(
          () => useDocumentStore.getState().document,
          (r) => useSessionStore.getState().recordSaveResult(r),
        );
      } catch (error) {
        if (!abort.signal.aborted)
          useAccessStore.getState().notify(error instanceof Error ? error.message : '载入失败');
      }
    };
    void initialize();
    const onStorage = (event: StorageEvent) => {
      if (
        !external &&
        event.key === STORAGE_KEY &&
        event.newValue &&
        isExternalSessionUpdate(useDocumentStore.getState().document, loadDocumentResult())
      )
        useSessionStore.getState().setConflict(true);
    };
    window.addEventListener('storage', onStorage);
    const launch = (
      window as Window & {
        launchQueue?: {
          setConsumer: (
            callback: (params: { files: { getFile: () => Promise<File> }[] }) => void,
          ) => void;
        };
      }
    ).launchQueue;
    launch?.setConsumer(async ({ files }) => {
      for (const handle of files) {
        try {
          const file = await handle.getFile();
          const result = parseMapFile(new Uint8Array(await file.arrayBuffer()), file.name);
          if (!abort.signal.aborted) {
            applyImportedDocument(result.document);
            fitDocument(result.document);
          }
        } catch (error) {
          useAccessStore.getState().notify(error instanceof Error ? error.message : '打开文件失败');
        }
      }
    });
    const poll = window.setInterval(async () => {
      if (!shareId || params.has('version')) return;
      try {
        const response = await fetch(`/api/shares/${encodeURIComponent(shareId)}`, {
          signal: abort.signal,
        });
        if (!response.ok) return;
        const latest = await response.json();
        if (latest.version > (useAccessStore.getState().shared?.version ?? 0))
          useAccessStore
            .getState()
            .notify(`分享已有新版本 ${latest.version}，可在分享窗口加载最新版本。`);
      } catch {
        /* 暂时离线不影响已打开的文档。 */
      }
    }, 600000);
    return () => {
      abort.abort();
      stopSave();
      window.clearInterval(poll);
      window.removeEventListener('storage', onStorage);
      launch?.setConsumer(() => {});
    };
  }, []);
}
