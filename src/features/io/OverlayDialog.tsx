/** 在线矢量和图像导入，以及图像的配准、缩放与位置导出。 */
import { useState } from 'react';
import { createDocument } from '@/core/model';
import type { ImageOverlayData } from '@/core/model/types';
import { parseMapFile } from '@/core/io/files';
import { worldFileCorners, overlayWorldFile, transformOverlay } from '@/core/io/overlays';
import { downloadText } from '@/core/io';
import { getMap } from '@/features/map/mapInstance';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useAccessStore } from '@/stores/useAccessStore';
import { applyImportedDocument } from './importDocument';

/** 读取图像实际尺寸，拒绝无法解码的数据。 */
async function imageSize(url: string): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
    image.onerror = () => reject(new Error('无法加载图像，请检查文件或在线地址'));
    image.src = url;
  });
}

export function OverlayDialog({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const doc = useDocumentStore((s) => s.document);
  const activeId = useDocumentStore((s) => s.activeLayerId);
  const layer = doc.layers.find((l) => l.id === activeId);
  const readOnly = useAccessStore((s) => s.readOnly);
  const editable = !readOnly && layer && !layer.locked;
  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
      setMessage('操作已完成');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };
  const importImage = async (source: string, name: string, world?: string, config?: string) => {
    const [width, height] = await imageSize(source);
    const bounds = getMap()?.getBounds();
    const west = bounds?.getWest() ?? 8,
      north = bounds?.getNorth() ?? 48;
    const dx = ((bounds?.getEast() ?? 9) - west) / 2;
    const dy = ((bounds?.getNorth() ?? 48) - (bounds?.getSouth() ?? 47)) / 2;
    let corners: ImageOverlayData['corners'] = [
      { lon: west + dx / 2, lat: north - dy / 2 },
      { lon: west + dx * 1.5, lat: north - dy / 2 },
      { lon: west + dx / 2, lat: north - dy * 1.5 },
    ];
    if (world) corners = worldFileCorners(world, width, height);
    if (config) {
      const value = JSON.parse(config);
      if (
        !Array.isArray(value.corners) ||
        value.corners.length !== 3 ||
        !value.corners.every(
          (p: { lon: number; lat: number }) =>
            Number.isFinite(p?.lon) && Number.isFinite(p?.lat) && Math.abs(p.lat) <= 90,
        )
      )
        throw new Error('config.json 配准角点无效');
      corners = value.corners;
    }
    const imported = createDocument(name);
    imported.layers[0] = {
      ...imported.layers[0],
      name,
      kind: 'image',
      image: { url: source, width, height, corners },
    };
    applyImportedDocument(imported);
  };
  const loadUrl = async (source: string, replaceLayer?: string) => {
    const address = new URL(source);
    if (!['http:', 'https:'].includes(address.protocol))
      throw new Error('请输入 HTTP 或 HTTPS 地址');
    if (/\.(png|jpe?g|webp|gif|svg|bmp)(?:$|\?)/i.test(address.pathname)) {
      await importImage(address.href, address.pathname.split('/').pop() ?? '在线图像');
      return;
    }
    const response = await fetch(address, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`在线图层读取失败：${response.status}`);
    const result = parseMapFile(
      new Uint8Array(await response.arrayBuffer()),
      address.pathname.split('/').pop() ?? '在线图层',
    );
    for (const item of result.document.layers) item.sourceUrl = address.href;
    if (replaceLayer) {
      const current = useDocumentStore.getState();
      current.replaceDocument({
        ...current.document,
        features: [
          ...current.document.features.filter((f) => f.layerId !== replaceLayer),
          ...result.document.features.map((f) => ({ ...f, layerId: replaceLayer })),
        ],
      });
    } else applyImportedDocument(result.document);
  };
  return (
    <div className="modal-backdrop">
      <section className="app-dialog" role="dialog" aria-modal="true" aria-label="图像与在线图层">
        <div className="panel-header">
          图像与在线图层<button onClick={onClose}>×</button>
        </div>
        <div className="panel-body">
          <label className="field">
            在线图层 URL
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…/layer.geojson"
            />
          </label>
          <button
            disabled={readOnly || busy || !url}
            onClick={() => void perform(() => loadUrl(url))}
          >
            加载在线图层
          </button>
          <label className="field">
            导入图像，可同时选择 world file 或 config.json
            <input
              type="file"
              multiple
              accept="image/*,.pgw,.jgw,.wld,.tfw,.json"
              disabled={readOnly || busy}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                void perform(async () => {
                  const file = files.find((f) => f.type.startsWith('image/'));
                  if (!file) throw new Error('请选择图像文件');
                  const source = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });
                  await importImage(
                    source,
                    file.name,
                    await files.find((f) => /\.(pgw|jgw|wld|tfw)$/i.test(f.name))?.text(),
                    await files.find((f) => f.name === 'config.json')?.text(),
                  );
                });
                e.target.value = '';
              }}
            />
          </label>
          {layer?.sourceUrl && (
            <button
              disabled={!editable || busy}
              onClick={() => void perform(() => loadUrl(layer.sourceUrl!, layer.id))}
            >
              刷新活动在线图层
            </button>
          )}
          {layer?.image && (
            <>
              <p>
                活动图像：{layer.name}。关闭窗口后，拖动中心手柄移动图像，拖动三个角点调整配准。
              </p>
              <div className="field-row">
                {[
                  [-15, '向左旋转'],
                  [15, '向右旋转'],
                  [0.8, '缩小'],
                  [1.25, '放大'],
                ].map(([value, label]) => (
                  <button
                    key={label}
                    disabled={!editable}
                    onClick={() =>
                      useDocumentStore.getState().updateLayer(layer.id, {
                        image: transformOverlay(
                          layer.image!,
                          Math.abs(Number(value)) < 2 ? Number(value) : 1,
                          Math.abs(Number(value)) >= 2 ? Number(value) : 0,
                        ),
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() =>
                  downloadText(JSON.stringify(layer.image, null, 2), {
                    filename: 'config.json',
                    mimeType: 'application/json',
                  })
                }
              >
                导出 config.json
              </button>
              <button
                onClick={() =>
                  downloadText(overlayWorldFile(layer.image!), {
                    filename: layer.name.replace(/\.[^.]+$/, '') + '.wld',
                    mimeType: 'text/plain',
                  })
                }
              >
                导出 world file
              </button>
            </>
          )}
          <p role="status">{message}</p>
        </div>
      </section>
    </div>
  );
}
