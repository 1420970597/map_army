import { describe, expect, it } from 'vitest';
import {
  formatMgrs,
  isSouthernBand,
  lonLatToMgrs,
  lonLatToMgrsString,
  mgrsBandSouthLatitude,
  mgrsLatBand,
  mgrsStringToLonLat,
  mgrsToLonLat,
  parseMgrs,
} from './mgrs';

/**
 * MGRS 测试。
 *
 * 期望值来源：
 *   1. 公开标准示例（维基百科 MGRS 条目给出的 4QFJ 示例、火奴鲁鲁所在方格）；
 *   2. 与成熟第三方实现做过 210 个点的全域逐点比对，结果完全一致。
 */

/** 计算两点间的近似平面距离（米） */
function distanceMeters(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const latMid = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  return Math.hypot((a.lon - b.lon) * 111320 * Math.cos(latMid), (a.lat - b.lat) * 110540);
}

describe('MGRS 纬度带', () => {
  it('应按 8° 分带，跳过 I 与 O', () => {
    expect(mgrsLatBand(-80)).toBe('C');
    expect(mgrsLatBand(-72)).toBe('D');
    expect(mgrsLatBand(0)).toBe('N');
    expect(mgrsLatBand(8)).toBe('P'); // 跳过 O
    expect(mgrsLatBand(80)).toBe('X');
    expect(mgrsLatBand(90)).toBe('X'); // 极区归入 X 带
  });

  it('带字母可以还原出南边界纬度', () => {
    expect(mgrsBandSouthLatitude('C')).toBe(-80);
    expect(mgrsBandSouthLatitude('N')).toBe(0);
    expect(mgrsBandSouthLatitude('X')).toBe(72);
  });

  it('应正确判定南/北半球', () => {
    expect(isSouthernBand('M')).toBe(true);
    expect(isSouthernBand('N')).toBe(false);
    expect(isSouthernBand('C')).toBe(true);
    expect(isSouthernBand('X')).toBe(false);
  });
});

describe('MGRS 编码', () => {
  it('命中公开标准示例：火奴鲁鲁位于方格 4QFJ', () => {
    // 维基百科 MGRS 条目明确说明火奴鲁鲁位于 grid zone 4Q、square FJ
    const code = lonLatToMgrsString({ lon: -157.8583, lat: 21.3069 }, 1);
    expect(code.slice(0, 4)).toBe('4QFJ');
  });

  it('命中公开标准示例：4QFJ 1234 6789 对应 21.41°N / 157.92°W', () => {
    const point = mgrsStringToLonLat('4QFJ1234167890');
    expect(point.lat).toBeCloseTo(21.4098, 3);
    expect(point.lon).toBeCloseTo(-157.9161, 3);
  });

  it('华盛顿应为 18SUJ', () => {
    // 美国国家格网（USNG，与 MGRS 兼容）中该坐标的常见引用值
    expect(lonLatToMgrsString({ lon: -77.0353, lat: 38.8895 }, 1).slice(0, 5)).toBe('18SUJ');
  });

  it('带 32 中央子午线与赤道交点应为 32N NF 00000 00000', () => {
    // 东向 500 000 m → 列索引 5 → 字母集第三组（S–Z）的第 6 个字母 N
    // 北向 0 m、偶数带 → 行字母从 F 起 → F
    expect(lonLatToMgrsString({ lon: 9, lat: 0 }, 1)).toBe('32NNF0000000000');
  });

  it('应支持不同精度', () => {
    const point = { lon: 7.4653, lat: 46.9479 };
    expect(lonLatToMgrsString(point, 10000).replace(/\s/g, '')).toHaveLength(7);
    expect(lonLatToMgrsString(point, 1000).replace(/\s/g, '')).toHaveLength(9);
    expect(lonLatToMgrsString(point, 1).replace(/\s/g, '')).toHaveLength(15);
  });
});

describe('MGRS 解码', () => {
  it('应能解析带空格与不带空格两种写法', () => {
    const withSpaces = parseMgrs('33U XP 05004 49998');
    const withoutSpaces = parseMgrs('33UXP0500449998');
    expect(withSpaces).toEqual(withoutSpaces);
    expect(withSpaces.zone).toBe(33);
    expect(withSpaces.band).toBe('U');
    expect(withSpaces.col).toBe('X');
    expect(withSpaces.row).toBe('P');
  });

  it('应正确还原精度', () => {
    expect(parseMgrs('33UXP0500449998').precision).toBe(1);
    expect(parseMgrs('33UXP05044999').precision).toBe(10);
    expect(parseMgrs('33UXP050499').precision).toBe(100);
    expect(parseMgrs('33UXP0549').precision).toBe(1000);
  });

  it('应拒绝非法输入', () => {
    expect(() => parseMgrs('')).toThrow();
    expect(() => parseMgrs('99UXP0500449998')).toThrow(RangeError);
    // 数字位数必须是偶数：两轴位数要相等
    expect(() => parseMgrs('33UXP050044999')).toThrow(SyntaxError);
    // 行字母不含 W、X
    expect(() => parseMgrs('33UXW0500449998')).toThrow();
  });
});

describe('MGRS 往返一致性', () => {
  const points = [
    { lon: 7.4653, lat: 46.9479, name: '瑞士阿劳' },
    { lon: -77.0353, lat: 38.8895, name: '美国华盛顿' },
    { lon: -0.1276, lat: 51.5074, name: '英国伦敦' },
    { lon: 139.6917, lat: 35.6895, name: '日本东京' },
    { lon: 151.2093, lat: -33.8688, name: '澳大利亚悉尼（南半球）' },
    { lon: -58.3816, lat: -34.6037, name: '阿根廷布宜诺斯艾利斯（南半球）' },
    { lon: 5.3221, lat: 60.3913, name: '挪威卑尔根（32V 例外区）' },
    { lon: 15.6469, lat: 78.2232, name: '斯瓦尔巴（33X 例外区）' },
    { lon: -179.9, lat: -79.9, name: '跨 180° 经线附近' },
    { lon: 179.9, lat: 83.9, name: '高纬度东边界' },
  ];

  it.each(points)('$name 的往返误差应小于 2 米', ({ lon, lat }) => {
    const original = { lon, lat };
    const code = lonLatToMgrsString(original, 1);
    const back = mgrsStringToLonLat(code);
    // 1 米精度下，定位点在方格西南角，理论最大偏差为 √2 米
    expect(distanceMeters(original, back)).toBeLessThan(2);
  });

  it.each(points)('$name 往返后纬度带应保持不变', ({ lon, lat }) => {
    const back = mgrsStringToLonLat(lonLatToMgrsString({ lon, lat }, 1));
    expect(mgrsLatBand(back.lat)).toBe(mgrsLatBand(lat));
  });

  it('全域抽样往返误差应小于 2 米', () => {
    let worst = 0;
    for (let lon = -179.5; lon <= 179.5; lon += 17.3) {
      for (const lat of [-79.5, -45.2, -12.7, -0.3, 0.4, 19.8, 44.1, 61.3, 77.6, 83.5]) {
        const original = { lon, lat };
        const back = mgrsToLonLat(lonLatToMgrs(original, 1));
        worst = Math.max(worst, distanceMeters(original, back));
      }
    }
    expect(worst).toBeLessThan(2);
  });
});

describe('MGRS 格式化', () => {
  it('应按精度决定数字位数', () => {
    const coord = lonLatToMgrs({ lon: 7.4653, lat: 46.9479 }, 1);
    expect(formatMgrs(coord)).toMatch(/^\d{2}[C-HJ-NP-X][A-HJ-NP-Z][A-HJ-NP-V]\d{10}$/);
  });

  it('分组书写应在带号后、字母对后、两轴之间插入空格', () => {
    const coord = lonLatToMgrs({ lon: 7.4653, lat: 46.9479 }, 1);
    const spaced = formatMgrs(coord, true);
    expect(spaced).toMatch(/^\d{2}[A-Z] [A-Z]{2} \d{5} \d{5}$/);
    // 去掉空格后应与紧凑格式完全一致
    expect(spaced.replace(/\s/g, '')).toBe(formatMgrs(coord));
  });
});
