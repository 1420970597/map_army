/** 应用显示选项采用独立持久化，绘制与选择瞬态不写入偏好。 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 偏好设置统一存储键，供吸附、地图与符号设置共享。 */
export const PREFERENCES_STORAGE_KEY = 'map-army.prefs.v1';
export interface Preferences {
  language: 'zh' | 'en' | 'de' | 'fr' | 'it';
  units: 'metric' | 'imperial' | 'nautical';
  angularUnit: 'degree' | 'milliradian';
  geoDegreeFormat: 'decimal' | 'dms';
  coordinateSearch: boolean;
  northArrow: boolean;
  measurement: boolean;
  hillshade: boolean;
  pacific: boolean;
  magneticNorth: boolean;
  magnifier: boolean;
  snapEnabled: boolean;
  snapThresholdPx: number;
  mapLanguage: 'local' | 'en';
  brightness: number;
  hue: number;
  chroma: number;
}
export const usePreferencesStore = create<
  Preferences & { update: (patch: Partial<Preferences>) => void }
>()(
  persist(
    (set) => ({
      language: 'zh',
      units: 'metric',
      angularUnit: 'degree',
      geoDegreeFormat: 'decimal',
      coordinateSearch: true,
      northArrow: true,
      measurement: true,
      hillshade: false,
      pacific: false,
      magneticNorth: false,
      magnifier: true,
      snapEnabled: true,
      snapThresholdPx: 10,
      mapLanguage: 'local',
      brightness: 100,
      hue: 0,
      chroma: 100,
      update: (patch) => set(patch),
    }),
    { name: PREFERENCES_STORAGE_KEY, version: 1 },
  ),
);
