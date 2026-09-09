/** 自定义军标定义与 SVG 安全处理。 */

export interface CustomSymbolDefinition {
  /** 稳定标识，写入要素与文档。 */
  id: string;
  /** 中文名称。 */
  name: string;
  /** 英文名称。 */
  nameEn?: string;
  /** SVG 文档。仅允许静态图形，不执行脚本。 */
  svg: string;
  /** 可选的标准 SIDC，用于回退描述与交换。 */
  baseSidc?: string;
  /** 目录分组。 */
  category?: string;
  /** 搜索别名。 */
  aliases?: string[];
  createdAt: number;
  updatedAt: number;
}

/** 移除 SVG 中可能执行代码或加载外部资源的内容。 */
export function sanitizeCustomSvg(value: string): string {
  const source = value.trim();
  if (!source.toLowerCase().includes('<svg')) throw new Error('自定义军标必须是 SVG 文档');
  if (typeof DOMParser === 'undefined') {
    return source
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\s(?:on[a-z]+|href|xlink:href)\s*=\s*(['"]).*?\1/gi, '')
      .replace(/javascript:/gi, '');
  }
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = parsed.documentElement;
  if (root.nodeName.toLowerCase() !== 'svg') throw new Error('SVG 根元素无效');
  parsed
    .querySelectorAll('script,foreignObject,iframe,object,embed')
    .forEach((node) => node.remove());
  parsed.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (
        name.startsWith('on') ||
        name === 'href' ||
        name === 'xlink:href' ||
        value.startsWith('javascript:')
      ) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return new XMLSerializer().serializeToString(root);
}

export function createCustomSymbol(
  params: Omit<CustomSymbolDefinition, 'id' | 'createdAt' | 'updatedAt'>,
): CustomSymbolDefinition {
  const now = Date.now();
  return {
    ...params,
    id: `custom_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    svg: sanitizeCustomSvg(params.svg),
    aliases: params.aliases ? [...params.aliases] : [],
    createdAt: now,
    updatedAt: now,
  };
}

export function customSymbolMatches(symbol: CustomSymbolDefinition, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  return [symbol.name, symbol.nameEn ?? '', symbol.id, ...(symbol.aliases ?? [])]
    .join(' ')
    .toLocaleLowerCase()
    .includes(q);
}
