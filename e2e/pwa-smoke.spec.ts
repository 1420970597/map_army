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
  expect(externalRequests.slice(requestsBefore3d).filter((url) => /cesium|terrain|imagery|tile/i.test(url))).toEqual([]);
  expect(
    localRequests.some((url) => url.includes('/cesium/Assets/Textures/NaturalEarthII/')),
  ).toBe(true);
});
