/**
 * 光标地理坐标追踪器。
 *
 * 必须作为 `MapContainer` 的子组件注册地图事件，但自身不渲染任何 DOM，
 * 只把坐标写入视图 store，由状态栏读取。
 */

import { useMapEvents } from 'react-leaflet';

import { useViewStore } from '@/stores/useViewStore';

/**
 * 光标坐标追踪组件。
 *
 * 高频事件（mousemove）直接写入 store 而不经过组件 state，
 * 避免每次移动都触发整棵树的重渲染。
 */
export function MouseTracker() {
  useMapEvents({
    mousemove: (event) => {
      useViewStore.getState().setCursor({ lon: event.latlng.lng, lat: event.latlng.lat });
    },
    mouseout: () => {
      useViewStore.getState().setCursor(null);
    },
  });

  return null;
}
