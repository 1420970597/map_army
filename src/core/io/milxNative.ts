/** 原生 MilX V3.1 XML，依据 gs-soft 公开样例读取图层、MSS 符号与参考点。 */
import {
  createDocument,
  createLayer,
  createFeature,
  type MapDocument,
  type MapFeature,
  type TacticalGraphicType,
} from '../model';
import { swissToLonLat } from '../geo/extended';
import { deserializeMilxly, serializeMilxly } from './milxly';
import { parseXml, record, list, xmlText, escapeXml } from './xml';

const GRAPHICS: Record<string, TacticalGraphicType> = {
  OLAGM: 'attackArrow',
  OLAGS: 'axisOfAdvance',
  GAA: 'assemblyArea',
  GLB: 'boundary',
  GLP: 'phaseLine',
  ALC: 'corridor',
  DLP: 'defenceLine',
};

/** 从原生 MilX 读取；15 位字母军标代码保留原值，不进行错误的数字填充。 */
export function milxXmlToDocument(
  text: string,
  name: string,
): { document: MapDocument; skipped: number } {
  const xml = parseXml(text);
  const root = record(xml.MilXDocument_Layer ?? xml.MilXDocument);
  if (!Object.keys(root).length) throw new Error('XML 根节点不是受支持的原生 MilX 文档');
  if (root.MapArmyDocument) {
    try {
      return deserializeMilxly(xmlText(root.MapArmyDocument));
    } catch {
      /* 扩展字段不可用时继续读取原生节点。 */
    }
  }
  const doc = createDocument(name);
  doc.layers = [];
  doc.features = [];
  let skipped = 0;
  for (const value of list(root.MilXLayer ?? record(root.LayerList).MilXLayer)) {
    const raw = record(value);
    const layer = createLayer({
      name: xmlText(raw.Name) || `图层 ${doc.layers.length + 1}`,
      order: doc.layers.length,
    });
    layer.visible = xmlText(raw.Visible) !== 'false';
    layer.status = /approved/i.test(xmlText(raw.LayerType)) ? 'approved' : 'working';
    doc.layers.push(layer);
    const coordinateSystem = xmlText(raw.CoordSystemType ?? root.CoordSystemType);
    for (const item of list(record(raw.GraphicList).MilXGraphic)) {
      try {
        const graphic = record(item);
        const mss = xmlText(graphic.MssStringXML);
        const symbol = record(parseXml(mss).Symbol);
        const sidc = xmlText(symbol['@_ID']);
        if (!sidc) {
          skipped++;
          continue;
        }
        const points = list(record(graphic.PointList).Point).map((point) => {
          const p = record(point),
            x = Number(p.X),
            y = Number(p.Y);
          return /SwissLv03/i.test(coordinateSystem) || Math.abs(x) > 180
            ? swissToLonLat({ x, y }, 'LV03')
            : { lon: x, lat: y };
        });
        if (
          !points.length ||
          points.some(
            (p) => !Number.isFinite(p.lon) || !Number.isFinite(p.lat) || Math.abs(p.lat) > 90,
          )
        ) {
          skipped++;
          continue;
        }
        const code = sidc.slice(4, 10).replace(/-+$/, '');
        const graphicType = GRAPHICS[code];
        const area = !graphicType && /^G/.test(sidc) && (code.startsWith('OA') || code === 'GAA');
        const geometry: MapFeature['geometry'] =
          points.length === 1
            ? { kind: 'point', position: points[0] }
            : { kind: area && points.length >= 3 ? 'area' : 'line', points };
        const feature = createFeature({
          layerId: layer.id,
          sidc,
          name: xmlText(graphic.Name),
          geometry,
          graphicType,
          symbolKind: graphicType ? 'multiPoint' : undefined,
        });
        for (const a of list(symbol.Attribute).map(record)) {
          const key = (
            {
              G: 'uniqueDesignation',
              H: 'higherFormation',
              T: 'uniqueDesignation',
              M: 'higherFormation',
              W: 'dtg',
              C: 'quantity',
            } as const
          )[String(a['@_ID']) as 'G'];
          if (key) feature.textFields[key] = xmlText(a);
        }
        feature.nativeMss = mss;
        doc.features.push(feature);
      } catch {
        skipped++;
      }
    }
  }
  if (!doc.layers.length) throw new Error('MilX 文档没有可读取的图层');
  return { document: doc, skipped };
}

/** 生成原生 XML，并用独立命名空间保存完整内部字段以保障往返。 */
export function documentToMilxXml(doc: MapDocument): string {
  const cSidc = (feature: MapFeature): string => {
    if (feature.sidc.length === 15) return feature.sidc;
    const affiliation =
      ({ '3': 'F', '6': 'H', '4': 'N', '5': 'U' } as Record<string, string>)[feature.sidc[3]] ??
      'U';
    if (feature.graphicType) {
      const code =
        Object.entries(GRAPHICS).find(([, type]) => type === feature.graphicType)?.[0] ?? 'GLB';
      return `G${affiliation}G-${code.padEnd(6, '-')}-----`;
    }
    const entity = feature.sidc.slice(10, 16);
    const code =
      ({ '121100': 'UCI---', '120100': 'UCA---', '130100': 'UCF---' } as Record<string, string>)[
        entity
      ] ?? 'U-----';
    return `S${affiliation}G-${code}-----`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?><MilXDocument_Layer xmlns="http://gs-soft.com/MilX/V3.1" xmlns:maparmy="https://map-army.local/schema/1"><MssLibraryVersionTag>2019.10.01</MssLibraryVersionTag>${doc.layers
    .map(
      (layer) =>
        `<MilXLayer><Name>${escapeXml(layer.name)}</Name><LayerType>${layer.status === 'approved' ? 'Approved' : 'Normal'}</LayerType><CoordSystemType>WGS84</CoordSystemType><GraphicList>${doc.features
          .filter((f) => f.layerId === layer.id)
          .map((f) => {
            const mss = `<Symbol ID="${escapeXml(cSidc(f))}"><Attribute ID="G">${escapeXml(f.textFields.uniqueDesignation)}</Attribute><Attribute ID="H">${escapeXml(f.textFields.higherFormation)}</Attribute></Symbol>`;
            const points = f.geometry.kind === 'point' ? [f.geometry.position] : f.geometry.points;
            return `<MilXGraphic><MssStringXML>${escapeXml(f.nativeMss ?? mss)}</MssStringXML><Name>${escapeXml(f.name)}</Name><PointList>${points.map((p) => `<Point><X>${p.lon}</X><Y>${p.lat}</Y></Point>`).join('')}</PointList></MilXGraphic>`;
          })
          .join('')}</GraphicList></MilXLayer>`,
    )
    .join(
      '',
    )}<maparmy:MapArmyDocument>${escapeXml(serializeMilxly(doc))}</maparmy:MapArmyDocument></MilXDocument_Layer>`;
}
