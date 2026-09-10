/** 版本化三维资产引用；几何和挂点变换由静态资产提供。 */
export interface Equipment3D {
  modelId: string;
  assetVersion: string;
  attachments: { socketId: string; attachmentId: string; assetVersion: string }[];
}

export const AIRCRAFT_MODEL = {
  id: 'demo-aircraft',
  version: '1',
  name: '通用飞机（类别示意）',
  url: '/models/demo-v1/aircraft.glb',
  sockets: [
    { id: 'left_wing', name: '左翼', accepts: ['demo-tank', 'demo-sensor'] },
    { id: 'right_wing', name: '右翼', accepts: ['demo-tank', 'demo-sensor'] },
    { id: 'center', name: '机腹', accepts: ['demo-sensor'] },
  ],
};

export const ATTACHMENTS = [
  { id: 'demo-tank', version: '1', name: '副油箱（示意）', url: '/models/demo-v1/tank.glb' },
  {
    id: 'demo-sensor',
    version: '1',
    name: '传感器吊舱（示意）',
    url: '/models/demo-v1/sensor.glb',
  },
];

/** 创建当前示意飞机的空装配。 */
export function createEquipment3D(): Equipment3D {
  return { modelId: AIRCRAFT_MODEL.id, assetVersion: AIRCRAFT_MODEL.version, attachments: [] };
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
  if (value.modelId !== AIRCRAFT_MODEL.id || value.assetVersion !== AIRCRAFT_MODEL.version)
    return '当前部署没有此模型版本；已保留原装配数据。';
  for (const item of value.attachments) {
    const socket = AIRCRAFT_MODEL.sockets.find((entry) => entry.id === item.socketId);
    const attachment = ATTACHMENTS.find(
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
  const socket = AIRCRAFT_MODEL.sockets.find((entry) => entry.id === socketId);
  const part = ATTACHMENTS.find((entry) => entry.id === attachmentId);
  if (!socket || (attachmentId !== null && !canMountAttachment(socketId, attachmentId)))
    return value;
  const current = value.attachments.find((entry) => entry.socketId === socketId);
  if ((!current && attachmentId === null) || current?.attachmentId === attachmentId) return value;
  const attachments = value.attachments.filter((entry) => entry.socketId !== socketId);
  if (part) attachments.push({ socketId, attachmentId: part.id, assetVersion: part.version });
  attachments.sort((a, b) => a.socketId.localeCompare(b.socketId));
  return { ...value, attachments };
}

/** 预览高亮与最终提交共用同一兼容性规则。 */
export function canMountAttachment(socketId: string, attachmentId: string): boolean {
  return (
    ATTACHMENTS.some((part) => part.id === attachmentId) &&
    AIRCRAFT_MODEL.sockets.some(
      (socket) => socket.id === socketId && socket.accepts.includes(attachmentId),
    )
  );
}
