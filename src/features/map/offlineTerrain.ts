/** 内置离线地形：不访问网络，提供可重复的全球粗粒度高程起伏。 */

export const OFFLINE_TERRAIN_SIZE = 32;

/**
 * 生成一个离线高程瓦片。
 *
 * 这是应用内置的低分辨率地形基线，用于无网络部署和没有外部 DEM 配置的场景；
 * 部署者可通过 Cesium Ion 或 quantized-mesh 地址替换为测绘数据。
 */
export function offlineHeightmap(
  tileX: number,
  tileY: number,
  level: number,
  width = OFFLINE_TERRAIN_SIZE,
  height = OFFLINE_TERRAIN_SIZE,
): Float32Array {
  const samples = new Float32Array(width * height);
  const tiles = 2 ** level;
  for (let row = 0; row < height; row += 1) {
    const latitude = 90 - ((tileY + row / (height - 1)) / tiles) * 180;
    for (let column = 0; column < width; column += 1) {
      const longitude = ((tileX + column / (width - 1)) / tiles) * 360 - 180;
      samples[row * width + column] = offlineElevation(longitude, latitude);
    }
  }
  return samples;
}

/** 以大陆起伏和主要山脉包络构成稳定的离线高程基线，单位为米。 */
export function offlineElevation(longitude: number, latitude: number): number {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  const continental = Math.max(
    0,
    0.52 + 0.27 * Math.sin(lon * 2.1) * Math.cos(lat * 1.7) + 0.18 * Math.sin(lon * 5.3 + lat),
  );
  const alps = gaussian(longitude, latitude, 8.5, 46.5, 2.8, 1.5) * 2600;
  const himalaya = gaussian(longitude, latitude, 85, 30, 16, 5) * 4200;
  const andes = gaussian(longitude, latitude, -70, -20, 10, 42) * 3000;
  const rolling = (0.5 + 0.5 * Math.sin(lon * 9 + Math.sin(lat * 4))) * 220;
  return Math.max(0, continental * 380 + rolling + alps + himalaya + andes);
}

function gaussian(
  longitude: number,
  latitude: number,
  centerLongitude: number,
  centerLatitude: number,
  longitudeWidth: number,
  latitudeWidth: number,
): number {
  const dx = (longitude - centerLongitude) / longitudeWidth;
  const dy = (latitude - centerLatitude) / latitudeWidth;
  return Math.exp(-(dx * dx + dy * dy));
}
