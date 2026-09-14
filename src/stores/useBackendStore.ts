/** 服务连接状态与数据引用；实际文档仍由编辑器管理。 */
import { create } from 'zustand';
export interface ProjectSummary {
  id: string;
  name: string;
  revision: number;
  updatedAt: number;
}
export const useBackendStore = create<{
  status: 'connecting' | 'saved' | 'saving' | 'offline' | 'conflict' | 'error' | 'external';
  message: string;
  workspaceId: string | null;
  workspaceName: string;
  projectId: string | null;
  revision: number;
  settingsVersion: number;
  projects: ProjectSummary[];
  catalogVersion: number;
  dirty: boolean;
  projectConflict: boolean;
  settingsConflict: boolean;
}>(() => ({
  status: 'connecting',
  message: '',
  workspaceId: null,
  workspaceName: '',
  projectId: null,
  revision: 0,
  settingsVersion: 0,
  projects: [],
  catalogVersion: 0,
  dirty: false,
  projectConflict: false,
  settingsConflict: false,
}));
