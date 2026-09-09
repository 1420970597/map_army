/** 分享访问模式与异步提示，独立于文档内容，不能被外部文件设置。 */
import { create } from 'zustand';
interface AccessState {
  readOnly: boolean;
  shared: { id: string; token?: string; version: number } | null;
  notice: string;
  setReadOnly: (value: boolean) => void;
  setShared: (shared: AccessState['shared']) => void;
  notify: (notice: string) => void;
}
export const useAccessStore = create<AccessState>((set) => ({
  readOnly: false,
  shared: null,
  notice: '',
  setReadOnly: (readOnly) => set({ readOnly }),
  setShared: (shared) => set({ shared }),
  notify: (notice) => set({ notice }),
}));
