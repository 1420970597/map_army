import { strToU8, zipSync, type Zippable } from 'fflate';
import type { MapDocument, MapFeature } from '../model';
import { AFSIM_LIMITS } from './afsim/source';
import { afsimSymbolForSidc } from './afsim/symbol';
import { afsimExportText } from './afsim/exportText';

/** 未传 layerIds 时导出全部图层，包括隐藏和锁定的图层；导出不修改文档。 */
export interface AfsimExportOptions {
  name?: string;
  layerIds?: readonly string[];
  language?: string;
}

/** 想定目录中的 UTF-8 文本文件。 */
export interface AfsimExportFile {
  path: string;
  content: string;
}

/** 静态想定及诊断；ZIP 中只引用同一目录内生成的文件。 */
export interface AfsimExportResult {
  archive: Uint8Array;
  files: readonly AfsimExportFile[];
  entry: 'main.txt';
  exported: number;
  skipped: number;
  warnings: readonly string[];
}

/** 避免路径穿越、Windows 保留名称和闭合关键字；跨平台使用 ASCII 文件名。 */
function safeName(value: string, fallback: string): string {
  const name =
    value
      .normalize('NFKC')
      .replace(/[^A-Za-z0-9_-]+/g, '_')
      .replace(/^[_-]+|[_-]+$/g, '')
      .slice(0, 48) || fallback;
  return /^(?:\d|end_|con$|prn$|aux$|nul$|com[1-9]$|lpt[1-9]$)/i.test(name) ? `map_${name}` : name;
}

function uniqueName(value: string, fallback: string, used: Set<string>): string {
  const base = safeName(value, fallback);
  let name = base;
  let index = 2;
  while (used.has(name.toLowerCase())) name = `${base}_${index++}`;
  used.add(name.toLowerCase());
  return name;
}

/** UtInputBuffer 不解码反斜杠转义；转换危险字符，不允许名称成为宏或额外命令。 */
function displayText(value: string): string {
  return Array.from(value)
    .map((char) => {
      const code = char.codePointAt(0)!;
      if (code < 32 || (code >= 127 && code <= 159) || /\s/.test(char)) return ' ';
      if (char === '"') return '＂';
      if (char === '\\') return '＼';
      if (char === '$') return '＄';
      return char;
    })
    .join('')
    .slice(0, 256);
}

function coordinate(value: number, positive: string, negative: string): string {
  // 固定小数避免极小坐标变为指数形式；精度约为 0.01 毫米。
  const degrees = Math.abs(value)
    .toFixed(10)
    .replace(/\.?0+$/, '');
  return `${degrees || '0'}${value < 0 ? negative : positive}`;
}

function altitude(value: string): string | null {
  const match =
    /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s+(m|meter|meters|km|ft|feet|yd|mi|nm)(?:\s+(agl|msl))?$/i.exec(
      value.trim(),
    );
  if (!match || !Number.isFinite(Number(match[1]))) return null;
  const units: Record<string, string> = { meter: 'm', meters: 'm', feet: 'ft' };
  const unit = match[2].toLowerCase();
  return `${Number(match[1])} ${units[unit] ?? unit} ${(match[3] ?? 'msl').toLowerCase()}`;
}

function projectFile(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<wsf-ide-project-file>
 <wsf-ide-project project-directory="">
  <wsf-ide-scenario command-line-args="$(SCENARIO_FILES)" working-directory="">
   <file-item file-path="main.txt" file-type="file-main-source"/>
  </wsf-ide-scenario>
 </wsf-ide-project>
</wsf-ide-project-file>
`;
}

/** 生成 AFSIM 原生静态平台目录。SIDC 经标准 aux_data 保留，不推断仿真动力学和组件。 */
export function documentToAfsim(
  document: MapDocument,
  options: AfsimExportOptions = {},
): AfsimExportResult {
  const language = options.language ?? 'zh';
  const t = (
    key: Parameters<typeof afsimExportText>[1],
    values?: Record<string, string | number>,
  ) => afsimExportText(language, key, values);
  const selected = options.layerIds ? new Set(options.layerIds) : null;
  const layerIds = new Set(document.layers.map((layer) => layer.id));
  if (selected && [...selected].some((id) => !layerIds.has(id))) throw new Error(t('invalidLayer'));
  const layers = document.layers
    .filter((layer) => !selected || selected.has(layer.id))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  if (layers.length + 3 > AFSIM_LIMITS.files || layerIds.size !== document.layers.length)
    throw new Error(t('limit'));
  const warnings: string[] = [t('snapshot')];
  const grouped = new Map(layers.map((layer) => [layer.id, [] as MapFeature[]]));
  let skipped = 0;
  let exported = 0;
  for (const feature of document.features) {
    const group = grouped.get(feature.layerId);
    if (group) group.push(feature);
    else if (!selected && !layerIds.has(feature.layerId)) {
      skipped++;
      warnings.push(t('skipped', { name: displayText(feature.name || feature.id) }));
    }
  }
  const usedPlatformNames = new Set<string>();
  const usedLayerNames = new Set<string>();
  const platformFiles: AfsimExportFile[] = [];
  const includes: string[] = [];
  for (const [index, layer] of layers.entries()) {
    const path = `platforms/${uniqueName(layer.group || layer.name, `layer_${index + 1}`, usedLayerNames)}.txt`;
    const rows: string[] = [`# 图层：${displayText(layer.name)}`, ''];
    if (layer.image || layer.sourceUrl)
      warnings.push(t('external', { name: displayText(layer.name) }));
    for (const feature of grouped.get(layer.id)!) {
      const name = displayText(feature.name || feature.textFields.uniqueDesignation || feature.id);
      const symbol = afsimSymbolForSidc(feature.sidc);
      const point = feature.geometry.kind === 'point' ? feature.geometry.position : null;
      if (
        !point ||
        !Number.isFinite(point.lat) ||
        !Number.isFinite(point.lon) ||
        Math.abs(point.lat) > 90 ||
        Math.abs(point.lon) > 180 ||
        !symbol ||
        feature.symbolKind === 'multiPoint' ||
        feature.graphicType ||
        feature.measurement
      ) {
        skipped++;
        warnings.push(t('skipped', { name }));
        continue;
      }
      if (++exported > AFSIM_LIMITS.platforms) throw new Error(t('limit'));
      if (feature.name && name !== feature.name) warnings.push(t('nameChanged', { name }));
      if (feature.customSymbolId || feature.customSymbolSvg) warnings.push(t('custom', { name }));
      const rawAltitude = feature.textFields.altitudeDepth?.trim();
      const height = rawAltitude ? altitude(rawAltitude) : '0 m msl';
      if (!height) warnings.push(t('altitude', { name }));
      let heading = 0;
      if (feature.direction !== undefined) {
        if (Number.isFinite(feature.direction)) heading = ((feature.direction % 360) + 360) % 360;
        else warnings.push(t('heading', { name }));
      }
      const identifier = uniqueName(
        feature.name || feature.textFields.uniqueDesignation || '',
        `unit_${exported}`,
        usedPlatformNames,
      );
      rows.push(
        `platform ${identifier} WSF_PLATFORM`,
        `  side ${symbol.side}`,
        `  spatial_domain ${symbol.domain}`,
        `  icon ${symbol.icon}`,
        `  marking "${name}"`,
        `  position ${coordinate(point.lat, 'N', 'S')} ${coordinate(point.lon, 'E', 'W')}`,
        `  altitude ${height ?? '0 m msl'}`,
        `  heading ${heading} deg`,
        '  aux_data',
        `    string map_army_sidc = "${feature.sidc}"`,
        '  end_aux_data',
        'end_platform',
        '',
      );
    }
    platformFiles.push({ path, content: rows.join('\n') });
    includes.push(`include_once ${path}`);
  }
  const files: AfsimExportFile[] = [
    {
      path: 'main.txt',
      content: ['# map.army 静态部署想定入口', ...includes, '', 'end_time 1 sec', ''].join('\n'),
    },
    ...platformFiles,
    {
      path: `${safeName(options.name ?? document.name, 'map_army_scenario')}.afproj`,
      content: projectFile(),
    },
    {
      path: 'README.txt',
      content: [
        displayText(document.name),
        '',
        t('done', { count: exported, skipped }),
        '',
        'main.txt / *.afproj',
        'platforms/*.txt',
        '',
        ...warnings,
        '',
        'SIDC: aux_data.string map_army_sidc',
        '',
      ].join('\n'),
    },
  ];
  let bytes = 0;
  const entries: Zippable = {};
  for (const file of files) {
    const content = strToU8(file.content);
    bytes += content.length;
    if (bytes > AFSIM_LIMITS.bytes) throw new Error(t('limit'));
    entries[file.path] = [content, { mtime: new Date(1980, 0, 1) }];
  }
  return { archive: zipSync(entries), files, entry: 'main.txt', exported, skipped, warnings };
}

/** 直接取得想定目录的 ZIP 字节。需要诊断时使用 documentToAfsim。 */
export function exportAfsimArchive(
  document: MapDocument,
  options: AfsimExportOptions = {},
): Uint8Array {
  return documentToAfsim(document, options).archive;
}
