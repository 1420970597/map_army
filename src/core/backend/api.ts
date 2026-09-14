/** 统一后端错误和凭证处理；调用方保留失败时的待保存数据。 */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
    signal: init.signal ?? AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error ?? `服务请求失败（${response.status}）`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

/** 读取后端生成的二进制预览，错误仍沿用统一 API 契约。 */
export async function apiBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
    signal: init.signal ?? AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error ?? `服务请求失败（${response.status}）`);
  }
  return response.blob();
}

export interface AssetRecord {
  id: string;
  name: string;
  kind: string;
  size: number;
  url: string;
  contentType: string;
  createdAt: number;
}

export async function uploadAsset(file: Blob, name: string, kind = 'file'): Promise<AssetRecord> {
  const body = new FormData();
  body.append('file', file, name);
  body.append('kind', kind);
  return api('/assets', { method: 'POST', body });
}
