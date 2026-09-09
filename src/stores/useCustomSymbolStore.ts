/** 自定义军标的本地目录。定义与文档分离，便于多个文档复用同一符号。 */
import { create } from 'zustand';
import {
  createCustomSymbol,
  customSymbolMatches,
  sanitizeCustomSvg,
  type CustomSymbolDefinition,
} from '@/core/symbology/custom';

const STORAGE_KEY = 'map-army:custom-symbols';

interface CustomSymbolState {
  symbols: CustomSymbolDefinition[];
  add: (params: Omit<CustomSymbolDefinition, 'id' | 'createdAt' | 'updatedAt'>) => string;
  update: (id: string, patch: Partial<Omit<CustomSymbolDefinition, 'id' | 'createdAt'>>) => void;
  remove: (id: string) => void;
  find: (id: string) => CustomSymbolDefinition | undefined;
  search: (query: string) => CustomSymbolDefinition[];
}

function load(): CustomSymbolDefinition[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is CustomSymbolDefinition =>
        item &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.svg === 'string',
    );
  } catch {
    return [];
  }
}

function persist(symbols: CustomSymbolDefinition[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  } catch {
    // 本地存储不可用时仍保持当前会话可用。
  }
}

export const useCustomSymbolStore = create<CustomSymbolState>((set, get) => ({
  symbols: load(),
  add: (params) => {
    const symbol = createCustomSymbol(params);
    set((state) => {
      const symbols = [...state.symbols, symbol];
      persist(symbols);
      return { symbols };
    });
    return symbol.id;
  },
  update: (id, patch) =>
    set((state) => {
      const symbols = state.symbols.map((symbol) =>
        symbol.id !== id
          ? symbol
          : {
              ...symbol,
              ...patch,
              svg: patch.svg === undefined ? symbol.svg : sanitizeCustomSvg(patch.svg),
              updatedAt: Date.now(),
            },
      );
      persist(symbols);
      return { symbols };
    }),
  remove: (id) =>
    set((state) => {
      const symbols = state.symbols.filter((symbol) => symbol.id !== id);
      persist(symbols);
      return { symbols };
    }),
  find: (id) => get().symbols.find((symbol) => symbol.id === id),
  search: (query) => get().symbols.filter((symbol) => customSymbolMatches(symbol, query)),
}));

export type { CustomSymbolDefinition } from '@/core/symbology/custom';
