/** 详情预览的 GPU 资源与相机生命周期，与文档编辑相互独立。 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Equipment3D, EquipmentModelDefinition } from '@/core/model/equipment3d';

/** 挂点投影到预览容器的屏幕位置。 */
export interface SocketMarker {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

/** 创建单个按需渲染的预览实例，关闭详情时由调用方释放。 */
export function createEquipmentPreview(
  host: HTMLDivElement,
  onMarkers: (markers: SocketMarker[]) => void,
  onStatus: (status: 'ready' | 'error', message?: string) => void,
  model: EquipmentModelDefinition,
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor('#e8eef2');
  renderer.domElement.setAttribute('aria-label', '三维装备预览，拖动旋转、滚轮缩放');
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 7;
  controls.maxDistance = 65;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x61727d, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(8, 16, 12);
  scene.add(light);
  let disposed = false;
  let lost = false;
  let ready = false;
  let value: Equipment3D | undefined;
  let candidate: { socketId: string; attachmentId: string } | null = null;
  const sockets = new Map<string, THREE.Object3D>();
  const templates = new Map<string, THREE.Group>();
  const resources: THREE.Object3D[] = [];
  const mounted: THREE.Object3D[] = [];
  const ghostMaterial = new THREE.MeshStandardMaterial({
    color: '#149565',
    transparent: true,
    opacity: 0.5,
  });
  const point = new THREE.Vector3();

  const render = () => {
    if (disposed || lost) return;
    renderer.render(scene, camera);
    const width = host.clientWidth;
    const height = host.clientHeight;
    onMarkers(
      [...sockets].map(([id, socket]) => {
        socket.getWorldPosition(point).project(camera);
        return {
          id,
          x: ((point.x + 1) * width) / 2,
          y: ((1 - point.y) * height) / 2,
          visible: Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1,
        };
      }),
    );
  };
  const resetCamera = () => {
    camera.position.set(12, 9, 15);
    controls.target.set(0, 0.5, 0);
    controls.update();
    render();
  };
  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };
  controls.addEventListener('change', render);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    onStatus('error', '三维画布已中断，请重新加载模型。');
  };
  renderer.domElement.addEventListener('webglcontextlost', onLost);
  resetCamera();
  resize();

  const rebuild = () => {
    if (!ready || disposed) return;
    for (const object of mounted) object.removeFromParent();
    mounted.length = 0;
    const add = (socketId: string, attachmentId: string, ghost: boolean) => {
      const socket = sockets.get(socketId);
      const template = templates.get(attachmentId);
      if (!socket || !template) return;
      const object = template.clone(true);
      if (ghost)
        object.traverse((node) => {
          if (node instanceof THREE.Mesh) node.material = ghostMaterial;
        });
      socket.add(object);
      mounted.push(object);
    };
    for (const item of value?.attachments ?? []) {
      if (candidate?.socketId !== item.socketId) add(item.socketId, item.attachmentId, false);
    }
    if (candidate) add(candidate.socketId, candidate.attachmentId, true);
    render();
  };

  const loader = new GLTFLoader();
  void Promise.allSettled(
    [model.url, ...model.attachments.map((part) => part.url)].map((url) => loader.loadAsync(url)),
  )
    .then((results) => {
      for (const result of results)
        if (result.status === 'fulfilled') resources.push(result.value.scene);
      if (disposed) {
        releaseResources(resources);
        return;
      }
      // 加载成功不能覆盖加载期间发生的上下文丢失；保留重建入口。
      if (lost) return;
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('模型加载失败，请检查网络后重试。');
      const aircraft = resources[0];
      aircraft.traverse((node) => {
        if (node.userData.mapArmyNodeRole === 'attachmentSocket') {
          const id: unknown = node.userData.socketId;
          if (typeof id !== 'string' || sockets.has(id)) throw new Error('模型挂点数据无效。');
          sockets.set(id, node);
        }
      });
      if (
        sockets.size !== model.sockets.length ||
        model.sockets.some((socket) => !sockets.has(socket.id))
      )
        throw new Error('模型挂点与资产目录不一致。');
      for (const [index, part] of model.attachments.entries()) {
        const model = resources[index + 1];
        model.updateMatrixWorld(true);
        let anchor: THREE.Object3D | undefined;
        model.traverse((node) => {
          if (node.userData.mapArmyNodeRole === 'attachmentAnchor') anchor = node;
        });
        if (!anchor) throw new Error('部件缺少安装锚点。');
        // 把安装锚点的逆变换应用到包装节点，保留模型内部父子关系。
        const wrapper = new THREE.Group();
        wrapper.applyMatrix4(anchor.matrixWorld.clone().invert());
        wrapper.add(model);
        templates.set(part.id, wrapper);
      }
      scene.add(aircraft);
      ready = true;
      rebuild();
      onStatus('ready');
    })
    .catch((error: unknown) => {
      if (!disposed) onStatus('error', error instanceof Error ? error.message : '模型无法显示。');
    });

  return {
    setValue(next: Equipment3D) {
      value = next;
      rebuild();
    },
    setDrag(active: boolean, next: typeof candidate) {
      controls.enabled = !active;
      candidate = next;
      rebuild();
    },
    resetCamera,
    viewUnderside() {
      camera.position.set(12, -9, 15);
      controls.target.set(0, 0, 0);
      controls.update();
      render();
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      releaseResources(resources);
      ghostMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

function releaseResources(roots: THREE.Object3D[]) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  for (const root of roots)
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material);
        for (const property of Object.values(material))
          if (property instanceof THREE.Texture) textures.add(property);
      }
    });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) {
    if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap)
      texture.image.close();
    texture.dispose();
  }
}
