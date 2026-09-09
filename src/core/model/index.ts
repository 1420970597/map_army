/**
 * 标图文档模型统一出口。
 */

export {
  BaseMapType,
  GeometryKind,
  LayerStatus,
  SymbolKind,
  TacticalGraphicType,
  Tool,
} from './types';
export type { GridType } from '../geo';
export type {
  AreaGeometry,
  FeatureGeometry,
  FeatureStyle,
  FeatureTextFields,
  GraphicParams,
  Layer,
  LineGeometry,
  MapDocument,
  MapFeature,
  PointGeometry,
} from './types';

export { createDocument } from './factory';
export {
  cloneFeature,
  createAreaGeometry,
  createFeature,
  createId,
  createLayer,
  createLineGeometry,
  createPointGeometry,
} from './factory';
export type { CreateFeatureParams, CreateLayerParams } from './factory';

export { mergeStyleWithDefaults, styleFromSymbolDefaults } from './style';
export type { SymbolStyleDefaults } from './style';

export { reorderLayers, sortLayersByDisplay } from './layerOrder';

export {
  CLIPBOARD_KIND,
  CLIPBOARD_VERSION,
  DEFAULT_PASTE_OFFSET_PX,
  materializeClipboard,
  parseClipboard,
  serializeClipboard,
} from './clipboard';
export type { ClipboardPayload, MaterializeParams } from './clipboard';

export { DEFAULT_SPATIAL_CELL_SIZE, createSpatialIndex, querySpatialIndex } from './spatialIndex';
export type { SpatialIndex, SpatialPoint } from './spatialIndex';

export {
  addToSelection,
  featuresInBounds,
  hitTestBounds,
  rangeSelection,
  removeFromSelection,
  toggleInSelection,
} from './selection';
export type { SelectMode } from './selection';

export {
  defaultBearingAt,
  deleteVertex,
  insertVertex,
  minVertexCountOf,
  moveVertex,
  resetAllBearings,
  resetBearing,
  stepVertex,
} from './vertex';

export { CURRENT_SCHEMA_VERSION, migrateDocument, registerMigration } from './migrate';
export type { DocumentMigration, MigrationResult, MigrationWarning } from './migrate';

export {
  anchorOf,
  bearingOf,
  boundsOf,
  centroidOf,
  formatArea,
  formatDistance,
  haversineDistance,
  measurePath,
  pointInPolygon,
  polygonArea,
  toDegrees,
  toRadians,
} from './geometry';
export type { Bounds, MeasureResult } from './geometry';
