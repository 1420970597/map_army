import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';

test('AFSIM 目录解析、绘制、撤销与刷新恢复', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '文件', exact: true }).click();
  await page.getByRole('button', { name: '导入 AFSIM 想定文件夹' }).click();
  const dialog = page.getByRole('dialog', { name: 'AFSIM 想定导入' });
  await dialog.locator('input[type=file]').setInputFiles(resolve('e2e/fixtures/afsim'));
  await expect(dialog.getByLabel('想定入口')).toHaveValue('main.txt');
  await dialog.getByRole('button', { name: '解析想定', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('可绘制 2 个单位，跳过 0 个');
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0);
  await dialog.getByRole('button', { name: '绘制到地图' }).click();
  await expect(dialog.getByRole('status')).toContainText('已绘制 2 个单位');
  await expect(dialog.getByRole('button', { name: '绘制到地图' })).toBeDisabled();
  await dialog.getByRole('button', { name: '关闭 AFSIM 导入' }).click();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2);
  await expect(page.locator('.leaflet-marker-icon svg')).toHaveCount(2);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('map-army.session.v1')))
    .toContain('blue-one');
  await page.reload();
  await page
    .getByRole('region', { name: '会话恢复提示' })
    .getByRole('button', { name: '恢复', exact: true })
    .click();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('AFSIM 解析后取消不会写入文档', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '文件', exact: true }).click();
  await page.getByRole('button', { name: '导入 AFSIM 想定文件夹' }).click();
  const dialog = page.getByRole('dialog', { name: 'AFSIM 想定导入' });
  await dialog.locator('input[type=file]').setInputFiles(resolve('e2e/fixtures/afsim'));
  await dialog.getByRole('button', { name: '解析想定', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('可绘制 2 个单位');
  await dialog.press('Escape');
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
});

test('手动导入的单位可从文件菜单导出为标准 AFSIM ZIP', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '文件', exact: true }).click();
  await page.getByRole('button', { name: '导入 AFSIM 想定文件夹' }).click();
  const dialog = page.getByRole('dialog', { name: 'AFSIM 想定导入' });
  await dialog.locator('input[type=file]').setInputFiles(resolve('e2e/fixtures/afsim'));
  await dialog.getByRole('button', { name: '解析想定', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('可绘制 2 个单位');
  await dialog.getByRole('button', { name: '绘制到地图' }).click();
  await dialog.getByRole('button', { name: '关闭 AFSIM 导入' }).click();
  await page.getByRole('button', { name: '文件', exact: true }).click();
  await page.getByLabel('格式').selectOption('afsim');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载文件', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const archive = unzipSync(await readFile(path!));
  expect(Object.keys(archive)).toEqual(
    expect.arrayContaining(['main.txt', 'platforms/blue.txt', 'platforms/red.txt', 'README.txt']),
  );
  expect(strFromU8(archive['main.txt'])).toContain('include_once platforms/blue.txt');
  await expect(page.getByRole('status')).toContainText('AFSIM 已导出：2');
});
