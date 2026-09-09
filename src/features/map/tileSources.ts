/** 公开瓦片目录及必须随导出保留的归属文本。 */
import type { BaseMapType } from '@/core/model';
export const TILE_SOURCES: Record<
  BaseMapType,
  { name: string; url: string; attribution: string; maxZoom: number }
> = {
  streets: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  },
  topo: {
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap, SRTM | © OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
  },
  satellite: {
    name: '卫星影像',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri',
    maxZoom: 19,
  },
  light: {
    name: '浅色底图',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap © CARTO',
    maxZoom: 20,
  },
  dark: {
    name: '深色底图',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap © CARTO',
    maxZoom: 20,
  },
  terrain: {
    name: '地形晕渲',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri',
    maxZoom: 13,
  },
  swiss: {
    name: 'swisstopo',
    url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    attribution: '© swisstopo',
    maxZoom: 18,
  },
  none: { name: '无底图', url: '', attribution: '', maxZoom: 20 },
};
