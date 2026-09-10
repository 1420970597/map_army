import { useEffect, useRef, useState } from 'react';
import {
  AIRCRAFT_MODEL,
  ATTACHMENTS,
  createEquipment3D,
  equipment3DProblem,
  mountAttachment,
  canMountAttachment,
} from '@/core/model/equipment3d';
import type { Equipment3D } from '@/core/model/equipment3d';
import type { MapFeature } from '@/core/model';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { createEquipmentPreview } from './equipmentPreview';
import type { SocketMarker } from './equipmentPreview';
import './equipment3d.css';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { equipmentText } from './equipmentText';

/** 三维关联、查看与装配入口；只读时相机仍然可操作。 */
export default function Equipment3DPanel({
  feature,
  disabled,
}: {
  feature: MapFeature;
  disabled: boolean;
}) {
  const update = useDocumentStore((state) => state.updateFeature);
  const language = usePreferencesStore((state) => state.language);
  const t = (text: string) => equipmentText(language, text);
  if (feature.geometry.kind !== 'point' || feature.symbolKind === 'multiPoint')
    return <p className="field-hint">{t('线、面和控制措施不对应单台装备模型。')}</p>;
  if (!feature.equipment3d)
    return (
      <div className="equipment-intro">
        <p>{t('此军标尚未关联三维模型。')}</p>
        <p className="field-hint">
          {t('可关联通用飞机验证旋转、缩放和挂载。当前资产为类别示意，不代表具体型号。')}
        </p>
        <button
          type="button"
          className="tb-button"
          disabled={disabled}
          onClick={() => update(feature.id, { equipment3d: createEquipment3D() })}
        >
          {t('关联示意飞机')}
        </button>
      </div>
    );
  const problem = equipment3DProblem(feature.equipment3d);
  return (
    <div className="equipment-panel">
      <strong>{problem ? feature.equipment3d.modelId : t(AIRCRAFT_MODEL.name)}</strong>
      <p className="field-hint">{t('类别示意 · 三维装配为本项目扩展')}</p>
      {problem ? (
        <p role="status">{t(problem)}</p>
      ) : (
        <ModelAssembly featureId={feature.id} value={feature.equipment3d} disabled={disabled} />
      )}
      <button
        type="button"
        className="tb-button"
        disabled={disabled}
        onClick={() => update(feature.id, { equipment3d: undefined })}
      >
        {t('移除模型与所有挂载')}
      </button>
      <p className="field-hint">{t('装配随文档保存，可撤销。真实装备型号仍需另行建模和关联。')}</p>
    </div>
  );
}

function ModelAssembly({
  featureId,
  value,
  disabled,
}: {
  featureId: string;
  value: Equipment3D;
  disabled: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const language = usePreferencesStore((state) => state.language);
  const t = (text: string) => equipmentText(language, text);
  const socketName = (id: string) =>
    t(AIRCRAFT_MODEL.sockets.find((socket) => socket.id === id)?.name ?? id);
  const preview = useRef<ReturnType<typeof createEquipmentPreview> | null>(null);
  const [markers, setMarkers] = useState<SocketMarker[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selectedPart, setSelectedPart] = useState(ATTACHMENTS[0].id);
  const [drag, setDrag] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!host.current) return;
    try {
      const instance = createEquipmentPreview(host.current, setMarkers, (next, message) => {
        setStatus(next);
        setError(message ?? '');
      });
      preview.current = instance;
      instance.setValue(valueRef.current);
      return () => {
        preview.current = null;
        instance.dispose();
      };
    } catch {
      setStatus('error');
      setError('此浏览器无法创建三维画布，请启用 WebGL 后重试。');
    }
  }, [retry]);
  useEffect(() => {
    preview.current?.setValue(value);
  }, [value]);
  useEffect(() => {
    host.current
      ?.querySelector('canvas')
      ?.setAttribute('aria-label', equipmentText(language, '三维装备预览，拖动旋转、滚轮缩放'));
  }, [language, retry]);
  useEffect(() => {
    preview.current?.setDrag(
      Boolean(drag) && !disabled,
      drag && target && !disabled ? { socketId: target, attachmentId: drag } : null,
    );
  }, [drag, target, disabled]);
  useEffect(() => {
    const cancel = () => {
      setDrag(null);
      setTarget(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && drag) {
        event.stopImmediatePropagation();
        cancel();
      }
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('dragend', cancel);
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('dragend', cancel);
      window.removeEventListener('blur', cancel);
    };
  }, [drag]);

  const install = (socketId: string, partId: string | null) => {
    setDrag(null);
    setTarget(null);
    if (disabled || status !== 'ready') return;
    const store = useDocumentStore.getState();
    const current = store.document.features.find((entry) => entry.id === featureId)?.equipment3d;
    if (!current) return;
    const next = mountAttachment(current, socketId, partId);
    if (next === current) return;
    store.updateFeature(featureId, { equipment3d: next });
    if (useDocumentStore.getState().document !== store.document)
      setNotice(partId ? '挂载已安装，可撤销。' : '挂载已拆卸，可撤销。');
  };
  const canMount = (socketId: string, part = selectedPart) => canMountAttachment(socketId, part);

  return (
    <>
      <div
        className="equipment-canvas"
        ref={host}
        onDragOver={(event) => {
          if (drag && !disabled) event.preventDefault();
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDrag(null);
          setTarget(null);
        }}
      >
        {status === 'ready' &&
          markers
            .filter((marker) => marker.visible)
            .map((marker) => (
              <button
                type="button"
                key={marker.id}
                data-socket-id={marker.id}
                className={`equipment-socket ${canMount(marker.id, drag ?? selectedPart) ? 'is-compatible' : ''} ${target === marker.id ? 'is-target' : ''}`}
                style={{ left: marker.x, top: marker.y }}
                aria-label={`${socketName(marker.id)}${t('挂点')}`}
                title={
                  canMount(marker.id, drag ?? selectedPart)
                    ? t('点击或拖入所选部件')
                    : t('此挂点不接受所选部件')
                }
                disabled={disabled || !canMount(marker.id, drag ?? selectedPart)}
                onClick={() => install(marker.id, selectedPart)}
                onDragOver={(event) => {
                  if (!disabled && drag && canMount(marker.id, drag)) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = 'copy';
                    setTarget(marker.id);
                  }
                }}
                onDragLeave={() => setTarget(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (drag) install(marker.id, drag);
                }}
              >
                {socketName(marker.id)}
              </button>
            ))}
        {status !== 'ready' && (
          <div className="equipment-loading" role="status">
            {t(status === 'loading' ? '正在加载三维模型…' : error)}
          </div>
        )}
      </div>
      {status === 'error' ? (
        <button
          className="tb-button"
          onClick={() => {
            setStatus('loading');
            setDrag(null);
            setTarget(null);
            setRetry((count) => count + 1);
          }}
        >
          {t('重新加载模型')}
        </button>
      ) : (
        <button
          className="tb-button"
          disabled={status !== 'ready'}
          onClick={() => preview.current?.resetCamera()}
        >
          {t('重置视角')}
        </button>
      )}
      <button
        type="button"
        className="tb-button"
        disabled={status !== 'ready'}
        onClick={() => preview.current?.viewUnderside()}
      >
        {t('查看机腹')}
      </button>
      <p className="field-hint">
        {t('拖动模型旋转，滚轮或双指缩放。')}
        {disabled
          ? t('当前只读，可自由查看模型。')
          : t('拖动部件到绿色挂点，或选择部件后点击挂点安装；Esc 取消拖动。')}
      </p>
      <div className="equipment-parts" aria-label={t('可挂载部件')}>
        {ATTACHMENTS.map((part) => (
          <button
            type="button"
            key={part.id}
            className={`equipment-part ${selectedPart === part.id ? 'is-selected' : ''}`}
            disabled={disabled || status !== 'ready'}
            aria-pressed={selectedPart === part.id}
            draggable={!disabled && status === 'ready'}
            onClick={() => setSelectedPart(part.id)}
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', part.id);
              event.dataTransfer.effectAllowed = 'copy';
              setSelectedPart(part.id);
              setDrag(part.id);
            }}
            onDragEnd={() => {
              setDrag(null);
              setTarget(null);
            }}
          >
            {t(part.name)}
          </button>
        ))}
      </div>
      <ul className="equipment-mounts" aria-label={t('当前装配')}>
        {AIRCRAFT_MODEL.sockets.map((socket) => {
          const mounted = value.attachments.find((item) => item.socketId === socket.id);
          return (
            <li key={socket.id}>
              <span>
                {t(socket.name)}：
                {t(ATTACHMENTS.find((part) => part.id === mounted?.attachmentId)?.name ?? '空')}
              </span>
              {mounted ? (
                <button
                  disabled={disabled || status !== 'ready'}
                  onClick={() => install(socket.id, null)}
                  aria-label={`${t('拆卸')}${t(socket.name)}${t('挂载')}`}
                >
                  {t('拆卸')}
                </button>
              ) : (
                <button
                  disabled={disabled || status !== 'ready' || !canMount(socket.id)}
                  onClick={() => install(socket.id, selectedPart)}
                  aria-label={`${t('安装到')}${t(socket.name)}`}
                >
                  {t('安装')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="field-hint" role="status">
        {t(notice || '三维装配示意：机翼支持两类部件，机腹支持传感器。')}
      </p>
    </>
  );
}
