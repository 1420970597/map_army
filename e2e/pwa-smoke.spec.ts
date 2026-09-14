import { expect, test } from '@playwright/test';

test('Chromium 可打开应用并配置六边形网格', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('map.army')).toBeVisible();
  await page.getByRole('button', { name: '选项' }).click();
  await expect(page.getByRole('dialog', { name: '选项' })).toContainText('六边形网格');
  await page.getByRole('checkbox', { name: '显示六边形标签' }).uncheck();
  await expect(page.getByRole('checkbox', { name: '显示六边形标签' })).not.toBeChecked();
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
});

test('Chromium 离线三维视图显示地球而非纯色背景', async ({ page }) => {
  const externalRequests: string[] = [];
  const localRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/^https?:\/\/(?!127\.0\.0\.1|localhost)/.test(url)) externalRequests.push(url);
    else localRequests.push(url);
  });
  await page.goto('/');
  const requestsBefore3d = externalRequests.length;
  await page.getByRole('button', { name: '三维' }).click();
  const canvas = page.locator('.cesium-container canvas');
  await expect(canvas).toHaveCount(1);
  await expect(page.getByText(/地形 内置离线地形/)).toBeVisible();
  await page.waitForTimeout(1800);
  await expect(page.getByText(/地形 内置离线地形/)).toBeVisible();
  expect(
    externalRequests
      .slice(requestsBefore3d)
      .filter((url) => /cesium|terrain|imagery|tile/i.test(url)),
  ).toEqual([]);
  expect(localRequests.some((url) => url.includes('/cesium/Assets/Textures/NaturalEarthII/'))).toBe(
    true,
  );
});

test('PWA 不使用缓存的工作空间身份或跨空间私有文件', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status', { name: '工作空间保存状态' })).toContainText('已保存');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  const result = await page.evaluate(async () => {
    const owner = await (await fetch('/api/workspace')).json();
    const upload = new FormData();
    upload.append('file', new Blob(['private-content']), 'private.txt');
    const asset = await (await fetch('/api/assets', { method: 'POST', body: upload })).json();
    const cache = await caches.open('maparmy-regression');
    await cache.put(
      '/api/workspace',
      new Response(JSON.stringify({ id: 'stale-owner' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await cache.put(asset.url, new Response('cached-private-content'));
    const fresh = await (await fetch('/api/workspace')).json();
    await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const denied = await fetch(asset.url);
    return { actual: owner.id, received: fresh.id, denied: denied.status };
  });
  expect(result.received).toBe(result.actual);
  expect(result.denied).toBe(404);
});

test('已有旧缓存 Worker 的浏览器先升级策略再连接工作空间', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status', { name: '工作空间保存状态' })).toContainText('已保存');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.context().route('**/legacy-cache-worker.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
      self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
      self.addEventListener('fetch', event => {
        if (new URL(event.request.url).pathname === '/api/workspace')
          event.respondWith(Promise.resolve(new Response(JSON.stringify({id:'stale-owner',name:'旧缓存'}), {headers:{'Content-Type':'application/json'}})));
      });`,
    }),
  );
  await page.evaluate(() =>
    navigator.serviceWorker.register('/legacy-cache-worker.js', { scope: '/' }),
  );
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL))
    .toContain('legacy-cache-worker.js');
  await page.reload();
  await expect(page.getByRole('status', { name: '工作空间保存状态' })).toContainText('已保存', {
    timeout: 20000,
  });
  const owner = await page.evaluate(
    () => JSON.parse(localStorage.getItem('map-army.connection')!).workspaceId,
  );
  expect(owner).not.toBe('stale-owner');
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(
    /\/sw\.js$/,
  );
});
