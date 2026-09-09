/** 地图指北针、磁偏角与按住 D 的局部放大镜。 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { northAngles } from '@/core/geo/extended';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useViewStore } from '@/stores/useViewStore';
import { isTypingTarget } from '@/core/shell';

export function MapTools() {
  const map = useMap();
  const north = usePreferencesStore((s) => s.northArrow);
  const magnetic = usePreferencesStore((s) => s.magneticNorth);
  const enabled = usePreferencesStore((s) => s.magnifier);
  const center = useViewStore((s) => s.center);
  const [magnify, setMagnify] = useState(false);
  const [pointer, setPointer] = useState({ x: 100, y: 100, lat: center.lat, lon: center.lon });
  const lens = useRef<HTMLDivElement>(null);
  const lensMap = useRef<L.Map | null>(null);
  const angles = useMemo(() => {
    try {
      return northAngles(center);
    } catch {
      return null;
    }
  }, [center]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        enabled &&
        e.key.toLowerCase() === 'd' &&
        !isTypingTarget(e.target) &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        setMagnify(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'd') setMagnify(false);
    };
    const blur = () => setMagnify(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [enabled]);
  useEffect(() => {
    if (!magnify || !lens.current) return;
    const instance = L.map(lens.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
    }).setView(map.getCenter(), map.getZoom() + 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(instance);
    lensMap.current = instance;
    return () => {
      lensMap.current = null;
      instance.remove();
    };
  }, [magnify, map]);
  useMapEvents({
    mousemove: (e) => {
      if (magnify) {
        setPointer({
          x: e.containerPoint.x,
          y: e.containerPoint.y,
          lat: e.latlng.lat,
          lon: e.latlng.lng,
        });
        lensMap.current?.setView(e.latlng, map.getZoom() + 2, { animate: false });
      }
    },
  });
  return (
    <>
      {north && (
        <div className="map-tools-overlay">
          <button
            className="north-arrow"
            title={magnetic ? '磁北；点击切换真北' : '真北；点击切换磁北'}
            onClick={() => usePreferencesStore.getState().update({ magneticNorth: !magnetic })}
          >
            <span
              style={{
                display: 'block',
                transform: `rotate(${magnetic ? (angles?.declination ?? 0) : 0}deg)`,
                border: 0,
                padding: 0,
              }}
            >
              ▲
            </span>
            {magnetic ? 'MN' : 'N'}
          </button>
          {angles && (
            <span title="WMM2025 磁偏角 / 网格与磁北夹角">
              δ {angles.declination.toFixed(1)}°<br />
              GM {angles.gm.toFixed(1)}°
            </span>
          )}
        </div>
      )}
      {magnify && (
        <div
          className="map-magnifier"
          ref={lens}
          style={{
            left: Math.min(map.getSize().x - 225, Math.max(0, pointer.x + 20)),
            top: Math.min(map.getSize().y - 225, Math.max(0, pointer.y + 20)),
          }}
        />
      )}
    </>
  );
}
