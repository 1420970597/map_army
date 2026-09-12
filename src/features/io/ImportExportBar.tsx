/** 文件与分享入口。导入默认追加图层；导出可限制为当前活动图层。 */
import { useEffect, useRef, useState } from 'react';
import {
  downloadText,
  downloadBytes,
  toSafeFilename,
  serializeMilxly,
  documentToGeoJson,
  documentToKml,
  documentToMilxXml,
  milxExportWarnings,
  documentToAfsim,
} from '@/core/io';
import type { AfsimExportResult } from '@/core/io';
import { afsimExportText } from '@/core/io/afsim/exportText';
import { parseMapFile, exportMilxArchive } from '@/core/io/files';
import { AfsimImportDialog } from './AfsimImportDialog';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useAccessStore } from '@/stores/useAccessStore';
import { applyImportedDocument } from './importDocument';
import { PrintDialog } from './PrintDialog';
import { OverlayDialog } from './OverlayDialog';
import { ShareDialog } from './ShareDialog';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { equipmentText } from '@/features/inspector/equipmentText';

export function ImportExportBar() {
  const doc = useDocumentStore((s) => s.document);
  const language = usePreferencesStore((state) => state.language);
  const activeLayerId = useDocumentStore((s) => s.activeLayerId);
  const setActiveLayer = useDocumentStore((s) => s.setActiveLayer);
  const readOnly = useAccessStore((s) => s.readOnly);
  const fileInput = useRef<HTMLInputElement>(null);
  const [afsimOpen, setAfsimOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [share, setShare] = useState(false);
  const [print, setPrint] = useState(false);
  const [format, setFormat] = useState('milxlyz');
  const [scope, setScope] = useState('all');
  const [importMode, setImportMode] = useState<'append' | 'replace' | 'active' | 'target'>(
    'append',
  );
  const [targetLayerId, setTargetLayerId] = useState(activeLayerId);
  const [message, setMessage] = useState('');
  const [afsimReport, setAfsimReport] = useState<AfsimExportResult | null>(null);

  const afsimText = (
    key: Parameters<typeof afsimExportText>[1],
    values?: Record<string, string | number>,
  ) => afsimExportText(language, key, values);

  /** 导出静态单位为标准 AFSIM 想定目录压缩包。 */
  const exportAfsim = (layerId = activeLayerId, forceLayer = false): void => {
    try {
      const result = documentToAfsim(doc, {
        name: doc.name,
        layerIds: forceLayer || scope === 'active' ? [layerId] : undefined,
        language,
      });
      setAfsimReport(result);
      if (!result.exported) {
        setMessage(afsimText('empty'));
        return;
      }
      downloadBytes(result.archive, {
        filename: toSafeFilename(doc.name, '.zip'),
        mimeType: 'application/zip',
      });
      setMessage(afsimText('done', { count: result.exported, skipped: result.skipped }));
    } catch (error) {
      setAfsimReport(null);
      setMessage(
        error instanceof Error ? `${afsimText('failed')}: ${error.message}` : afsimText('failed'),
      );
    }
  };

  const exportFile = (layerId = activeLayerId, forceLayer = false) => {
    if (format === 'afsim') {
      exportAfsim(layerId, forceLayer);
      return;
    }
    const output =
      scope === 'all' && !forceLayer
        ? doc
        : {
            ...doc,
            layers: doc.layers.filter((l) => l.id === layerId),
            features: doc.features.filter((f) => f.layerId === layerId),
          };
    if (format === 'milxlyz')
      downloadBytes(exportMilxArchive(output), {
        filename: toSafeFilename(doc.name, '.milxlyz'),
        mimeType: 'application/milxlyz',
      });
    else {
      const text =
        format === 'kml'
          ? documentToKml(output)
          : format === 'geojson'
            ? JSON.stringify(documentToGeoJson(output), null, 2)
            : format === 'json'
              ? serializeMilxly(output)
              : documentToMilxXml(output);
      downloadText(text, {
        filename: toSafeFilename(doc.name, `.${format}`),
        mimeType:
          format === 'json' || format === 'geojson' ? 'application/json' : 'application/xml',
      });
    }
    const warnings = ['milxly', 'milx', 'milxlyz'].includes(format)
      ? milxExportWarnings(output)
      : [];
    if (format === 'kml' && output.features.some((feature) => feature.equipment3d))
      warnings.push('KML 不保留三维装配；如需继续编辑装配，请另存项目 JSON');
    setMessage(
      warnings.length
        ? `文件已导出；${warnings.map((warning) => equipmentText(language, warning)).join('；')}`
        : '文件已导出',
    );
    setAfsimReport(null);
  };
  useEffect(() => {
    const onLayerExport = (event: Event) => {
      const layerId = (event as CustomEvent<{ layerId?: string }>).detail?.layerId;
      if (layerId && doc.layers.some((layer) => layer.id === layerId)) {
        exportFile(layerId, true);
      }
    };
    window.addEventListener('map-army:export-layer', onLayerExport);
    return () => window.removeEventListener('map-army:export-layer', onLayerExport);
  });
  return (
    <div className="toolbar-group">
      <button className="tb-button" onClick={() => setOpen(!open)}>
        文件
      </button>
      <button className="tb-button" onClick={() => setShare(true)}>
        分享
      </button>
      <button className="tb-button" onClick={() => setPrint(true)}>
        打印 / 图片
      </button>
      <input
        ref={fileInput}
        type="file"
        hidden
        accept=".milxly,.milxlyz,.milx,.json,.geojson,.kml,.nvg,.gpx,.zip"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const result = parseMapFile(new Uint8Array(await file.arrayBuffer()), file.name);
            applyImportedDocument(result.document, importMode, targetLayerId);
            setMessage(
              `已导入 ${result.document.features.length} 个要素${result.skipped ? `，跳过 ${result.skipped} 个不支持的要素` : ''}`,
            );
          } catch (error) {
            setMessage(error instanceof Error ? error.message : '导入失败');
          }
          event.target.value = '';
        }}
      />
      {open && (
        <div className="modal-backdrop">
          <section className="app-dialog" role="dialog" aria-modal="true" aria-label="文件交换">
            <div className="panel-header">
              导入与导出
              <button onClick={() => setOpen(false)} aria-label="关闭文件">
                ×
              </button>
            </div>
            <div className="panel-body">
              <label className="field">
                导入方式
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as typeof importMode)}
                >
                  <option value="append">追加为新图层</option>
                  <option value="active">合并到活动图层</option>
                  <option value="target">导入到指定图层</option>
                  <option value="replace">替换文档（可撤销）</option>
                </select>
              </label>
              {importMode === 'target' && (
                <label className="field">
                  目标图层
                  <select
                    value={targetLayerId}
                    onChange={(event) => {
                      setTargetLayerId(event.target.value);
                      setActiveLayer(event.target.value);
                    }}
                  >
                    {doc.layers.map((layer) => (
                      <option key={layer.id} value={layer.id} disabled={layer.locked}>
                        {layer.name}
                        {layer.locked ? '（已锁定）' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button disabled={readOnly} onClick={() => fileInput.current?.click()}>
                选择文件导入
              </button>
              <button
                disabled={readOnly}
                onClick={() => {
                  setOpen(false);
                  setAfsimOpen(true);
                }}
              >
                导入 AFSIM 想定文件夹
              </button>
              <button
                disabled={readOnly}
                onClick={() => {
                  setOpen(false);
                  setOverlay(true);
                }}
              >
                图像与在线图层
              </button>
              <hr />
              <label className="field">
                {afsimText('scope')}
                <select value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="all">{afsimText('all')}</option>
                  <option value="active">{afsimText('active')}</option>
                </select>
              </label>
              <label className="field">
                格式
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="afsim">{afsimText('format')}</option>
                  <option value="milxlyz">MilX ZIP 压缩图层</option>
                  <option value="milxly">MilX XML 图层</option>
                  <option value="milx">MilX XML</option>
                  <option value="kml">KML</option>
                  <option value="geojson">GeoJSON</option>
                  <option value="json">项目备份 JSON</option>
                </select>
              </label>
              <button onClick={() => exportFile()}>下载文件</button>
              <button onClick={() => exportAfsim()}>{afsimText('export')}</button>
              <p className="empty-hint">{afsimText('snapshot')}</p>
              <p role="status">{message}</p>
              {afsimReport && (
                <details>
                  <summary>{afsimText('report', { count: afsimReport.warnings.length })}</summary>
                  <p>
                    {afsimText('entry', {
                      entry: afsimReport.entry,
                      count: afsimReport.files.length,
                    })}
                  </p>
                  {afsimReport.warnings.length > 0 && (
                    <ul>
                      {afsimReport.warnings.slice(0, 100).map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  {afsimReport.warnings.length > 100 && <p>{afsimText('more')}</p>}
                  <button
                    onClick={() =>
                      downloadText(
                        [
                          afsimText('entry', {
                            entry: afsimReport.entry,
                            count: afsimReport.files.length,
                          }),
                          afsimText('done', {
                            count: afsimReport.exported,
                            skipped: afsimReport.skipped,
                          }),
                          '',
                          ...afsimReport.warnings,
                        ].join('\n'),
                        { filename: 'afsim-export-report.txt', mimeType: 'text/plain' },
                      )
                    }
                  >
                    {afsimText('downloadReport')}
                  </button>
                </details>
              )}
            </div>
          </section>
        </div>
      )}
      {overlay && <OverlayDialog onClose={() => setOverlay(false)} />}
      {afsimOpen && (
        <AfsimImportDialog
          mode={importMode}
          targetLayerId={targetLayerId}
          onClose={() => setAfsimOpen(false)}
        />
      )}
      {share && <ShareDialog onClose={() => setShare(false)} />}
      {print && <PrintDialog onClose={() => setPrint(false)} />}
    </div>
  );
}
