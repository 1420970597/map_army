/** 战术图形的地图适配层；生成几何与控制点编辑共用同一组数据。 */
import { useMemo } from 'react';
import { Polygon, Polyline, Tooltip } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import { buildGraphic, GRAPHIC_META } from '@/core/graphics';
import type { MapFeature } from '@/core/model';
import { applyLayerOpacity, featureStyleOf, featureHighlightStyleOf } from './featureStyle';

export function TacticalGraphic({
  feature,
  selected = false,
  opacity = 1,
  approved = false,
  onSelect,
}: {
  feature: MapFeature;
  selected?: boolean;
  opacity?: number;
  approved?: boolean;
  onSelect?: (id: string, event: LeafletMouseEvent) => void;
}) {
  const graphic = useMemo(
    () =>
      feature.graphicType && feature.geometry.kind !== 'point'
        ? buildGraphic(feature.graphicType, feature.geometry.points, feature.graphicParams)
        : null,
    [feature],
  );
  if (!graphic || !feature.graphicType) return null;
  const style = applyLayerOpacity(
    {
      ...(selected ? featureHighlightStyleOf(feature) : featureStyleOf(feature)),
      ...(approved ? { color: '#111111' } : {}),
    },
    opacity,
  );
  const shared = {
    positions: graphic.outline.map((point): [number, number] => [point.lat, point.lon]),
    pathOptions: style,
    eventHandlers: onSelect
      ? { click: (event: LeafletMouseEvent) => onSelect(feature.id, event) }
      : undefined,
  };
  const label =
    feature.textFields.uniqueDesignation || feature.name || GRAPHIC_META[feature.graphicType].name;
  return (
    <>
      {GRAPHIC_META[feature.graphicType].geometryKind === 'area' ? (
        <Polygon {...shared}>
          <Tooltip>{label}</Tooltip>
        </Polygon>
      ) : (
        <Polyline {...shared}>
          <Tooltip>{label}</Tooltip>
        </Polyline>
      )}
      {graphic.parts?.map((points, index) => (
        <Polyline
          key={index}
          positions={points.map((point) => [point.lat, point.lon])}
          pathOptions={{ ...style, interactive: false }}
        />
      ))}
    </>
  );
}
