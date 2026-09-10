import { parseXml, record, list, xmlText } from '../xml';
import { blockEnd, isScript, location, tokenize, type Token } from './lexer';

// 自由字符串参数可与 script/include 等命令同名，预处理时必须保留参数身份。
const ARGUMENT_COUNTS: Readonly<Record<string, number>> = {
  platform: 2,
  platform_type: 2,
  sensor: 2,
  processor: 2,
  weapon: 2,
  comm: 2,
  side: 1,
  icon: 1,
  marking: 1,
  category: 1,
  spatial_domain: 1,
  start_at: 1,
  use_route: 1,
  label: 1,
  mover: 1,
  on_broken: 1,
  on_success: 1,
  radar_signature: 1,
  optical_signature: 1,
  infrared_signature: 1,
};

/** 只读取入口实际引用的文件，目录内的大型输出和资源不会载入内存。 */
export interface AfsimSourceFile {
  path: string;
  size: number;
  readText(): Promise<string>;
}

export const AFSIM_LIMITS = {
  files: 10_000,
  bytes: 32 * 1024 * 1024,
  depth: 64,
  tokens: 500_000,
  platforms: 10_000,
};

/** 规范化目录相对路径；允许目录内的父级引用，拒绝越出所选目录。 */
export function normalizePath(path: string): string | null {
  const value = path.replace(/\\/g, '/');
  if (/^(?:\/|[a-z]:)/i.test(value)) return null;
  const parts: string[] = [];
  for (const part of value.split('/')) {
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

function directory(path: string): string {
  return path.slice(0, Math.max(0, path.lastIndexOf('/')));
}

/** 建立不读取内容的文件索引，重复路径会使引用产生歧义，因此拒绝导入。 */
export function indexAfsimFiles(files: readonly AfsimSourceFile[]): Map<string, AfsimSourceFile> {
  if (files.length > AFSIM_LIMITS.files) throw new Error('AFSIM 目录最多支持 10000 个文件');
  const indexed = new Map<string, AfsimSourceFile>();
  for (const file of files) {
    const path = normalizePath(file.path);
    if (!path || indexed.has(path)) throw new Error(`AFSIM 文件路径无效或重复：${file.path}`);
    indexed.set(path, file);
  }
  return indexed;
}

/** 返回可选入口，优先展示项目文件和 main；不会合并多个独立想定。 */
export function afsimEntryPaths(files: readonly AfsimSourceFile[]): string[] {
  return [...indexAfsimFiles(files).keys()]
    .filter((path) => /\.(?:afproj|txt|afsim|wsf)$/i.test(path))
    .sort((a, b) => {
      const rank = (path: string) =>
        /\.afproj$/i.test(path) ? 0 : /(?:^|\/)main\.txt$/i.test(path) ? 1 : 2;
      return rank(a) - rank(b) || a.localeCompare(b);
    });
}

/** 根据入口展开 include 输入流，不执行脚本，不读取目录外文件或网络资源。 */
export async function loadAfsimSources(files: readonly AfsimSourceFile[], entry: string) {
  const indexed = indexAfsimFiles(files);
  const cache = new Map<string, Token[]>();
  const visited = new Set<string>();
  const warnings = new Set<string>();
  const variables = new Map<string, string>();
  const searchPaths: string[] = [];
  let bytes = 0;
  let tokenCount = 0;
  let cwd = directory(entry);
  let platformMode: 'type' | 'instance' | null = null;
  let inMover = false;
  // 路径变量只做一次替换；浏览器没有进程环境，未定义变量保留以阻止误命中。
  const expandVariables = (value: string) =>
    value.replace(
      /\$\$|\$\(([^)]+)\)|\$\{([^}]+)\}/g,
      (match, parenthesized: string | undefined, braced: string | undefined) =>
        match === '$$' ? '$' : (variables.get(parenthesized ?? braced ?? '') ?? match),
    );
  const resolve = (value: string, from: string): string | undefined => {
    const expanded = expandVariables(value);
    if (/\$[({]/.test(expanded) || /^(?:[/\\]|[a-z]:)/i.test(expanded)) return undefined;
    const candidates = [directory(from), ...searchPaths, cwd].map((base) =>
      normalizePath(`${base ? `${base}/` : ''}${expanded}`),
    );
    return candidates.find((path): path is string => path !== null && indexed.has(path));
  };
  const read = async (path: string): Promise<string> => {
    const file = indexed.get(path);
    if (!file) throw new Error(`AFSIM 入口不存在：${path}`);
    if (!Number.isFinite(file.size) || file.size < 0 || bytes + file.size > AFSIM_LIMITS.bytes)
      throw new Error('AFSIM 依赖文本总大小超过 32 MB');
    const text = await file.readText();
    bytes += Math.max(file.size, new TextEncoder().encode(text).length);
    if (bytes > AFSIM_LIMITS.bytes) throw new Error('AFSIM 依赖文本总大小超过 32 MB');
    return text;
  };
  const visit = async (path: string, chain: readonly string[]): Promise<Token[]> => {
    if (chain.includes(path))
      throw new Error(`AFSIM include 循环：${[...chain, path].join(' -> ')}`);
    if (chain.length >= AFSIM_LIMITS.depth) throw new Error('AFSIM include 嵌套超过 64 层');
    let input = cache.get(path);
    if (!input) {
      input = tokenize(await read(path), path);
      cache.set(path, input);
    }
    visited.add(path);
    const output: Token[] = [];
    for (let i = 0; i < input.length; i++) {
      const token = input[i];
      const value = token.value;
      if (!token.quoted && isScript(value)) {
        const end = blockEnd(input, i);
        warnings.add('含脚本：仅导入静态声明，运行时创建、删除和位置修改未执行');
        tokenCount += end - i;
        i = end;
      } else if (!token.quoted && (value === 'include' || value === 'include_once')) {
        const requested = input[++i];
        if (!requested) throw new Error(`${location(token)}：include 缺少文件名`);
        const included = resolve(requested.value, path);
        if (!included) {
          warnings.add(`${location(token)}：缺少依赖 ${requested.value}`);
        } else if (value !== 'include_once' || !visited.has(included)) {
          const nested = await visit(included, [...chain, path]);
          for (const item of nested) output.push(item);
        }
      } else if (!token.quoted && value === 'define_path_variable') {
        const key = input[++i];
        const val = input[++i];
        if (!key || !val) throw new Error(`${location(token)}：路径变量定义不完整`);
        variables.set(key.value, val.value);
      } else if (!token.quoted && value === 'undefine_path_variable') {
        const key = input[++i];
        if (!key) throw new Error(`${location(token)}：缺少变量名`);
        variables.delete(key.value);
      } else if (!token.quoted && value === 'reset_file_path') {
        searchPaths.length = 0;
      } else if (!token.quoted && value === 'file_path') {
        const item = input[++i];
        if (!item) throw new Error(`${location(token)}：file_path 缺少路径`);
        const base = directory(path);
        const expanded = expandVariables(item.value);
        const resolved = /^(?:[/\\]|[a-z]:)|\$[({]/i.test(expanded)
          ? null
          : normalizePath(`${base ? `${base}/` : ''}${expanded}`);
        if (resolved !== null) searchPaths.push(resolved);
        else warnings.add(`${location(token)}：搜索路径不在所选目录内：${item.value}`);
      } else if (!token.quoted && (value.startsWith('$') || value === 'include_if_exists')) {
        throw new Error(`${location(token)}：暂不支持条件预处理 ${value}`);
      } else {
        output.push(token);
        let count = ARGUMENT_COUNTS[value] ?? 0;
        // edit/delete mover 没有类型参数；platform 编辑只提供名称。
        const previous = input[i - 1]?.value;
        if (
          ['sensor', 'processor', 'weapon', 'comm'].includes(value) &&
          (previous === 'edit' ||
            previous === 'delete' ||
            (platformMode === 'instance' && previous !== 'add'))
        )
          count = 1;
        if (value === 'route' && platformMode === null && !inMover) count = 1;
        if (value === 'mover')
          count =
            previous === 'edit' ||
            previous === 'delete' ||
            (platformMode === 'instance' && previous !== 'add')
              ? 0
              : platformMode === null
                ? 2
                : 1;
        const args =
          value === 'platform' && (previous === 'edit' || previous === 'delete') ? 1 : count;
        if (value === 'platform' && previous !== 'delete') platformMode = 'instance';
        if (value === 'platform_type') platformMode = 'type';
        if (value === 'end_platform' || value === 'end_platform_type') platformMode = null;
        if (value === 'mover' && previous !== 'delete') inMover = true;
        if (value === 'end_mover') inMover = false;
        for (let n = 0; n < args; n++) {
          const arg = input[++i];
          if (!arg) throw new Error(`${location(token)}：${value} 参数不完整`);
          output.push({ ...arg, argument: true });
          tokenCount++;
        }
      }
      tokenCount++;
      if (tokenCount > AFSIM_LIMITS.tokens || output.length > AFSIM_LIMITS.tokens)
        throw new Error('AFSIM 展开词元超过 500000 个');
    }
    return output;
  };
  let roots = [entry];
  if (/\.afproj$/i.test(entry)) {
    const xml = parseXml(await read(entry));
    const project = record(record(xml['wsf-ide-project-file'])['wsf-ide-project']);
    const projectDirectory = xmlText(project['@_project-directory']);
    if (/^(?:[/\\]|[a-z]:)/i.test(projectDirectory))
      throw new Error('AFSIM 项目目录在所选目录外，请选择 .txt 入口');
    const projectBase = normalizePath(`${cwd ? `${cwd}/` : ''}${projectDirectory}`);
    if (projectBase === null) throw new Error('AFSIM 项目目录在所选目录外');
    cwd = projectBase;
    const scenarios = list(project['wsf-ide-scenario']);
    if (scenarios.length !== 1)
      throw new Error('AFSIM 项目包含多个或没有想定，请选择具体的 .txt 入口');
    const scenario = record(scenarios[0]);
    const working = xmlText(scenario['@_working-directory']);
    if (working) {
      const resolved = normalizePath(`${cwd ? `${cwd}/` : ''}${working}`);
      if (resolved === null || /^(?:[/\\]|[a-z]:)/i.test(working))
        throw new Error('AFSIM 项目工作目录在所选目录外，请选择 .txt 入口');
      cwd = resolved;
    }
    roots = list(scenario['file-item'])
      .map(record)
      .filter((item) => xmlText(item['@_file-type']) === 'file-main-source')
      .map((item) => {
        const requested = xmlText(item['@_file-path']);
        const path = /^(?:[/\\]|[a-z]:)/i.test(requested)
          ? null
          : normalizePath(`${projectBase ? `${projectBase}/` : ''}${requested}`);
        if (!path || !indexed.has(path)) throw new Error(`AFSIM 项目入口不存在：${requested}`);
        return path;
      });
    if (!roots.length) throw new Error('AFSIM 项目没有主想定文件');
  }
  const tokens: Token[] = [];
  for (const root of roots)
    if (!visited.has(root)) {
      for (const token of await visit(root, [])) tokens.push(token);
      if (tokens.length > AFSIM_LIMITS.tokens) throw new Error('AFSIM 展开词元超过 500000 个');
    } else {
      warnings.add(`项目主源 ${root} 已由前序入口包含，仅解析一次`);
    }
  return { tokens, warnings: [...warnings], sources: [...visited] };
}
