/**
 * MilX XML 互操作的单元测试。
 *
 * 覆盖三类性质：
 * 1. 序列化 → 解析的**往返一致性**（除已知的 15↔20 SIDC 差异外不丢字段）；
 * 2. **宽容解析**：不支持的要素被跳过并计数；
 * 3. **SIDC 长度兼容**：15 位输入补 0 到 20 位，20 位原样保留。
 */

import { describe, expect, it } from 'vitest';

import {
  createAreaGeometry,
  createDocument,
  createFeature,
  createLayer,
  createLineGeometry,
  createPointGeometry,
  GeometryKind,
  type MapDocument,
} from '../model';
import {
  documentToMilxXml,
  milxXmlToDocument,
  MILX_XML_NAMESPACE,
  MILX_XML_VERSION,
  sidlPad,
} from './milxXml';

/** 构造一份包含三层三类几何 + 文本修饰符 + 方向的示例文档 */
function sampleDocument(): MapDocument {
  const document = createDocument('XML 往返测试');
  const layerId = document.layers[0].id;

  return {
    ...document,
    layers: [
      {
        id: layerId,
        name: '主图层',
        visible: true,
        locked: false,
        opacity: 0.85,
        order: 5,
      },
      createLayer({ name: '隐藏图层', visible: false, opacity: 0.5 }),
    ],
    features: [
      createFeature({
        layerId,
        sidc: '10031000001211000000',
        name: '步兵连 & <友军>',
        geometry: createPointGeometry(8.5, 47.4),
        textFields: {
          uniqueDesignation: 'A-1',
          higherFormation: '第1旅',
          additionalInformation: '驻训',
          staffComments: '注意 <安全>',
        },
        direction: 45,
      }),
      createFeature({
        layerId,
        sidc: '10061500001101000000',
        name: '进攻轴线',
        geometry: createLineGeometry([
          { lon: 8.0, lat: 47.0 },
          { lon: 9.0, lat: 47.5 },
        ]),
        textFields: { uniqueDesignation: 'AX-2' },
      }),
      createFeature({
        layerId,
        sidc: '10031000000000000000',
        name: '集结地域',
        geometry: createAreaGeometry([
          { lon: 8.2, lat: 47.2 },
          { lon: 8.6, lat: 47.2 },
          { lon: 8.4, lat: 47.5 },
        ]),
      }),
    ],
  };
}

describe('sidlPad', () => {
  it('15 位 SIDC 应在末尾补 5 个 0', () => {
    expect(sidlPad('100310000012110')).toBe('10031000001211000000');
    expect(sidlPad('100310000012110')).toHaveLength(20);
  });

  it('20 位 SIDC 应原样返回', () => {
    const sidc = '10031000001211000000';
    expect(sidlPad(sidc)).toBe(sidc);
  });

  it('15 位输入中夹杂分隔符时应先归一化再补 0', () => {
    // 2525C 系统常见带连字符或空格的写法
    // '10 03 10000 012110' 清洗后是 '100310000012110'（15 位），再补 0
    expect(sidlPad('10 03 10000 012110')).toBe('10031000001211000000');
    expect(sidlPad('10-03-10000-012110')).toBe('10031000001211000000');
  });

  it('非 15 / 20 位长度应原样返回（不做截断）', () => {
    // 上层负责校验长度，此处只保证不破坏输入
    expect(sidlPad('12345')).toBe('12345');
    expect(sidlPad('')).toBe('');
  });
});

describe('documentToMilxXml', () => {
  it('应输出带命名空间与版本属性的根节点', () => {
    const xml = documentToMilxXml(sampleDocument());

    expect(xml).toContain(`xmlns="${MILX_XML_NAMESPACE}"`);
    expect(xml).toContain(`version="${MILX_XML_VERSION}"`);
    expect(xml).toContain('exportedAt=');
  });

  it('应按 kind 写出三类几何', () => {
    const xml = documentToMilxXml(sampleDocument());

    expect(xml).toContain('type="point"');
    expect(xml).toContain('type="line"');
    expect(xml).toContain('type="area"');
    // 点用 <position>，线 / 面用 <points>
    expect(xml).toContain('<position ');
    expect(xml).toContain('<points>');
    expect(xml).toContain('</points>');
  });

  it('文本修饰符的四个字段都应出现', () => {
    const xml = documentToMilxXml(sampleDocument());

    expect(xml).toContain('<uniqueDesignation>A-1</uniqueDesignation>');
    expect(xml).toContain('<higherFormation>第1旅</higherFormation>');
    expect(xml).toContain('<additionalInformation>驻训</additionalInformation>');
    expect(xml).toContain('<staffComments>');
  });

  it('XML 特殊字符应被转义而非破坏结构', () => {
    const xml = documentToMilxXml(sampleDocument());

    // & 出现在 name 与 staffComments 中，必须转为 &amp;
    expect(xml).toContain('步兵连 &amp; &lt;友军&gt;');
    expect(xml).toContain('注意 &lt;安全&gt;');
    // 不应出现裸的 <友军>
    expect(xml).not.toContain('>步兵连 & <友军><');
  });

  it('输出末尾应有换行，便于文本比对', () => {
    const xml = documentToMilxXml(sampleDocument());
    expect(xml.endsWith('\n')).toBe(true);
  });
});

describe('milxXmlToDocument', () => {
  it('应能解析 documentToMilxXml 的输出', () => {
    const original = sampleDocument();
    const xml = documentToMilxXml(original);
    const result = milxXmlToDocument(xml, '解析回填');

    expect(result.skipped).toBe(0);
    expect(result.document.name).toBe('解析回填');
    expect(result.document.features).toHaveLength(original.features.length);
    expect(result.document.layers).toHaveLength(original.layers.length);
  });

  it('应保留要素的几何类型与坐标', () => {
    const original = sampleDocument();
    const result = milxXmlToDocument(documentToMilxXml(original), '解析回填');
    const [point, line, area] = result.document.features;

    expect(point.geometry.kind).toBe(GeometryKind.Point);
    if (point.geometry.kind === GeometryKind.Point) {
      expect(point.geometry.position.lon).toBeCloseTo(8.5);
      expect(point.geometry.position.lat).toBeCloseTo(47.4);
    }

    expect(line.geometry.kind).toBe(GeometryKind.Line);
    expect(area.geometry.kind).toBe(GeometryKind.Area);
  });

  it('应保留文本修饰符与方向字段', () => {
    const original = sampleDocument();
    const result = milxXmlToDocument(documentToMilxXml(original), '解析回填');
    const [point] = result.document.features;

    expect(point.textFields.uniqueDesignation).toBe('A-1');
    expect(point.textFields.higherFormation).toBe('第1旅');
    expect(point.textFields.additionalInformation).toBe('驻训');
    expect(point.textFields.staffComments).toBe('注意 <安全>');
    expect(point.direction).toBe(45);
  });

  it('应正确转义回原始字符', () => {
    const original = sampleDocument();
    const result = milxXmlToDocument(documentToMilxXml(original), '解析回填');
    const [point] = result.document.features;

    // 写入时被 &amp; &lt; &gt; 转义的内容，反序列化后必须还原
    expect(point.name).toBe('步兵连 & <友军>');
  });

  it('应保留图层可见性、锁定、不透明度等属性', () => {
    const original = sampleDocument();
    const result = milxXmlToDocument(documentToMilxXml(original), '解析回填');
    const mainLayer = result.document.layers.find((layer) => layer.id === original.layers[0].id);

    expect(mainLayer?.visible).toBe(true);
    expect(mainLayer?.opacity).toBeCloseTo(0.85);
    expect(mainLayer?.order).toBe(5);
  });

  it('应接受 15 位 SIDC 并补 0 到 20 位', () => {
    // 直接构造一份带 15 位 SIDC 的 XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<milx xmlns="${MILX_XML_NAMESPACE}" version="${MILX_XML_VERSION}" exportedAt="2026-01-01T00:00:00.000Z">
  <layers>
    <layer id="l1" name="默认" visible="true" locked="false" opacity="1" order="0"/>
  </layers>
  <features>
    <feature id="f1" layerId="l1" sidc="100310000012110" name="2525C 单位">
      <geometry type="point">
        <position lon="10" lat="20"/>
      </geometry>
    </feature>
  </features>
</milx>`;

    const result = milxXmlToDocument(xml, '2525C 输入');
    expect(result.skipped).toBe(0);
    expect(result.document.features).toHaveLength(1);
    expect(result.document.features[0].sidc).toBe('10031000001211000000');
    expect(result.document.features[0].sidc).toHaveLength(20);
  });

  it('应接受带分隔符的 15 位 SIDC', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<milx xmlns="${MILX_XML_NAMESPACE}" version="${MILX_XML_VERSION}" exportedAt="2026-01-01T00:00:00.000Z">
  <layers/>
  <features>
    <feature id="f1" layerId="l1" sidc="10 03 10000 012110" name="带空格">
      <geometry type="point">
        <position lon="0" lat="0"/>
      </geometry>
    </feature>
  </features>
</milx>`;

    const result = milxXmlToDocument(xml, '带分隔符');
    expect(result.document.features[0].sidc).toBe('10031000001211000000');
  });

  it('不支持的要素应被跳过并计数', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<milx xmlns="${MILX_XML_NAMESPACE}" version="${MILX_XML_VERSION}" exportedAt="2026-01-01T00:00:00.000Z">
  <layers>
    <layer id="l1" name="L" visible="true" locked="false" opacity="1" order="0"/>
  </layers>
  <features>
    <feature id="ok" layerId="l1" sidc="10031000001211000000" name="合法">
      <geometry type="point">
        <position lon="1" lat="2"/>
      </geometry>
    </feature>
    <feature id="bad-geom" layerId="l1" sidc="10031000001211000000" name="几何缺失">
    </feature>
    <feature id="bad-sidc" layerId="l1" sidc="abcdefghijklmnopqrst" name="非数字 SIDC">
      <geometry type="point">
        <position lon="1" lat="2"/>
      </geometry>
    </feature>
    <feature id="bad-len" layerId="l1" sidc="12345" name="SIDC 太短">
      <geometry type="point">
        <position lon="1" lat="2"/>
      </geometry>
    </feature>
    <feature id="bad-type" layerId="l1" sidc="10031000001211000000" name="未知几何类型">
      <geometry type="polygon">
        <points><point lon="1" lat="2"/></points>
      </geometry>
    </feature>
  </features>
</milx>`;

    const result = milxXmlToDocument(xml, '宽容解析');
    // 合法点 + 1 个被识别为 line/area 但 points 为空的几何
    // 实际这里：bad-geom 缺少几何 → 跳过；bad-sidc 非数字 → 跳过；
    // bad-len 长度非法 → 跳过；bad-type type 不被识别 → 跳过
    expect(result.skipped).toBe(4);
    expect(result.document.features).toHaveLength(1);
    expect(result.document.features[0].id).toBe('ok');
  });

  it('缺少图层时应补充默认图层并接管要素', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<milx xmlns="${MILX_XML_NAMESPACE}" version="${MILX_XML_VERSION}" exportedAt="2026-01-01T00:00:00.000Z">
  <layers/>
  <features>
    <feature id="f1" layerId="l1" sidc="10031000001211000000" name="无图层">
      <geometry type="point">
        <position lon="1" lat="2"/>
      </geometry>
    </feature>
  </features>
</milx>`;

    const result = milxXmlToDocument(xml, '无图层');
    expect(result.document.layers).toHaveLength(1);
    expect(result.document.features[0].layerId).toBe(result.document.layers[0].id);
  });

  it('XML 文本非法时应抛出错误', () => {
    const malformed = '<milx><layers><</milx>';
    expect(() => milxXmlToDocument(malformed, '非法')).toThrow(/XML/);
  });

  it('根节点不是 milx 时应抛出错误', () => {
    expect(() => milxXmlToDocument('<root/>', '根错')).toThrow(/<milx>/);
  });

  it('几何中坐标不全为数字时应被跳过', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<milx xmlns="${MILX_XML_NAMESPACE}" version="${MILX_XML_VERSION}" exportedAt="2026-01-01T00:00:00.000Z">
  <layers/>
  <features>
    <feature id="f1" layerId="l1" sidc="10031000001211000000" name="无点线">
      <geometry type="line">
        <points>
          <point lon="abc" lat="1"/>
        </points>
      </geometry>
    </feature>
  </features>
</milx>`;

    const result = milxXmlToDocument(xml, '坏坐标');
    expect(result.skipped).toBe(1);
    expect(result.document.features).toHaveLength(0);
  });
});