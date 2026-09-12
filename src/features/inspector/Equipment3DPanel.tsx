import { useEffect, useRef, useState } from 'react';
import {
  AIRCRAFT_MODEL,
  EQUIPMENT_MODELS,
  createEquipment3D,
  equipment3DProblem,
  findEquipmentModel,
  mountAttachment,
  canMountAttachment,
} from '@/core/model/equipment3d';
import type { Equipment3D, EquipmentModelDefinition } from '@/core/model/equipment3d';
import { AFSIM_MODEL_CATALOG } from '@/core/model/afsimCatalog';
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
        <ModelCatalog
          disabled={disabled}
          onSelect={(model) => update(feature.id, { equipment3d: createEquipment3D(model) })}
        />
        <p className="field-hint">
          {t('内置模型库包含类别示意和已获许可的 AFSIM 模型；受限源文件仅显示索引。')}
        </p>
      </div>
    );
  const problem = equipment3DProblem(feature.equipment3d);
  const model = findEquipmentModel(feature.equipment3d.modelId, feature.equipment3d.assetVersion);
  return (
    <div className="equipment-panel">
      <div className="equipment-heading">
        <div>
          <strong>{problem || !model ? feature.equipment3d.modelId : t(model.name)}</strong>
          <p className="field-hint">
            {model ? `${t(model.category)} · ${t('三维装配为本项目扩展')}` : t('模型版本不可用')}
          </p>
        </div>
      </div>
      <ModelCatalog
        selectedId={model?.id}
        disabled={disabled}
        onSelect={(nextModel) => {
          if (model?.id === nextModel.id && model.version === nextModel.version) return;
          update(feature.id, { equipment3d: createEquipment3D(nextModel) });
        }}
      />
      {problem ? (
        <p role="status">{t(problem)}</p>
      ) : (
        <ModelAssembly
          featureId={feature.id}
          value={feature.equipment3d}
          model={model ?? AIRCRAFT_MODEL}
          disabled={disabled}
        />
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

function ModelCatalog({
  selectedId,
  disabled,
  onSelect,
}: {
  selectedId?: string;
  disabled: boolean;
  onSelect: (model: EquipmentModelDefinition) => void;
}) {
  const language = usePreferencesStore((state) => state.language);
  const t = (text: string) => equipmentText(language, text);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('all');
  const embeddedAfsimModels = EQUIPMENT_MODELS.filter((model) => model.source === 'afsim');
  const restrictedAfsimModels = AFSIM_MODEL_CATALOG.filter(
    (entry) => entry.status === 'restricted',
  ).length;
  const visibleModels = EQUIPMENT_MODELS.filter(
    (model) => filter === 'all' || (model.source === 'afsim' && model.equipmentType === filter),
  );

  const choose = async (model: EquipmentModelDefinition) => {
    setLoadingId(model.id);
    setLoadError('');
    try {
      const responses = await Promise.all(
        [model.url, ...model.attachments.map((part) => part.url)].map((url) => fetch(url)),
      );
      if (responses.some((response) => !response.ok)) throw new Error('model');
      onSelect(model);
    } catch {
      // 模型资源未能从内置目录加载时，不改变文档中的当前模型。
      setLoadError(t('模型加载失败，请检查网络后重试。'));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <section className="equipment-catalog" aria-label={t('内置模型库')}>
      <strong>{t('选择三维模型')}</strong>
      <div className="equipment-catalog-controls">
        <label>
          {t('类型')}
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{t('全部')}</option>
            {[
              ...new Set(embeddedAfsimModels.map((model) => model.equipmentType).filter(Boolean)),
            ].map((type) => (
              <option key={type} value={type}>
                {t(typeLabel(type!))}
              </option>
            ))}
          </select>
        </label>
        <span className="field-hint">
          {t('AFSIM 模型索引')}：{AFSIM_MODEL_CATALOG.length} · {t('可嵌入')}：
          {embeddedAfsimModels.length} · {t('受限')}：{restrictedAfsimModels}
        </span>
      </div>
      <div className="equipment-models">
        {visibleModels.map((model) => {
          const selected = selectedId === model.id;
          return (
            <article className={`equipment-model ${selected ? 'is-selected' : ''}`} key={model.id}>
              <div className="equipment-model-preview" aria-hidden="true">
                <span>{model.category.slice(0, 1)}</span>
              </div>
              <div className="equipment-model-copy">
                <strong>{t(model.name)}</strong>
                <span>
                  {t(model.category)}
                  {model.source === 'afsim' ? ` · AFSIM ${model.variant ?? ''}` : ''}
                </span>
                <p>{t(model.description)}</p>
                {model.attribution && <small>{model.attribution}</small>}
              </div>
              <button
                type="button"
                className="tb-button"
                disabled={disabled || selected || loadingId !== null}
                aria-pressed={selected}
                aria-label={
                  !selected && model.id === AIRCRAFT_MODEL.id && selectedId === undefined
                    ? t('关联示意飞机')
                    : `${t(selected ? '当前模型' : '关联')}${t(model.name)}`
                }
                onClick={() => void choose(model)}
              >
                {t(loadingId === model.id ? '正在检查模型' : selected ? '当前模型' : '选择')}
              </button>
            </article>
          );
        })}
      </div>
      {loadError && (
        <p className="field-hint" role="status">
          {loadError}
        </p>
      )}
    </section>
  );
}

function typeLabel(type: string): string {
  return (
    {
      aircraft: '航空器',
      helicopter: '直升机',
      drone: '无人机',
      weapon: '武器',
      launcher: '发射/雷达',
      naval: '舰船',
      space: '航天器',
      ground: '地面装备',
      unknown: '未分类',
    }[type] ?? type
  );
}

function ModelAssembly({
  featureId,
  value,
  model,
  disabled,
}: {
  featureId: string;
  value: Equipment3D;
  model: EquipmentModelDefinition;
  disabled: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const language = usePreferencesStore((state) => state.language);
  const t = (text: string) => equipmentText(language, text);
  const socketName = (id: string) =>
    t(model.sockets.find((socket) => socket.id === id)?.name ?? id);
  const preview = useRef<ReturnType<typeof createEquipmentPreview> | null>(null);
  const [markers, setMarkers] = useState<SocketMarker[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selectedPart, setSelectedPart] = useState(model.attachments[0]?.id ?? '');
  const [drag, setDrag] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!host.current) return;
    try {
      const instance = createEquipmentPreview(
        host.current,
        setMarkers,
        (next, message) => {
          setStatus(next);
          setError(message ?? '');
        },
        model,
      );
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
  }, [retry, model]);
  useEffect(() => {
    preview.current?.setValue(value);
  }, [value]);
  useEffect(() => {
    setSelectedPart(model.attachments[0]?.id ?? '');
  }, [model]);
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
  const canMount = (socketId: string, part = selectedPart) =>
    Boolean(part) && canMountAttachment(socketId, part, model);

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
        {model.attachments.map((part) => (
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
        {model.sockets.map((socket) => {
          const mounted = value.attachments.find((item) => item.socketId === socket.id);
          return (
            <li key={socket.id}>
              <span>
                {t(socket.name)}：
                {t(
                  model.attachments.find((part) => part.id === mounted?.attachmentId)?.name ?? '空',
                )}
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
