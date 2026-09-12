import { AFSIM_MODEL_CATALOG } from './afsimCatalog';
import type { AfsimCatalogEntry } from './afsimCatalog';

/** 版本化三维资产引用；几何和挂点变换由静态资产提供。 */
export interface Equipment3D {
  modelId: string;
  assetVersion: string;
  attachments: { socketId: string; attachmentId: string; assetVersion: string }[];
}

export interface SocketDefinition {
  id: string;
  name: string;
  accepts: readonly string[];
}

export interface AttachmentDefinition {
  id: string;
  version: string;
  name: string;
  url: string;
}

/** 页面内置模型目录；新型号只需增加一项并提供对应 GLB。 */
export interface EquipmentModelDefinition {
  id: string;
  version: string;
  name: string;
  category: string;
  description: string;
  url: string;
  sockets: readonly SocketDefinition[];
  attachments: readonly AttachmentDefinition[];
  source?: 'project' | 'afsim';
  sourcePath?: string;
  distributionStatus?: AfsimCatalogEntry['status'];
  attribution?: string;
  variant?: string;
  wingTip?: readonly number[];
  engines?: readonly Record<string, unknown>[];
  equipmentType?: string;
}

const AIRCRAFT_ATTACHMENTS: readonly AttachmentDefinition[] = [
  { id: 'demo-tank', version: '1', name: '副油箱（示意）', url: '/models/demo-v1/tank.glb' },
  {
    id: 'demo-sensor',
    version: '1',
    name: '传感器吊舱（示意）',
    url: '/models/demo-v1/sensor.glb',
  },
];

export const AIRCRAFT_MODEL: EquipmentModelDefinition = {
  id: 'demo-aircraft',
  version: '1',
  name: '通用飞机（类别示意）',
  category: '航空器',
  description: '机翼支持副油箱和传感器吊舱，机腹支持传感器吊舱。',
  url: '/models/demo-v1/aircraft.glb',
  sockets: [
    { id: 'left_wing', name: '左翼', accepts: ['demo-tank', 'demo-sensor'] },
    { id: 'right_wing', name: '右翼', accepts: ['demo-tank', 'demo-sensor'] },
    { id: 'center', name: '机腹', accepts: ['demo-sensor'] },
  ],
  attachments: AIRCRAFT_ATTACHMENTS,
};

const ARMORED_VEHICLE_MODEL: EquipmentModelDefinition = {
  id: 'demo-vehicle',
  version: '1',
  name: '通用装甲车辆（类别示意）',
  category: '车辆',
  description: '车辆示意模型；当前版本没有可用外挂挂点。',
  url: '/models/demo-v1/vehicle.glb',
  sockets: [],
  attachments: [],
};

/** 所有可直接在页面选择的内置模型。 */
export const EQUIPMENT_MODELS: readonly EquipmentModelDefinition[] = [
  AIRCRAFT_MODEL,
  ARMORED_VEHICLE_MODEL,
  ...AFSIM_MODEL_CATALOG.filter((entry) => entry.status === 'embedded').map(afsimModel),
];

function afsimModel(entry: AfsimCatalogEntry): EquipmentModelDefinition {
  return {
    id: entry.id,
    version: 'afsim-v1',
    name: entry.displayName,
    category: entry.category,
    description: `AFSIM ${entry.variant} · ${entry.sourcePath}`,
    url: entry.url ?? '',
    sockets: entry.sockets,
    attachments: entry.attachments,
    source: 'afsim',
    sourcePath: entry.sourcePath ?? undefined,
    distributionStatus: entry.status,
    attribution: entry.attribution ?? undefined,
    variant: entry.variant,
    wingTip: entry.wingTip ?? undefined,
    engines: entry.engines,
    equipmentType: entry.type,
  };
}

/** 兼容现有调用方：默认飞机的部件目录。 */
export const ATTACHMENTS = AIRCRAFT_ATTACHMENTS;

export function findEquipmentModel(
  modelId: string,
  version?: string,
): EquipmentModelDefinition | undefined {
  return EQUIPMENT_MODELS.find(
    (model) => model.id === modelId && (version === undefined || model.version === version),
  );
}

/** 创建当前示意飞机的空装配。 */
export function createEquipment3D(model: EquipmentModelDefinition = AIRCRAFT_MODEL): Equipment3D {
  return { modelId: model.id, assetVersion: model.version, attachments: [] };
}

/** 只校验数据形状，保留其他部署或未来版本的引用，避免导入时丢失装配。 */
export function readEquipment3D(value: unknown): Equipment3D | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  if (
    typeof item.modelId !== 'string' ||
    typeof item.assetVersion !== 'string' ||
    !Array.isArray(item.attachments) ||
    item.attachments.length > 100
  )
    return undefined;
  const attachments: Equipment3D['attachments'] = [];
  for (const raw of item.attachments) {
    if (!raw || typeof raw !== 'object') return undefined;
    if (
      typeof raw.socketId !== 'string' ||
      typeof raw.attachmentId !== 'string' ||
      typeof raw.assetVersion !== 'string' ||
      attachments.some((previous) => previous.socketId === raw.socketId)
    )
      return undefined;
    attachments.push({
      socketId: raw.socketId,
      attachmentId: raw.attachmentId,
      assetVersion: raw.assetVersion,
    });
  }
  return { modelId: item.modelId, assetVersion: item.assetVersion, attachments };
}

/** 只有目录中存在且版本完全一致的模型才能装配。 */
export function equipment3DProblem(value: Equipment3D): string | null {
  if (!readEquipment3D(value)) return '装配数据格式无效。';
  const model = findEquipmentModel(value.modelId, value.assetVersion);
  if (!model) return '当前部署没有此模型版本；已保留原装配数据。';
  for (const item of value.attachments) {
    const socket = model.sockets.find((entry) => entry.id === item.socketId);
    const attachment = model.attachments.find(
      (entry) => entry.id === item.attachmentId && entry.version === item.assetVersion,
    );
    if (!socket || !attachment || !socket.accepts.includes(attachment.id))
      return '当前部署无法解析部分挂载；已保留原装配数据。';
  }
  return null;
}

/** 安装、替换或拆卸在一次文档提交中完成；重复操作返回同一对象。 */
export function mountAttachment(
  value: Equipment3D,
  socketId: string,
  attachmentId: string | null,
): Equipment3D {
  if (equipment3DProblem(value)) return value;
  const model = findEquipmentModel(value.modelId, value.assetVersion);
  if (!model) return value;
  const socket = model.sockets.find((entry) => entry.id === socketId);
  const part = model.attachments.find((entry) => entry.id === attachmentId);
  if (!socket || (attachmentId !== null && !canMountAttachment(socketId, attachmentId, model)))
    return value;
  const current = value.attachments.find((entry) => entry.socketId === socketId);
  if ((!current && attachmentId === null) || current?.attachmentId === attachmentId) return value;
  const attachments = value.attachments.filter((entry) => entry.socketId !== socketId);
  if (part) attachments.push({ socketId, attachmentId: part.id, assetVersion: part.version });
  attachments.sort((a, b) => a.socketId.localeCompare(b.socketId));
  return { ...value, attachments };
}

/** 预览高亮与最终提交共用同一兼容性规则。 */
export function canMountAttachment(
  socketId: string,
  attachmentId: string,
  model: EquipmentModelDefinition = AIRCRAFT_MODEL,
): boolean {
  return (
    model.attachments.some((part) => part.id === attachmentId) &&
    model.sockets.some((socket) => socket.id === socketId && socket.accepts.includes(attachmentId))
  );
}
