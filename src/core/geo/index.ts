/**
 * 地理计算模块统一出口。
 *
 * 对外仅暴露本 barrel 文件，内部实现细节（如 Krüger 级数）不直接被 UI 层引用，
 * 便于后续替换投影算法而不影响调用方。
 */

export * from './types';
export * from './constants';
export * from './transverse-mercator';
export * from './utm';
export * from './mgrs';
export * from './bng';
export * from './grid';
export * from './snap';
export * from './planar';
export * from './search';

export * from './extended';
