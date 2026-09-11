import { parseXml, record, list, xmlText } from '../xml';
import { blockEnd, isScriptBlock, location, tokenize, type Token } from './lexer';

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
  acoustic_signature: 1,
  inherent_contrast: 1,
  p6dof_object_type: 1,
  ignore_block: 1,
};

const COMPONENT_BLOCKS = new Set([
  'sensor',
  'processor',
  'weapon',
  'comm',
  'mover',
  'fuel',
  'track',
  'zone',
  'antenna_pattern',
  'radar_signature',
  'optical_signature',
  'infrared_signature',
  'acoustic_signature',
  'multiresolution_comm',
  'multiresolution_processor',
  'multiresolution_mover',
  'inherent_contrast',
  'p6dof_object_type',
]);

// 组件名称和类型都是自由字符串，第二个词只能在明确遇到下一个命令时省略。
const STRUCTURAL_WORDS = new Set([
  'add',
  'on',
  'off',
  'debug',
  'position',
  'altitude',
  'heading',
  'speed',
  'route',
  'track',
  'target',
  'side',
  'icon',
  'category',
  'spatial_domain',
  'start_at',
  'use_route',
  'clear_categories',
  'internal_link',
  'transfer_rate',
  'transmitter',
  'receiver',
  'on_initialize',
  'on_update',
  'on_message',
  'script_variables',
  'model',
  'fidelity_range',
  'common',
  'default_radial_acceleration',
  'integrator',
  'dynamics',
  'mission_sequence',
  'event_output',
  'event_pipe',
  'horizontal_map',
]);

function isStructuralToken(token: Token | undefined): boolean {
  if (!token || token.quoted) return false;
  return (
    token.value.startsWith('end_') ||
    STRUCTURAL_WORDS.has(token.value) ||
    COMPONENT_BLOCKS.has(token.value)
  );
}

function isTargetBlockStart(tokens: readonly Token[], index: number): boolean {
  return ['offset', 'position', 'velocity', 'heading', 'platform', 'end_target'].includes(
    tokens[index + 1]?.value ?? '',
  );
}

function enclosingBlock(tokens: readonly Token[], index: number): string | undefined {
  const stack: string[] = [];
  for (let i = 0; i < index; i++) {
    const token = tokens[i];
    if (token.quoted || token.argument) continue;
    if (token.value.startsWith('end_')) {
      if (stack.at(-1) === token.value.slice(4)) stack.pop();
    } else if (token.value === 'target' && isTargetBlockStart(tokens, i)) {
      stack.push('target');
    } else if (COMPONENT_BLOCKS.has(token.value)) {
      stack.push(token.value);
    }
  }
  return stack.at(-1);
}

function componentArgumentCount(tokens: readonly Token[], index: number): number {
  const first = tokens[index + 1];
  if (!first) return 1;
  const second = tokens[index + 2];
  // WSF_* 是组件类型本身；嵌套模型也常以自定义类型作为唯一参数。
  if (first.value.startsWith('WSF_') && (!second || isStructuralToken(second))) return 1;
  return second && !isStructuralToken(second) ? 2 : 1;
}

function moverArgumentCount(tokens: readonly Token[], index: number): number {
  const first = tokens[index + 1];
  const second = tokens[index + 2];
  if (!first) return 1;
  if (first.value.startsWith('WSF_')) return 1;
  return second && !isStructuralToken(second) ? 2 : 1;
}

function isEditedPlatformMover(tokens: readonly Token[], index: number): boolean {
  for (let i = index - 1; i >= 1; i--) {
    if (tokens[i].quoted || tokens[i].argument) continue;
    if (tokens[i].value === 'end_platform') return false;
    if (tokens[i].value === 'platform' && tokens[i - 1]?.value === 'edit') return true;
  }
  return false;
}

const ROUTE_COMMANDS = new Set([
  'position',
  'mgrs_coordinate',
  'altitude',
  'heading',
  'speed',
  'time',
  'label',
  'execute',
  'turn_right',
  'turn_left',
  'pause',
  'extrapolate',
  'end_route',
]);

const ROOT_SUPPORT_FILES = new Set([
  'setup.txt',
  'event_output.txt',
  'event_pipe.txt',
  'csv_event_output.txt',
  'terrain.txt',
  'dis_data.txt',
  'dis_realtime.txt',
  'xio_interface.txt',
  'multi_thread.txt',
]);

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
  const all = [...indexAfsimFiles(files).keys()].filter((path) =>
    /\.(?:afproj|txt|afsim|wsf)$/i.test(path),
  );
  const candidates = all.filter((path) => {
    const lower = path.toLowerCase();
    const base = lower.slice(lower.lastIndexOf('/') + 1);
    return (
      !/(?:^|\/)(?:doc|docs|documentation|changelog)(?:\/|$)/.test(lower) &&
      !/(?:^|\/)(?:readme|aaa_readme)(?:\.[^.]+)?$/.test(lower) &&
      !/(?:raw[_-]?data|mission|\.log$)/.test(base)
    );
  });
  const likely = candidates.filter((path) => {
    const lower = path.toLowerCase();
    const base = lower.slice(lower.lastIndexOf('/') + 1);
    return (
      /\.afproj$/i.test(path) ||
      (!lower.includes('/') && !ROOT_SUPPORT_FILES.has(base)) ||
      /^(?:main|scenario)\.(?:txt|afsim|wsf)$/i.test(base) ||
      (!lower.includes('/') && /^(?:setup|startup)\.(?:txt|afsim|wsf)$/i.test(base)) ||
      /(?:^|\/)(?:scenario|scenarios|demo|demos)(?:\/|$)/.test(lower) ||
      /(?:_demo|_scenario)\.(?:txt|afsim|wsf)$/i.test(base)
    );
  });
  return (likely.length ? likely : candidates).sort((a, b) => {
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
  const macros = new Map<string, string>();
  let cwd = directory(entry);
  // 路径变量只做一次替换；浏览器没有进程环境，未定义变量保留以阻止误命中。
  const expandMacros = (value: string) =>
    value.replace(
      /\$<([A-Za-z_][A-Za-z0-9_]*)(?::([^>]*))?>\$/g,
      (_match, name: string, fallback?: string) => macros.get(name) ?? fallback ?? _match,
    );
  const expandVariables = (value: string) =>
    expandMacros(value).replace(
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
      const value = token.quoted ? token.value : expandMacros(token.value);
      if (!token.quoted && isScriptBlock(input, i)) {
        const end = blockEnd(input, i);
        warnings.add('含脚本：仅导入静态声明，运行时创建、删除和位置修改未执行');
        tokenCount += end - i;
        i = end;
      } else if (!token.quoted && value === 'execute') {
        // route 航点中的 execute <callback> 只有一个回调名，不是脚本块。
        i++;
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
      } else if (!token.quoted && value === '$define') {
        const name = input[++i];
        const replacement = input[++i];
        if (!name || !replacement) throw new Error(`${location(token)}：宏定义不完整`);
        macros.set(name.value, expandMacros(replacement.value));
      } else if (!token.quoted && /^(?:\$Id:|\$Header:|\$Log:)/.test(value)) {
        while (i + 1 < input.length && input[++i].value !== '$') {
          // 版本控制标记不参与静态地图导入。
        }
      } else if (!token.quoted && (value.startsWith('$') || value === 'include_if_exists')) {
        warnings.add(`${location(token)}：忽略不影响静态部署的预处理或条件命令 ${value}`);
        if (value === 'include_if_exists') i++;
      } else {
        const previous = input[i - 1]?.value;
        const expressionReference = value === 'comm' && previous === 'via';
        output.push(
          expressionReference
            ? { ...token, value, argument: true }
            : value === token.value
              ? token
              : { ...token, value },
        );
        let count = expressionReference ? 0 : (ARGUMENT_COUNTS[value] ?? 0);
        if (['sensor', 'processor', 'weapon', 'comm'].includes(value)) {
          count = componentArgumentCount(input, i);
          if (previous === 'edit' || previous === 'delete') count = 1;
          if (expressionReference) count = 0;
        }
        if (
          value === 'platform' &&
          (previous === 'track' ||
            previous === 'target' ||
            ['track', 'target'].includes(enclosingBlock(input, i) ?? ''))
        )
          count = 1;
        if (value === 'route') count = ROUTE_COMMANDS.has(input[i + 1]?.value ?? '') ? 0 : 1;
        if (value === 'mover') {
          count =
            previous === 'edit' || previous === 'delete' || isEditedPlatformMover(input, i)
              ? 0
              : moverArgumentCount(input, i);
        }
        const args =
          value === 'platform' && (previous === 'edit' || previous === 'delete') ? 1 : count;
        for (let n = 0; n < args; n++) {
          const arg = input[++i];
          if (!arg || (!arg.quoted && arg.value.startsWith('end_')))
            throw new Error(`${location(token)}：${value} 参数不完整`);
          const expandedArgument = expandMacros(arg.value);
          output.push({ ...arg, value: expandedArgument, argument: true });
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
