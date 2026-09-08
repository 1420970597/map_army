/**
 * 均匀网格空间索引。
 *
 * 本模块按固定尺寸将平面坐标分桶，提供与 UI、地图引擎无关的邻域查询能力。
 */

/** 默认空间网格单元边长 */
export const DEFAULT_SPATIAL_CELL_SIZE = 64;

/**
 * 可写入空间索引的平面点。
 *
 * @typeParam T 点标识的类型
 */
export interface SpatialPoint<T = string> {
  /** 点标识 */
  id: T;
  /** 横向坐标 */
  x: number;
  /** 纵向坐标 */
  y: number;
}

/**
 * 均匀网格空间索引。
 *
 * @typeParam T 点标识的类型
 */
export interface SpatialIndex<T = string> {
  /** 实际使用的网格单元边长 */
  cellSize: number;
  /** 以网格坐标为键的点桶 */
  cells: ReadonlyMap<string, readonly SpatialPoint<T>[]>;
}

/**
 * 生成网格桶键。
 *
 * @param x 网格横向坐标
 * @param y 网格纵向坐标
 * @returns 可作为 Map 键的网格坐标文本
 */
function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * 规范化网格单元边长。
 *
 * @param cellSize 请求的单元边长
 * @returns 有效边长；无效输入时返回默认值
 */
function normalizedCellSize(cellSize: number | undefined): number {
  if (cellSize === undefined || !Number.isFinite(cellSize) || cellSize <= 0) {
    return DEFAULT_SPATIAL_CELL_SIZE;
  }
  return cellSize;
}

/** 保留由本模块创建的索引对应的原始写入顺序。 */
const sourcePointsByIndex = new WeakMap<object, readonly SpatialPoint<unknown>[]>();

/**
 * 按均匀网格创建空间索引。
 *
 * @typeParam T 点标识的类型
 * @param points 待索引的点，输入数组不会被修改
 * @param cellSize 网格单元边长；无效值回退为默认边长
 * @returns 新建的只读空间索引
 */
export function createSpatialIndex<T>(
  points: readonly SpatialPoint<T>[],
  cellSize?: number,
): SpatialIndex<T> {
  const actualCellSize = normalizedCellSize(cellSize);
  const mutableCells = new Map<string, SpatialPoint<T>[]>();

  for (const point of points) {
    const key = cellKey(Math.floor(point.x / actualCellSize), Math.floor(point.y / actualCellSize));
    const bucket = mutableCells.get(key);
    if (bucket === undefined) mutableCells.set(key, [point]);
    else bucket.push(point);
  }

  const index: SpatialIndex<T> = { cellSize: actualCellSize, cells: mutableCells };
  sourcePointsByIndex.set(index, [...points] as readonly SpatialPoint<unknown>[]);
  return index;
}

/**
 * 查询圆形范围内的点。
 *
 * 查询结果按输入点写入索引时的原始顺序返回，圆周边界上的点也会包含在内。
 *
 * @typeParam T 点标识的类型
 * @param index 空间索引
 * @param x 查询圆心横向坐标
 * @param y 查询圆心纵向坐标
 * @param radius 查询半径；负数或非有限值返回空数组
 * @returns 位于查询圆内的点
 */
export function querySpatialIndex<T>(
  index: SpatialIndex<T>,
  x: number,
  y: number,
  radius: number,
): SpatialPoint<T>[] {
  if (!Number.isFinite(radius) || radius < 0) return [];

  const minCellX = Math.floor((x - radius) / index.cellSize);
  const maxCellX = Math.floor((x + radius) / index.cellSize);
  const minCellY = Math.floor((y - radius) / index.cellSize);
  const maxCellY = Math.floor((y + radius) / index.cellSize);
  const radiusSquared = radius * radius;
  const matchingPoints = new Set<SpatialPoint<T>>();

  for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      const bucket = index.cells.get(cellKey(cellX, cellY));
      if (bucket === undefined) continue;

      for (const point of bucket) {
        const deltaX = point.x - x;
        const deltaY = point.y - y;
        if (deltaX * deltaX + deltaY * deltaY <= radiusSquared) matchingPoints.add(point);
      }
    }
  }

  const sourcePoints = sourcePointsByIndex.get(index) as readonly SpatialPoint<T>[] | undefined;
  if (sourcePoints === undefined) return [...matchingPoints];
  return sourcePoints.filter((point) => matchingPoints.has(point));
}
