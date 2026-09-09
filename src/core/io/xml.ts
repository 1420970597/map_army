/** 统一 XML 解析，不依赖浏览器 DOM；禁用文档实体，保留命名空间局部名称。 */
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export type XmlRecord = Record<string, unknown>;
/** 对象读取守卫。 */
export function record(value: unknown): XmlRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as XmlRecord)
    : {};
}
/** 将单节点与多节点统一为数组。 */
export function list(value: unknown): unknown[] {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
}
/** 安全取得文本内容。 */
export function xmlText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : typeof record(value)['#text'] === 'string'
      ? String(record(value)['#text'])
      : '';
}
/** 严格解析 XML，拒绝 DTD 以及不完整的文档。 */
export function parseXml(text: string): XmlRecord {
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true)
    throw new Error('XML 格式无效或包含不支持的文档实体');
  return record(
    new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: false,
    }).parse(text),
  );
}
/** 转义 XML 文本与属性，保证用户文本不能改变节点结构。 */
export function escapeXml(value: unknown): string {
  return String(value ?? '').replace(
    /[<>&'"]/g,
    (char) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] ?? char,
  );
}
