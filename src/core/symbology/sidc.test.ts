/**
 * SIDC 编解码的单元测试。
 *
 * 重点覆盖三类性质：
 * 1. 解析 → 序列化的**往返一致性**（任意合法 SIDC 不应丢失信息）；
 * 2. 非法输入的**拒绝能力**（长度、字符、字段取值）；
 * 3. 字段读写的**语义正确性**（梯队、机动方式、实体代码）。
 */

import { describe, expect, it } from 'vitest';

import {
  createSidc,
  echelonOf,
  entityCodeOf,
  formatSidc,
  isValidSidc,
  mobilityOf,
  parseSidc,
  setAOf,
  withEchelon,
  VERSION_2525D,
} from './sidc';
import { Affiliation, Context, Echelon, HqTfDummy, Status, SymbolSet } from './types';

describe('parseSidc', () => {
  it('应正确解析标准 20 位 SIDC 的各个字段', () => {
    // 10031000001211000000：2525D / 真实 / 友军 / 地面单位 / 存在 / 无 HQ / 无放大 / 步兵
    const sidc = parseSidc('10031000001211000000');

    expect(sidc.version).toBe(VERSION_2525D);
    expect(sidc.context).toBe(Context.Reality);
    expect(sidc.affiliation).toBe(Affiliation.Friend);
    expect(sidc.symbolSet).toBe(SymbolSet.LandUnit);
    expect(sidc.status).toBe(Status.Present);
    expect(sidc.hqTfDummy).toBe(HqTfDummy.None);
    expect(sidc.entity).toBe('12');
    expect(sidc.entityType).toBe('11');
    expect(sidc.entitySubtype).toBe('00');
  });

  it('应正确解析带有司令部与梯队标记的 SIDC', () => {
    // 第 8 位为 2（司令部），第 9-10 位为 16（营级梯队）
    const sidc = parseSidc('10031002161211000000');

    expect(sidc.hqTfDummy).toBe(HqTfDummy.Headquarters);
    expect(sidc.amplifier).toBe(16);
    expect(echelonOf(sidc)).toBe(Echelon.Battalion);
  });

  it('应容忍输入中的连字符与空格', () => {
    const withSeparators = parseSidc('10-0-3-10-0-0-00-121100-00-00');
    const plain = parseSidc('10031000001211000000');

    expect(withSeparators).toEqual(plain);
  });

  it('长度不足时应抛出错误', () => {
    expect(() => parseSidc('100310')).toThrow(/长度/);
  });

  it('包含非数字字符时应抛出错误', () => {
    expect(() => parseSidc('1003100000121100000A')).toThrow(/只能包含数字/);
  });

  it('版本号不受支持时应抛出错误', () => {
    expect(() => parseSidc('99031000001211000000')).toThrow(/版本/);
  });

  it('身份字段越界时应抛出错误', () => {
    // 第 4 位为身份，取值 9 超出 0~6 的合法范围
    expect(() => parseSidc('10091000001211000000')).toThrow(/身份/);
  });

  it('上下文字段越界时应抛出错误', () => {
    // 第 3 位为上下文，取值 9 超出 0~2 的合法范围
    expect(() => parseSidc('10931000001211000000')).toThrow(/上下文/);
  });

  it('符号集字段非法时应抛出错误', () => {
    expect(() => parseSidc('10039900001211000000')).toThrow(/符号集/);
  });

  it('状态字段越界时应抛出错误', () => {
    expect(() => parseSidc('10031090001211000000')).toThrow(/状态/);
  });

  it('司令部字段越界时应抛出错误', () => {
    expect(() => parseSidc('10031009001211000000')).toThrow(/司令部/);
  });
});

describe('formatSidc', () => {
  it('应对不足位的字段左侧补零', () => {
    const sidc = createSidc({ symbolSet: SymbolSet.Air });
    const text = formatSidc(sidc);

    expect(text).toHaveLength(20);
    // 符号集 1 应输出为 "01"
    expect(text.slice(4, 6)).toBe('01');
  });

  it('与 parseSidc 应构成往返一致', () => {
    const samples = [
      '10031000001211000000',
      '10061500001101000000',
      '10131002161303000000',
      '10013000001201000000',
      '15103500001101000000',
    ];

    for (const sample of samples) {
      expect(formatSidc(parseSidc(sample))).toBe(sample);
    }
  });
});

describe('isValidSidc', () => {
  it('应对合法 SIDC 返回 true', () => {
    expect(isValidSidc('10031000001211000000')).toBe(true);
    expect(isValidSidc('10061500001101000000')).toBe(true);
  });

  it('应对非法 SIDC 返回 false', () => {
    expect(isValidSidc('')).toBe(false);
    expect(isValidSidc('123')).toBe(false);
    expect(isValidSidc('abcdefghijklmnopqrst')).toBe(false);
    expect(isValidSidc('99031000001211000000')).toBe(false);
  });
});

describe('createSidc', () => {
  it('应给出符合 2525D 地面步兵单位的默认值', () => {
    const sidc = createSidc();

    expect(sidc.version).toBe(VERSION_2525D);
    expect(sidc.affiliation).toBe(Affiliation.Friend);
    expect(sidc.symbolSet).toBe(SymbolSet.LandUnit);
    expect(entityCodeOf(sidc)).toBe('121100');
  });

  it('应允许按字段覆盖默认值', () => {
    const sidc = createSidc({ affiliation: Affiliation.Hostile, symbolSet: SymbolSet.Air });

    expect(sidc.affiliation).toBe(Affiliation.Hostile);
    expect(sidc.symbolSet).toBe(SymbolSet.Air);
    // 未覆盖的字段保持默认
    expect(sidc.context).toBe(Context.Reality);
  });
});

describe('echelonOf', () => {
  it('放大器为梯队类别时应返回对应梯队', () => {
    expect(echelonOf(createSidc({ amplifier: 11 }))).toBe(Echelon.Team);
    expect(echelonOf(createSidc({ amplifier: 14 }))).toBe(Echelon.Platoon);
    expect(echelonOf(createSidc({ amplifier: 18 }))).toBe(Echelon.Brigade);
    expect(echelonOf(createSidc({ amplifier: 21 }))).toBe(Echelon.Division);
  });

  it('放大器为机动方式类别时应返回 null', () => {
    // 33 表示陆上机动中的"履带式"
    expect(echelonOf(createSidc({ amplifier: 33 }))).toBeNull();
  });

  it('放大器为零时应返回 null', () => {
    expect(echelonOf(createSidc({ amplifier: 0 }))).toBeNull();
  });
});

describe('mobilityOf', () => {
  it('放大器为陆上机动类别时应返回机动方式', () => {
    expect(mobilityOf(createSidc({ amplifier: 33 }))).toBe(3);
    expect(mobilityOf(createSidc({ amplifier: 32 }))).toBe(2);
  });

  it('放大器为梯队类别时应返回 null', () => {
    expect(mobilityOf(createSidc({ amplifier: 16 }))).toBeNull();
  });
});

describe('withEchelon', () => {
  it('应写入梯队并保持可往返读取', () => {
    const sidc = withEchelon(createSidc(), Echelon.Company);
    expect(echelonOf(sidc)).toBe(Echelon.Company);
  });

  it('传入 None 时应清空放大器', () => {
    const sidc = withEchelon(createSidc({ amplifier: 16 }), Echelon.None);
    expect(sidc.amplifier).toBe(0);
    expect(echelonOf(sidc)).toBeNull();
  });

  it('应正确序列化到 20 位字符串中', () => {
    const sidc = withEchelon(createSidc(), Echelon.Battalion);
    expect(formatSidc(sidc).slice(8, 10)).toBe('16');
  });
});

describe('entityCodeOf 与 setAOf', () => {
  it('实体代码应为实体、类型、子类型的拼接', () => {
    const sidc = createSidc({ entity: '13', entityType: '03', entitySubtype: '00' });
    expect(entityCodeOf(sidc)).toBe('130300');
  });

  it('Set A 应只取前 10 位', () => {
    const sidc = createSidc();
    expect(setAOf(sidc)).toBe(formatSidc(sidc).slice(0, 10));
    expect(setAOf(sidc)).toHaveLength(10);
  });
});
