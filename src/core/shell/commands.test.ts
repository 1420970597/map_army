/**
 * 应用命令注册表单测。
 *
 * 验证快捷键覆盖、命令路由、参数映射和注册表不可变性。
 */

import { describe, expect, it, vi } from 'vitest';

import { SHORTCUTS } from './shortcuts';
import {
  COMMANDS,
  executeCommand,
  findCommand,
  type CommandContext,
  type CommandId,
} from './commands';

/** 构造完整的命令上下文并暴露所有调用记录。 */
function createContext(): { context: CommandContext; calls: string[] } {
  const calls: string[] = [];
  return {
    context: {
      undo: vi.fn(() => calls.push('undo')),
      redo: vi.fn(() => calls.push('redo')),
      copy: vi.fn(() => calls.push('copy')),
      paste: vi.fn(() => calls.push('paste')),
      deleteSelection: vi.fn(() => calls.push('deleteSelection')),
      selectAll: vi.fn(() => calls.push('selectAll')),
      escape: vi.fn(() => calls.push('escape')),
      toggleFullscreen: vi.fn(() => calls.push('toggleFullscreen')),
      reload: vi.fn(() => calls.push('reload')),
      zoomBy: vi.fn((delta: number) => calls.push(`zoom:${delta}`)),
      panBy: vi.fn((x: number, y: number) => calls.push(`pan:${x},${y}`)),
      resetNorth: vi.fn(() => calls.push('resetNorth')),
      confirm: vi.fn(() => calls.push('confirm')),
      toggleSnap: vi.fn(() => calls.push('toggleSnap')),
      stepVertex: vi.fn((delta: number) => calls.push(`vertex:${delta}`)),
      activateBoxSelect: vi.fn(() => calls.push('activateBoxSelect')),
      toggleShortcutHelp: vi.fn(() => calls.push('toggleShortcutHelp')),
    },
    calls,
  };
}

/** 执行一个命令并断言其映射到预期上下文调用。 */
function expectCommandCall(id: CommandId, expected: string): void {
  const { context, calls } = createContext();
  expect(executeCommand(id, context)).toBe(true);
  expect(calls).toEqual([expected]);
}

describe('COMMANDS', () => {
  it('与 SHORTCUTS 的不同命令标识精确一致', () => {
    const shortcutIds = [...new Set(SHORTCUTS.map((shortcut) => shortcut.id))].sort();
    const commandIds = COMMANDS.map((command) => command.id).sort();

    expect(commandIds).toEqual(shortcutIds);
  });

  it('冻结注册表及其中的命令定义', () => {
    expect(Object.isFrozen(COMMANDS)).toBe(true);
    expect(COMMANDS.every((command) => Object.isFrozen(command))).toBe(true);
  });
});

describe('findCommand', () => {
  it('返回已注册命令', () => {
    expect(findCommand('edit.undo')?.id).toBe('edit.undo');
  });

  it('未知命令返回 undefined', () => {
    expect(findCommand('unknown.command')).toBeUndefined();
  });
});

describe('executeCommand', () => {
  it('未知命令返回 false 且不调用上下文', () => {
    const { context, calls } = createContext();

    expect(executeCommand('unknown.command', context)).toBe(false);
    expect(calls).toEqual([]);
  });

  it.each([
    ['edit.undo', 'undo'],
    ['edit.redo', 'redo'],
    ['edit.copy', 'copy'],
    ['edit.paste', 'paste'],
    ['edit.delete', 'deleteSelection'],
    ['select.all', 'selectAll'],
    ['edit.escape', 'escape'],
    ['app.fullscreen', 'toggleFullscreen'],
    ['app.reload', 'reload'],
    ['view.north', 'resetNorth'],
    ['edit.confirm', 'confirm'],
    ['edit.toggleSnap', 'toggleSnap'],
    ['select.box', 'activateBoxSelect'],
    ['app.shortcutHelp', 'toggleShortcutHelp'],
  ] as const)('%s 调用正确上下文方法', (id, expected) => {
    expectCommandCall(id, expected);
  });

  it('缩放命令传递正负增量', () => {
    expectCommandCall('view.zoomIn', 'zoom:1');
    expectCommandCall('view.zoomOut', 'zoom:-1');
  });

  it('平移命令传递四个屏幕方向', () => {
    expectCommandCall('view.panUp', 'pan:0,-1');
    expectCommandCall('view.panDown', 'pan:0,1');
    expectCommandCall('view.panLeft', 'pan:-1,0');
    expectCommandCall('view.panRight', 'pan:1,0');
  });

  it('顶点循环命令传递正负步进', () => {
    expectCommandCall('edit.previousVertex', 'vertex:-1');
    expectCommandCall('edit.nextVertex', 'vertex:1');
  });
});
