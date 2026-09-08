import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

import { createLeafletProjection } from '@/features/map/leafletProjection';

import { createClipboardPayload, pasteFeatures } from './mapCommandLogic';
import { registerMapCommandContext, type MapCommandContext } from './mapCommandRegistry';
import { useClipboardStore } from '@/stores/useClipboardStore';
import { useDocumentStore } from '@/stores/useDocumentStore';

/** MapContainer 的命令桥，注册 Leaflet 实例能力并在卸载时释放。 */
export function MapCommandHandler() {
  const map = useMap();

  useEffect(() => {
    const context: MapCommandContext = {
      copy: () => {
        const documentState = useDocumentStore.getState();
        const center = map.getCenter();
        const payload = createClipboardPayload({
          selectedIds: documentState.selectedIds,
          features: documentState.document.features,
          layers: documentState.document.layers,
          anchor: { lon: center.lng, lat: center.lat },
          zoom: map.getZoom(),
        });
        if (payload === null) return false;
        useClipboardStore.getState().setPayload(payload);
        useClipboardStore.getState().persist();
        return true;
      },
      paste: () => {
        const clipboardState = useClipboardStore.getState();
        const payload = clipboardState.payload;
        const documentState = useDocumentStore.getState();
        const layer = documentState.document.layers.find(
          (item) => item.id === documentState.activeLayerId,
        );
        if (payload === null || layer === undefined || layer.locked) return false;

        const pasteCount = clipboardState.recordPaste();
        const features = pasteFeatures(payload, layer, createLeafletProjection(map), pasteCount);
        if (features === null || features.length === 0) return false;
        documentState.addFeatures(features);
        useClipboardStore.getState().persist();
        return true;
      },
      zoomBy: (delta) => {
        map.setZoom(map.getZoom() + delta);
        return true;
      },
      panBy: (x, y) => {
        map.panBy([x * 120, y * 120]);
        return true;
      },
      resetNorth: () => true,
      toggleFullscreen: () => {
        if (!document.fullscreenEnabled) return false;
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          void map.getContainer().requestFullscreen();
        }
        return true;
      },
      confirm: () => {
        window.dispatchEvent(new CustomEvent('map-army:confirm-draw'));
        return true;
      },
      cancelDraw: () => {
        window.dispatchEvent(new CustomEvent('map-army:cancel-draw'));
        return true;
      },
    };

    return registerMapCommandContext(context);
  }, [map]);

  return null;
}
