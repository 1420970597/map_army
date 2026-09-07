/**
 * 导入导出操作栏。
 *
 * 提供五种交换能力：
 * - 导出 / 导入 MilX 图层（`.milxly`，JSON 文本）
 * - 导出压缩图层（`.milxlyz`，gzip 二进制）
 * - 导出 GeoJSON（通用 GIS 互操作）
 * - 导出 PNG 图像（当前地图视图快照）
 */

import { toPng } from 'html-to-image';
import { useState } from 'react';

import {
  compressMilxly,
  deserializeMilxly,
  documentToGeoJson,
  downloadBytes,
  downloadText,
  geoJsonToDocument,
  pickTextFile,
  serializeMilxly,
  toSafeFilename,
} from '@/core/io';
import { createId } from '@/core/model';
import { useDocumentStore } from '@/stores/useDocumentStore';

/** 操作栏组件 */
export function ImportExportBar() {
  const doc = useDocumentStore((state) => state.document);
  const replaceDocument = useDocumentStore((state) => state.replaceDocument);
  const [message, setMessage] = useState<string | null>(null);

  /** 短暂提示操作结果，3 秒后自动消失 */
  const notify = (text: string): void => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3000);
  };

  const exportMilxly = (): void => {
    downloadText(serializeMilxly(doc), {
      filename: toSafeFilename(doc.name, '.milxly'),
      mimeType: 'application/json',
    });
    notify('已导出 MilX 图层');
  };

  const exportMilxlyz = async (): Promise<void> => {
    try {
      const compressed = await compressMilxly(serializeMilxly(doc));
      downloadBytes(compressed, {
        filename: toSafeFilename(doc.name, '.milxlyz'),
        mimeType: 'application/octet-stream',
      });
      notify('已导出压缩图层');
    } catch (error) {
      notify(error instanceof Error ? error.message : '压缩导出失败');
    }
  };

  const exportGeoJson = (): void => {
    downloadText(JSON.stringify(documentToGeoJson(doc), null, 2), {
      filename: toSafeFilename(doc.name, '.geojson'),
      mimeType: 'application/geo+json',
    });
    notify('已导出 GeoJSON');
  };

  /**
   * 导出当前地图视图为 PNG。
   *
   * 通过 html-to-image 抓取地图容器。瓦片能否被捕获取决于其服务是否允许
   * 跨域读取，个别瓦片缺失时退化为局部空缺，不会导致整体失败。
   */
  const exportPng = async (): Promise<void> => {
    const node = document.querySelector<HTMLElement>('.leaflet-container');
    if (!node) {
      notify('未找到地图容器，无法导出图片');
      return;
    }

    try {
      // pixelRatio 取 2，保证导出图在高分屏上仍然清晰
      const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = toSafeFilename(doc.name, '.png');
      link.href = dataUrl;
      link.click();
      notify('已导出 PNG 图像');
    } catch {
      notify('图片导出失败，可能是瓦片服务不允许跨域读取');
    }
  };

  const importFile = async (): Promise<void> => {
    const picked = await pickTextFile('.milxly,.milxlyz,.geojson,.json');
    if (!picked) return;

    try {
      if (picked.name.endsWith('.geojson') || picked.name.endsWith('.json')) {
        const collection = JSON.parse(picked.text);
        const result = geoJsonToDocument(
          collection,
          picked.name.replace(/\.(geojson|json)$/, ''),
          createId('lyr'),
        );
        replaceDocument(result.document);
        notify(`已导入 GeoJSON，跳过 ${result.skipped} 个不支持的要素`);
        return;
      }

      const result = deserializeMilxly(picked.text);
      replaceDocument(result.document);
      notify(result.skipped > 0 ? `已导入，跳过 ${result.skipped} 个损坏要素` : '已导入 MilX 图层');
    } catch (error) {
      notify(error instanceof Error ? error.message : '导入失败');
    }
  };

  return (
    <div className="toolbar-group">
      <button
        type="button"
        className="tb-button"
        title="导出当前地图视图为 PNG"
        onClick={() => void exportPng()}
      >
        图片
      </button>
      <button type="button" className="tb-button" title="导出为 GeoJSON" onClick={exportGeoJson}>
        GeoJSON
      </button>
      <button
        type="button"
        className="tb-button"
        title="导出为压缩的 MilX 图层"
        onClick={() => void exportMilxlyz()}
      >
        压缩导出
      </button>
      <button type="button" className="tb-button" title="导出为 MilX 图层" onClick={exportMilxly}>
        导出
      </button>
      <button
        type="button"
        className="tb-button"
        title="导入标图文件"
        onClick={() => void importFile()}
      >
        导入
      </button>
      {message ? <span className="io-message">{message}</span> : null}
    </div>
  );
}
