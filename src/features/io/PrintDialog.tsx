/** 打印与地理配准图像导出；逐行重采样将 Web Mercator 截图转换为等经纬度影像。 */
import { useState } from 'react';
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getMap } from '@/features/map/mapInstance';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { downloadText, toSafeFilename } from '@/core/io';
import { paperSize, printPixels, worldFile } from '@/core/io/print';
import { boundsOf } from '@/core/model';

export function PrintDialog({ onClose }: { onClose: () => void }) {
  const [paper, setPaper] = useState<'a4' | 'a3'>('a4');
  const [landscape, setLandscape] = useState(true);
  const [dpi, setDpi] = useState(150);
  const [format, setFormat] = useState('pdf');
  const [scope, setScope] = useState('viewport');
  const [georef, setGeoref] = useState(true);
  const [transparent, setTransparent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generate = async () => {
    const map = getMap();
    if (!map) {
      setMessage('请切换到二维视图后导出');
      return;
    }
    const originalCenter = map.getCenter(),
      originalZoom = map.getZoom();
    setBusy(true);
    setMessage('正在生成，请稍候…');
    try {
      const doc = useDocumentStore.getState().document;
      if (scope === 'all') {
        const extent = boundsOf(doc.features);
        if (extent)
          map.fitBounds(
            [
              [extent.minLat, extent.minLon],
              [extent.maxLat, extent.maxLon],
            ],
            { padding: [50, 50], animate: false },
          );
      }
      const [paperWidth, paperHeight] = paperSize(paper, landscape);
      const widthMm = paperWidth - 20;
      const node = map.getContainer();
      if (scope === '25000') {
        const requiredGroundWidth = (widthMm / 1000) * 25000;
        const widthMeters = 40075016.686 * Math.cos((originalCenter.lat * Math.PI) / 180);
        map.setView(
          originalCenter,
          Math.log2((widthMeters * node.clientWidth) / (256 * requiredGroundWidth)),
          { animate: false },
        );
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      await Promise.all(
        Array.from(node.querySelectorAll('img.leaflet-tile')).map((img) => {
          if ((img as HTMLImageElement).complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            window.setTimeout(done, 5000);
          });
        }),
      );
      const ratio = printPixels(widthMm, dpi) / node.clientWidth;
      const canvas = await toCanvas(node, {
        pixelRatio: ratio,
        backgroundColor: transparent ? undefined : '#ffffff',
        filter: (element) =>
          !(element instanceof HTMLElement) ||
          (!element.classList.contains('leaflet-control-container') &&
            !element.classList.contains('map-tools-overlay') &&
            (!transparent || !element.classList.contains('leaflet-tile-pane'))),
      });
      const extent = map.getBounds();
      const bounds = {
        west: extent.getWest(),
        east: extent.getEast(),
        north: extent.getNorth(),
        south: extent.getSouth(),
      };
      let output = canvas;
      if (georef && format !== 'pdf') {
        output = document.createElement('canvas');
        output.width = canvas.width;
        output.height = canvas.height;
        const ctx = output.getContext('2d')!;
        const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
        const top = mercator(bounds.north),
          bottom = mercator(bounds.south);
        for (let y = 0; y < output.height; y++) {
          const lat = bounds.north - ((y + 0.5) / output.height) * (bounds.north - bounds.south);
          const sourceY = Math.max(
            0,
            Math.min(canvas.height - 1, ((top - mercator(lat)) / (top - bottom)) * canvas.height),
          );
          ctx.drawImage(canvas, 0, sourceY, canvas.width, 1, 0, y, output.width, 1);
        }
      }
      const ctx = output.getContext('2d')!;
      const attribution = `${node.querySelector('.leaflet-control-attribution')?.textContent ?? ''} | map.army 开源复刻 | ${new Date().toISOString().slice(0, 10)}`;
      const font = Math.max(12, Math.round(10 * ratio));
      ctx.font = `${font}px sans-serif`;
      const textWidth = Math.min(output.width, ctx.measureText(attribution).width + 12);
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.fillRect(output.width - textWidth, output.height - font * 2, textWidth, font * 2);
      ctx.fillStyle = '#111';
      ctx.fillText(
        attribution,
        Math.max(4, output.width - textWidth + 6),
        output.height - font / 2,
        output.width - 10,
      );
      if (format === 'pdf') {
        const pdf = new jsPDF({
          orientation: landscape ? 'landscape' : 'portrait',
          unit: 'mm',
          format: paper,
        });
        const h = Math.min(paperHeight - 30, (widthMm * output.height) / output.width),
          w = (h * output.width) / output.height;
        pdf.addImage(output.toDataURL('image/png'), 'PNG', (paperWidth - w) / 2, 10, w, h);
        const ground =
          (40075016.686 *
            Math.cos((map.getCenter().lat * Math.PI) / 180) *
            (bounds.east - bounds.west)) /
          360;
        const denominator = Math.round(ground / (w / 1000));
        pdf.setFontSize(9);
        pdf.text(
          `1:${denominator.toLocaleString('en-US')} | ${dpi} DPI | Print at 100% (no scaling)`,
          10,
          paperHeight - 10,
        );
        pdf.save(toSafeFilename(doc.name, '.pdf'));
        setMessage(`PDF 已生成，中心纬度比例约 1:${denominator}；打印时使用 100% 原始尺寸。`);
      } else {
        const link = document.createElement('a');
        link.href = output.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
        link.download = toSafeFilename(doc.name, `.${format}`);
        link.click();
        if (georef)
          downloadText(worldFile(bounds, output.width, output.height), {
            filename: toSafeFilename(doc.name, format === 'jpg' ? '.jgw' : '.pgw'),
            mimeType: 'text/plain',
          });
        setMessage('图像已生成，地理配准使用 WGS84 经纬度。');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出失败，请检查底图服务是否支持 CORS');
    } finally {
      map.setView(originalCenter, originalZoom, { animate: false });
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <section className="app-dialog" role="dialog" aria-modal="true" aria-label="打印与图片导出">
        <div className="panel-header">
          打印与图片导出
          <button disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>
        <div className="panel-body">
          <label className="field">
            格式
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="pdf">PDF</option>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
            </select>
          </label>
          <label className="field">
            纸张
            <select value={paper} onChange={(e) => setPaper(e.target.value as typeof paper)}>
              <option value="a4">A4</option>
              <option value="a3">A3</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={landscape}
              onChange={(e) => setLandscape(e.target.checked)}
            />
            横向
          </label>
          <label className="field">
            分辨率
            <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
              <option value={96}>96 DPI</option>
              <option value={150}>150 DPI</option>
              <option value={300}>300 DPI</option>
            </select>
          </label>
          <label className="field">
            范围
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="viewport">当前视口</option>
              <option value="all">全部要素</option>
              <option value="25000">中心比例 1:25 000</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={georef}
              onChange={(e) => setGeoref(e.target.checked)}
              disabled={format === 'pdf'}
            />
            附带地理配准文件
          </label>
          <label>
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
              disabled={format === 'jpg'}
            />
            不包含底图
          </label>
          <p className="empty-hint">导出自动保留底图归属。PDF 打印使用原始尺寸，关闭自动缩放。</p>
          <button disabled={busy} onClick={() => void generate()}>
            {busy ? '正在生成…' : '生成并下载'}
          </button>
          <p role="status">{message}</p>
        </div>
      </section>
    </div>
  );
}
