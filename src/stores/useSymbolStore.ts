/** 符号库偏好与待绘制战术图形；所有偏好即时保存并容忍存储不可用。 */
import { create } from 'zustand';
import { loadPrefs, savePrefs, type AppPrefs } from '@/core/io/prefs';
import { normalizeSymbolDefaults, type SymbolDefaults } from '@/core/symbology/defaults';
import type { TacticalGraphicType } from '@/core/model';

interface SymbolState extends AppPrefs {
  graphicType: TacticalGraphicType | null;
  setGraphicType: (type: TacticalGraphicType | null) => void;
  toggleFavorite: (key: string) => void;
  setDefaults: (patch: Partial<SymbolDefaults>) => void;
  setMode: (mode: AppPrefs['symbolMode']) => void;
}

export const useSymbolStore = create<SymbolState>((set) => ({
  ...loadPrefs(),
  graphicType: null,
  setGraphicType: (graphicType) => set({ graphicType }),
  toggleFavorite: (key) =>
    set((state) => {
      const favorites = state.favorites.includes(key)
        ? state.favorites.filter((item) => item !== key)
        : [...state.favorites, key];
      savePrefs({ ...state, favorites });
      return { favorites };
    }),
  setDefaults: (patch) =>
    set((state) => {
      const symbolDefaults = normalizeSymbolDefaults({ ...state.symbolDefaults, ...patch });
      savePrefs({ ...state, symbolDefaults });
      return { symbolDefaults };
    }),
  setMode: (symbolMode) =>
    set((state) => {
      savePrefs({ ...state, symbolMode });
      return { symbolMode };
    }),
}));
