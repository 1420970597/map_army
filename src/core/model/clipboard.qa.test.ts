/**
 * QA 独立验证：剪贴板载荷的隔离性、粘贴偏移递增与异常兜底。
 *
 * 重点验证「复制—粘贴」链路不会让外部数据穿透到文档或反向污染剪贴板，
 * 以及连续粘贴的像素偏移必须单调递进而非恒为首次偏移。
 */

import { describe, expect, it } from 'vitest';

import type { Projection } from '../geo';
import { GeometryKind, type MapFeature } from './types';
import {
  CLIPBOARD_KIND,
  CLIPBOARD_VERSION,
  DEFAULT_PASTE_OFFSET_PX,
  materializeClipboard,
  parseClipboard,
  serializeClipboard,
} from './clipboard';

const identityProjection: Projection = {
  toPixel: (point) => ({ x: point.lon, y: point.lat }),
  toLonLat: (pixel) => ({ lon: pixel.x, lat: pixel.y }),
};

/** 构造带线几何与手动顶点方向的测试要素。 */
function lineFeature(overrides: Partial<MapFeature> = {}): MapFeature {
  return {
    id: 'source-line',
    layerId: 'source-layer',
    sidc: 'SFGPUCI----K---',
    name: '进攻轴线',
    geometry: {
      kind: GeometryKind.Line,
      points: [
        { lon: 1, lat: 2 },
        { lon: 3, lat: 4 },
      ],
    },
    textFields: { uniqueDesignation: 'A' },
    style: { color: '#123456', weight: 3 },
    vertexBearings: [45, 90],
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

function payloadOf(features: MapFeature[] = [lineFeature()]) {
  return serializeClipboard(features, { 'source-layer': '源图层' }, { lon: 0, lat: 0 }, 10);
}

/** 读取线几何顶点数组，非线几何时抛错以便测试快速失败。 */
function pointsOf(feature: MapFeature): { lon: number; lat: number }[] {
  if (feature.geometry.kind === 'point') throw new Error('测试要素必须是线');
  return feature.geometry.points;
}

describe('QA 载荷与文档的双向隔离', () => {
  it('序列化后载荷与源要素不共享任何嵌套引用', () => {
    const feature = lineFeature();
    const payload = payloadOf([feature]);

    const stored = payload.features[0];
    expect(stored).not.toBe(feature);
    expect(stored.geometry).not.toBe(feature.geometry);
    if (stored.geometry.kind === 'point') throw new Error('测试要素必须是线');
    if (feature.geometry.kind === 'point') throw new Error('测试要素必须是线');
    expect(stored.geometry.points[0]).not.toBe(feature.geometry.points[0]);
    expect(stored.textFields).not.toBe(feature.textFields);
    expect(stored.style).not.toBe(feature.style);
    expect(stored.vertexBearings).not.toBe(feature.vertexBearings);
  });

  it('修改载荷的嵌套坐标不会影响源要素几何', () => {
    const feature = lineFeature();
    const payload = payloadOf([feature]);

    pointsOf(payload.features[0])[0].lon = 999;
    pointsOf(payload.features[0])[1].lat = -999;

    expect(pointsOf(feature)).toEqual([
      { lon: 1, lat: 2 },
      { lon: 3, lat: 4 },
    ]);
  });

  it('实例化后的要素与载荷不共享坐标对象', () => {
    const payload = payloadOf();
    const first = materializeClipboard(payload, {
      targetLayerId: 'target',
      projection: identityProjection,
    })[0];

    pointsOf(first)[0].lon = 999;

    expect(pointsOf(payload.features[0])[0]).toEqual({ lon: 1, lat: 2 });
  });

  it('同一载荷两次实例化产生互不相同的要素标识', () => {
    const payload = payloadOf([lineFeature(), lineFeature({ id: 'source-line-2' })]);

    const first = materializeClipboard(payload, {
      targetLayerId: 'target',
      projection: identityProjection,
    });
    const second = materializeClipboard(payload, {
      targetLayerId: 'target',
      projection: identityProjection,
    });

    const ids = [...first, ...second].map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('QA 连续粘贴的像素偏移', () => {
  it('偏移随粘贴次数线性递增', () => {
    const payload = payloadOf();
    const offsets = [1, 2, 3, 4].map((pasteCount) => {
      const [feature] = materializeClipboard(payload, {
        targetLayerId: 'target',
        projection: identityProjection,
        pasteCount,
      });
      return pointsOf(feature)[0].lon - 1;
    });

    expect(offsets).toEqual([24, 48, 72, 96]);
  });

  it('默认单次偏移等于导出的默认常量', () => {
    expect(DEFAULT_PASTE_OFFSET_PX).toBe(24);

    const [feature] = materializeClipboard(payloadOf(), {
      targetLayerId: 'target',
      projection: identityProjection,
    });

    expect(pointsOf(feature)[0]).toEqual({ lon: 25, lat: 26 });
  });

  it('线要素的全部顶点整体平移，不发生逐点累积偏移', () => {
    const [feature] = materializeClipboard(payloadOf(), {
      targetLayerId: 'target',
      projection: identityProjection,
      pasteCount: 2,
    });

    expect(pointsOf(feature)).toEqual([
      { lon: 49, lat: 50 },
      { lon: 51, lat: 52 },
    ]);
  });

  it('非法粘贴次数回退为 1 次偏移', () => {
    const payload = payloadOf();
    const offsetFor = (pasteCount: number | undefined): number => {
      const [feature] = materializeClipboard(payload, {
        targetLayerId: 'target',
        projection: identityProjection,
        pasteCount,
      });
      return pointsOf(feature)[0].lon - 1;
    };

    expect(offsetFor(undefined)).toBe(24);
    expect(offsetFor(0)).toBe(24);
    expect(offsetFor(-3)).toBe(24);
    expect(offsetFor(Number.NaN)).toBe(24);
    expect(offsetFor(2.9)).toBe(48);
  });
});

describe('QA 剪贴板异常兜底', () => {
  it('结构不合法的载荷被拒收而不是抛出', () => {
    const cases = [
      'null',
      '[]',
      '{}',
      `"${CLIPBOARD_KIND}"`,
      JSON.stringify({ kind: CLIPBOARD_KIND, version: CLIPBOARD_VERSION }),
      JSON.stringify({
        kind: CLIPBOARD_KIND,
        version: CLIPBOARD_VERSION,
        features: null,
        layerNames: {},
        anchor: { lon: 0, lat: 0 },
        zoom: 1,
      }),
      JSON.stringify({
        kind: CLIPBOARD_KIND,
        version: CLIPBOARD_VERSION,
        features: [null],
        layerNames: {},
        anchor: { lon: 0, lat: 0 },
        zoom: 1,
      }),
    ];

    for (const raw of cases) {
      expect(parseClipboard(raw)).toBeNull();
    }
  });

  it('要素要素缺少必填字段时被拒收', () => {
    const valid = payloadOf();
    const broken = {
      ...valid,
      features: [{ ...valid.features[0], sidc: undefined }],
    };

    expect(parseClipboard(JSON.stringify(broken))).toBeNull();
  });

  it('空要素数组的载荷合法但实例化为空数组', () => {
    const empty = payloadOf([]);

    const parsed = parseClipboard(JSON.stringify(empty));
    expect(parsed?.features).toEqual([]);
    expect(
      materializeClipboard(empty, { targetLayerId: 'target', projection: identityProjection }),
    ).toEqual([]);
  });

  it('顶点方向为自动方向占位时可安全往返', () => {
    // 用 length 扩展留出空槽，等价于模型里 `delete bearings[1]` 的自动方向占位。
    const bearings = [45];
    bearings.length = 2;
    const payload = payloadOf([lineFeature({ vertexBearings: bearings })]);

    const parsed = parseClipboard(JSON.stringify(payload));

    expect(parsed?.features[0].vertexBearings).toHaveLength(2);
    expect(parsed?.features[0].vertexBearings?.[0]).toBe(45);
    expect(parsed?.features[0].vertexBearings?.[1]).toBeUndefined();
  });
});
