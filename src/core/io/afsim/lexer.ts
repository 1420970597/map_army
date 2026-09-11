/** 带源位置的词元，错误报告可以直接定位原始想定。 */
export interface Token {
  value: string;
  file: string;
  line: number;
  quoted?: boolean;
  argument?: boolean;
}

/** 为解析错误附上文件和行号。 */
export function location(token: Token): string {
  return `${token.file}:${token.line}`;
}

/** 按 AFSIM 输入流拆词；注释和引号中的命令不会参与结构识别。 */
export function tokenize(text: string, file: string): Token[] {
  if (text.includes('\0')) throw new Error(`${file}：文件包含二进制数据`);
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  while (i < text.length) {
    const char = text[i];
    if (/\s|\uFEFF/.test(char)) {
      if (char === '\n') line++;
      i++;
    } else if (char === '#' || text.startsWith('//', i)) {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) throw new Error(`${file}:${line}：块注释未结束`);
      line += text.slice(i, end + 2).split('\n').length - 1;
      i = end + 2;
    } else if (char === '"' || char === "'") {
      const startLine = line;
      let value = '';
      i++;
      while (i < text.length && text[i] !== char) {
        if (text[i] === '\n') line++;
        if (text[i] === '\\' && text[i + 1] === char) i++;
        value += text[i++];
      }
      if (i === text.length) throw new Error(`${file}:${startLine}：引号未结束`);
      i++;
      tokens.push({ value, file, line: startLine, quoted: true });
    } else {
      const start = i;
      while (i < text.length && !/\s/.test(text[i])) {
        if (
          text[i] === '#' ||
          text[i] === '"' ||
          text[i] === "'" ||
          text.startsWith('//', i) ||
          text.startsWith('/*', i)
        )
          break;
        i++;
      }
      tokens.push({ value: text.slice(start, i), file, line });
    }
    if (tokens.length > 500_000) throw new Error(`${file}：词元数量超过上限`);
  }
  return tokens;
}

/** 脚本体保持不透明，避免把脚本中的字符串或变量当作想定命令。 */
export function isScript(value: string): boolean {
  return [
    'script',
    'script_variables',
    'on_initialize',
    'on_initialize2',
    'on_update',
    'on_message',
    'on_entry',
    'on_exit',
    'on_init',
    'execute',
  ].includes(value);
}

/** execute 在 route 中是单词命令，在仿真输入中才是带 end_execute 的代码块。 */
export function isScriptBlock(tokens: readonly Token[], start: number): boolean {
  const value = tokens[start]?.value ?? '';
  if (value !== 'execute') return isScript(value);
  const next = tokens[start + 1]?.value?.toLowerCase();
  return [
    'at_time',
    'at_interval_of',
    'at_event',
    'at_simulation_time',
    'when',
    'on_event',
  ].includes(next ?? '');
}

/** 查找闭合词；同名的参数不是子块。静态平台、类型、mover 和 route 不递归定义自身。 */
export function blockEnd(tokens: readonly Token[], start: number, nesting = 0): number {
  const opening = tokens[start];
  if (nesting > 64) throw new Error(`${location(opening)}：块嵌套超过 64 层`);
  const ending = `end_${opening.value}`;
  for (let i = start + 1; i < tokens.length; i++) {
    if (tokens[i].quoted || tokens[i].argument) continue;
    if (tokens[i].value === ending) return i;
    if (isScriptBlock(tokens, i) && !isScriptBlock(tokens, start))
      i = blockEnd(tokens, i, nesting + 1);
  }
  throw new Error(`${location(opening)}：缺少 ${ending}`);
}
