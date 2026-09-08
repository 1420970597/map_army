/**
 * 应用命令注册表。
 *
 * 命令以普通纯函数形式映射到注入的上下文能力，供快捷键、工具栏和后续交互层复用。
 */

/**
 * 应用支持的命令标识。
 */
export type CommandId =
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.copy'
  | 'edit.paste'
  | 'edit.delete'
  | 'select.all'
  | 'edit.escape'
  | 'app.fullscreen'
  | 'app.reload'
  | 'view.zoomIn'
  | 'view.zoomOut'
  | 'view.panUp'
  | 'view.panDown'
  | 'view.panLeft'
  | 'view.panRight'
  | 'view.north'
  | 'edit.confirm'
  | 'edit.toggleSnap'
  | 'edit.previousVertex'
  | 'edit.nextVertex'
  | 'select.box'
  | 'app.shortcutHelp';

/**
 * 命令执行所需的应用能力集合。
 */
export interface CommandContext {
  /** 撤销最近一次文档变更。 */
  undo(): void;
  /** 重做最近一次被撤销的文档变更。 */
  redo(): void;
  /** 复制当前选择。 */
  copy(): void;
  /** 粘贴剪贴板内容。 */
  paste(): void;
  /** 删除当前选择。 */
  deleteSelection(): void;
  /** 选择所有可选择对象。 */
  selectAll(): void;
  /** 取消当前交互状态。 */
  escape(): void;
  /** 切换全屏状态。 */
  toggleFullscreen(): void;
  /** 重新加载应用。 */
  reload(): void;
  /** 按增量缩放地图。 */
  zoomBy(delta: number): void;
  /** 按屏幕方向增量平移地图。 */
  panBy(x: number, y: number): void;
  /** 将地图朝向重置为正北。 */
  resetNorth(): void;
  /** 确认当前编辑操作。 */
  confirm(): void;
  /** 切换顶点吸附。 */
  toggleSnap(): void;
  /** 在顶点编辑器中循环切换顶点。 */
  stepVertex(delta: number): void;
  /** 激活框选工具。 */
  activateBoxSelect(): void;
  /** 切换快捷键帮助面板。 */
  toggleShortcutHelp(): void;
}

/**
 * 一条可执行命令的注册定义。
 */
export interface CommandSpec {
  /** 唯一命令标识。 */
  id: CommandId;
  /** 执行命令的上下文操作。 */
  execute(context: CommandContext): void;
}

/**
 * 所有已注册命令。
 *
 * 数组和命令定义均冻结，防止调用方修改内部注册表。
 */
const commandSpecs: readonly CommandSpec[] = [
  { id: 'edit.undo', execute: (context) => context.undo() },
  { id: 'edit.redo', execute: (context) => context.redo() },
  { id: 'edit.copy', execute: (context) => context.copy() },
  { id: 'edit.paste', execute: (context) => context.paste() },
  { id: 'edit.delete', execute: (context) => context.deleteSelection() },
  { id: 'select.all', execute: (context) => context.selectAll() },
  { id: 'edit.escape', execute: (context) => context.escape() },
  { id: 'app.fullscreen', execute: (context) => context.toggleFullscreen() },
  { id: 'app.reload', execute: (context) => context.reload() },
  { id: 'view.zoomIn', execute: (context) => context.zoomBy(1) },
  { id: 'view.zoomOut', execute: (context) => context.zoomBy(-1) },
  { id: 'view.panUp', execute: (context) => context.panBy(0, -1) },
  { id: 'view.panDown', execute: (context) => context.panBy(0, 1) },
  { id: 'view.panLeft', execute: (context) => context.panBy(-1, 0) },
  { id: 'view.panRight', execute: (context) => context.panBy(1, 0) },
  { id: 'view.north', execute: (context) => context.resetNorth() },
  { id: 'edit.confirm', execute: (context) => context.confirm() },
  { id: 'edit.toggleSnap', execute: (context) => context.toggleSnap() },
  { id: 'edit.previousVertex', execute: (context) => context.stepVertex(-1) },
  { id: 'edit.nextVertex', execute: (context) => context.stepVertex(1) },
  { id: 'select.box', execute: (context) => context.activateBoxSelect() },
  { id: 'app.shortcutHelp', execute: (context) => context.toggleShortcutHelp() },
];

export const COMMANDS: readonly CommandSpec[] = Object.freeze(
  commandSpecs.map((command) => Object.freeze(command)),
);

/**
 * 查找指定标识的命令定义。
 *
 * @param id 命令标识
 * @returns 命令定义；未注册时返回 undefined
 */
export function findCommand(id: string): CommandSpec | undefined {
  return COMMANDS.find((command) => command.id === id);
}

/**
 * 执行指定标识的命令。
 *
 * @param id 命令标识
 * @param context 命令执行上下文
 * @returns 找到并执行命令时返回 true；未知命令返回 false
 */
export function executeCommand(id: string, context: CommandContext): boolean {
  const command = findCommand(id);
  if (command === undefined) return false;
  command.execute(context);
  return true;
}
