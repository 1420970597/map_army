/**
 * 符号修饰符（Modifier）几何生成。
 *
 * 修饰符叠加在框架之外或之上，用于表达 SIDC 中除身份与实体之外的
 * 附加语义，包括：
 *
 * - **梯队（Echelon）**：编制层级，绘制在框架正上方
 * - **司令部/特遣队/佯动**：绘制在框架上方紧贴顶边处
 * - **状态（Status）**：受损、被摧毁等，叠加在框架之上
 * - **机动方向（Direction of Movement）**：自符号中心向外的速度矢量
 */

import { CENTER } from './frames';
import { HqTfDummy, Status, type Echelon, type SymbolPath } from './types';

/** Extended 模式的两个图标扩展修饰符位置。 */
export function buildIconExtensions(modifier1: string, modifier2: string): SymbolPath[] {
  const paths: SymbolPath[] = [];
  if (modifier1 !== '00') paths.push(iconExtensionPath(modifier1, 28, 30));
  if (modifier2 !== '00') paths.push(iconExtensionPath(modifier2, 172, 30));
  return paths;
}

/** 用稳定的代码标记绘制扩展图标，未知代码仍保留可见的占位语义。 */
function iconExtensionPath(code: string, x: number, y: number): SymbolPath {
  const size = 9;
  const marker = Number.parseInt(code, 10);
  if (Number.isFinite(marker) && marker % 2 === 0) {
    return {
      d: `M ${x},${y - size} L ${x + size},${y} L ${x},${y + size} L ${x - size},${y} Z`,
      role: 'icon',
      strokeWidth: 4,
    };
  }
  return {
    d: `M ${x - size},${y - size} L ${x + size},${y - size} L ${x + size},${y + size} L ${x - size},${y + size} Z`,
    role: 'icon',
    strokeWidth: 4,
  };
}

/** 梯队单元之间的水平间距 */
const ECHELON_GAP = 16;

/** 梯队圆点半径 */
const ECHELON_DOT_RADIUS = 4.5;

/** 梯队竖条尺寸 */
const ECHELON_BAR_WIDTH = 3.5;
const ECHELON_BAR_HEIGHT = 13;

/** 梯队叉号（师级以上）边长的一半 */
const ECHELON_CROSS_RADIUS = 6;

/**
 * 生成梯队符号。
 *
 * 2525 用三类图元表达编制层级，层级越高图元越"重"：
 *
 * 编码上，梯队值 `XY` 的十位表示类别、个位表示序号，而图元种类与数量
 * 由**整个两位数**共同决定：
 *
 * | 编码范围 | 图元 | 数量 |
 * | --- | --- | --- |
 * | 11 ~ 14（班 ~ 排） | 实心圆点 | 1 ~ 4 |
 * | 15 ~ 18（连 ~ 旅） | 竖条 | 1 ~ 4（序号 - 4） |
 * | 21 ~ 26（师 ~ 总部） | 叉号 | 1 ~ 6 |
 *
 * 注意「圆点」与「竖条」同属十位为 1 的类别，需按序号是否大于 4 区分，
 * 这是 2525 编码表自身的分区方式。
 *
 * @param echelon 梯队级别，{@link Echelon.None} 时返回空结果
 * @param frameTop 框架顶边 y 坐标，梯队紧贴其上方绘制
 * @returns 梯队图元，按渲染方式分为填充与描边两组
 */
export function buildEchelon(
  echelon: Echelon,
  frameTop: number,
): { fills: SymbolPath[]; strokes: SymbolPath[] } {
  const fills: SymbolPath[] = [];
  const strokes: SymbolPath[] = [];
  if (!echelon) return { fills, strokes };

  const category = Math.floor(echelon / 10);
  const serial = echelon % 10;
  if (serial <= 0) return { fills, strokes };

  // 十位为 1 时：序号 1~4 用圆点，5~8 用竖条
  const isBar = category === 1 && serial > 4;
  // 实际绘制的图元个数：竖条区间需减去 4 的偏移
  const count = isBar ? serial - 4 : serial;

  // 梯队整体位于框架顶边之上：先留 6 单位间隙，再向上绘制图元
  const baseY = frameTop - 6;
  const width = (count - 1) * ECHELON_GAP;
  const startX = CENTER - width / 2;

  for (let i = 0; i < count; i += 1) {
    const cx = startX + i * ECHELON_GAP;

    if (category === 2) {
      // 师及以上：叉号为开放线段，必须描边渲染
      strokes.push({
        d: crossPath(cx, baseY - ECHELON_CROSS_RADIUS),
        role: 'icon',
        strokeWidth: 4,
      });
    } else if (isBar) {
      // 连至旅：闭合矩形，填充渲染
      fills.push({ d: barPath(cx, baseY - ECHELON_BAR_HEIGHT), role: 'icon' });
    } else {
      // 班至排：实心圆点，填充渲染
      fills.push({ d: dotPath(cx, baseY - ECHELON_DOT_RADIUS), role: 'icon' });
    }
  }

  return { fills, strokes };
}

/**
 * 生成司令部/特遣队/佯动指示符。
 *
 * - **司令部（HQ）**：框架顶边之上的尖顶三角，形似屋顶
 * - **特遣队（TF）**：框架顶边之上的水平横线
 * - **佯动（Feint/Dummy）**：不额外绘制图元，改为让整个符号以虚线渲染
 *
 * 三者可组合（例如「特遣队司令部」为横线 + 尖顶叠加）。
 *
 * @param hqTfDummy 司令部/特遣队/佯动标记
 * @param frameTop 框架顶边 y 坐标
 * @param left 框架左边界 x 坐标
 * @param right 框架右边界 x 坐标
 */
export function buildHqTfDummy(
  hqTfDummy: HqTfDummy,
  frameTop: number,
  left: number,
  right: number,
): SymbolPath[] {
  const paths: SymbolPath[] = [];

  // 司令部：尖顶三角，顶点略高于框架顶边
  if (
    hqTfDummy === HqTfDummy.Headquarters ||
    hqTfDummy === HqTfDummy.FeintDummyHeadquarters ||
    hqTfDummy === HqTfDummy.TaskForceHeadquarters ||
    hqTfDummy === HqTfDummy.FeintDummyTaskForceHeadquarters
  ) {
    const apexY = frameTop - 18;
    paths.push({
      d: `M ${left + 6},${frameTop + 2} L ${CENTER},${apexY} L ${right - 6},${frameTop + 2}`,
      role: 'frame',
      strokeWidth: 6,
    });
  }

  // 特遣队：框架顶边之上的水平横线
  if (
    hqTfDummy === HqTfDummy.TaskForce ||
    hqTfDummy === HqTfDummy.FeintDummyTaskForce ||
    hqTfDummy === HqTfDummy.TaskForceHeadquarters ||
    hqTfDummy === HqTfDummy.FeintDummyTaskForceHeadquarters
  ) {
    const lineY = frameTop - 26;
    paths.push({
      d: `M ${left},${lineY} L ${right},${lineY}`,
      role: 'frame',
      strokeWidth: 6,
    });
  }

  return paths;
}

/**
 * 生成状态覆盖图元。
 *
 * - **受损（Damaged）**：贯穿框架的斜杠
 * - **已被摧毁（Destroyed）**：贯穿框架的大叉
 * - **满载（Full to Capacity）**：框架底部加粗横线
 *
 * 其余状态（存在、计划、完全有能力）不需要额外图元：
 * 计划状态已由框架虚线表达。
 */
export function buildStatusOverlay(status: Status): SymbolPath[] {
  switch (status) {
    case Status.Damaged:
      return [{ d: 'M 34,152 L 166,48', role: 'frame', strokeWidth: 5 }];
    case Status.Destroyed:
      return [
        { d: 'M 34,48 L 166,152', role: 'frame', strokeWidth: 5 },
        { d: 'M 34,152 L 166,48', role: 'frame', strokeWidth: 5 },
      ];
    case Status.FullToCapacity:
      return [{ d: 'M 30,166 L 170,166', role: 'frame', strokeWidth: 6 }];
    default:
      return [];
  }
}

/**
 * 生成机动方向指示箭头（速度矢量）。
 *
 * 箭头自符号中心指向行进方向，长度固定。0° 指向正北（屏幕上方），
 * 角度按顺时针递增，与军事惯用的方位角定义一致。
 *
 * @param bearingDeg 方位角，单位为度
 * @param length 箭头总长度，默认 90
 */
export function buildDirectionArrow(bearingDeg: number, length = 90): SymbolPath[] {
  // 屏幕坐标系 y 轴向下，而方位角 0° 指向上方，故取负
  const rad = ((bearingDeg - 90) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);

  const tipX = CENTER + dx * length;
  const tipY = CENTER + dy * length;
  const tailX = CENTER + dx * (length * 0.35);
  const tailY = CENTER + dy * (length * 0.35);

  // 箭羽：以箭尖为顶点，沿垂直于轴线的方向张开
  const perpX = -dy;
  const perpY = dx;
  const barb = length * 0.16;
  const barbBaseX = tipX - dx * barb * 1.6;
  const barbBaseY = tipY - dy * barb * 1.6;

  return [
    { d: `M ${tailX},${tailY} L ${tipX},${tipY}`, role: 'frame', strokeWidth: 5 },
    {
      d:
        `M ${tipX},${tipY} ` +
        `L ${barbBaseX + perpX * barb},${barbBaseY + perpY * barb} ` +
        `M ${tipX},${tipY} ` +
        `L ${barbBaseX - perpX * barb},${barbBaseY - perpY * barb}`,
      role: 'frame',
      strokeWidth: 5,
    },
  ];
}

/** 构造实心圆点的 path（用两段半圆闭合，避免依赖 <circle> 元素） */
function dotPath(cx: number, cy: number): string {
  const r = ECHELON_DOT_RADIUS;
  return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0 Z`;
}

/** 构造竖条的 path */
function barPath(cx: number, top: number): string {
  const half = ECHELON_BAR_WIDTH / 2;
  return `M ${cx - half},${top} L ${cx + half},${top} L ${cx + half},${top + ECHELON_BAR_HEIGHT} L ${cx - half},${top + ECHELON_BAR_HEIGHT} Z`;
}

/** 构造叉号的 path（两条交叉线段，描边渲染） */
function crossPath(cx: number, top: number): string {
  const r = ECHELON_CROSS_RADIUS;
  const cy = top + r;
  return `M ${cx - r},${cy - r} L ${cx + r},${cy + r} M ${cx - r},${cy + r} L ${cx + r},${cy - r}`;
}
