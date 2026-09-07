/**
 * 标图文档模型统一出口。
 */

export { BaseMapType, GeometryKind, Tool } from './types';
export type { GridType } from '../geo';
export type {
  AreaGeometry,
  FeatureGeometry,
  FeatureStyle,
  FeatureTextFields,
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
