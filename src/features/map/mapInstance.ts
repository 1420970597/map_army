/** 地图导出与视图命令共用的实例注册表，不存储文档数据。 */
import type { Map } from 'leaflet';
let current: Map | null = null;
export function registerMap(map: Map): () => void {
  current = map;
  return () => {
    if (current === map) current = null;
  };
}
export function getMap(): Map | null {
  return current;
}
