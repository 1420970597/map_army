/** 在线文件处理进入后端；离线时明确使用现有本地交换能力。 */
import { api, type AssetRecord } from './api';
import { backendAvailable } from './sync';
import { parseMapFile } from '@/core/io/files';
import type { MapDocument } from '@/core/model';
import type { AfsimExportResult, AfsimSourceFile, AfsimImportResult } from '@/core/io';
import { afsimFilesToDocument } from '@/core/io/afsim';

export async function importMapData(data: Uint8Array, name: string) {
  if (!backendAvailable()) return parseMapFile(data, name);
  const body = new FormData();
  body.append('file', new Blob([new Uint8Array(data)]), name);
  return api<{ document: MapDocument; skipped: number }>('/exchange/import', {
    method: 'POST',
    body,
  });
}

export async function importAfsimData(
  files: readonly AfsimSourceFile[],
  entry: string,
): Promise<AfsimImportResult> {
  if (!backendAvailable()) return afsimFilesToDocument(files, entry);
  const selected = files.filter((file) => /\.(txt|afsim|wsf|afproj)$/i.test(file.path));
  const data = await Promise.all(
    selected.map(async (file) => ({ path: file.path, content: await file.readText() })),
  );
  return api('/exchange/afsim', { method: 'POST', body: JSON.stringify({ files: data, entry }) });
}

export interface BackendExport extends Omit<AfsimExportResult, 'archive'> {
  asset: AssetRecord;
  warnings: string[];
}
export async function exportMapData(
  document: MapDocument,
  format: string,
  options?: Record<string, unknown>,
): Promise<BackendExport> {
  const params = new URLSearchParams(window.location.search);
  const query = new URLSearchParams();
  for (const key of ['share', 'version']) if (params.has(key)) query.set(key, params.get(key)!);
  return api(`/exchange/export?${query}`, {
    method: 'POST',
    body: JSON.stringify({ document, format, options }),
  });
}
export async function downloadAsset(asset: AssetRecord) {
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error('导出文件无法读取');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = asset.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
