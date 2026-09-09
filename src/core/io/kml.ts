/** KML 2.2 点、线、面互转；扩展属性保留本应用全部要素字段与图层。 */
import {
  createDocument,
  createLayer,
  createFeature,
  type MapDocument,
  type MapFeature,
} from '../model';
import { deserializeMilxly, serializeMilxly } from './milxly';
import { parseXml, record, list, xmlText, escapeXml, type XmlRecord } from './xml';

/** 序列化 KML，所有控制点及元数据作为 ExtendedData 保留。 */
export function documentToKml(doc: MapDocument): string {
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(doc.name)}</name>${doc.layers
    .map(
      (layer) =>
        `<Folder><name>${escapeXml(layer.name)}</name><visibility>${layer.visible ? 1 : 0}</visibility>${doc.features
          .filter((f) => f.layerId === layer.id)
          .map((feature) => {
            const geo = feature.geometry;
            const points = geo.kind === 'point' ? [geo.position] : geo.points;
            const closed =
              geo.kind === 'area' &&
              points.length &&
              (points[0].lon !== points.at(-1)!.lon || points[0].lat !== points.at(-1)!.lat)
                ? [...points, points[0]]
                : points;
            const coords = closed.map((p) => `${p.lon},${p.lat},0`).join(' ');
            const geometry =
              geo.kind === 'point'
                ? `<Point><coordinates>${coords}</coordinates></Point>`
                : geo.kind === 'line'
                  ? `<LineString><coordinates>${coords}</coordinates></LineString>`
                  : `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
            return `<Placemark><name>${escapeXml(feature.name)}</name><ExtendedData><Data name="map-army"><value>${escapeXml(JSON.stringify(feature))}</value></Data></ExtendedData>${geometry}</Placemark>`;
          })
          .join('')}</Folder>`,
    )
    .join('')}</Document></kml>`;
}

/** 解析 Folder、MultiGeometry 与命名空间；不支持的几何有明确跳过计数。 */
export function kmlToDocument(
  text: string,
  name: string,
  defaultLayerId?: string,
): { document: MapDocument; skipped: number } {
  const root = parseXml(text);
  if (!root.kml) throw new Error('XML 根节点不是 KML');
  const doc = createDocument(name);
  doc.layers = [];
  doc.features = [];
  let skipped = 0;
  const walk = (node: XmlRecord, parentName: string) => {
    const layerName = xmlText(node.name) || parentName;
    const layer = createLayer({
      name: layerName,
      order: doc.layers.length,
      visible: xmlText(node.visibility) !== '0',
    });
    if (defaultLayerId && doc.layers.length === 0) layer.id = defaultLayerId;
    const marks = list(node.Placemark);
    if (marks.length) doc.layers.push(layer);
    for (const value of marks) {
      const mark = record(value);
      const extra = list(record(mark.ExtendedData).Data)
        .map(record)
        .find((d) => d['@_name'] === 'map-army');
      let metadata: Partial<MapFeature> = {};
      try {
        if (extra) metadata = record(JSON.parse(xmlText(extra.value)));
      } catch {
        /* 外部扩展数据损坏时仍导入可用的几何。 */
      }
      const readGeo = (node: XmlRecord): MapFeature['geometry'][] => {
        if (node.MultiGeometry) return list(node.MultiGeometry).flatMap((m) => readGeo(record(m)));
        return ['Point', 'LineString', 'Polygon'].flatMap((kind) =>
          list(node[kind]).flatMap<MapFeature['geometry']>((g) => {
            const geo = record(g);
            const raw =
              kind === 'Polygon'
                ? record(record(record(geo.outerBoundaryIs).LinearRing)).coordinates
                : geo.coordinates;
            const points = xmlText(raw)
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .map((c) => {
                const [lon, lat] = c.split(',').map(Number);
                return { lon, lat };
              });
            if (
              points.some(
                (p) =>
                  !Number.isFinite(p.lon) ||
                  !Number.isFinite(p.lat) ||
                  Math.abs(p.lat) > 90 ||
                  Math.abs(p.lon) > 180,
              )
            )
              return [];
            if (kind === 'Point')
              return points.length ? [{ kind: 'point' as const, position: points[0] }] : [];
            if (
              kind === 'Polygon' &&
              points.length > 1 &&
              points[0].lon === points.at(-1)!.lon &&
              points[0].lat === points.at(-1)!.lat
            )
              points.pop();
            if (points.length < (kind === 'Polygon' ? 3 : 2)) return [];
            return [{ kind: kind === 'Polygon' ? ('area' as const) : ('line' as const), points }];
          }),
        );
      };
      const geometries = readGeo(mark);
      if (!geometries.length) skipped++;
      for (const geometry of geometries) {
        const base = createFeature({
          layerId: layer.id,
          sidc: '10031000000000000000',
          name: xmlText(mark.name),
          geometry,
        });
        doc.features.push({ ...base, ...metadata, id: base.id, layerId: layer.id, geometry });
      }
    }
    for (const key of ['Document', 'Folder'])
      for (const child of list(node[key])) walk(record(child), layerName);
  };
  walk(record(root.kml), name);
  if (!doc.layers.length) doc.layers = createDocument().layers;
  const normalized = deserializeMilxly(serializeMilxly(doc));
  return { document: normalized.document, skipped: skipped + normalized.skipped };
}
