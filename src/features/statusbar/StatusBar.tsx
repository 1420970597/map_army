/**
 * 底部状态栏。
 *
 * 实时显示光标位置的三种坐标表示：经纬度、MGRS、UTM。
 * 三者并列展示是军图标图工具的标准做法，便于不同作业习惯的使用者读取。
 */

import { formatMgrs, formatUtm, lonLatToMgrs, lonLatToUtm } from '@/core/geo';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useViewStore } from '@/stores/useViewStore';

/** 经纬度保留的小数位数，约合 1 米精度 */
const COORD_DIGITS = 5;

/**
 * 底部状态栏组件。
 */
export function StatusBar() {
  const cursor = useViewStore((state) => state.cursor);
  const zoom = useViewStore((state) => state.zoom);
  const features = useDocumentStore((state) => state.document.features);
  const layers = useDocumentStore((state) => state.document.layers);

  return (
    <footer className="statusbar">
      {cursor ? (
        <>
          <span>
            经纬度 {cursor.lat.toFixed(COORD_DIGITS)}, {cursor.lon.toFixed(COORD_DIGITS)}
          </span>
          <span>MGRS {formatMgrsOrDash(cursor)}</span>
          <span>UTM {formatUtmOrDash(cursor)}</span>
        </>
      ) : (
        <span>将光标移到地图上以查看坐标</span>
      )}

      <span className="toolbar-spacer" />

      <span>要素 {features.length}</span>
      <span>图层 {layers.length}</span>
      <span>缩放 {zoom}</span>
    </footer>
  );
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
