/**
 * SIDC（符号识别码）的解析、构造与校验。
 *
 * MIL-STD-2525D 使用的 20 位数字型 SIDC 布局如下（位置从 1 开始计数）：
 *
 * ```
 *  1  2 | 3 | 4 | 5  6 | 7 | 8 | 9 10 | 11 12 | 13 14 | 15 16 | 17 18 | 19 20
 * 版  本 |上下文|身份|符 号 集|状态|HQ |放大器|  实体  |实体类型 |实体子类|修饰1 |修饰2
 * ```
 *
 * 其中第 1-10 位为 Set A（所有符号集通用），第 11-20 位为 Set B（随符号集而异）。
 */

import {
  Affiliation,
  AmplifierCategory,
  Context,
  Echelon,
  HqTfDummy,
  Status,
  SymbolSet,
  type Sidc,
} from './types';

/** SIDC 的标准长度（2525D） */
export const SIDC_LENGTH = 20;

/** 2525D 的版本号，占据第 1-2 位 */
export const VERSION_2525D = 10;

/** 2525E Change 1 的版本号 */
export const VERSION_2525E = 15;

/** 所有合法的版本号 */
const VALID_VERSIONS: readonly number[] = [VERSION_2525D, VERSION_2525E];

/** 各集合型字段的合法取值，用于校验 */
const VALID_CONTEXTS: readonly number[] = Object.values(Context);
const VALID_AFFILIATIONS: readonly number[] = Object.values(Affiliation);
const VALID_SYMBOL_SETS: readonly number[] = Object.values(SymbolSet);
const VALID_STATUSES: readonly number[] = Object.values(Status);
const VALID_HQ_TF_DUMMY: readonly number[] = Object.values(HqTfDummy);
const VALID_AMPLIFIER_CATEGORIES: readonly number[] = Object.values(AmplifierCategory);

/**
 * 判断给定数值是否属于指定集合。
 *
 * `Object.values` 对 const 对象返回 `number[]`，此处统一收窄为数字比较，
 * 避免调用点出现类型断言。
 */
function inSet(value: number, set: readonly number[]): boolean {
  return set.includes(value);
}

/**
 * 解析 20 位数字型 SIDC 字符串。
 *
 * 本函数**只做结构校验**（长度、字符范围、字段取值是否在枚举内），
 * 不校验实体代码是否对应真实存在的符号——后者由符号库查找决定，
 * 因为标准会随版本修订不断增补实体，硬编码白名单反而会误伤。
 *
 * @param code 待解析的 SIDC 字符串
 * @returns 结构化表示的 SIDC
 * @throws 当字符串结构非法时抛出带位置信息的错误
 */
export function parseSidc(code: string): Sidc {
  const normalized = normalizeSidc(code);

  if (normalized.length !== SIDC_LENGTH) {
    throw new Error(
      `SIDC 长度必须为 ${SIDC_LENGTH} 位，实际收到 ${normalized.length} 位："${code}"`,
    );
  }
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`SIDC 只能包含数字，实际收到："${code}"`);
  }

  const version = sliceNumber(normalized, 0, 2);
  if (!inSet(version, VALID_VERSIONS)) {
    throw new Error(`SIDC 第 1-2 位版本号 "${version}" 不是受支持的标准版本`);
  }

  const context = sliceNumber(normalized, 2, 1);
  if (!inSet(context, VALID_CONTEXTS)) {
    throw new Error(`SIDC 第 3 位上下文 "${context}" 非法`);
  }

  const affiliation = sliceNumber(normalized, 3, 1);
  if (!inSet(affiliation, VALID_AFFILIATIONS)) {
    throw new Error(`SIDC 第 4 位身份 "${affiliation}" 非法`);
  }

  const symbolSet = sliceNumber(normalized, 4, 2);
  if (!inSet(symbolSet, VALID_SYMBOL_SETS)) {
    throw new Error(`SIDC 第 5-6 位符号集 "${symbolSet}" 非法`);
  }

  const status = sliceNumber(normalized, 6, 1);
  if (!inSet(status, VALID_STATUSES)) {
    throw new Error(`SIDC 第 7 位状态 "${status}" 非法`);
  }

  const hqTfDummy = sliceNumber(normalized, 7, 1);
  if (!inSet(hqTfDummy, VALID_HQ_TF_DUMMY)) {
    throw new Error(`SIDC 第 8 位司令部/特遣队标记 "${hqTfDummy}" 非法`);
  }

  const amplifier = sliceNumber(normalized, 8, 2);
  const amplifierCategory = sliceNumber(normalized, 8, 1);
  if (!inSet(amplifierCategory, VALID_AMPLIFIER_CATEGORIES)) {
    throw new Error(`SIDC 第 9 位放大器类别 "${amplifierCategory}" 非法`);
  }

  return {
    version,
    context: context as Sidc['context'],
    affiliation: affiliation as Sidc['affiliation'],
    symbolSet: symbolSet as Sidc['symbolSet'],
    status: status as Sidc['status'],
    hqTfDummy: hqTfDummy as Sidc['hqTfDummy'],
    amplifier,
    entity: sliceString(normalized, 10, 2),
    entityType: sliceString(normalized, 12, 2),
    entitySubtype: sliceString(normalized, 14, 2),
    modifier1: sliceString(normalized, 16, 2),
    modifier2: sliceString(normalized, 18, 2),
  };
}

/**
 * 将结构化 SIDC 序列化为 20 位字符串。
 *
 * 各字段不足位时左侧补零，例如符号集 1 输出为 "01"。
 */
export function formatSidc(sidc: Sidc): string {
  const parts = [
    pad(sidc.version, 2),
    String(sidc.context),
    String(sidc.affiliation),
    pad(sidc.symbolSet, 2),
    String(sidc.status),
    String(sidc.hqTfDummy),
    pad(sidc.amplifier, 2),
    sidc.entity,
    sidc.entityType,
    sidc.entitySubtype,
    sidc.modifier1,
    sidc.modifier2,
  ];
  return normalizeSidc(parts.join(''));
}

/**
 * 判断字符串是否为结构合法的 SIDC。
 *
 * 内部通过捕获 {@link parseSidc} 的异常实现，保证校验逻辑与解析逻辑
 * 永远不会出现分歧。
 */
export function isValidSidc(code: string): boolean {
  try {
    parseSidc(code);
    return true;
  } catch {
    return false;
  }
}

/**
 * 按默认值构造一个 SIDC。
 *
 * 默认值为：2525D 版本、真实上下文、友军身份、地面单位符号集、
 * 存在状态、无司令部标记、无放大器、实体为"步兵"。
 */
export function createSidc(overrides: Partial<Sidc> = {}): Sidc {
  return {
    version: VERSION_2525D,
    context: Context.Reality,
    affiliation: Affiliation.Friend,
    symbolSet: SymbolSet.LandUnit,
    status: Status.Present,
    hqTfDummy: HqTfDummy.None,
    amplifier: 0,
    entity: '12',
    entityType: '11',
    entitySubtype: '00',
    modifier1: '00',
    modifier2: '00',
    ...overrides,
  };
}

/**
 * 读取 SIDC 中的梯队级别。
 *
 * 只有当放大器类别为"旅及以下梯队"或"师及以上梯队"时才存在梯队，
 * 其余情况（机动方式、拖曳阵列）返回 null。
 */
export function echelonOf(sidc: Sidc): Echelon | null {
  const category = Math.floor(sidc.amplifier / 10);
  if (
    category !== AmplifierCategory.EchelonBrigadeAndBelow &&
    category !== AmplifierCategory.EchelonDivisionAndAbove
  ) {
    return null;
  }
  return sidc.amplifier === 0 ? null : (sidc.amplifier as Echelon);
}

/**
 * 读取 SIDC 中的陆上机动方式。
 *
 * 仅当放大器类别为"陆上装备机动方式"时有效，否则返回 null。
 */
export function mobilityOf(sidc: Sidc): number | null {
  if (Math.floor(sidc.amplifier / 10) !== AmplifierCategory.MobilityLand) {
    return null;
  }
  return sidc.amplifier % 10;
}

/** 设置 SIDC 的梯队级别，会自动修正放大器类别字段 */
export function withEchelon(sidc: Sidc, echelon: Echelon): Sidc {
  if (echelon === Echelon.None) {
    return { ...sidc, amplifier: 0 };
  }
  return { ...sidc, amplifier: echelon };
}

/**
 * 取得实体的完整 6 位代码（实体 + 实体类型 + 实体子类型）。
 *
 * 该代码是符号库检索的主键。
 */
export function entityCodeOf(sidc: Sidc): string {
  return `${sidc.entity}${sidc.entityType}${sidc.entitySubtype}`;
}

/**
 * 取得 Set A（第 1-10 位），即与具体实体无关的通用部分。
 *
 * 在符号库中，框架与修饰符只依赖 Set A，因此可用它做缓存键。
 */
export function setAOf(sidc: Sidc): string {
  return formatSidc(sidc).slice(0, 10);
}

/**
 * 规范化输入：去除连字符、空格并统一大写。
 *
 * 外部系统（如某些 C2 平台）会输出形如 `10031000001211000000`
 * 或带分隔符的 `10-0-3-10-0-0-00-121100-00-00` 形式，此处统一收敛。
 */
function normalizeSidc(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

/** 截取子串并转为数字 */
function sliceNumber(code: string, start: number, length: number): number {
  return Number(code.slice(start, start + length));
}

/** 截取子串，不足位时右侧补零以保证后续字段对齐 */
function sliceString(code: string, start: number, length: number): string {
  return pad(Number(code.slice(start, start + length) || 0), length);
}

/** 数字左侧补零到指定宽度 */
function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}
