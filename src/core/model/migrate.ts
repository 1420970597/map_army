/**
 * 标图文档 schema 迁移链。
 *
 * 本模块是所有反序列化入口升级历史文档的唯一位置。迁移步骤按相邻版本注册，
 * 以避免兼容逻辑分散到持久化、导入与分享载荷等调用方。
 */

import type { MapDocument } from './types';

/** 当前标图文档的 schema 版本。 */
export const CURRENT_SCHEMA_VERSION = 2;

/** 单个相邻 schema 版本之间的迁移函数。 */
export type DocumentMigration = (document: MapDocument) => MapDocument;

/** 迁移过程中可由调用方观察到的警告。 */
export interface MigrationWarning {
  /** 警告类别。 */
  code: 'future-schema-version' | 'missing-migration';
  /** 面向调用方的中文说明。 */
  message: string;
  /** 与警告相关的 schema 版本。 */
  schemaVersion: number;
}

/** 文档迁移结果，包含独立副本与全部警告。 */
export interface MigrationResult {
  /** 已迁移或原样保留的独立文档副本。 */
  document: MapDocument;
  /** 迁移过程中的可观察警告。 */
  warnings: readonly MigrationWarning[];
}

/** 已按起始版本登记的相邻迁移步骤。 */
const migrations = new Map<number, DocumentMigration>();

/**
 * 判断值是否为可读取属性的普通对象。
 *
 * @param value 待判断的任意值
 * @returns 值是否为对象记录
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 判断输入是否具备标图文档的基础结构。
 *
 * schema 迁移仅负责版本升级，不承担格式解析器的字段修复职责，因而在这里
 * 提前拒绝不具备基础结构的输入。
 *
 * @param value 待迁移的原始值
 * @returns 值是否可作为标图文档迁移
 */
function isMapDocument(value: unknown): value is MapDocument {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    Array.isArray(value.layers) &&
    Array.isArray(value.features) &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number'
  );
}

/**
 * 读取并校验文档的起始 schema 版本。
 *
 * @param document 已校验基础结构的文档
 * @returns 缺省时为 1 的有效 schema 版本
 */
function schemaVersionOf(document: MapDocument): number {
  if (document.schemaVersion === undefined) return 1;

  if (!Number.isInteger(document.schemaVersion) || document.schemaVersion < 1) {
    throw new TypeError('schemaVersion 必须是大于等于 1 的整数。');
  }

  return document.schemaVersion;
}

/**
 * 登记一个相邻版本的文档迁移步骤。
 *
 * 只接受 `vN→vN+1`，从而确保任一历史版本都能沿注册表逐步升级，
 * 而不依赖难以维护的跨版本条件分支。
 *
 * @param from 起始 schema 版本
 * @param to 目标 schema 版本，必须等于 from + 1
 * @param migration 不修改入参并返回升级后文档的迁移函数
 */
export function registerMigration(from: number, to: number, migration: DocumentMigration): void {
  if (!Number.isInteger(from) || from < 1 || to !== from + 1) {
    throw new RangeError('迁移步骤必须连接两个相邻的正整数 schema 版本。');
  }

  if (migrations.has(from)) {
    throw new Error(`schema v${from} 的迁移步骤已登记。`);
  }

  migrations.set(from, migration);
}

/**
 * 将 v1 文档升级为 v2。
 *
 * v2 建立了版本化迁移链，但未修改既有业务字段，因此仅由框架统一写入版本号。
 *
 * @param document v1 文档副本
 * @returns 保留全部既有字段的文档副本
 */
function migrateV1ToV2(document: MapDocument): MapDocument {
  return { ...document };
}

registerMigration(1, 2, migrateV1ToV2);

/**
 * 将原始标图文档迁移到当前 schema。
 *
 * 输入永不被修改；无版本文档按 v1 处理。遇到高于当前版本的文档时保留全部数据
 * 与原版本，返回警告而不执行降级或猜测性改写。
 *
 * @param raw 由持久化或导入入口取得的原始文档
 * @returns 包含独立文档副本与迁移警告的结果
 */
export function migrateDocument(raw: unknown): MigrationResult {
  if (!isMapDocument(raw)) {
    throw new TypeError('无法迁移：输入不具备标图文档的基础结构。');
  }

  let document = structuredClone(raw);
  let version = schemaVersionOf(document);
  const warnings: MigrationWarning[] = [];

  if (version > CURRENT_SCHEMA_VERSION) {
    warnings.push({
      code: 'future-schema-version',
      message: `文档 schema v${version} 高于当前支持的 v${CURRENT_SCHEMA_VERSION}，已原样保留。`,
      schemaVersion: version,
    });
    return { document, warnings };
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = migrations.get(version);
    if (!migration) {
      warnings.push({
        code: 'missing-migration',
        message: `缺少 schema v${version} 到 v${version + 1} 的迁移步骤，已保留当前数据。`,
        schemaVersion: version,
      });
      return { document, warnings };
    }

    document = { ...migration(document), schemaVersion: version + 1 };
    version += 1;
  }

  return { document, warnings };
}
