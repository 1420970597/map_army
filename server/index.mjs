/** 分享存储服务：随机读取地址、独立编辑令牌、不可变版本与乐观并发检查。 */
import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 8 * 1024 * 1024;
const digest = (value) => createHash('sha256').update(value).digest('hex');

/** 建立可测试的 HTTP 服务，数据目录由部署卷提供。 */
export function createShareServer({ directory = process.env.SHARE_DIRECTORY ?? './data/shares', limit = 10000 } = {}) {
  const locks = new Map();
  const root = resolve(directory);
  const json = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  };
  const body = async (req) => {
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > MAX_BYTES) throw Object.assign(new Error('分享文档不能超过 8 MB'), { status: 413 }); chunks.push(chunk); }
    let value;
    try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('请求不是合法 JSON'), { status: 400 }); }
    const doc = value?.document;
    if (!doc || typeof doc.name !== 'string' || !Array.isArray(doc.layers) || !doc.layers.length || !Array.isArray(doc.features)) throw Object.assign(new Error('文档结构无效'), { status: 400 });
    return doc;
  };
  const atomic = async (path, value) => {
    const temp = `${path}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(temp, JSON.stringify(value), { mode: 0o600 }); await rename(temp, path);
  };
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/health' && req.method === 'GET') { json(res, 200, { status: 'ok' }); return; }
      await mkdir(root, { recursive: true });
      if (url.pathname === '/api/shares' && req.method === 'POST') {
        const document = await body(req);
        if ((await readdir(root)).length >= limit) { json(res, 507, { error: '分享存储已满' }); return; }
        const id = randomBytes(16).toString('hex'), token = randomBytes(32).toString('base64url');
        const path = join(root, id); await mkdir(path);
        await atomic(join(path, '1.json'), { document, version: 1, updatedAt: Date.now() });
        await atomic(join(path, 'meta.json'), { tokenHash: digest(token), version: 1 });
        json(res, 201, { id, token, version: 1 }); return;
      }
      const match = url.pathname.match(/^\/api\/shares\/([a-f0-9]{32})$/);
      if (!match) { json(res, 404, { error: '分享地址不存在' }); return; }
      const id = match[1], path = join(root, id);
      if (req.method === 'GET') {
        const meta = JSON.parse(await readFile(join(path, 'meta.json'), 'utf8'));
        const version = Number(url.searchParams.get('version') || meta.version);
        if (!Number.isSafeInteger(version) || version < 1 || version > meta.version) { json(res, 404, { error: '分享版本不存在' }); return; }
        const data = JSON.parse(await readFile(join(path, `${version}.json`), 'utf8'));
        json(res, 200, { ...data, latestVersion: meta.version }); return;
      }
      if (req.method !== 'PUT') { json(res, 405, { error: '不支持的请求方法' }); return; }
      const document = await body(req);
      const previous = locks.get(id) ?? Promise.resolve();
      let release; const current = new Promise((done) => { release = done; });
      locks.set(id, current);
      await previous;
      try {
        const meta = JSON.parse(await readFile(join(path, 'meta.json'), 'utf8'));
        const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
        if (!timingSafeEqual(Buffer.from(digest(token)), Buffer.from(meta.tokenHash))) { json(res, 403, { error: '需要有效的编辑链接才能更新分享' }); return; }
        if (Number(req.headers['if-match']) !== meta.version) { json(res, 409, { error: '分享已有新版本，请先加载最新版本', version: meta.version }); return; }
        const version = meta.version + 1;
        await atomic(join(path, `${version}.json`), { document, version, updatedAt: Date.now() });
        await atomic(join(path, 'meta.json'), { ...meta, version });
        json(res, 200, { id, version });
      } finally { release(); if (locks.get(id) === current) locks.delete(id); }
    } catch (error) {
      const status = error.code === 'ENOENT' ? 404 : error.status ?? 500;
      json(res, status, { error: status === 500 ? '分享服务暂时不可用' : error.code === 'ENOENT' ? '分享不存在' : error.message });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3001);
  createShareServer().listen(port, '0.0.0.0', () => console.log(`分享服务已启动，端口 ${port}`));
}
