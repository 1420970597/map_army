/** 文件入口统一识别 ZIP/XML、旧 gzip/JSON、KML、GeoJSON 与 NVG。 */
import { unzipSync, zipSync, strFromU8, strToU8, gunzipSync } from 'fflate';
import { createId, createDocument, createFeature, type MapDocument } from '../model';
import { documentToMilxXml, milxXmlToDocument } from './milxNative';
import { deserializeMilxly } from './milxly';
import { kmlToDocument } from './kml';
import { geoJsonToDocument } from './geojson';
import { parseXml, record, list, xmlText, type XmlRecord } from './xml';

/** 文件读取总上限，避免损坏压缩包无限占用内存。 */
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

/** 生成与原站相同的 ZIP 容器，内部包含一个 .milxly XML。 */
export function exportMilxArchive(doc: MapDocument): Uint8Array {
  return zipSync({ 'Layer.milxly': strToU8(documentToMilxXml(doc)) });
}

/** 读取文件魔数后解析，避免把压缩字节误当成文本。 */
export function parseMapFile(
  data: Uint8Array,
  name: string,
): { document: MapDocument; skipped: number } {
  if (data.length > MAX_FILE_BYTES) throw new Error('文件过大，最大支持 32 MB');
  if (data[0] === 0x50 && data[1] === 0x4b) {
    let total = 0;
    const entries = unzipSync(data, {
      filter: (entry) => {
        total += entry.originalSize;
        if (total > MAX_FILE_BYTES) throw new Error('解压后文件过大');
        return /\.(milxly|milx|kml|json|geojson)$/i.test(entry.name);
      },
    });
    const values = Object.entries(entries);
    if (!values.length) throw new Error('压缩包中没有支持的标图文件');
    const results = values.map(([filename, bytes]) => parseMapFile(bytes, filename));
    const combined = createDocument(name);
    combined.layers = [];
    combined.features = [];
    for (const result of results) {
      const ids = new Map(result.document.layers.map((layer) => [layer.id, createId('lyr')]));
      combined.layers.push(
        ...result.document.layers.map((layer) => ({
          ...layer,
          id: ids.get(layer.id)!,
          order: combined.layers.length + layer.order,
        })),
      );
      combined.features.push(
        ...result.document.features.map((f) => ({
          ...f,
          id: createId('ft'),
          layerId: ids.get(f.layerId) ?? combined.layers[0].id,
        })),
      );
    }
    return {
      document: combined,
      skipped: results.reduce((sum, result) => sum + result.skipped, 0),
    };
  }
  if (data[0] === 0x1f && data[1] === 0x8b) {
    const size = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(
      data.length - 4,
      true,
    );
    if (size > MAX_FILE_BYTES) throw new Error('解压后文件过大');
    return parseMapFile(gunzipSync(data), name.replace(/z$/i, ''));
  }
  const text = strFromU8(data)
    .replace(/^\uFEFF/, '')
    .trim();
  if (text.startsWith('<')) {
    if (/<(?:\w+:)?kml[\s>]/i.test(text)) return kmlToDocument(text, name, createId('lyr'));
    if (/<(?:\w+:)?nvg[\s>]/i.test(text)) return nvgToDocument(text, name);
    return milxXmlToDocument(text, name);
  }
  const json: unknown = JSON.parse(text);
  if (record(json).type === 'FeatureCollection')
    return geoJsonToDocument(
      json as Parameters<typeof geoJsonToDocument>[0],
      name,
      createId('lyr'),
    );
  return deserializeMilxly(text);
}

/** NVG 2.0 点、折线与区域导入；递归处理分组，未知元素计入跳过数量。 */
export function nvgToDocument(
  text: string,
  name: string,
): { document: MapDocument; skipped: number } {
  const root = record(parseXml(text).nvg);
  if (!Object.keys(root).length) throw new Error('NVG 根节点无效');
  const version = xmlText(root['@_version']);
  if (version && !['2.0.0', '2.0.2', '2.0'].includes(version))
    throw new Error(`不支持 NVG ${version}`);
  const doc = createDocument(name);
  let skipped = 0;
  const walk = (node: XmlRecord) => {
    for (const [tag, values] of Object.entries(node)) {
      if (tag.startsWith('@_') || tag === '#text') continue;
      for (const value of list(values)) {
        const item = record(value);
        if (['point', 'text', 'polyline', 'polygon', 'line', 'multipoint'].includes(tag)) {
          const raw = xmlText(item['@_points'] ?? item.points);
          const points =
            tag === 'point' || tag === 'text'
              ? [{ lon: Number(item['@_x']), lat: Number(item['@_y']) }]
              : raw
                  .trim()
                  .split(/\s+/)
                  .map((part) => {
                    const [lon, lat] = part.split(',').map(Number);
                    return { lon, lat };
                  });
          const minimum = tag === 'polygon' ? 3 : tag === 'point' || tag === 'text' ? 1 : 2;
          if (
            points.length < minimum ||
            points.some(
              (p) => !Number.isFinite(p.lon) || !Number.isFinite(p.lat) || Math.abs(p.lat) > 90,
            )
          ) {
            skipped++;
            continue;
          }
          const feature = createFeature({
            layerId: doc.layers[0].id,
            sidc: xmlText(item['@_symbol']).replace(/^.*:/, '') || '10031000000000000000',
            name: xmlText(item['@_label'] ?? item['@_text']),
            geometry:
              minimum === 1
                ? { kind: 'point', position: points[0] }
                : { kind: tag === 'polygon' ? 'area' : 'line', points },
          });
          doc.features.push(feature);
        } else if (tag === 'g' || tag === 'group') walk(item);
        else if (!['metadata', 'title', 'desc', 'content'].includes(tag)) skipped++;
      }
    }
  };
  walk(root);
  return { document: doc, skipped };
}
