/** 通过真实 HTTP 验证读取权限、编辑令牌、版本冲突和持久化。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createShareServer } from './index.mjs';

test('分享创建、版本更新、只读拒写及服务重启后读取', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'map-army-share-'));
  let server = createShareServer({ directory });
  const start = () => new Promise((done) => server.listen(0, '127.0.0.1', done));
  await start();
  const document = { name: '演习', layers: [{ id: 'one' }], features: [] };
  const request = (path, options = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
  try {
    const created = await request('/api/shares', {
      method: 'POST',
      body: JSON.stringify({ document }),
    });
    assert.equal(created.status, 201);
    const share = await created.json();
    const path = `/api/shares/${share.id}`;
    assert.deepEqual((await (await request(path)).json()).document, document);
    assert.equal(
      (await request(path, { method: 'PUT', body: JSON.stringify({ document }) })).status,
      403,
    );
    const update = {
      method: 'PUT',
      headers: { Authorization: `Bearer ${share.token}`, 'If-Match': '1' },
      body: JSON.stringify({ document: { ...document, name: '第二版' } }),
    };
    const simultaneous = await Promise.all([request(path, update), request(path, update)]);
    assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 409]);
    assert.equal((await (await request(`${path}?version=1`)).json()).document.name, '演习');
    await new Promise((done) => server.close(done));
    server = createShareServer({ directory });
    await start();
    assert.equal((await (await request(path)).json()).document.name, '第二版');
  } finally {
    await new Promise((done) => server.close(done));
    await rm(directory, { recursive: true, force: true });
  }
});

test('允许先创建空分享，再在后续版本加入图层', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'map-army-empty-share-'));
  const server = createShareServer({ directory });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const request = (path, options = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
  try {
    const created = await request('/api/shares', {
      method: 'POST',
      body: JSON.stringify({ document: { name: '空分享', layers: [], features: [] } }),
    });
    assert.equal(created.status, 201);
    const share = await created.json();
    const updated = await request(`/api/shares/${share.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${share.token}`, 'If-Match': '1' },
      body: JSON.stringify({ document: { name: '已填充', layers: [{ id: 'one' }], features: [] } }),
    });
    assert.equal(updated.status, 200);
  } finally {
    await new Promise((done) => server.close(done));
    await rm(directory, { recursive: true, force: true });
  }
});

test('编辑副本创建独立分享标识并可独立更新', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'map-army-copy-share-'));
  const server = createShareServer({ directory });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const request = (path, options = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
  try {
    const created = await request('/api/shares', {
      method: 'POST',
      body: JSON.stringify({ document: { name: '原始', layers: [], features: [] } }),
    });
    const source = await created.json();
    const copied = await request(`/api/shares/${source.id}/copy`, { method: 'POST' });
    assert.equal(copied.status, 201);
    const copy = await copied.json();
    assert.notEqual(copy.id, source.id);
    const updated = await request(`/api/shares/${copy.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${copy.token}`, 'If-Match': '1' },
      body: JSON.stringify({ document: { name: '副本', layers: [], features: [] } }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await (await request(`/api/shares/${source.id}`)).json()).document.name, '原始');
    assert.equal((await (await request(`/api/shares/${copy.id}`)).json()).document.name, '副本');
  } finally {
    await new Promise((done) => server.close(done));
    await rm(directory, { recursive: true, force: true });
  }
});
