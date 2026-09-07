/**
 * 军标配色方案。
 *
 * 颜色与框架形状在标准中是**互为冗余**的第二重编码：
 * 当图形因尺寸过小、单色打印或夜视条件而无法分辨形状时，
 * 颜色仍能传达身份信息。
 *
 * 本模块把「身份 → 颜色」的映射集中管理，并额外提供夜间与单色两套
 * 替代方案，便于在不同使用环境下整体切换。
 */

import { Affiliation, type ColorRole } from './types';

/** 一套完整配色：按颜色角色给出具体色值 */
export interface Palette {
  /** 身份对应的主色（框架与填充） */
  identity: string;
  /** 框架内部的衬底色 */
  fill: string;
  /** 图标主体色 */
  icon: string;
  /** 文本修饰符颜色 */
  text: string;
}

/**
 * 昼间标准配色（默认）。
 *
 * 遵循 MIL-STD-2525 的填充约定：友军与中立为**空心**（浅色衬底 + 深色图标），
 * 敌军与不明为**实心**（身份色填充 + 白色图标）。
 * 这一「空/实」差异构成了除形状与色相之外的第三重冗余。
 */
const DAY_PALETTES: Record<Affiliation, Palette> = {
  [Affiliation.Pending]: {
    identity: '#FFD700',
    fill: '#FFFFFF',
    icon: '#1A1A1A',
    text: '#1A1A1A',
  },
  [Affiliation.Unknown]: {
    identity: '#FFD700',
    fill: '#FFD700',
    icon: '#1A1A1A',
    text: '#1A1A1A',
  },
  [Affiliation.AssumedFriend]: {
    identity: '#0B82D6',
    fill: '#FFFFFF',
    icon: '#1A1A1A',
    text: '#1A1A1A',
  },
  [Affiliation.Friend]: {
    identity: '#0B82D6',
    fill: '#FFFFFF',
    icon: '#1A1A1A',
    text: '#1A1A1A',
  },
  [Affiliation.Neutral]: {
    identity: '#1E9B4B',
    fill: '#FFFFFF',
    icon: '#1A1A1A',
    text: '#1A1A1A',
  },
  [Affiliation.Suspect]: {
    identity: '#E00000',
    fill: '#E00000',
    icon: '#FFFFFF',
    text: '#1A1A1A',
  },
  [Affiliation.Hostile]: {
    identity: '#E00000',
    fill: '#E00000',
    icon: '#FFFFFF',
    text: '#1A1A1A',
  },
};

/**
 * 夜间（夜视兼容）配色：改用高亮度低饱和的色相，降低眩光。
 */
const NIGHT_PALETTES: Record<Affiliation, Palette> = {
  [Affiliation.Pending]: {
    identity: '#7FE3FF',
    fill: '#0A1A22',
    icon: '#7FE3FF',
    text: '#7FE3FF',
  },
  [Affiliation.Unknown]: {
    identity: '#FFE97F',
    fill: '#221F0A',
    icon: '#FFE97F',
    text: '#FFE97F',
  },
  [Affiliation.AssumedFriend]: {
    identity: '#7FE3FF',
    fill: '#0A1A22',
    icon: '#7FE3FF',
    text: '#7FE3FF',
  },
  [Affiliation.Friend]: {
    identity: '#7FE3FF',
    fill: '#0A1A22',
    icon: '#7FE3FF',
    text: '#7FE3FF',
  },
  [Affiliation.Neutral]: {
    identity: '#8CFF9B',
    fill: '#0A2211',
    icon: '#8CFF9B',
    text: '#8CFF9B',
  },
  [Affiliation.Suspect]: {
    identity: '#FF8A8A',
    fill: '#2A0A0A',
    icon: '#FF8A8A',
    text: '#FF8A8A',
  },
  [Affiliation.Hostile]: {
    identity: '#FF8A8A',
    fill: '#2A0A0A',
    icon: '#FF8A8A',
    text: '#FF8A8A',
  },
};

/**
 * 单色（黑白打印）配色：仅依靠明度与框架形状区分身份。
 */
const MONO_PALETTES: Record<Affiliation, Palette> = {
  [Affiliation.Pending]: {
    identity: '#000000',
    fill: '#FFFFFF',
    icon: '#000000',
    text: '#000000',
  },
  [Affiliation.Unknown]: {
    identity: '#000000',
    fill: '#B0B0B0',
    icon: '#000000',
    text: '#000000',
  },
  [Affiliation.AssumedFriend]: {
    identity: '#000000',
    fill: '#FFFFFF',
    icon: '#000000',
    text: '#000000',
  },
  [Affiliation.Friend]: {
    identity: '#000000',
    fill: '#FFFFFF',
    icon: '#000000',
    text: '#000000',
  },
  [Affiliation.Neutral]: {
    identity: '#000000',
    fill: '#FFFFFF',
    icon: '#000000',
    text: '#000000',
  },
  [Affiliation.Suspect]: {
    identity: '#000000',
    fill: '#808080',
    icon: '#FFFFFF',
    text: '#000000',
  },
  [Affiliation.Hostile]: {
    identity: '#000000',
    fill: '#808080',
    icon: '#FFFFFF',
    text: '#000000',
  },
};

/** 可用的配色主题名称 */
export type PaletteTheme = 'day' | 'night' | 'mono';

/** 主题名称到配色表的映射 */
const THEMES: Record<PaletteTheme, Record<Affiliation, Palette>> = {
  day: DAY_PALETTES,
  night: NIGHT_PALETTES,
  mono: MONO_PALETTES,
};

/**
 * 取得指定身份与主题下的配色。
 *
 * @param affiliation 身份
 * @param theme 配色主题，默认昼间
 */
export function paletteOf(affiliation: Affiliation, theme: PaletteTheme = 'day'): Palette {
  return THEMES[theme][affiliation];
}

/**
 * 按颜色角色取出具体色值。
 *
 * 把「角色」与「色值」解耦，使渲染代码无需关心当前主题。
 */
export function colorOf(role: ColorRole, palette: Palette): string {
  switch (role) {
    case 'frame':
      return palette.identity;
    case 'fill':
      return palette.fill;
    case 'icon':
      return palette.icon;
    case 'background':
      return palette.fill;
    case 'text':
      return palette.text;
    default:
      return palette.icon;
  }
}
