/** 将符号 SVG 包装为 Leaflet 图标内部标记。使用内联 SVG 避免数据 URI 加载差异。 */
export function mapSymbolMarkup(svg: string, size: number): string {
  return `<span class="map-symbol-svg" style="display:block;width:${size}px;height:${size}px;line-height:0;overflow:visible">${svg}</span>`;
}
