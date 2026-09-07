/**
 * 军事符号引擎的类型定义。
 *
 * 本模块遵循 MIL-STD-2525D Change 1 与 NATO APP-6(D) 定义的
 * 20 位数字型符号识别码（SIDC, Symbol Identification Code）。
 */

/**
 * 上下文（Context），对应 SIDC 第 3 位。
 *
 * 用于区分真实态势、演习态势与模拟态势。演习与模拟态势在渲染时
 * 使用虚线框架以示区别。
 */
export const Context = {
  /** 真实（Reality）：实际发生的态势 */
  Reality: 0,
  /** 演习（Exercise）：模拟对抗演练中的态势 */
  Exercise: 1,
  /** 模拟（Simulation）：计算机兵棋推演中的态势 */
  Simulation: 2,
} as const;
export type Context = (typeof Context)[keyof typeof Context];

/**
 * 身份（Standard Identity / Affiliation），对应 SIDC 第 4 位。
 *
 * 身份决定符号的**框架形状**与**颜色**，二者互为冗余，
 * 以保证在单色打印或夜视条件下仍能区分敌我。
 */
export const Affiliation = {
  /** 待定（Pending） */
  Pending: 0,
  /** 不明（Unknown）：黄色四叶形框架 */
  Unknown: 1,
  /** 假定友军（Assumed Friend）：蓝色矩形框架 + 问号修饰 */
  AssumedFriend: 2,
  /** 友军（Friend）：蓝色矩形框架 */
  Friend: 3,
  /** 中立（Neutral）：绿色正方形框架 */
  Neutral: 4,
  /** 可疑（Suspect / Joker）：红色菱形框架 + 问号修饰 */
  Suspect: 5,
  /** 敌军（Hostile / Faker）：红色菱形框架 */
  Hostile: 6,
} as const;
export type Affiliation = (typeof Affiliation)[keyof typeof Affiliation];

/**
 * 符号集（Symbol Set），对应 SIDC 第 5-6 位。
 *
 * 符号集决定符号所属的领域，进而决定实体代码的语义与框架形态。
 */
export const SymbolSet = {
  /** 未知 */
  Unknown: 0,
  /** 空中 */
  Air: 1,
  /** 空中导弹 */
  AirMissile: 2,
  /** 太空 */
  Space: 5,
  /** 太空导弹 */
  SpaceMissile: 6,
  /** 地面单位 */
  LandUnit: 10,
  /** 地面平民单位/组织 */
  LandCivilian: 11,
  /** 地面装备 */
  LandEquipment: 15,
  /** 地面设施 */
  LandInstallation: 20,
  /** 控制措施（战术图形） */
  ControlMeasure: 25,
  /** 徒步单兵 */
  Dismounted: 27,
  /** 海面 */
  SeaSurface: 30,
  /** 水下 */
  SeaSubsurface: 35,
  /** 水雷战 */
  MineWarfare: 36,
  /** 活动/事件 */
  Activities: 40,
  /** 大气（气象） */
  Atmospheric: 45,
  /** 海洋（水文） */
  Oceanographic: 46,
  /** 信号情报 */
  Sigint: 50,
  /** 网络空间 */
  Cyberspace: 60,
} as const;
export type SymbolSet = (typeof SymbolSet)[keyof typeof SymbolSet];

/**
 * 状态（Status），对应 SIDC 第 7 位。
 *
 * 用于表达目标是否存在、是否受损或被摧毁。
 */
export const Status = {
  /** 存在（Present） */
  Present: 0,
  /** 计划/预期（Planned / Anticipated / Suspect）：虚线渲染 */
  Planned: 1,
  /** 具备完全作战能力（Fully Capable） */
  FullyCapable: 2,
  /** 受损（Damaged） */
  Damaged: 3,
  /** 已被摧毁（Destroyed） */
  Destroyed: 4,
  /** 满载（Full to Capacity） */
  FullToCapacity: 5,
} as const;
export type Status = (typeof Status)[keyof typeof Status];

/**
 * 司令部/特遣队/佯动（HQ / Task Force / Dummy），对应 SIDC 第 8 位。
 *
 * 该字段在框架上方叠加指示线：司令部为向上开口的"旗标"，
 * 特遣队为带斜线的方框。
 */
export const HqTfDummy = {
  /** 无 */
  None: 0,
  /** 佯动/假目标（Feint / Dummy） */
  FeintDummy: 1,
  /** 司令部（Headquarters） */
  Headquarters: 2,
  /** 佯动司令部（Feint / Dummy Headquarters） */
  FeintDummyHeadquarters: 3,
  /** 特遣队（Task Force） */
  TaskForce: 4,
  /** 佯动特遣队（Feint / Dummy Task Force） */
  FeintDummyTaskForce: 5,
  /** 特遣队司令部（Task Force Headquarters） */
  TaskForceHeadquarters: 6,
  /** 佯动特遣队司令部 */
  FeintDummyTaskForceHeadquarters: 7,
} as const;
export type HqTfDummy = (typeof HqTfDummy)[keyof typeof HqTfDummy];

/**
 * 放大器/描述符的类别，对应 SIDC 第 9 位。
 *
 * 放大器用于表达梯队级别、装备机动方式或拖曳阵列类型，
 * 具体取值由第 10 位给出。
 */
export const AmplifierCategory = {
  /** 未指定 */
  Unknown: 0,
  /** 旅及以下梯队 */
  EchelonBrigadeAndBelow: 1,
  /** 师及以上梯队 */
  EchelonDivisionAndAbove: 2,
  /** 陆上装备机动方式 */
  MobilityLand: 3,
  /** 雪上装备机动方式 */
  MobilitySnow: 4,
  /** 水上装备机动方式 */
  MobilityWater: 5,
  /** 海军拖曳阵列 */
  NavalTowedArray: 6,
} as const;
export type AmplifierCategory = (typeof AmplifierCategory)[keyof typeof AmplifierCategory];

/**
 * 梯队级别（Echelon）。
 *
 * 梯队符号绘制在框架**正上方**，用点或竖条的数量表示编制层级。
 */
export const Echelon = {
  /** 无 */
  None: 0,
  /** 班/组（Team / Crew）：1 个点 */
  Team: 11,
  /** 小队（Squad）：2 个点 */
  Squad: 12,
  /** 分队（Section）：3 个点 */
  Section: 13,
  /** 排/分遣队（Platoon / Detachment）：4 个点 */
  Platoon: 14,
  /** 连/炮兵连/骑兵连（Company / Battery / Troop）：1 条竖线 */
  Company: 15,
  /** 营/中队（Battalion / Squadron）：2 条竖线 */
  Battalion: 16,
  /** 团/大队（Regiment / Group）：3 条竖线 */
  Regiment: 17,
  /** 旅（Brigade）：4 条竖线 */
  Brigade: 18,
  /** 师（Division）：1 个 X */
  Division: 21,
  /** 军/海军陆战队远征部队（Corps / MEF）：2 个 X */
  Corps: 22,
  /** 集团军（Army）：3 个 X */
  Army: 23,
  /** 集团军群/方面军（Army Group / Front）：4 个 X */
  ArmyGroup: 24,
  /** 战区/军区（Region / Theater）：5 个 X */
  Region: 25,
  /** 司令部（Command）：6 个 X */
  Command: 26,
} as const;
export type Echelon = (typeof Echelon)[keyof typeof Echelon];

/**
 * 装备陆上机动方式（第 9 位为 3 时的第 10 位取值）。
 */
export const MobilityLand = {
  /** 轮式，有限越野 */
  WheeledLimitedCrossCountry: 1,
  /** 轮式，越野 */
  WheeledCrossCountry: 2,
  /** 履带式 */
  Tracked: 3,
  /** 轮履混合 */
  WheeledAndTracked: 4,
  /** 牵引 */
  Towed: 5,
  /** 铁路运输 */
  Rail: 6,
  /** 驮载（畜力） */
  PackAnimals: 7,
} as const;
export type MobilityLand = (typeof MobilityLand)[keyof typeof MobilityLand];

/**
 * 完整的 20 位 SIDC 结构化表示。
 *
 * 实体代码被拆分为 entity / entityType / entitySubtype 三段各两位，
 * 便于按层级检索符号定义。
 */
export interface Sidc {
  /** 标准版本（第 1-2 位），10 表示 2525D */
  version: number;
  /** 上下文（第 3 位） */
  context: Context;
  /** 身份（第 4 位） */
  affiliation: Affiliation;
  /** 符号集（第 5-6 位） */
  symbolSet: SymbolSet;
  /** 状态（第 7 位） */
  status: Status;
  /** 司令部/特遣队/佯动（第 8 位） */
  hqTfDummy: HqTfDummy;
  /** 放大器原始两位数值（第 9-10 位） */
  amplifier: number;
  /** 实体（第 11-12 位） */
  entity: string;
  /** 实体类型（第 13-14 位） */
  entityType: string;
  /** 实体子类型（第 15-16 位） */
  entitySubtype: string;
  /** 修饰符 1（第 17-18 位） */
  modifier1: string;
  /** 修饰符 2（第 19-20 位） */
  modifier2: string;
}

/**
 * 符号的几何输出：一组 SVG 图元描述。
 *
 * 之所以不直接输出 SVG 字符串，是为了让调用方（地图 divIcon、
 * 侧边栏预览、导出器）能够自由决定描边宽度、抗锯齿与配色，
 * 同时便于单元测试对几何数值做断言。
 */
export interface SymbolGeometry {
  /** 需要填充闭合的区域（框架底色与图标实心部分） */
  fills: SymbolPath[];
  /** 需要描边的路径 */
  strokes: SymbolPath[];
  /** 文本修饰符 */
  labels: SymbolLabel[];
}

/** 单条 SVG 路径及其渲染属性 */
export interface SymbolPath {
  /** SVG path 的 d 属性 */
  d: string;
  /** 填充/描边使用的颜色角色 */
  role: ColorRole;
  /** 描边宽度，仅在 strokes 中有效 */
  strokeWidth?: number;
  /** 是否使用虚线（演习、计划状态等） */
  dashed?: boolean;
  /**
   * 坐标变换，写成 SVG transform 属性值的形式。
   *
   * 图标统一定义在 100×100 局部坐标系内，渲染时需要变换到框架内部区域，
   * 该变换即记录在此处，从而让几何描述保持自包含。
   */
  transform?: string;
}

/** 符号上叠加的文本修饰符 */
export interface SymbolLabel {
  /** 文本内容 */
  text: string;
  /** 基线锚点 x */
  x: number;
  /** 基线锚点 y */
  y: number;
  /** 字号 */
  fontSize: number;
  /** 文本相对锚点的水平对齐方式 */
  anchor: 'start' | 'middle' | 'end';
  /** 颜色角色 */
  role: ColorRole;
}

/**
 * 颜色角色。
 *
 * 与具体色值解耦：不同身份、不同主题（昼间/夜间/单色打印）
 * 只需提供一张色表即可整体切换。
 */
export type ColorRole =
  | 'frame' // 框架轮廓
  | 'fill' // 框架填充
  | 'icon' // 图标主体
  | 'background' // 图标衬底，用于压暗框架填充
  | 'text'; // 文本修饰符
