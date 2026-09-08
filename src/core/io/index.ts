/**
 * 导入导出模块统一出口。
 */

export {
  compressMilxly,
  decompressMilxly,
  deserializeMilxly,
  serializeMilxly,
  MILXLY_FORMAT,
  MILXLY_VERSION,
} from './milxly';
export type { MilxlyFile } from './milxly';

export { documentToGeoJson, geoJsonToDocument } from './geojson';
export type { GeoJsonFeature, GeoJsonFeatureCollection, GeoJsonGeometry } from './geojson';

export { autoSave, clearDocument, loadDocument, saveDocument } from './persistence';

export {
  classifyError,
  estimateBytes,
  isConflict,
  CONFLICT_WINDOW_MS,
  QUOTA_WARN_BYTES,
  STORAGE_KEY,
  URL_PAYLOAD_VERSION,
} from './session';
export type { SessionErrorKind, SessionMeta } from './session';

export {
  downloadBytes,
  downloadText,
  pickBinaryFile,
  pickTextFile,
  toSafeFilename,
} from './download';
export type { DownloadOptions } from './download';
