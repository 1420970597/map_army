import { describe, expect, it } from 'vitest';
import { parseCoordinateSearch } from './search';

describe('原站坐标搜索格式', () => {
  it('WGS84 十进制度使用经度、纬度顺序', () => {
    expect(parseCoordinateSearch('7.45 46.95')).toEqual({ lon: 7.45, lat: 46.95 });
    expect(parseCoordinateSearch('7.45E 46.95N')).toEqual({ lon: 7.45, lat: 46.95 });
    expect(parseCoordinateSearch('7.45 deg E 46.95 degree N')).toEqual({
      lon: 7.45,
      lat: 46.95,
    });
  });

  it('支持带度分秒的经度、纬度输入', () => {
    const point = parseCoordinateSearch('7°27\'0"E, 46°57\'0"N');
    expect(point?.lon).toBeCloseTo(7.45, 8);
    expect(point?.lat).toBeCloseTo(46.95, 8);
  });

  it('保留 GARS、MGRS、UTM 与 BNG 的原有入口', () => {
    expect(parseCoordinateSearch('006BC27')).not.toBeNull();
    expect(parseCoordinateSearch('32TMT1234567890')).not.toBeNull();
    expect(parseCoordinateSearch('32N 382000E 5201000N')).not.toBeNull();
    expect(parseCoordinateSearch('TQ38')).not.toBeNull();
  });
});
