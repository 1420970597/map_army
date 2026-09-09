/** 验证用户实际交换路径，特别是非 ASCII 文本、图层及压缩文件往返。 */
import { describe, it, expect } from 'vitest';
import { gzipSync, strToU8 } from 'fflate';
import { createDocument, createFeature, createLayer } from '../model';
import { documentToKml, kmlToDocument } from './kml';
import { serializeMilxly } from './milxly';
import { parseMapFile, exportMilxArchive, nvgToDocument } from './files';
import { milxXmlToDocument } from './milxNative';

function example() {
  const doc = createDocument('中文 & 图层');
  doc.layers.push(createLayer({ name: '第二层' }));
  doc.features = [
    createFeature({
      layerId: doc.layers[0].id,
      sidc: '10031000001211000000',
      geometry: { kind: 'point', position: { lon: 8.5, lat: 47.4 } },
      textFields: { uniqueDesignation: '一连<&>' },
    }),
    createFeature({
      layerId: doc.layers[1].id,
      sidc: '10032500009000010000',
      geometry: {
        kind: 'line',
        points: [
          { lon: 8, lat: 47 },
          { lon: 9, lat: 47.5 },
        ],
      },
      graphicType: 'attackArrow',
      graphicParams: { widthRatio: 0.4 },
    }),
  ];
  return doc;
}

describe('跨格式交换', () => {
  it('KML 往返保留图层、战术参数和中文字段', () => {
    const doc = example();
    const loaded = kmlToDocument(documentToKml(doc), doc.name);
    expect(loaded.skipped).toBe(0);
    expect(loaded.document.layers.map((l) => l.name)).toEqual(doc.layers.map((l) => l.name));
    expect(
      loaded.document.features.map((f) => [f.geometry, f.textFields, f.graphicParams]),
    ).toEqual(doc.features.map((f) => [f.geometry, f.textFields, f.graphicParams]));
  });
  it('ZIP 容器按原生 XML 解压并保留完整要素', () => {
    const doc = example();
    const archive = exportMilxArchive(doc);
    expect([...archive.slice(0, 2)]).toEqual([0x50, 0x4b]);
    expect(
      parseMapFile(archive, 'example.milxlyz').document.features.map((f) => [
        f.geometry,
        f.textFields,
        f.graphicType,
      ]),
    ).toEqual(doc.features.map((f) => [f.geometry, f.textFields, f.graphicType]));
  });
  it('继续读取旧 gzip JSON 文件', () =>
    expect(
      parseMapFile(gzipSync(strToU8(serializeMilxly(example()))), 'old.milxlyz').document.features,
    ).toHaveLength(2));
  it('读取原站样例结构，不对字母 SIDC 补零', () => {
    const input =
      '<MilXDocument_Layer xmlns="http://gs-soft.com/MilX/V3.1"><MilXLayer><Name>测试</Name><GraphicList><MilXGraphic><MssStringXML>&lt;Symbol ID="SFG-UCI----J---"&gt;&lt;Attribute ID="G"&gt;一连&lt;/Attribute&gt;&lt;/Symbol&gt;</MssStringXML><PointList><Point><X>8.5</X><Y>47.4</Y></Point></PointList></MilXGraphic></GraphicList></MilXLayer></MilXDocument_Layer>';
    const loaded = milxXmlToDocument(input, '原生');
    expect(loaded.skipped).toBe(0);
    expect(loaded.document.features[0]).toMatchObject({
      sidc: 'SFG-UCI----J---',
      textFields: { uniqueDesignation: '一连' },
      geometry: { kind: 'point', position: { lon: 8.5, lat: 47.4 } },
    });
  });
  it('KML 非闭合外环不能丢失最后一个点', () =>
    expect(
      kmlToDocument(
        '<kml><Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>8,47 9,47 9,48</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>',
        '面',
      ).document.features[0].geometry,
    ).toMatchObject({
      kind: 'area',
      points: [
        { lon: 8, lat: 47 },
        { lon: 9, lat: 47 },
        { lon: 9, lat: 48 },
      ],
    }));
  it('拒绝非法 XML 和文档实体', () =>
    expect(() => kmlToDocument('<!DOCTYPE kml><kml/>', '非法')).toThrow());
  it('NVG 支持分组、坐标与未知类型报告', () => {
    const result = nvgToDocument(
      '<nvg version="2.0.2"><g><point x="8" y="47" label="位置"/><polyline points="8,47 9,48"/><unknown/></g></nvg>',
      'NVG',
    );
    expect(result.document.features).toHaveLength(2);
    expect(result.skipped).toBe(1);
  });
});
