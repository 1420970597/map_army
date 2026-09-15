let sequence = 0;

/** 生成对象与草稿标识；无加密随机源时的回退不用于访问凭证。 */
export function createRandomId(): string {
  const source = globalThis.crypto;
  try {
    if (typeof source?.randomUUID === 'function') return source.randomUUID();
  } catch {
    // 部分受限环境暴露方法但拒绝调用，继续尝试字节随机源。
  }

  try {
    if (typeof source?.getRandomValues === 'function') {
      const bytes = source.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    // 随机源不可用时仍需允许页面启动、编辑和恢复草稿。
  }

  return `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2) || '0'}-${Math.random().toString(36).slice(2) || '0'}`;
}
