import { describe, expect, it } from 'vitest';
import {
  UTM_FALSE_EASTING,
  UTM_FALSE_NORTHING_SOUTH,
  formatUtm,
  lonLatToUtm,
  utmCentralMeridian,
  utmToLonLat,
  utmZoneNumber,
  utmZoneOf,
} from './utm';

describe('UTM 带号', () => {
  it('应按每 6° 划分 60 个带', () => {
    expect(utmZoneNumber(-180)).toBe(1);
    expect(utmZoneNumber(-177)).toBe(1);
    expect(utmZoneNumber(-174)).toBe(2);
    expect(utmZoneNumber(0)).toBe(31);
    expect(utmZoneNumber(3)).toBe(31);
    expect(utmZoneNumber(6)).toBe(32);
    expect(utmZoneNumber(179.9)).toBe(60);
  });

  it('带号应始终落在 1..60', () => {
    for (let lon = -360; lon <= 360; lon += 3.7) {
      const zone = utmZoneNumber(lon);
      expect(zone).toBeGreaterThanOrEqual(1);
      expect(zone).toBeLessThanOrEqual(60);
    }
  });

  it('中央子午线应位于带中心', () => {
    expect(utmCentralMeridian(1)).toBe(-177);
    expect(utmCentralMeridian(31)).toBe(3);
    expect(utmCentralMeridian(32)).toBe(9);
    expect(utmCentralMeridian(60)).toBe(177);
  });

  it('应正确判定半球', () => {
    expect(utmZoneOf({ lon: 0, lat: 1 }).hemisphere).toBe('N');
    expect(utmZoneOf({ lon: 0, lat: -1 }).hemisphere).toBe('S');
  });
});

describe('UTM 正算', () => {
  it('中央子午线上的点东向坐标应为 500 000 m', () => {
    const p = lonLatToUtm({ lon: 3, lat: 46.9 });
    expect(p.x).toBeCloseTo(UTM_FALSE_EASTING, 6);
  });

  it('赤道上的北半球点北向坐标应为 0', () => {
    const p = lonLatToUtm({ lon: 7, lat: 0 });
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('南半球点北向坐标应含 10 000 000 m 偏移', () => {
    // 取赤道以南 0.0001°（约 11 米）处，北向坐标应接近 10 000 000 减去该距离
    const p = lonLatToUtm({ lon: 7, lat: -0.0001 });
    expect(p.y).toBeGreaterThan(UTM_FALSE_NORTHING_SOUTH - 20);
    expect(p.y).toBeLessThan(UTM_FALSE_NORTHING_SOUTH);
    expect(p.zone.hemisphere).toBe('S');
  });

  it('瑞士阿劳的坐标应落在合理区间（带 32）', () => {
    const p = lonLatToUtm({ lon: 7.4653, lat: 46.9479 });
    expect(p.zone.number).toBe(32);
    // 中央子午线 9°E，阿劳在其西侧约 1.53°，按纬度折算约 −117 km
    expect(p.x).toBeGreaterThan(370000);
    expect(p.x).toBeLessThan(400000);
    // 北纬 46.95° 的子午线弧长约 5.2 Mm
    expect(p.y).toBeGreaterThan(5100000);
    expect(p.y).toBeLessThan(5300000);
  });
});

describe('UTM 往返一致性', () => {
  it('各带各纬度的往返误差应小于 1 毫米', () => {
    for (const zone of [1, 18, 31, 32, 60]) {
      const centralMeridian = utmCentralMeridian(zone);
      for (const lat of [-70, -20, 0, 30, 60, 80]) {
        for (const dLon of [-3, 0, 3]) {
          const original = { lon: centralMeridian + dLon, lat };
          const utm = lonLatToUtm(original, { number: zone, hemisphere: lat >= 0 ? 'N' : 'S' });
          const back = utmToLonLat(utm, utm.zone);
          expect(back.lon).toBeCloseTo(original.lon, 9);
          expect(back.lat).toBeCloseTo(original.lat, 9);
        }
      }
    }
  });
});

describe('UTM 格式化', () => {
  it('应输出 "带号半球 东向E 北向N" 的形式', () => {
    expect(formatUtm({ x: 323478, y: 4306483 }, { number: 18, hemisphere: 'N' })).toBe(
      '18N 323478E 4306483N',
    );
  });
});
