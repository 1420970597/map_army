/** 图像图层以三点仿射变换显示；活动图层提供角点和中心拖动手柄。 */
import { useEffect } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Layer } from '@/core/model';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useAccessStore } from '@/stores/useAccessStore';

const handleIcon = L.divIcon({
  className: 'overlay-handle',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function ImageLayer({ layer, editable }: { layer: Layer; editable: boolean }) {
  const map = useMap();
  const image = layer.image!;
  useEffect(() => {
    const img = document.createElement('img');
    img.src = image.url;
    img.crossOrigin = 'anonymous';
    img.alt = layer.name;
    img.className = 'map-image-overlay leaflet-zoom-hide';
    Object.assign(img.style, {
      position: 'absolute',
      width: `${image.width}px`,
      height: `${image.height}px`,
      maxWidth: 'none',
      transformOrigin: '0 0',
      opacity: String(layer.opacity),
      pointerEvents: 'none',
      zIndex: String(layer.order),
    });
    const update = () => {
      const [o, x, y] = image.corners.map((p) => map.latLngToLayerPoint([p.lat, p.lon]));
      img.style.transform = `matrix(${(x.x - o.x) / image.width},${(x.y - o.y) / image.width},${(y.x - o.x) / image.height},${(y.y - o.y) / image.height},${o.x},${o.y})`;
    };
    map.getPanes().overlayPane.append(img);
    update();
    map.on('zoomend viewreset moveend', update);
    return () => {
      map.off('zoomend viewreset moveend', update);
      img.remove();
    };
  }, [image, layer.name, layer.opacity, layer.order, map]);
  if (!editable) return null;
  const center = {
    lon: (image.corners[1].lon + image.corners[2].lon) / 2,
    lat: (image.corners[1].lat + image.corners[2].lat) / 2,
  };
  return (
    <>
      {[...image.corners, center].map((p, i) => (
        <Marker
          key={i}
          position={[p.lat, p.lon]}
          icon={handleIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const next = (e.target as L.Marker).getLatLng();
              const corners = image.corners.map((corner, j) =>
                i === 3
                  ? {
                      lon: corner.lon + next.lng - center.lon,
                      lat: corner.lat + next.lat - center.lat,
                    }
                  : j === i
                    ? { lon: next.lng, lat: next.lat }
                    : corner,
              ) as typeof image.corners;
              useDocumentStore.getState().updateLayer(layer.id, { image: { ...image, corners } });
            },
          }}
        />
      ))}
    </>
  );
}

export function ImageLayers() {
  const layers = useDocumentStore((s) => s.document.layers);
  const active = useDocumentStore((s) => s.activeLayerId);
  const readOnly = useAccessStore((s) => s.readOnly);
  return (
    <>
      {layers
        .filter((l) => l.visible && l.image)
        .sort((a, b) => a.order - b.order)
        .map((layer) => (
          <ImageLayer
            key={layer.id}
            layer={layer}
            editable={!readOnly && !layer.locked && active === layer.id}
          />
        ))}
    </>
  );
}
