import { describe, expect, it } from 'vitest';
import {
  bngLetters,
  bngStringToLonLat,
  bngToLonLat,
  formatBng,
  lonLatToBng,
  lonLatToBngString,
  parseBng,
} from './bng';

/**
 * 英国国家格网（BNG / OSGB36）测试。
 *
 * ⚠️ 精度说明：本项目在 WGS84 与 OSGB36 之间使用 7 参数赫尔默特变换近似，
 * 未使用 OSTN15 网格改正文件，因此往返误差在 ±5 米量级。
 * 这里的断言阈值按该精度设定，不追求毫米级一致。
 */

describe('BNG 投影', () => {
  it('伦敦应落在合理的 BNG 坐标区间', () => {
    // 伦敦（特拉法加广场）的 BNG 坐标约为 E 530 000 / N 180 000
    const p = lonLatToBng({ lon: -0.1276, lat: 51.5074 });
    expect(p.x).toBeGreaterThan(528000);
    expect(p.x).toBeLessThan(534000);
    expect(p.y).toBeGreaterThan(178000);
    expect(p.y).toBeLessThan(184000);
  });

  it('伦敦的方格字母应为 TQ', () => {
    expect(bngLetters(lonLatToBng({ lon: -0.1276, lat: 51.5074 }))).toBe('TQ');
  });

  it('往返误差应在赫尔默特变换的精度范围内（±10 米）', () => {
    const original = { lon: -0.1276, lat: 51.5074 };
    const back = bngToLonLat(lonLatToBng(original));
    const errorMeters = Math.hypot(
      (back.lon - original.lon) * 111320 * Math.cos((51.5 * Math.PI) / 180),
      (back.lat - original.lat) * 110540,
    );
    expect(errorMeters).toBeLessThan(10);
  });
});

describe('BNG 格式化与解析', () => {
  it('应按位数控制精度', () => {
    const london = lonLatToBng({ lon: -0.1276, lat: 51.5074 });
    // 5 位 → 1 米；3 位 → 100 米；2 位 → 1 千米
    expect(formatBng(london, 5)).toMatch(/^TQ \d{5} \d{5}$/);
    expect(formatBng(london, 3)).toMatch(/^TQ \d{3} \d{3}$/);
  });

  it('解析结果应按位数对齐（3 位 → 100 米网格）', () => {
    const parsed = parseBng('TQ 300 800');
    expect(parsed.x % 1000).toBe(0);
    expect(parsed.y % 1000).toBe(0);
    // 应落在 TQ 方格内
    expect(bngLetters(parsed)).toBe('TQ');
  });

  it('已知坐标 TQ 288 079 应解算到英国境内', () => {
    const point = bngStringToLonLat('TQ 288 079');
    // 该点位于伦敦西南方向，经度约 -0.17°、纬度约 51.46°
    expect(point.lon).toBeGreaterThan(-1.5);
    expect(point.lon).toBeLessThan(0.5);
    expect(point.lat).toBeGreaterThan(50.5);
    expect(point.lat).toBeLessThan(52);
  });

  it('往返解析应保持方格字母不变', () => {
    for (const code of ['TQ 288 079', 'SU 123 456', 'NZ 456 789', 'SH 605 545']) {
      const point = bngStringToLonLat(code);
      expect(lonLatToBngString(point, 3).slice(0, 2)).toBe(code.slice(0, 2));
    }
  });

  it('应拒绝非法输入', () => {
    expect(() => parseBng('AA 123 456')).toThrow();
    // 数字位数必须为偶数
    expect(() => parseBng('TQ 288 07')).toThrow(SyntaxError);
  });

  it('范围外的坐标应抛出 RangeError', () => {
    // 东向 2 500 km 远超英国国家格网覆盖范围，不存在对应的 500 km 方格字母
    expect(() => bngLetters({ x: 2500000, y: 500000 })).toThrow(RangeError);
  });
});
