/** 图像配准计算：world file 按像素中心定义，可包含旋转与倾斜。 */
import type { ImageOverlayData } from '../model/types';
import type { LonLat } from '../geo';

/** 将六行 WGS84 world file 转为左上、右上、左下角点。 */
export function worldFileCorners(
  text: string,
  width: number,
  height: number,
): ImageOverlayData['corners'] {
  const values = text.trim().split(/\s+/).map(Number);
  if (values.length !== 6 || values.some((v) => !Number.isFinite(v)) || width <= 0 || height <= 0)
    throw new Error('配准文件应包含六个有效数值');
  const [a, d, b, e, c, f] = values;
  if (Math.abs(a * e - b * d) < 1e-20) throw new Error('配准变换不可逆');
  const point = (x: number, y: number): LonLat => ({
    lon: a * x + b * y + c,
    lat: d * x + e * y + f,
  });
  const corners: ImageOverlayData['corners'] = [
    point(-0.5, -0.5),
    point(width - 0.5, -0.5),
    point(-0.5, height - 0.5),
  ];
  if (corners.some((p) => Math.abs(p.lat) > 90 || Math.abs(p.lon) > 540))
    throw new Error('world file 必须使用 WGS84 经纬度');
  return corners;
}

/** 从角点反求 world file，旋转项也完整保留。 */
export function overlayWorldFile(image: ImageOverlayData): string {
  const [o, x, y] = image.corners;
  const a = (x.lon - o.lon) / image.width,
    d = (x.lat - o.lat) / image.width;
  const b = (y.lon - o.lon) / image.height,
    e = (y.lat - o.lat) / image.height;
  return [a, d, b, e, o.lon + (a + b) / 2, o.lat + (d + e) / 2]
    .map((v) => v.toPrecision(15))
    .join('\n');
}

/** 以中心进行等比例缩放和旋转，纬度方向按当地比例修正。 */
export function transformOverlay(
  image: ImageOverlayData,
  scale: number,
  degrees: number,
): ImageOverlayData {
  const [, x, y] = image.corners;
  const center = { lon: (x.lon + y.lon) / 2, lat: (x.lat + y.lat) / 2 };
  const cosine = Math.max(0.01, Math.cos((center.lat * Math.PI) / 180));
  const angle = (degrees * Math.PI) / 180;
  const corners = image.corners.map((p) => {
    const dx = (p.lon - center.lon) * cosine * scale,
      dy = (p.lat - center.lat) * scale;
    return {
      lon: center.lon + (dx * Math.cos(angle) - dy * Math.sin(angle)) / cosine,
      lat: center.lat + dx * Math.sin(angle) + dy * Math.cos(angle),
    };
  }) as ImageOverlayData['corners'];
  return { ...image, corners };
}
