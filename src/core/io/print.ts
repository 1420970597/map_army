/** 打印尺寸与 WGS84 world file 纯计算。 */
export interface ImageExtent {
  west: number;
  east: number;
  north: number;
  south: number;
}
/** 世界文件使用像素中心，行顺序固定为 A、D、B、E、C、F。 */
export function worldFile(bounds: ImageExtent, width: number, height: number): string {
  if (!(width > 0 && height > 0 && bounds.east > bounds.west && bounds.north > bounds.south))
    throw new Error('图像范围或尺寸无效');
  const a = (bounds.east - bounds.west) / width,
    e = (bounds.south - bounds.north) / height;
  return [a, 0, 0, e, bounds.west + a / 2, bounds.north + e / 2]
    .map((n) => n.toPrecision(15))
    .join('\n');
}
/** 纸张宽高，单位毫米。 */
export function paperSize(size: 'a4' | 'a3', landscape: boolean): [number, number] {
  const dimensions: [number, number] = size === 'a4' ? [210, 297] : [297, 420];
  return landscape ? [dimensions[1], dimensions[0]] : dimensions;
}
/** 物理尺寸与 DPI 对应的像素数。 */
export function printPixels(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}
/** 地面宽度与纸张宽度对应的比例尺分母。 */
export function scaleDenominator(groundMeters: number, widthMm: number): number {
  return groundMeters / (widthMm / 1000);
}
