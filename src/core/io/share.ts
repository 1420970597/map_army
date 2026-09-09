/** URL 快照分享；只携带用户选择的文档，解析复用文件校验路径。 */
import { strToU8, strFromU8, gzipSync, gunzipSync } from 'fflate';
import type { MapDocument } from '../model';
import { serializeMilxly, deserializeMilxly } from './milxly';

/** 生成压缩后的只读或编辑副本链接，地址依赖由调用方提供。 */
export function createShareUrl(
  doc: MapDocument,
  mode: 'view' | 'copy' = 'view',
  baseUrl = window.location.href,
): string {
  const bytes = gzipSync(strToU8(serializeMilxly(doc)));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const payload = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = `map-army=${mode}.z.${payload}`;
  return url.toString();
}

/** 校验分享载荷，包括压缩体积与完整文档结构。 */
export function readShareUrl(
  hash = window.location.hash,
): { document: MapDocument; mode: 'view' | 'copy' } | null {
  const match = hash.match(/^#map-army=(view|copy)\.(z\.)?([A-Za-z0-9_-]+)$/);
  if (!match || match[3].length > 2000000) return null;
  try {
    const encoded = match[3].replaceAll('-', '+').replaceAll('_', '/');
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    if (
      match[2] &&
      (bytes.length < 18 ||
        new DataView(bytes.buffer).getUint32(bytes.length - 4, true) > 8 * 1024 * 1024)
    )
      return null;
    const text = strFromU8(match[2] ? gunzipSync(bytes) : bytes);
    const parsed = match[2]
      ? deserializeMilxly(text)
      : deserializeMilxly(
          JSON.stringify({ format: 'milxly', version: 1, document: JSON.parse(text) }),
        );
    return { document: parsed.document, mode: match[1] as 'view' | 'copy' };
  } catch {
    return null;
  }
}
