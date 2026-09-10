/** 只读三维地球：复用文档数据，并提供航向、俯仰与高度控制。 */
import { useEffect, useRef, useState } from 'react';
import type {
  CustomHeightmapTerrainProvider,
  ImageryLayer as CesiumImageryLayer,
  TerrainProvider,
  UrlTemplateImageryProvider as CesiumUrlTemplateImageryProvider,
  Viewer,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useViewStore } from '@/stores/useViewStore';
import { buildGraphic, GRAPHIC_META } from '@/core/graphics';
import { militarySvg } from '@/core/symbology/military';
import { useAccessStore } from '@/stores/useAccessStore';
import { useCustomSymbolStore } from '@/stores/useCustomSymbolStore';
import { offlineHeightmap, OFFLINE_TERRAIN_SIZE } from './offlineTerrain';

function createOfflineTerrain(Provider: typeof CustomHeightmapTerrainProvider): TerrainProvider {
  return new Provider({
    width: OFFLINE_TERRAIN_SIZE,
    height: OFFLINE_TERRAIN_SIZE,
    callback: (tileX, tileY, level) => offlineHeightmap(tileX, tileY, level),
    credit: '内置离线地形基线',
  });
}

function createImageryLayer(
  ImageryLayer: typeof CesiumImageryLayer,
  UrlTemplateImageryProvider: typeof CesiumUrlTemplateImageryProvider,
  url: string | undefined,
): CesiumImageryLayer | false {
  if (!url) return false;
  return new ImageryLayer(
    new UrlTemplateImageryProvider({
      url,
      credit: '配置的离线或内网影像服务',
      maximumLevel: 19,
    }),
  );
}

/** 创建 Cesium 随包发布的 Natural Earth 离线底图，避免无网络时只显示纯色地球。 */
function createOfflineImageryLayer(
  ImageryLayer: typeof CesiumImageryLayer,
  Provider: typeof CesiumUrlTemplateImageryProvider,
): CesiumImageryLayer {
  return new ImageryLayer(
    new Provider({
      // Cesium 的 Natural Earth 资源采用 TMS 行号，reverseY 将其转换为地理瓦片行号。
      url: '/cesium/Assets/Textures/NaturalEarthII/{z}/{x}/{reverseY}.jpg',
      maximumLevel: 2,
      credit: 'Cesium Natural Earth 离线底图',
      tileWidth: 256,
      tileHeight: 256,
    }),
  );
}

export function Map3DView() {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(0);
  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(-60);
  const [terrainStatus, setTerrainStatus] = useState<'loading' | 'ready' | 'offline'>('loading');
  const layers = useDocumentStore((s) => s.document.layers);
  const features = useDocumentStore((s) => s.document.features);
  const updateLayer = useDocumentStore((s) => s.updateLayer);
  const customSymbols = useCustomSymbolStore((s) => s.symbols);
  useEffect(() => {
    let disposed = false;
    void import('cesium')
      .then(
        async ({
          Viewer,
          Cartesian3,
          EllipsoidTerrainProvider,
          CustomHeightmapTerrainProvider,
          CesiumTerrainProvider,
          Ion,
          createWorldTerrainAsync,
          ImageryLayer,
          UrlTemplateImageryProvider,
          Color,
          Math: CMath,
        }) => {
          if (disposed || !host.current) return;
          let terrainProvider: TerrainProvider;
          const terrainUrl = import.meta.env.VITE_CESIUM_TERRAIN_URL?.trim();
          const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN?.trim();
          if (ionToken) {
            try {
              Ion.defaultAccessToken = ionToken;
              terrainProvider = await createWorldTerrainAsync({
                requestVertexNormals: true,
                requestWaterMask: true,
              });
              setTerrainStatus('ready');
            } catch {
              terrainProvider = createOfflineTerrain(CustomHeightmapTerrainProvider);
              setTerrainStatus('offline');
            }
          } else if (!terrainUrl) {
            // Cesium 椭球 provider 是离线部署的稳定基线；离线高程采样用于要素贴地时不阻断地球渲染。
            terrainProvider = new EllipsoidTerrainProvider();
            setTerrainStatus('offline');
          } else {
            try {
              terrainProvider = await CesiumTerrainProvider.fromUrl(terrainUrl, {
                requestVertexNormals: true,
                requestWaterMask: true,
              });
              setTerrainStatus('ready');
            } catch {
              terrainProvider = new EllipsoidTerrainProvider();
              setTerrainStatus('offline');
            }
          }
          if (disposed || !host.current) return;
          const configuredImagery = createImageryLayer(
            ImageryLayer,
            UrlTemplateImageryProvider,
            import.meta.env.VITE_CESIUM_IMAGERY_URL?.trim(),
          );
          const instance = new Viewer(host.current, {
            animation: false,
            timeline: false,
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            infoBox: false,
            fullscreenButton: false,
            // 未配置影像时使用随应用发布的单瓦片底图，确保离线部署仍有可辨识地球。
            baseLayer:
              configuredImagery ||
              createOfflineImageryLayer(ImageryLayer, UrlTemplateImageryProvider),
            terrainProvider,
            // 持续渲染确保无影像的离线场景也能完成地球首帧绘制。
            requestRenderMode: false,
          });
          viewer.current = instance;
          instance.selectedEntityChanged.addEventListener((entity) => {
            const state = useDocumentStore.getState();
            if (entity && state.document.features.some((feature) => feature.id === entity.id)) {
              state.select([entity.id]);
              useViewStore.getState().setInspectorOpen(true);
            }
          });
          // 无影像的离线模式仍显示带颜色的地球和地形网格，避免出现整屏纯蓝。
          instance.scene.globe.baseColor = Color.fromCssColorString('#6f8f5f');
          instance.scene.globe.show = true;
          if (instance.scene.skyAtmosphere) instance.scene.skyAtmosphere.show = false;
          instance.scene.backgroundColor = Color.fromCssColorString('#102536');
          instance.scene.requestRender();
          const view = useViewStore.getState();
          instance.camera.setView({
            destination: Cartesian3.fromDegrees(
              view.center.lon,
              view.center.lat,
              40075016 / 2 ** view.zoom,
            ),
            orientation: { heading: 0, pitch: CMath.toRadians(-60), roll: 0 },
          });
          const sync = () => {
            if (!instance.isDestroyed()) {
              const camera = instance.camera;
              setHeight(Math.round(camera.positionCartographic.height));
              setHeading(Math.round(CMath.toDegrees(camera.heading)));
              setPitch(Math.round(CMath.toDegrees(camera.pitch)));
            }
          };
          instance.camera.moveEnd.addEventListener(sync);
          sync();
          setReady(true);
        },
      )
      .catch((error) =>
        useAccessStore
          .getState()
          .notify(
            `三维视图无法初始化：${error instanceof Error ? error.message : '请检查 WebGL 支持'}`,
          ),
      );
    return () => {
      disposed = true;
      viewer.current?.destroy();
      viewer.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void import('cesium').then(({ Cartesian3, Color, PolygonHierarchy, HeightReference }) => {
      const map = viewer.current;
      if (cancelled || !map || map.isDestroyed()) return;
      map.entities.removeAll();
      const byId = new Map(layers.map((l) => [l.id, l]));
      for (const feature of features) {
        const layer = byId.get(feature.layerId);
        if (!layer?.visible) continue;
        const color = Color.fromCssColorString(
          layer.status === 'approved' ? '#111111' : (feature.style?.color ?? '#167cba'),
        ).withAlpha(layer.opacity);
        if (feature.geometry.kind === 'point') {
          const p = feature.geometry.position;
          map.entities.add({
            id: feature.id,
            name: feature.name,
            position: Cartesian3.fromDegrees(p.lon, p.lat),
            billboard: {
              image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(feature.customSymbolSvg ?? customSymbols.find((symbol) => symbol.id === feature.customSymbolId)?.svg ?? militarySvg(feature.sidc, { ...feature.textFields, size: 32, monoColor: layer.status === 'approved' ? '#111111' : undefined }))}`,
              color: Color.WHITE.withAlpha(layer.opacity),
              heightReference: HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
        } else {
          const graphic = feature.graphicType
            ? buildGraphic(feature.graphicType, feature.geometry.points, feature.graphicParams)
            : null;
          const points = graphic?.outline ?? feature.geometry.points;
          const positions = Cartesian3.fromDegreesArray(points.flatMap((p) => [p.lon, p.lat]));
          const area = feature.graphicType
            ? GRAPHIC_META[feature.graphicType].geometryKind === 'area'
            : feature.geometry.kind === 'area';
          map.entities.add({
            id: feature.id,
            name: feature.name,
            polyline: {
              positions: area ? [...positions, positions[0]] : positions,
              width: feature.style?.weight ?? 3,
              material: color,
              clampToGround: true,
            },
            polygon: area
              ? {
                  hierarchy: new PolygonHierarchy(positions),
                  material: color.withAlpha(layer.opacity * 0.2),
                  heightReference: HeightReference.CLAMP_TO_GROUND,
                }
              : undefined,
          });
          graphic?.parts?.forEach((part, i) =>
            map.entities.add({
              id: `${feature.id}-part-${i}`,
              polyline: {
                positions: Cartesian3.fromDegreesArray(part.flatMap((p) => [p.lon, p.lat])),
                width: 2,
                material: color,
                clampToGround: true,
              },
            }),
          );
        }
      }
      map.scene.requestRender();
    });
    return () => {
      cancelled = true;
    };
  }, [ready, features, layers, customSymbols]);
  const rotate = async (h: number, p: number) => {
    const map = viewer.current;
    if (!map) return;
    const { Math: CMath } = await import('cesium');
    map.camera.setView({
      orientation: { heading: CMath.toRadians(h), pitch: CMath.toRadians(p), roll: 0 },
    });
    map.scene.requestRender();
    setHeading(h);
    setPitch(p);
  };
  return (
    <div className="map-3d">
      <div ref={host} className="cesium-container" aria-label="三维只读地球视图" />
      <div className="map-tools-overlay">
        <span>
          三维只读 · 高度 {height.toLocaleString()} m · 地形{' '}
          {terrainStatus === 'ready'
            ? 'DEM 已加载'
            : terrainStatus === 'loading'
              ? 'DEM 加载中'
              : '内置离线地形'}
        </span>
        <div className="map-3d-layers" aria-label="三维图层控制">
          {layers.map((layer) => (
            <label className="field-row" key={layer.id}>
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={(event) => updateLayer(layer.id, { visible: event.target.checked })}
              />
              <span>{layer.name}</span>
              <input
                aria-label={`${layer.name} 不透明度`}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={layer.opacity}
                onChange={(event) => updateLayer(layer.id, { opacity: Number(event.target.value) })}
              />
            </label>
          ))}
        </div>
        <button onClick={() => void rotate(0, pitch)}>N 朝北</button>
        <label>
          航向 {heading}°
          <input
            aria-label="三维航向"
            type="range"
            min={0}
            max={360}
            value={heading}
            onChange={(e) => void rotate(Number(e.target.value), pitch)}
          />
        </label>
        <label>
          俯仰 {pitch}°
          <input
            aria-label="三维俯仰"
            type="range"
            min={-90}
            max={-5}
            value={pitch}
            onChange={(e) => void rotate(heading, Number(e.target.value))}
          />
        </label>
        <button
          onClick={() => {
            viewer.current?.camera.moveUp(Math.max(100, height * 0.1));
            viewer.current?.scene.requestRender();
          }}
        >
          升高
        </button>
        <button
          onClick={() => {
            viewer.current?.camera.moveDown(Math.max(100, height * 0.1));
            viewer.current?.scene.requestRender();
          }}
        >
          降低
        </button>
      </div>
    </div>
  );
}
