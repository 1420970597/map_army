/**
 * 底部状态栏。
 *
 * 实时显示光标位置的三种坐标表示：经纬度、MGRS、UTM。
 * 三者并列展示是军图标图工具的标准做法，便于不同作业习惯的使用者读取。
 */

import { formatMgrs, formatUtm, lonLatToGars, lonLatToMgrs, lonLatToUtm } from '@/core/geo';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useViewStore } from '@/stores/useViewStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';

/** 经纬度保留的小数位数，约合 1 米精度 */
const COORD_DIGITS = 5;

/**
 * 底部状态栏组件。
 */
export function StatusBar() {
  const cursor = useViewStore((state) => state.cursor);
  const zoom = useViewStore((state) => state.zoom);
  const grid = useViewStore((state) => state.grid);
  const geoDegreeFormat = usePreferencesStore((state) => state.geoDegreeFormat);
  const features = useDocumentStore((state) => state.document.features);
  const layers = useDocumentStore((state) => state.document.layers);

  return (
    <footer className="statusbar">
      {cursor ? (
        <>
          <span>
            经纬度 {formatCoordinate(cursor.lat, geoDegreeFormat)},{' '}
            {formatCoordinate(cursor.lon, geoDegreeFormat)}
          </span>
          <span>MGRS {formatMgrsOrDash(cursor)}</span>
          <span>UTM {formatUtmOrDash(cursor)}</span>
          <span>{gridCoordinate(grid, cursor)}</span>
        </>
      ) : (
        <span>将光标移到地图上以查看坐标</span>
      )}

      <span className="toolbar-spacer" />

      <span>要素 {features.length}</span>
      <span>图层 {layers.length}</span>
      <span>缩放 {zoom}</span>
      <span>比例尺 {scaleLabel(zoom, cursor?.lat ?? 0)}</span>
    </footer>
  );
}

/** 根据当前网格显示光标坐标，避免状态栏固定成三种格式。 */
function gridCoordinate(grid: string, point: { lon: number; lat: number }): string {
  try {
    if (grid === 'MGRS') return `网格 ${formatMgrs(lonLatToMgrs(point, 10))}`;
    if (grid === 'UTM') {
      const value = lonLatToUtm(point);
      return `网格 ${formatUtm(value, value.zone)}`;
    }
    if (grid === 'GARS') return `网格 ${lonLatToGars(point, 5)}`;
    if (grid === 'WGS84') return `网格 ${point.lon.toFixed(5)}, ${point.lat.toFixed(5)}`;
  } catch {
    return '网格 —';
  }
  return grid === 'none' ? '网格 —' : `网格 ${grid}`;
}

/** 估算当前视口赤道附近比例尺，作为状态栏快速读数。 */
function scaleLabel(zoom: number, latitude: number): string {
  const metersPerPixel = (40075016.686 * Math.cos((latitude * Math.PI) / 180)) / 256 / 2 ** zoom;
  return metersPerPixel >= 1000
    ? `${(metersPerPixel * 100).toFixed(0)} m / 100 px`
    : `${metersPerPixel.toFixed(1)} m / px`;
}

/** 按选项格式化单个经纬度。 */
function formatCoordinate(value: number, format: 'decimal' | 'dms'): string {
  if (format === 'decimal') return value.toFixed(COORD_DIGITS);
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = ((minutesFloat - minutes) * 60).toFixed(1);
  return `${degrees}°${minutes}'${seconds}"${value < 0 ? '-' : '+'}`;
}

/** 格式化 MGRS 坐标，超出适用范围时显示占位符 */
function formatMgrsOrDash(cursor: { lon: number; lat: number }): string {
  try {
    // MGRS 仅在南北纬 84° 之间定义，超出范围会抛错
    return formatMgrs(lonLatToMgrs(cursor, 5));
  } catch {
    return '—';
  }
}

/** 格式化 UTM 坐标，超出适用范围时显示占位符 */
function formatUtmOrDash(cursor: { lon: number; lat: number }): string {
  try {
    const projected = lonLatToUtm(cursor);
    return formatUtm(projected, projected.zone);
  } catch {
    return '—';
  }
}
