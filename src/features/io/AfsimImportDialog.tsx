import { useEffect, useRef, useState } from 'react';
import {
  afsimEntryPaths,
  afsimFilesToDocument,
  type AfsimImportResult,
  type AfsimSourceFile,
} from '@/core/io/afsim';
import { downloadText } from '@/core/io';
import { useAccessStore } from '@/stores/useAccessStore';
import { getMap } from '@/features/map/mapInstance';
import { useViewStore } from '@/stores/useViewStore';
import { applyImportedDocument } from './importDocument';

/** 目录索引和解析预览与文档写入分离；取消、失败和空结果均不修改地图。 */
export function AfsimImportDialog({
  mode,
  targetLayerId,
  onClose,
}: {
  mode: 'append' | 'replace' | 'active' | 'target';
  targetLayerId: string;
  onClose(): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);
  const generation = useRef(0);
  const [files, setFiles] = useState<AfsimSourceFile[]>([]);
  const [entries, setEntries] = useState<string[]>([]);
  const [entry, setEntry] = useState('');
  const [result, setResult] = useState<AfsimImportResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const readOnly = useAccessStore((state) => state.readOnly);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  const parse = async () => {
    const request = ++generation.current;
    setBusy(true);
    setResult(null);
    setMessage('正在读取想定及依赖文件…');
    try {
      const parsed = await afsimFilesToDocument(files, entry);
      if (request !== generation.current) return;
      setResult(parsed);
      setApplied(false);
      setMessage(
        `可绘制 ${parsed.document.features.length} 个单位，跳过 ${parsed.skipped} 个；读取 ${parsed.sources.length} 个文件`,
      );
    } catch (error) {
      if (request === generation.current)
        setMessage(error instanceof Error ? error.message : 'AFSIM 解析失败');
    } finally {
      if (request === generation.current) setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <section
        ref={panel}
        tabIndex={-1}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="AFSIM 想定导入"
        onPasteCapture={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
          if (event.key === 'Tab') {
            const controls = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), select:not(:disabled), summary',
              ),
            ).filter((element) => element.getClientRects().length > 0);
            const first = controls[0];
            const last = controls.at(-1);
            if (
              event.shiftKey &&
              (document.activeElement === first || document.activeElement === panel.current)
            ) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="panel-header">
          AFSIM 想定导入
          <button onClick={onClose} aria-label="关闭 AFSIM 导入">
            ×
          </button>
        </div>
        <div className="panel-body">
          <p>
            选择想定文件夹和入口文件，解析后将静态部署单位绘制到地图。公共类型库需包含在所选文件夹内。
          </p>
          <p>
            沿用文件交换中的导入方式：
            {
              {
                append: '追加为新图层',
                active: '合并到活动图层',
                target: '导入到指定图层',
                replace: '替换文档（可撤销）',
              }[mode]
            }
            。按阵营分层，blue 为友军、red 为敌军、neutral 为中立，其他名称为未知。
          </p>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            aria-label="AFSIM 文件夹"
            {...{ webkitdirectory: '', directory: '' }}
            onChange={(event) => {
              const selected = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              if (!selected.length) return;
              generation.current++;
              setResult(null);
              setBusy(false);
              setApplied(false);
              try {
                const sourceFiles = selected.map((file): AfsimSourceFile => ({
                  path: file.webkitRelativePath
                    ? file.webkitRelativePath.split('/').slice(1).join('/')
                    : file.name,
                  size: file.size,
                  readText: async () => {
                    try {
                      return new TextDecoder('utf-8', { fatal: true }).decode(
                        await file.arrayBuffer(),
                      );
                    } catch {
                      throw new Error(`${file.name}：无法读取 UTF-8 文本，请检查文件编码`);
                    }
                  },
                }));
                const paths = afsimEntryPaths(sourceFiles);
                setFiles(sourceFiles);
                setEntries(paths);
                setEntry(paths[0] ?? '');
                setMessage(
                  paths.length
                    ? `已选择 ${selected.length} 个文件，请确认入口`
                    : '文件夹中没有 .txt/.afproj/.afsim/.wsf 入口',
                );
              } catch (error) {
                setFiles([]);
                setEntries([]);
                setEntry('');
                setMessage(error instanceof Error ? error.message : '目录无法读取');
              }
            }}
          />
          <button disabled={busy || readOnly} onClick={() => input.current?.click()}>
            选择想定文件夹
          </button>
          {entries.length > 0 && (
            <label className="field">
              想定入口
              <select
                value={entry}
                disabled={busy}
                onChange={(event) => {
                  setEntry(event.target.value);
                  setResult(null);
                  setApplied(false);
                  setMessage('入口已更改，请重新解析');
                }}
              >
                {entries.map((path) => (
                  <option value={path} key={path}>
                    {path}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button disabled={!entry || busy || readOnly} onClick={() => void parse()}>
            解析想定
          </button>
          <p role="status">{message}</p>
          {result && (
            <>
              <p>
                仅绘制静态位置；脚本、轨道初始化及仿真过程不会执行。军标按阵营与运动域映射，可在导入后编辑。
              </p>
              <details>
                <summary>诊断报告（{result.warnings.length} 项）</summary>
                <ul>
                  {result.warnings.slice(0, 100).map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
                {result.warnings.length > 100 && <p>完整报告可下载查看。</p>}
                <button
                  onClick={() =>
                    downloadText(
                      [message, ...result.warnings, '', '读取文件：', ...result.sources].join('\n'),
                      { filename: 'afsim-import-report.txt', mimeType: 'text/plain' },
                    )
                  }
                >
                  下载诊断报告
                </button>
              </details>
              <button
                disabled={readOnly || applied || !result.document.features.length}
                onClick={() => {
                  try {
                    applyImportedDocument(result.document, mode, targetLayerId);
                    setApplied(true);
                    setMessage(`已绘制 ${result.document.features.length} 个单位；可撤销整次导入`);
                    const points = result.document.features.flatMap((feature) =>
                      feature.geometry.kind === 'point' ? [feature.geometry.position] : [],
                    );
                    const map = getMap();
                    if (map && !useViewStore.getState().is3d)
                      map.fitBounds(
                        points.map((point) => [point.lat, point.lon]),
                        { padding: [60, 60], maxZoom: 12 },
                      );
                    else if (points[0]) useViewStore.getState().setCenter(points[0]);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : '导入失败');
                  }
                }}
              >
                绘制到地图
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
