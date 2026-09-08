import type { LonLat, Projection } from '@/core/geo';
import {
  materializeClipboard,
  serializeClipboard,
  type ClipboardPayload,
  type Layer,
  type MapFeature,
} from '@/core/model';

export interface ClipboardCommandInput {
  selectedIds: readonly string[];
  features: readonly MapFeature[];
  layers: readonly Layer[];
  anchor: LonLat;
  zoom: number;
}

export function createClipboardPayload(input: ClipboardCommandInput): ClipboardPayload | null {
  if (input.selectedIds.length === 0) return null;
  const featuresById = new Map(input.features.map((feature) => [feature.id, feature]));
  const features = input.selectedIds
    .map((id) => featuresById.get(id))
    .filter((feature): feature is MapFeature => feature !== undefined);
  if (features.length === 0) return null;
  return serializeClipboard(
    features,
    Object.fromEntries(input.layers.map((layer) => [layer.id, layer.name])),
    input.anchor,
    input.zoom,
  );
}

export function pasteFeatures(
  payload: ClipboardPayload | null,
  layer: Layer | undefined,
  projection: Projection,
  pasteCount: number,
): MapFeature[] | null {
  if (payload === null || layer === undefined || layer.locked) return null;
  return materializeClipboard(payload, { targetLayerId: layer.id, projection, pasteCount });
}
