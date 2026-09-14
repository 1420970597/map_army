/** 编辑器画布独立持有 GPU 资源，参数变化保留相机、挂点变换直接反馈。 */
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { MoverMount } from './moverTypes';

export function moverPreview(
  host: HTMLDivElement,
  select: (id: string) => void,
  changed: (mount: MoverMount) => void,
  failed: (error: Error) => void = () => {},
  parentsChanged: (parents: { id: string; name: string }[]) => void = () => {},
) {
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor('#e8eef2');
  renderer.domElement.setAttribute('aria-label', 'Mover 三维画布，拖动旋转，滚轮缩放');
  host.append(renderer.domElement);
  const scene = new T.Scene(),
    content = new T.Group(),
    helpers = new T.Group();
  scene.add(content, helpers);
  const camera = new T.PerspectiveCamera(40, 1, 0.01, 10000);
  const orbit = new OrbitControls(camera, renderer.domElement);
  const transform = new TransformControls(camera, renderer.domElement);
  scene.add(transform.getHelper());
  scene.add(new T.HemisphereLight(0xffffff, 0x596573, 2.5));
  const light = new T.DirectionalLight(0xffffff, 3);
  light.position.set(10, 30, 15);
  scene.add(light);
  const bounds = new T.Box3(),
    center = new T.Vector3();
  let radius = 10,
    first = true,
    disposed = false,
    lost = false;
  let selected = '',
    wire = false,
    nodes: T.Object3D[] = [],
    mounts: MoverMount[] = [];
  const reference = new T.Mesh(
    new T.SphereGeometry(1, 12, 8),
    new T.MeshBasicMaterial({ color: '#e87818', depthTest: false }),
  );
  reference.visible = false;
  scene.add(reference);
  let sequence = 0;
  let hidden = new Set<string>();
  let parents = new Map<string, T.Object3D>();
  let baseTransform = new T.Matrix4();
  const parentMatrix = (id?: string) => parents.get(id ?? '')?.matrixWorld ?? baseTransform;
  const materialDefaults = new WeakMap<
    T.Material,
    { transparent: boolean; opacity: number; depthWrite: boolean; emissive: T.Color }
  >();
  const draw = () => {
    if (!disposed && !lost) renderer.render(scene, camera);
  };
  const resize = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    draw();
  };
  const view = (direction = new T.Vector3(1, 0.7, 1)) => {
    const distance =
      (radius / Math.sin(T.MathUtils.degToRad(20))) * Math.max(1, 1 / camera.aspect) * 1.15;
    camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));
    camera.up.set(0, 1, 0);
    if (Math.abs(direction.y) > 0.99) camera.up.set(0, 0, -1);
    orbit.target.copy(center);
    orbit.update();
    draw();
  };
  orbit.addEventListener('change', draw);
  transform.addEventListener('dragging-changed', (event) => {
    orbit.enabled = !event.value;
  });
  transform.addEventListener('change', draw);
  transform.addEventListener('mouseUp', () => {
    const object = transform.object;
    const mount = mounts.find((m) => '@' + m.id === selected);
    if (!object || !mount) return;
    object.updateMatrix();
    const local = parentMatrix(mount.parent).clone().invert().multiply(object.matrix);
    const position = new T.Vector3(),
      rotation = new T.Quaternion(),
      scale = new T.Vector3();
    local.decompose(position, rotation, scale);
    const euler = new T.Euler().setFromQuaternion(rotation);
    changed({
      ...mount,
      position: position.toArray(),
      scale: scale.toArray(),
      rotation: [euler.x, euler.y, euler.z].map(T.MathUtils.radToDeg) as MoverMount['rotation'],
    });
  });
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const release = (group: T.Object3D) => {
    group.traverse((n) => {
      if (n instanceof T.Mesh || n instanceof T.Line || n instanceof T.Points) {
        n.geometry.dispose();
        for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
          for (const value of Object.values(m)) if (value instanceof T.Texture) value.dispose();
          m.dispose();
        }
      }
    });
    group.clear();
  };
  const highlight = () => {
    reference.visible = false;
    content.traverse((node) => {
      if (node.userData.componentId)
        node.visible =
          !hidden.has(node.userData.componentId) && !hidden.has(node.userData.instanceId);
      if (node.userData.referencePoint && node.userData.componentId === selected) {
        reference.visible = true;
        node.getWorldPosition(reference.position);
        reference.scale.setScalar(Math.max(0.03, radius * 0.02));
      }
      if (!(node instanceof T.Mesh)) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      const active =
        !selected ||
        selected.startsWith('@') ||
        node.userData.componentId === selected ||
        node.userData.instanceId === selected;
      for (const m of mats) {
        if (m instanceof T.MeshStandardMaterial) {
          const original = materialDefaults.get(m)!;
          m.wireframe = wire;
          m.transparent = original.transparent || !active;
          m.opacity = original.opacity * (active ? 1 : 0.2);
          m.depthWrite = original.depthWrite && active;
          m.emissive.copy(original.emissive);
          if (active && selected && !selected.startsWith('@'))
            m.emissive.add(new T.Color('#164b70'));
        }
      }
    });
    transform.detach();
    const node = nodes.find((n) => n.userData.mountId === selected.slice(1));
    if (selected.startsWith('@') && node) transform.attach(node);
    draw();
  };
  const updateMounts = (next: MoverMount[]) => {
    transform.detach();
    release(helpers);
    nodes = [];
    mounts = next;
    for (const m of next) {
      const g = new T.Group();
      g.position.fromArray(m.position);
      g.rotation.set(...(m.rotation.map(T.MathUtils.degToRad) as [number, number, number]));
      g.scale.fromArray(m.scale ?? [1, 1, 1]);
      g.updateMatrix();
      g.applyMatrix4(parentMatrix(m.parent));
      g.userData.mountId = m.id;
      const ball = new T.Mesh(
        new T.SphereGeometry(Math.max(0.035, radius * 0.012), 12, 8),
        new T.MeshBasicMaterial({
          color: m.role === 'anchor' ? '#d45e14' : '#0887ce',
          depthTest: false,
        }),
      );
      ball.userData.mountId = m.id;
      g.add(ball, new T.AxesHelper(Math.max(0.15, radius * 0.12)));
      helpers.add(g);
      nodes.push(g);
    }
    highlight();
  };
  const ray = new T.Raycaster();
  const pointer = new T.Vector2();
  let down = [0, 0];
  const onDown = (e: PointerEvent) => {
    down = [e.clientX, e.clientY];
  };
  const onUp = (e: PointerEvent) => {
    if (transform.axis || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    const hit = ray
      .intersectObjects([...helpers.children, ...content.children], true)
      .find((h) => h.object instanceof T.Mesh);
    if (hit) {
      const id = hit.object.userData.mountId;
      const component = hit.object.userData.instanceId ?? hit.object.userData.componentId;
      if (id) select('@' + id);
      else if (component) select(component);
    } else select('');
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    sequence++;
    failed(new Error('三维画布已中断，请重新生成预览'));
  });
  resize();
  view();
  return {
    reset() {
      first = true;
      sequence++;
      release(content);
      parents.clear();
      hidden.clear();
      parentsChanged([]);
      reference.visible = false;
      transform.detach();
      draw();
    },
    async load(blob: Blob, signal?: AbortSignal) {
      const current = ++sequence;
      const gltf = await new GLTFLoader().parseAsync(await blob.arrayBuffer(), '');
      if (lost) {
        release(gltf.scene);
        throw new Error('三维画布已中断，请重新生成预览');
      }
      if (disposed || current !== sequence || signal?.aborted) {
        release(gltf.scene);
        return;
      }
      release(content);
      content.add(gltf.scene);
      content.updateMatrixWorld(true);
      parents = new Map();
      baseTransform = new T.Matrix4();
      gltf.scene.traverse((node) => {
        if (node.userData.modelTransform) baseTransform = node.matrixWorld.clone();
        if (node.userData.mapArmyNodeRole || node.userData.assemblySocket) return;
        const index = gltf.parser.associations.get(node)?.nodes;
        const id = node.userData.instanceId ?? (index !== undefined ? 'node:' + index : undefined);
        if (id) parents.set(id, node);
      });
      parentsChanged([...parents].map(([id, node]) => ({ id, name: node.name || id })));
      const originalMaterials = new Set<T.Material>();
      gltf.scene.traverse((n) => {
        if (n instanceof T.Mesh) {
          for (const m of Array.isArray(n.material) ? n.material : [n.material])
            originalMaterials.add(m);
          n.material = Array.isArray(n.material)
            ? n.material.map((m: T.Material) => m.clone())
            : n.material.clone();
          for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
            if (m instanceof T.MeshStandardMaterial)
              materialDefaults.set(m, {
                transparent: m.transparent,
                opacity: m.opacity,
                depthWrite: m.depthWrite,
                emissive: m.emissive.clone(),
              });
          }
        }
      });
      originalMaterials.forEach((m) => m.dispose());
      bounds.setFromObject(content);
      bounds.getCenter(center);
      radius = Math.max(0.1, bounds.getSize(new T.Vector3()).length() / 2);
      camera.near = radius / 1000;
      camera.far = radius * 1000;
      camera.updateProjectionMatrix();
      orbit.minDistance = radius * 0.05;
      orbit.maxDistance = radius * 50;
      updateMounts(mounts);
      if (first) {
        view();
        first = false;
      }
      highlight();
    },
    select(id: string) {
      selected = id;
      highlight();
    },
    mounts: updateMounts,
    reparent(mount: MoverMount, parent: string): MoverMount {
      const local = new T.Matrix4().compose(
        new T.Vector3(...mount.position),
        new T.Quaternion().setFromEuler(
          new T.Euler(...(mount.rotation.map(T.MathUtils.degToRad) as [number, number, number])),
        ),
        new T.Vector3(...(mount.scale ?? [1, 1, 1])),
      );
      local
        .premultiply(parentMatrix(mount.parent))
        .premultiply(parentMatrix(parent).clone().invert());
      const p = new T.Vector3(),
        q = new T.Quaternion(),
        s = new T.Vector3();
      local.decompose(p, q, s);
      const e = new T.Euler().setFromQuaternion(q);
      return {
        ...mount,
        parent,
        position: p.toArray(),
        rotation: [e.x, e.y, e.z].map(T.MathUtils.radToDeg) as MoverMount['rotation'],
        scale: s.toArray(),
      };
    },
    wire(value: boolean) {
      wire = value;
      highlight();
    },
    hide(id: string) {
      if (id) hidden.add(id);
      else hidden = new Set();
      highlight();
    },
    mode(value: 'translate' | 'rotate') {
      transform.setMode(value);
    },
    view(direction: 'perspective' | 'top' | 'side' | 'front') {
      view(
        direction === 'top'
          ? new T.Vector3(0, 1, 0)
          : direction === 'side'
            ? new T.Vector3(0, 0, 1)
            : direction === 'front'
              ? new T.Vector3(1, 0, 0)
              : undefined,
      );
    },
    dispose() {
      disposed = true;
      sequence++;
      observer.disconnect();
      transform.dispose();
      orbit.dispose();
      release(content);
      release(helpers);
      reference.geometry.dispose();
      reference.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
