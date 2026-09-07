/**
 * 符号框架（Frame）几何生成。
 *
 * 框架是军标的「底版」，其**形状**编码身份（affiliation）、
 * 其**轮廓族**编码战斗维度（battle dimension）：
 *
 * | 战斗维度 | 轮廓族 | 适用符号集 |
 * | --- | --- | --- |
 * | 地面 | 矩形/菱形/正方形/四叶形 | 地面单位、装备、设施、单兵 |
 * | 空中 | 叶形（左右尖、上下圆） | 空中、太空 |
 * | 海面 | 水平椭圆 | 海面 |
 * | 水下 | 半椭圆（上平下圆） | 水下、水雷战 |
 *
 * 全部几何在 **200 × 200 的视口**内定义，中心点为 (100, 100)。
 * 采用固定视口的好处是：图标、框架、修饰符合成时天然对齐，
 * 调用方只需按目标尺寸整体缩放即可。
 */

import { Affiliation, Context, Status, SymbolSet, type Sidc } from './types';
import type { SymbolPath } from './types';

/** 符号视口边长，所有坐标均以此为单位 */
export const VIEWPORT = 200;

/** 视口中心，绝大多数图形以其为对称中心 */
export const CENTER = VIEWPORT / 2;

/** 框架轮廓族 */
export type FrameFamily =
  | 'rectangle' // 友军：矩形
  | 'diamond' // 敌军：菱形
  | 'square' // 中立：正方形
  | 'quatrefoil' // 不明：四叶形
  | 'leaf' // 空中/太空：叶形
  | 'ellipse' // 海面：椭圆
  | 'halfEllipse'; // 水下：半椭圆

/**
 * 判定给定 SIDC 应使用哪种轮廓族。
 *
 * 优先级：符号集决定轮廓族，身份决定族内具体形状。
 * 陆上类符号集才使用「身份四形状」，其余维度使用自己的专属轮廓。
 */
export function frameFamilyOf(sidc: Sidc): FrameFamily {
  switch (sidc.symbolSet) {
    case SymbolSet.Air:
    case SymbolSet.AirMissile:
    case SymbolSet.Space:
    case SymbolSet.SpaceMissile:
      return 'leaf';
    case SymbolSet.SeaSurface:
      return 'ellipse';
    case SymbolSet.SeaSubsurface:
    case SymbolSet.MineWarfare:
      return 'halfEllipse';
    default:
      return landFamilyOf(sidc.affiliation);
  }
}

/**
 * 陆上符号集按身份选择轮廓。
 *
 * 假定友军（Assumed Friend）沿用友军的矩形，另叠加问号修饰；
 * 可疑（Suspect）沿用敌军的菱形，同样叠加问号。
 */
function landFamilyOf(affiliation: Affiliation): FrameFamily {
  switch (affiliation) {
    case Affiliation.Friend:
    case Affiliation.AssumedFriend:
      return 'rectangle';
    case Affiliation.Hostile:
    case Affiliation.Suspect:
      return 'diamond';
    case Affiliation.Neutral:
      return 'square';
    case Affiliation.Unknown:
    case Affiliation.Pending:
    default:
      return 'quatrefoil';
  }
}

/**
 * 生成框架的填充区域路径。
 *
 * @param family 轮廓族
 * @returns SVG path 的 d 属性
 */
export function framePathOf(family: FrameFamily): string {
  switch (family) {
    case 'rectangle':
      return frameRectanglePath();
    case 'diamond':
      return frameDiamondPath();
    case 'square':
      return frameSquarePath();
    case 'quatrefoil':
      return frameQuatrefoilPath();
    case 'leaf':
      return frameLeafPath();
    case 'ellipse':
      return frameEllipsePath();
    case 'halfEllipse':
      return frameHalfEllipsePath();
    default:
      return frameRectanglePath();
  }
}

/**
 * 生成完整的框架图元（填充 + 描边）。
 *
 * @param sidc 符号的 SIDC
 * @returns 框架的填充与描边图元
 */
export function buildFrame(sidc: Sidc): SymbolPath[] {
  const family = frameFamilyOf(sidc);
  const d = framePathOf(family);
  const dashed = requiresDashedFrame(sidc);

  return [
    { d, role: 'fill' },
    { d, role: 'frame', strokeWidth: 8, dashed },
  ];
}

/**
 * 判断框架是否应以虚线渲染。
 *
 * 两种情形使用虚线：
 * 1. 状态为「计划/预期」——表达尚未实际存在；
 * 2. 上下文为「演习」或「模拟」——表达非真实态势。
 */
export function requiresDashedFrame(sidc: Sidc): boolean {
  return sidc.status === Status.Planned || sidc.context !== Context.Reality;
}

/**
 * 取得框架内部可用于绘制图标的矩形区域。
 *
 * 图标必须缩放到该区域内，否则会溢出框架。空中与水下轮廓内部
 * 可用空间明显小于外接矩形，因此按轮廓族分别给出内缩量。
 *
 * @param family 轮廓族
 * @returns 内部矩形 { left, top, right, bottom }
 */
export function innerBoundsOf(family: FrameFamily): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  switch (family) {
    case 'rectangle':
      return { left: 32, top: 58, right: 168, bottom: 142 };
    case 'diamond':
      // 菱形内部可用区域随高度收窄，按内切矩形取值
      return { left: 45, top: 62, right: 155, bottom: 138 };
    case 'square':
      return { left: 58, top: 58, right: 142, bottom: 142 };
    case 'quatrefoil':
      return { left: 45, top: 58, right: 155, bottom: 142 };
    case 'leaf':
      return { left: 48, top: 66, right: 152, bottom: 134 };
    case 'ellipse':
      return { left: 45, top: 65, right: 155, bottom: 135 };
    case 'halfEllipse':
      // 内部区域必须完全位于水线（y=90）之下，否则图标会浮出水面
      return { left: 40, top: 96, right: 160, bottom: 144 };
    default:
      return { left: 32, top: 58, right: 168, bottom: 142 };
  }
}

/**
 * 取得框架轮廓族的外接顶边 y 坐标。
 *
 * 梯队、司令部等修饰符绘制在框架**上方**，需要以顶边为基准定位；
 * 不同轮廓族的顶边高度差异明显（例如水下半椭圆顶边低至 96），
 * 若统一按矩形取值会导致修饰符与框架重叠。
 */
export function frameTopOf(family: FrameFamily): number {
  switch (family) {
    case 'rectangle':
      return 50;
    case 'diamond':
      return 40;
    case 'square':
      return 50;
    case 'quatrefoil':
      return 40;
    case 'leaf':
      return 52;
    case 'ellipse':
      return 48;
    case 'halfEllipse':
      return 90;
    default:
      return 50;
  }
}

/** 取得框架轮廓族的外接底边 y 坐标，用于放置底部文本修饰符 */
export function frameBottomOf(family: FrameFamily): number {
  switch (family) {
    case 'rectangle':
      return 150;
    case 'diamond':
      return 160;
    case 'square':
      return 150;
    case 'quatrefoil':
      return 160;
    case 'leaf':
      return 148;
    case 'ellipse':
      return 152;
    case 'halfEllipse':
      return 150;
    default:
      return 150;
  }
}

/** 友军矩形：宽 150、高 100，居中 */
function frameRectanglePath(): string {
  return 'M 25,50 L 175,50 L 175,150 L 25,150 Z';
}

/** 敌军菱形：外接于矩形，四顶点位于轴线上 */
function frameDiamondPath(): string {
  return 'M 100,40 L 185,100 L 100,160 L 15,100 Z';
}

/** 中立正方形：边长 100，高度与友军矩形一致 */
function frameSquarePath(): string {
  return 'M 50,50 L 150,50 L 150,150 L 50,150 Z';
}

/**
 * 不明四叶形（quatrefoil）。
 *
 * 由四段半椭圆弧首尾相接构成：相邻弧在 (60,70)、(140,70)、(140,130)、
 * (60,130) 四处形成内凹的尖角，这正是四叶饰的几何特征。
 */
function frameQuatrefoilPath(): string {
  return [
    'M 60,70',
    'A 40,30 0 0 1 140,70', // 上瓣
    'A 40,30 0 0 1 140,130', // 右瓣
    'A 40,30 0 0 1 60,130', // 下瓣
    'A 40,30 0 0 1 60,70', // 左瓣
    'Z',
  ].join(' ');
}

/** 空中叶形：左右两端尖锐、上下边缘圆润 */
function frameLeafPath(): string {
  return [
    'M 18,100',
    'Q 45,52 100,52', // 左上缘
    'Q 155,52 182,100', // 右上缘
    'Q 155,148 100,148', // 右下缘
    'Q 45,148 18,100', // 左下缘
    'Z',
  ].join(' ');
}

/** 海面椭圆：水平长轴 */
function frameEllipsePath(): string {
  return [
    'M 20,100',
    'A 80,52 0 0 1 180,100', // 上半弧
    'A 80,52 0 0 1 20,100', // 下半弧
    'Z',
  ].join(' ');
}

/** 水下半椭圆：上沿为水平水线，下沿为半椭圆 */
function frameHalfEllipsePath(): string {
  return [
    'M 18,90',
    'L 182,90', // 水线
    'A 82,60 0 0 1 18,90', // 水下弧，向下凸出至 y=150
    'Z',
  ].join(' ');
}
