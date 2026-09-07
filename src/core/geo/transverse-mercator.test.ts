import { describe, expect, it } from 'vitest';
import { WGS84 } from './constants';
import { tmForward, tmInverse } from './transverse-mercator';
import type { TransverseMercatorParams } from './transverse-mercator';

/**
 * 横轴墨卡托投影测试。
 *
 * 采用 Krüger 级数（Karney 2011），理论精度为纳米级，
 * 因此这里以"正反算往返一致性"作为主要验证手段——
 * 往返误差直接反映级数与迭代的实现是否正确。
 */

/** 构造一个 UTM 风格的投影参数（中央子午线 lon0，缩放 0.9996，东偏移 500 km） */
function utmLike(lon0: number): TransverseMercatorParams {
  return {
    ellipsoid: WGS84,
    centralMeridian: lon0,
    scaleFactor: 0.9996,
    falseEasting: 500000,
    falseNorthing: 0,
  };
}

/** 计算两点之间的平面距离（米，按纬度折算经度方向） */
function distanceMeters(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const latMid = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  return Math.hypot((a.lon - b.lon) * 111320 * Math.cos(latMid), (a.lat - b.lat) * 110540);
}

describe('横轴墨卡托投影', () => {
  describe('正算', () => {
    it('中央子午线上的点，东向坐标应等于东偏移量', () => {
      const params = utmLike(3);
      for (const lat of [-80, -40, 0, 40, 80]) {
        const p = tmForward({ lon: 3, lat }, params);
        expect(p.x).toBeCloseTo(500000, 6);
      }
    });

    it('赤道上的点，北向坐标应为 0', () => {
      const params = utmLike(3);
      for (const dLon of [-3, -1, 0, 1, 3]) {
        const p = tmForward({ lon: 3 + dLon, lat: 0 }, params);
        expect(p.y).toBeCloseTo(0, 6);
      }
    });

    it('东向坐标随经度单调递增', () => {
      const params = utmLike(0);
      let previous = -Infinity;
      for (let lon = -3; lon <= 3; lon += 0.5) {
        const { x } = tmForward({ lon, lat: 45 }, params);
        expect(x).toBeGreaterThan(previous);
        previous = x;
      }
    });

    it('北向坐标随纬度单调递增', () => {
      const params = utmLike(0);
      let previous = -Infinity;
      for (let lat = -80; lat <= 84; lat += 4) {
        const { y } = tmForward({ lon: 0, lat }, params);
        expect(y).toBeGreaterThan(previous);
        previous = y;
      }
    });
  });

  describe('正反算往返一致性', () => {
    // 覆盖：多个带号 × 全纬度区间 × 带内不同经差
    const zones = [1, 18, 31, 33, 60];
    const latitudes = [-80, -60, -30, -0.5, 0, 15, 45, 60, 70, 78, 84];
    const longitudeOffsets = [-3, -1.5, 0, 1.5, 3];

    it('全球范围内往返误差应小于 1 毫米', () => {
      let worst = 0;
      for (const zone of zones) {
        const centralMeridian = -183 + 6 * zone;
        const params = utmLike(centralMeridian);
        for (const lat of latitudes) {
          for (const dLon of longitudeOffsets) {
            const original = { lon: centralMeridian + dLon, lat };
            const back = tmInverse(tmForward(original, params), params);
            const error = distanceMeters(original, back);
            worst = Math.max(worst, error);
          }
        }
      }
      expect(worst).toBeLessThan(0.001);
    });

    it('等角纬度反算在高纬度不发散（回归测试）', () => {
      // 该用例针对曾经出现过的缺陷：等角纬度反算使用牛顿法时，
      // 导数表达式有误会导致迭代在高纬度发散（τ 越大越严重）。
      const params = utmLike(15);
      for (const lat of [70, 78, 84]) {
        const back = tmInverse(tmForward({ lon: 15, lat }, params), params);
        expect(back.lat).toBeCloseTo(lat, 9);
      }
    });
  });

  describe('跨 180° 经线', () => {
    it('超出 ±180° 的经度输入应被正确规范化', () => {
      const params = utmLike(180);
      for (const lon of [179, -179, 181, -181]) {
        const back = tmInverse(tmForward({ lon, lat: 20 }, params), params);
        // 经度按 360° 周期等价比较（例如 181° 与 -179° 是同一点）
        const delta = ((back.lon - lon + 540) % 360) - 180;
        expect(Math.abs(delta)).toBeLessThan(1e-9);
      }
    });
  });
});
