/**
 * 军标图标库。
 *
 * 每个图标在 **100 × 100 的局部坐标系**内定义（中心 50,50），
 * 渲染时按框架的内部可用区域等比缩放并居中。这样做的收益是：
 * 图标定义与框架尺寸彻底解耦，同一份图标可复用于任意尺寸的符号。
 *
 * 实体代码（entity code）取自 MIL-STD-2525D / APP-6(D) 的标准编码表，
 * 与符号集（symbol set）联合构成检索主键。
 *
 * 说明：标准全集包含数千个符号，本库选取**最常用的核心符号**作为覆盖目标，
 * 未收录的实体代码会回退到该符号集的通用图标，保证渲染永不失败。
 */

import { SymbolSet } from './types';

/** 图标中的一条路径 */
export interface IconPath {
  /** SVG path 的 d 属性，定义在 100×100 局部坐标系内 */
  d: string;
  /** 是否为实心（填充）图元，默认 false 即仅描边 */
  filled?: boolean;
}

/** 一个符号条目的定义 */
export interface SymbolDefinition {
  /** 中文名称 */
  name: string;
  /** 英文名称 */
  nameEn: string;
  /** 所属符号集 */
  symbolSet: SymbolSet;
  /** 6 位实体代码 */
  entity: string;
  /** 图标路径集合 */
  paths: IconPath[];
}

/** 检索主键：`符号集-实体代码`，例如 `10-121100` */
function key(symbolSet: SymbolSet, entity: string): string {
  return `${symbolSet}-${entity}`;
}

/**
 * 地面单位图标（符号集 10）。
 *
 * 各图标依据 2525 标准外观绘制：装甲为椭圆（象征坦克俯视轮廓）、
 * 炮兵为实心圆（象征炮弹）、工兵为桥形、医疗为十字等。
 */
const LAND_UNIT: SymbolDefinition[] = [
  // ── 指挥控制 ──────────────────────────────────────────────
  {
    name: '指挥控制',
    nameEn: 'Command and Control',
    symbolSet: SymbolSet.LandUnit,
    entity: '110000',
    paths: [{ d: 'M 30,30 L 70,30 L 70,70 L 30,70 Z' }],
  },
  {
    name: '通信',
    nameEn: 'Signal',
    symbolSet: SymbolSet.LandUnit,
    entity: '111000',
    paths: [
      { d: 'M 50,20 L 50,80' }, // 天线主杆
      { d: 'M 32,34 L 68,34' }, // 上横担
      { d: 'M 36,50 L 64,50' }, // 下横担
    ],
  },
  // ── 机动与作战 ────────────────────────────────────────────
  {
    name: '装甲',
    nameEn: 'Armor',
    symbolSet: SymbolSet.LandUnit,
    entity: '120500',
    paths: [{ d: 'M 15,50 A 35,22 0 0 1 85,50 A 35,22 0 0 1 15,50 Z' }],
  },
  {
    name: '反坦克',
    nameEn: 'Antitank / Antiarmor',
    symbolSet: SymbolSet.LandUnit,
    entity: '120400',
    paths: [
      { d: 'M 15,50 A 35,22 0 0 1 85,50 A 35,22 0 0 1 15,50 Z' }, // 椭圆
      { d: 'M 20,76 L 80,24' }, // 穿过椭圆的斜线
    ],
  },
  {
    name: '步兵',
    nameEn: 'Infantry',
    symbolSet: SymbolSet.LandUnit,
    entity: '121100',
    paths: [{ d: 'M 25,22 L 75,78' }, { d: 'M 75,22 L 25,78' }],
  },
  {
    name: '机械化步兵',
    nameEn: 'Mechanized Infantry',
    symbolSet: SymbolSet.LandUnit,
    entity: '121102',
    paths: [
      { d: 'M 12,50 A 38,25 0 0 1 88,50 A 38,25 0 0 1 12,50 Z' }, // 外椭圆
      { d: 'M 33,30 L 67,70' }, // 内嵌 X
      { d: 'M 67,30 L 33,70' },
    ],
  },
  {
    name: '侦察/骑兵',
    nameEn: 'Reconnaissance / Cavalry',
    symbolSet: SymbolSet.LandUnit,
    entity: '121300',
    paths: [
      { d: 'M 18,82 L 82,18' }, // 主对角线
      { d: 'M 82,18 L 60,22' }, // 顶端短钩
    ],
  },
  {
    name: '特种部队',
    nameEn: 'Special Operations Forces',
    symbolSet: SymbolSet.LandUnit,
    entity: '121800',
    paths: [{ d: 'M 56,10 L 32,56 L 48,56 L 42,90 L 70,42 L 52,42 Z', filled: true }],
  },
  {
    name: '陆航旋翼',
    nameEn: 'Army Aviation Rotary Wing',
    symbolSet: SymbolSet.LandUnit,
    entity: '120600',
    paths: [
      { d: 'M 50,50 m -26,0 a 26,26 0 1,0 52,0 a 26,26 0 1,0 -52,0' }, // 旋翼圆
      { d: 'M 24,24 L 76,76' },
      { d: 'M 76,24 L 24,76' },
    ],
  },
  {
    name: '陆航固定翼',
    nameEn: 'Army Aviation Fixed Wing',
    symbolSet: SymbolSet.LandUnit,
    entity: '120800',
    paths: [
      { d: 'M 50,14 L 50,86' }, // 机身
      { d: 'M 18,54 L 82,54' }, // 主翼
      { d: 'M 32,80 L 68,80' }, // 尾翼
    ],
  },
  // ── 火力支援 ──────────────────────────────────────────────
  {
    name: '防空',
    nameEn: 'Air Defense',
    symbolSet: SymbolSet.LandUnit,
    entity: '130100',
    paths: [
      { d: 'M 18,58 A 32,32 0 0 1 82,58' }, // 半球穹顶
      { d: 'M 18,58 L 82,58' }, // 地平面
      { d: 'M 50,58 L 50,20' }, // 指向上方的炮管
      { d: 'M 44,28 L 50,18 L 56,28 Z', filled: true }, // 箭头
    ],
  },
  {
    name: '野战炮兵',
    nameEn: 'Field Artillery',
    symbolSet: SymbolSet.LandUnit,
    entity: '130300',
    paths: [{ d: 'M 50,50 m -16,0 a 16,16 0 1,0 32,0 a 16,16 0 1,0 -32,0', filled: true }],
  },
  {
    name: '炮兵观察员',
    nameEn: 'Field Artillery Observer',
    symbolSet: SymbolSet.LandUnit,
    entity: '130400',
    paths: [
      { d: 'M 50,50 m -16,0 a 16,16 0 1,0 32,0 a 16,16 0 1,0 -32,0', filled: true },
      { d: 'M 50,78 L 50,92' }, // 观察镜支架
      { d: 'M 42,92 L 58,92' },
    ],
  },
  {
    name: '导弹',
    nameEn: 'Missile',
    symbolSet: SymbolSet.LandUnit,
    entity: '130700',
    paths: [
      { d: 'M 50,10 L 58,34 L 58,72 L 42,72 L 42,34 Z' }, // 弹体
      { d: 'M 42,72 L 34,90 L 50,82 L 66,90 L 58,72' }, // 尾焰
    ],
  },
  // ── 防护 ──────────────────────────────────────────────────
  {
    name: '工兵',
    nameEn: 'Engineer',
    symbolSet: SymbolSet.LandUnit,
    entity: '140700',
    paths: [
      { d: 'M 14,74 L 86,74' }, // 桥面
      { d: 'M 26,74 L 34,44' }, // 左斜撑
      { d: 'M 74,74 L 66,44' }, // 右斜撑
      { d: 'M 34,44 L 66,44' }, // 横梁
      { d: 'M 44,44 L 44,74 M 56,44 L 56,74' }, // 立柱
    ],
  },
  {
    name: '宪兵',
    nameEn: 'Military Police',
    symbolSet: SymbolSet.LandUnit,
    entity: '141200',
    paths: [
      { d: 'M 50,14 L 80,28 L 80,52 C 80,72 66,84 50,90 C 34,84 20,72 20,52 L 20,28 Z' },
      { d: 'M 38,42 L 62,42 M 38,56 L 62,56' }, // 盾面横纹
    ],
  },
  {
    name: '核生化防护',
    nameEn: 'CBRN Defense',
    symbolSet: SymbolSet.LandUnit,
    entity: '140100',
    paths: [
      { d: 'M 50,16 L 88,82 L 12,82 Z' }, // 警示三角
      { d: 'M 50,52 m -9,0 a 9,9 0 1,0 18,0 a 9,9 0 1,0 -18,0', filled: true },
    ],
  },
  {
    name: '导弹防御',
    nameEn: 'Missile Defense',
    symbolSet: SymbolSet.LandUnit,
    entity: '142200',
    paths: [
      { d: 'M 50,10 L 58,34 L 58,70 L 42,70 L 42,34 Z' },
      { d: 'M 20,84 L 80,84' },
      { d: 'M 50,70 L 50,84' },
    ],
  },
  // ── 情报 ──────────────────────────────────────────────────
  {
    name: '电子战',
    nameEn: 'Electronic Warfare',
    symbolSet: SymbolSet.LandUnit,
    entity: '150500',
    paths: [
      { d: 'M 14,50 Q 26,20 38,50 T 62,50 T 86,50' }, // 电波
      { d: 'M 14,70 Q 26,40 38,70 T 62,70 T 86,70' },
    ],
  },
  // ── 保障 ──────────────────────────────────────────────────
  {
    name: '医疗',
    nameEn: 'Medical',
    symbolSet: SymbolSet.LandUnit,
    entity: '161300',
    paths: [
      {
        d: 'M 40,18 L 60,18 L 60,40 L 82,40 L 82,60 L 60,60 L 60,82 L 40,82 L 40,60 L 18,60 L 18,40 L 40,40 Z',
        filled: true,
      },
    ],
  },
  {
    name: '补给',
    nameEn: 'All Classes of Supply',
    symbolSet: SymbolSet.LandUnit,
    entity: '160200',
    paths: [{ d: 'M 20,36 L 80,36 L 80,80 L 20,80 Z' }, { d: 'M 20,36 L 50,20 L 80,36' }],
  },
  {
    name: '弹药',
    nameEn: 'Ammunition',
    symbolSet: SymbolSet.LandUnit,
    entity: '160400',
    paths: [{ d: 'M 36,20 L 64,20 L 64,58 L 50,72 L 36,58 Z' }, { d: 'M 36,44 L 64,44' }],
  },
  {
    name: '维修',
    nameEn: 'Maintenance',
    symbolSet: SymbolSet.LandUnit,
    entity: '161100',
    paths: [
      { d: 'M 50,50 m -14,0 a 14,14 0 1,0 28,0 a 14,14 0 1,0 -28,0' }, // 齿轮主体
      { d: 'M 50,20 L 50,30 M 50,70 L 50,80 M 20,50 L 30,50 M 70,50 L 80,50' }, // 四向凸齿
      { d: 'M 29,29 L 36,36 M 71,29 L 64,36 M 29,71 L 36,64 M 71,71 L 64,64' }, // 斜向凸齿
    ],
  },
  {
    name: '运输',
    nameEn: 'Transportation',
    symbolSet: SymbolSet.LandUnit,
    entity: '161200',
    paths: [
      { d: 'M 16,66 L 84,66' }, // 车轮基线
      { d: 'M 28,66 L 28,40 L 72,40 L 72,66' }, // 车厢
      { d: 'M 72,48 L 84,48 L 84,66' }, // 车头
      { d: 'M 32,66 m -6,0 a 6,6 0 1,0 12,0 a 6,6 0 1,0 -12,0' }, // 车轮
      { d: 'M 68,66 m -6,0 a 6,6 0 1,0 12,0 a 6,6 0 1,0 -12,0' },
    ],
  },
];

/**
 * 空中图标（符号集 01）。
 *
 * 空中图标以「机身 + 机翼」的侧视/俯视混合表达，不同机型靠机翼形状区分。
 */
const AIR: SymbolDefinition[] = [
  {
    name: '固定翼',
    nameEn: 'Fixed Wing',
    symbolSet: SymbolSet.Air,
    entity: '110100',
    paths: [
      { d: 'M 50,12 L 54,44 L 54,88 L 46,88 L 46,44 Z' }, // 机身
      { d: 'M 12,52 L 88,52' }, // 主翼
      { d: 'M 34,80 L 66,80' }, // 尾翼
    ],
  },
  {
    name: '战斗机',
    nameEn: 'Fighter',
    symbolSet: SymbolSet.Air,
    entity: '110104',
    paths: [
      { d: 'M 50,12 L 54,46 L 54,88 L 46,88 L 46,46 Z' },
      { d: 'M 14,58 L 50,46 L 86,58' }, // 后掠翼
      { d: 'M 36,82 L 64,82' },
    ],
  },
  {
    name: '轰炸机',
    nameEn: 'Bomber',
    symbolSet: SymbolSet.Air,
    entity: '110103',
    paths: [
      { d: 'M 50,14 L 55,48 L 55,86 L 45,86 L 45,48 Z' },
      { d: 'M 16,50 L 84,50' },
      { d: 'M 30,78 L 70,78' },
      { d: 'M 42,26 L 58,26' },
    ],
  },
  {
    name: '运输机',
    nameEn: 'Cargo',
    symbolSet: SymbolSet.Air,
    entity: '110107',
    paths: [
      { d: 'M 50,16 L 58,50 L 58,82 L 42,82 L 42,50 Z' },
      { d: 'M 14,54 L 86,54' },
      { d: 'M 34,78 L 66,78' },
      { d: 'M 40,60 L 60,60' }, // 货舱线
    ],
  },
  {
    name: '加油机',
    nameEn: 'Tanker',
    symbolSet: SymbolSet.Air,
    entity: '110109',
    paths: [
      { d: 'M 50,16 L 56,50 L 56,82 L 44,82 L 44,50 Z' },
      { d: 'M 14,54 L 86,54' },
      { d: 'M 34,78 L 66,78' },
      { d: 'M 56,64 L 82,64 L 82,72' }, // 加油管
    ],
  },
  {
    name: '侦察机',
    nameEn: 'Reconnaissance',
    symbolSet: SymbolSet.Air,
    entity: '110111',
    paths: [
      { d: 'M 50,14 L 54,46 L 54,86 L 46,86 L 46,46 Z' },
      { d: 'M 16,52 L 84,52' },
      { d: 'M 34,78 L 66,78' },
      { d: 'M 50,50 m -8,0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0' }, // 侦察吊舱
    ],
  },
  {
    name: '旋翼机',
    nameEn: 'Rotary Wing',
    symbolSet: SymbolSet.Air,
    entity: '110200',
    paths: [
      { d: 'M 50,50 m -28,0 a 28,28 0 1,0 56,0 a 28,28 0 1,0 -56,0' }, // 旋翼盘
      { d: 'M 24,24 L 76,76' },
      { d: 'M 76,24 L 24,76' },
      { d: 'M 42,50 L 58,50 L 55,84 L 45,84 Z' }, // 机身
    ],
  },
  {
    name: '无人机',
    nameEn: 'Unmanned Aircraft',
    symbolSet: SymbolSet.Air,
    entity: '110300',
    paths: [
      { d: 'M 50,18 L 62,34 L 62,66 L 38,66 L 38,34 Z' }, // 机体
      { d: 'M 12,52 L 38,52 M 62,52 L 88,52' }, // 分离式机翼
      { d: 'M 40,66 L 40,84 M 60,66 L 60,84' }, // 起落架
    ],
  },
  {
    name: '导弹（空中）',
    nameEn: 'Air Weapon',
    symbolSet: SymbolSet.Air,
    entity: '130000',
    paths: [
      { d: 'M 50,10 L 58,36 L 58,74 L 42,74 L 42,36 Z' },
      { d: 'M 42,74 L 34,90 L 50,82 L 66,90 L 58,74' },
    ],
  },
];

/**
 * 海面图标（符号集 30）。
 *
 * 海面舰艇以俯视船体轮廓表达，舰种靠上层建筑数量与形状区分。
 */
const SEA_SURFACE: SymbolDefinition[] = [
  {
    name: '水面舰艇',
    nameEn: 'Surface Combatant',
    symbolSet: SymbolSet.SeaSurface,
    entity: '120000',
    paths: [{ d: 'M 12,56 L 88,56 L 74,78 L 26,78 Z' }],
  },
  {
    name: '航空母舰',
    nameEn: 'Carrier',
    symbolSet: SymbolSet.SeaSurface,
    entity: '120100',
    paths: [
      { d: 'M 10,54 L 90,54 L 76,80 L 24,80 Z' }, // 船体
      { d: 'M 18,54 L 82,54 L 82,44 L 18,44 Z' }, // 飞行甲板
      { d: 'M 66,44 L 66,32 L 78,32 L 78,44' }, // 舰岛
    ],
  },
  {
    name: '驱逐舰',
    nameEn: 'Destroyer',
    symbolSet: SymbolSet.SeaSurface,
    entity: '120203',
    paths: [
      { d: 'M 12,58 L 88,58 L 74,78 L 26,78 Z' },
      { d: 'M 40,58 L 40,42 L 60,42 L 60,58' }, // 上层建筑
    ],
  },
  {
    name: '护卫舰',
    nameEn: 'Frigate',
    symbolSet: SymbolSet.SeaSurface,
    entity: '120204',
    paths: [{ d: 'M 16,58 L 84,58 L 72,78 L 28,78 Z' }, { d: 'M 42,58 L 42,44 L 58,44 L 58,58' }],
  },
  {
    name: '两栖舰',
    nameEn: 'Amphibious Warfare Ship',
    symbolSet: SymbolSet.SeaSurface,
    entity: '120300',
    paths: [
      { d: 'M 12,52 L 88,52 L 74,78 L 26,78 Z' },
      { d: 'M 30,52 L 30,36 L 70,36 L 70,52' }, // 宽大甲板室
      { d: 'M 70,52 L 88,52' },
    ],
  },
  {
    name: '水雷战舰艇',
    nameEn: 'Mine Warfare Ship',
    symbolSet: SymbolSet.SeaSurface,
    entity: '120400',
    paths: [
      { d: 'M 16,58 L 84,58 L 72,78 L 28,78 Z' },
      { d: 'M 44,58 L 44,44 L 56,44 L 56,58' },
      { d: 'M 50,86 m -7,0 a 7,7 0 1,0 14,0 a 7,7 0 1,0 -14,0' }, // 水雷
    ],
  },
];

/**
 * 水下图标（符号集 35）。
 */
const SEA_SUBSURFACE: SymbolDefinition[] = [
  {
    name: '潜艇',
    nameEn: 'Submarine',
    symbolSet: SymbolSet.SeaSubsurface,
    entity: '110100',
    paths: [
      { d: 'M 14,56 L 86,56 C 86,68 72,76 50,76 C 28,76 14,68 14,56 Z' }, // 艇身
      { d: 'M 44,56 L 44,36 L 56,36 L 56,56' }, // 指挥塔
    ],
  },
  {
    name: '无人潜航器',
    nameEn: 'Unmanned Underwater Vehicle',
    symbolSet: SymbolSet.SeaSubsurface,
    entity: '110400',
    paths: [
      { d: 'M 24,56 L 76,56 C 76,66 66,72 50,72 C 34,72 24,66 24,56 Z' },
      { d: 'M 50,56 L 50,40' },
    ],
  },
];

/** 地面装备图标（符号集 15）。 */
const LAND_EQUIPMENT: SymbolDefinition[] = [
  { name: '主战坦克', nameEn: 'Main Battle Tank', symbolSet: SymbolSet.LandEquipment, entity: '110100', paths: [{ d: 'M18,62 L82,62 L74,78 L26,78 Z' }, { d: 'M34,62 L42,46 L62,46 L70,62' }, { d: 'M58,46 L86,34' }] },
  { name: '步兵战车', nameEn: 'Infantry Fighting Vehicle', symbolSet: SymbolSet.LandEquipment, entity: '110200', paths: [{ d: 'M16,62 L78,62 L72,78 L24,78 Z' }, { d: 'M34,62 L42,48 L62,48 L68,62' }, { d: 'M62,48 L82,42' }] },
  { name: '装甲输送车', nameEn: 'Armored Personnel Carrier', symbolSet: SymbolSet.LandEquipment, entity: '110300', paths: [{ d: 'M16,60 L80,60 L74,76 L22,76 Z' }, { d: 'M30,60 L38,46 L64,46 L72,60' }] },
  { name: '自行火炮', nameEn: 'Self-Propelled Howitzer', symbolSet: SymbolSet.LandEquipment, entity: '120100', paths: [{ d: 'M18,64 L80,64 L74,78 L24,78 Z' }, { d: 'M34,64 L40,48 L62,48 L70,64' }, { d: 'M54,48 L88,22' }] },
  { name: '牵引火炮', nameEn: 'Towed Howitzer', symbolSet: SymbolSet.LandEquipment, entity: '120200', paths: [{ d: 'M22,68 L76,68' }, { d: 'M48,68 L74,30 L86,24' }, { d: 'M30,68 m-8,0 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0 M66,68 m-8,0 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0' }] },
  { name: '多管火箭炮', nameEn: 'Multiple Rocket Launcher', symbolSet: SymbolSet.LandEquipment, entity: '120300', paths: [{ d: 'M18,66 L82,66 L74,80 L26,80 Z' }, { d: 'M30,58 L66,40 L72,54 L36,72 Z' }, { d: 'M38,55 L66,41 M42,62 L70,48' }] },
  { name: '地对空导弹发射车', nameEn: 'Surface-to-Air Missile Launcher', symbolSet: SymbolSet.LandEquipment, entity: '130100', paths: [{ d: 'M18,68 L82,68 L74,82 L26,82 Z' }, { d: 'M42,60 L54,24 L62,60 Z' }] },
  { name: '反坦克导弹车', nameEn: 'Antitank Missile Vehicle', symbolSet: SymbolSet.LandEquipment, entity: '130200', paths: [{ d: 'M18,68 L82,68 L74,82 L26,82 Z' }, { d: 'M42,60 L62,34 L68,42 L48,68 Z' }, { d: 'M68,42 L84,30' }] },
  { name: '迫击炮', nameEn: 'Mortar', symbolSet: SymbolSet.LandEquipment, entity: '120400', paths: [{ d: 'M34,76 L66,76 M50,76 L36,34 L44,30 M56,76 L72,58' }] },
  { name: '雷达车', nameEn: 'Radar Vehicle', symbolSet: SymbolSet.LandEquipment, entity: '140100', paths: [{ d: 'M18,68 L82,68 L74,82 L26,82 Z' }, { d: 'M50,62 L50,30 M28,38 Q50,14 72,38 M34,48 Q50,30 66,48' }] },
  { name: '通信车', nameEn: 'Communications Vehicle', symbolSet: SymbolSet.LandEquipment, entity: '140200', paths: [{ d: 'M18,68 L82,68 L74,82 L26,82 Z' }, { d: 'M50,66 L50,24 M32,36 Q50,18 68,36 M38,46 Q50,34 62,46' }] },
  { name: '电子干扰车', nameEn: 'Electronic Warfare Vehicle', symbolSet: SymbolSet.LandEquipment, entity: '140300', paths: [{ d: 'M18,68 L82,68 L74,82 L26,82 Z' }, { d: 'M50,64 L50,34 M24,34 Q36,18 48,34 T72,34 M24,48 Q36,32 48,48 T72,48' }] },
  { name: '工程车', nameEn: 'Engineer Vehicle', symbolSet: SymbolSet.LandEquipment, entity: '150100', paths: [{ d: 'M18,68 L82,68 L74,82 L26,82 Z' }, { d: 'M36,68 L48,42 L60,68 M42,54 L64,36 L74,44' }] },
  { name: '装甲抢修车', nameEn: 'Armored Recovery Vehicle', symbolSet: SymbolSet.LandEquipment, entity: '150200', paths: [{ d: 'M18,68 L82,68 L74,82 L26,82 Z' }, { d: 'M36,68 L50,42 L64,68 M50,42 L74,28 L80,36' }] },
  { name: '架桥车', nameEn: 'Armored Vehicle-Launched Bridge', symbolSet: SymbolSet.LandEquipment, entity: '150300', paths: [{ d: 'M18,70 L82,70 L74,82 L26,82 Z' }, { d: 'M20,54 L80,54 L72,42 L28,42 Z' }, { d: 'M32,54 L40,42 M68,54 L60,42' }] },
  { name: '军用卡车', nameEn: 'Cargo Truck', symbolSet: SymbolSet.LandEquipment, entity: '160100', paths: [{ d: 'M16,64 L84,64 L84,76 L16,76 Z' }, { d: 'M24,64 L24,42 L62,42 L62,64 M62,48 L76,48 L84,64' }, { d: 'M30,76 m-7,0 a7,7 0 1,0 14,0 a7,7 0 1,0 -14,0 M70,76 m-7,0 a7,7 0 1,0 14,0 a7,7 0 1,0 -14,0' }] },
  { name: '油料车', nameEn: 'Fuel Truck', symbolSet: SymbolSet.LandEquipment, entity: '160200', paths: [{ d: 'M16,66 L84,66 L84,78 L16,78 Z' }, { d: 'M24,66 L24,42 L60,42 L60,66 M42,54 m-10,0 a10,10 0 1,0 20,0 a10,10 0 1,0 -20,0' }] },
  { name: '救护车', nameEn: 'Ambulance', symbolSet: SymbolSet.LandEquipment, entity: '160300', paths: [{ d: 'M16,66 L84,66 L84,78 L16,78 Z' }, { d: 'M24,66 L24,42 L60,42 L60,66 M42,48 L42,56 M38,52 L46,52' }] },
  { name: '无人地面车辆', nameEn: 'Unmanned Ground Vehicle', symbolSet: SymbolSet.LandEquipment, entity: '170100', paths: [{ d: 'M22,62 L78,62 L72,76 L28,76 Z' }, { d: 'M40,62 L46,48 L60,48 L66,62 M50,48 m-6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0' }] },
  { name: '地面传感器', nameEn: 'Ground Sensor', symbolSet: SymbolSet.LandEquipment, entity: '170200', paths: [{ d: 'M50,78 L50,42 M32,54 Q50,30 68,54 M38,64 Q50,48 62,64 M36,78 L64,78' }] },
];

/** 地面设施、点状控制措施和功能专项图标。 */
const EXTRA_DEFINITIONS: SymbolDefinition[] = [
  { name: '指挥所', nameEn: 'Command Post', symbolSet: SymbolSet.LandInstallation, entity: '110100', paths: [{ d: 'M20,28 L80,28 L80,76 L20,76 Z M36,76 L36,50 L64,50 L64,76 M50,28 L50,14' }] },
  { name: '机场', nameEn: 'Airfield', symbolSet: SymbolSet.LandInstallation, entity: '110200', paths: [{ d: 'M18,72 L82,28 M30,64 L42,72 M48,50 L60,58 M66,36 L78,44 M42,42 L58,58 M58,42 L42,58' }] },
  { name: '港口', nameEn: 'Port', symbolSet: SymbolSet.LandInstallation, entity: '110300', paths: [{ d: 'M20,30 L80,30 L80,72 L20,72 Z M50,30 L50,58 M36,58 Q50,72 64,58 M30,80 Q40,72 50,80 T70,80' }] },
  { name: '弹药库', nameEn: 'Ammunition Supply Point', symbolSet: SymbolSet.LandInstallation, entity: '120100', paths: [{ d: 'M22,34 L78,34 L78,78 L22,78 Z M22,34 L50,18 L78,34 M42,42 L58,42 L58,64 L50,70 L42,64 Z' }] },
  { name: '油料库', nameEn: 'Fuel Supply Point', symbolSet: SymbolSet.LandInstallation, entity: '120200', paths: [{ d: 'M22,36 L78,36 L78,78 L22,78 Z M50,68 C32,52 40,34 50,20 C60,34 68,52 50,68 Z' }] },
  { name: '野战医院', nameEn: 'Field Hospital', symbolSet: SymbolSet.LandInstallation, entity: '120300', paths: [{ d: 'M20,36 L80,36 L80,78 L20,78 Z M42,46 L58,46 L58,54 L66,54 L66,70 L58,70 L58,78 L42,78 L42,70 L34,70 L34,54 L42,54 Z', filled: true }] },
  { name: '补给站', nameEn: 'Supply Point', symbolSet: SymbolSet.LandInstallation, entity: '120400', paths: [{ d: 'M20,38 L80,38 L80,78 L20,78 Z M20,38 L50,20 L80,38 M34,54 L66,54 M34,66 L66,66' }] },
  { name: '维修站', nameEn: 'Maintenance Facility', symbolSet: SymbolSet.LandInstallation, entity: '120500', paths: [{ d: 'M20,34 L80,34 L80,78 L20,78 Z M34,60 L46,48 L58,60 L70,48 M50,34 L50,22' }] },
  { name: '桥梁', nameEn: 'Bridge', symbolSet: SymbolSet.LandInstallation, entity: '130100', paths: [{ d: 'M14,68 L86,68 M24,68 Q50,30 76,68 M34,68 L42,52 M66,68 L58,52' }] },
  { name: '渡场', nameEn: 'Crossing Site', symbolSet: SymbolSet.LandInstallation, entity: '130200', paths: [{ d: 'M16,34 L84,34 M16,66 L84,66 M36,30 L64,70 M60,62 L64,70 L56,68' }] },
  { name: '雷达站', nameEn: 'Radar Site', symbolSet: SymbolSet.LandInstallation, entity: '140100', paths: [{ d: 'M50,78 L50,48 M24,48 Q50,16 76,48 M32,58 Q50,34 68,58 M30,78 L70,78' }] },
  { name: '通信站', nameEn: 'Communications Site', symbolSet: SymbolSet.LandInstallation, entity: '140200', paths: [{ d: 'M50,78 L50,24 M36,78 L64,78 M28,34 Q50,12 72,34 M34,44 Q50,28 66,44' }] },
  { name: '检查点', nameEn: 'Checkpoint', symbolSet: SymbolSet.ControlMeasure, entity: '110100', paths: [{ d: 'M50,16 L84,50 L50,84 L16,50 Z M32,50 L68,50' }] },
  { name: '目标点', nameEn: 'Target Reference Point', symbolSet: SymbolSet.ControlMeasure, entity: '110200', paths: [{ d: 'M50,16 m-26,0 a26,26 0 1,0 52,0 a26,26 0 1,0 -52,0 M50,34 L50,66 M34,50 L66,50' }] },
  { name: '集结点', nameEn: 'Assembly Point', symbolSet: SymbolSet.ControlMeasure, entity: '110300', paths: [{ d: 'M50,18 L78,76 L22,76 Z M50,34 L50,62 M36,48 L64,48' }] },
  { name: '突破口', nameEn: 'Breach Point', symbolSet: SymbolSet.ControlMeasure, entity: '110400', paths: [{ d: 'M22,30 L78,30 M22,70 L78,70 M34,50 L66,50 M58,42 L66,50 L58,58' }] },
  { name: '接触线', nameEn: 'Line of Contact', symbolSet: SymbolSet.ControlMeasure, entity: '120100', paths: [{ d: 'M16,50 L84,50 M30,42 L38,50 L30,58 M70,42 L62,50 L70,58' }] },
  { name: '火力协调点', nameEn: 'Fire Support Coordination Point', symbolSet: SymbolSet.ControlMeasure, entity: '120200', paths: [{ d: 'M50,18 L80,50 L50,82 L20,50 Z M50,32 L50,68 M32,50 L68,50' }] },
  { name: '补给集散点', nameEn: 'Logistics Release Point', symbolSet: SymbolSet.ControlMeasure, entity: '120300', paths: [{ d: 'M24,24 L76,24 L76,76 L24,76 Z M32,50 L68,50 M50,32 L50,68' }] },
  { name: '禁入区', nameEn: 'Restricted Area', symbolSet: SymbolSet.ControlMeasure, entity: '120400', paths: [{ d: 'M50,16 m-30,0 a30,30 0 1,0 60,0 a30,30 0 1,0 -60,0 M28,72 L72,28' }] },
  { name: '警戒点', nameEn: 'Security Point', symbolSet: SymbolSet.ControlMeasure, entity: '130100', paths: [{ d: 'M50,16 L82,38 L70,78 L30,78 L18,38 Z M50,34 L50,60' }] },
  { name: '交接点', nameEn: 'Linkup Point', symbolSet: SymbolSet.ControlMeasure, entity: '130200', paths: [{ d: 'M22,50 L78,50 M38,34 L22,50 L38,66 M62,34 L78,50 L62,66' }] },
  { name: '紧急事件', nameEn: 'Emergency Event', symbolSet: SymbolSet.Activities, entity: '110100', paths: [{ d: 'M50,14 L84,78 L16,78 Z M50,34 L50,58 M50,68 L50,70' }] },
  { name: '人道救援', nameEn: 'Humanitarian Assistance', symbolSet: SymbolSet.Activities, entity: '110200', paths: [{ d: 'M50,80 C20,62 24,32 38,32 C46,32 50,38 50,42 C50,38 54,32 62,32 C76,32 80,62 50,80 Z M50,42 L50,64 M40,53 L60,53' }] },
  { name: '医疗后送', nameEn: 'Medical Evacuation', symbolSet: SymbolSet.Activities, entity: '110300', paths: [{ d: 'M20,50 L72,50 M64,40 L76,50 L64,60 M32,38 L32,62 M22,50 L42,50' }] },
  { name: '爆炸物处理', nameEn: 'Explosive Ordnance Disposal', symbolSet: SymbolSet.Activities, entity: '110400', paths: [{ d: 'M50,18 m-22,0 a22,22 0 1,0 44,0 a22,22 0 1,0 -44,0 M50,40 L50,58 M42,50 L58,50 M50,18 L50,10' }] },
];

/** 全量符号表 */
const DEFINITIONS: SymbolDefinition[] = [
  ...LAND_UNIT,
  ...AIR,
  ...SEA_SURFACE,
  ...SEA_SUBSURFACE,
  ...LAND_EQUIPMENT,
  ...EXTRA_DEFINITIONS,
];

/** 主键到定义的索引 */
const INDEX: Map<string, SymbolDefinition> = new Map(
  DEFINITIONS.map((definition) => [key(definition.symbolSet, definition.entity), definition]),
);

/** 各符号集在实体代码未收录时使用的回退定义 */
const FALLBACKS: Partial<Record<SymbolSet, Omit<SymbolDefinition, 'entity'>>> = {
  [SymbolSet.LandUnit]: {
    name: '地面单位',
    nameEn: 'Land Unit',
    symbolSet: SymbolSet.LandUnit,
    paths: [{ d: 'M 30,30 L 70,30 L 70,70 L 30,70 Z' }],
  },
  [SymbolSet.Air]: {
    name: '空中单位',
    nameEn: 'Air Unit',
    symbolSet: SymbolSet.Air,
    paths: [{ d: 'M 50,12 L 54,44 L 54,88 L 46,88 L 46,44 Z' }, { d: 'M 12,52 L 88,52' }],
  },
  [SymbolSet.SeaSurface]: {
    name: '海面单位',
    nameEn: 'Sea Surface Unit',
    symbolSet: SymbolSet.SeaSurface,
    paths: [{ d: 'M 12,56 L 88,56 L 74,78 L 26,78 Z' }],
  },
  [SymbolSet.SeaSubsurface]: {
    name: '水下单位',
    nameEn: 'Sea Subsurface Unit',
    symbolSet: SymbolSet.SeaSubsurface,
    paths: [{ d: 'M 14,56 L 86,56 C 86,68 72,76 50,76 C 28,76 14,68 14,56 Z' }],
  },
};

/**
 * 按符号集与实体代码查找符号定义。
 *
 * 若精确代码未收录，则逐级回退：
 * 先尝试实体子类型归零（`121102` → `121100`），再回退到该符号集的通用图标。
 * 这样即便遇到较冷门的实体代码，也能给出语义相近的图形而非空白。
 *
 * @param symbolSet 符号集
 * @param entity 6 位实体代码
 * @returns 符号定义，永不返回 undefined
 */
export function findSymbol(symbolSet: SymbolSet, entity: string): SymbolDefinition {
  const exact = INDEX.get(key(symbolSet, entity));
  if (exact) return exact;

  // 逐级归零：子类型 → 类型 → 实体
  const parent = `${entity.slice(0, 4)}00`;
  const byType = INDEX.get(key(symbolSet, parent));
  if (byType) return { ...byType, entity };

  const grandParent = `${entity.slice(0, 2)}0000`;
  const byEntity = INDEX.get(key(symbolSet, grandParent));
  if (byEntity) return { ...byEntity, entity };

  const fallback = FALLBACKS[symbolSet];
  if (fallback) return { ...fallback, entity };

  return {
    name: '未知单位',
    nameEn: 'Unknown Unit',
    symbolSet,
    entity,
    paths: [{ d: 'M 30,30 L 70,70 M 70,30 L 30,70' }],
  };
}

/** 列出当前符号库中全部已收录的定义（供 UI 生成符号选择器） */
export function listSymbols(symbolSet?: SymbolSet): SymbolDefinition[] {
  if (symbolSet === undefined) return [...DEFINITIONS];
  return DEFINITIONS.filter((definition) => definition.symbolSet === symbolSet);
}

/**
 * 按名称关键字搜索符号（中英文均匹配）。
 *
 * @param keyword 关键字
 * @param symbolSet 限定符号集，省略时检索全部
 */
export function searchSymbols(keyword: string, symbolSet?: SymbolSet): SymbolDefinition[] {
  const lower = keyword.trim().toLowerCase();
  if (!lower) return listSymbols(symbolSet);
  return listSymbols(symbolSet).filter(
    (definition) =>
      definition.name.includes(keyword.trim()) || definition.nameEn.toLowerCase().includes(lower),
  );
}
