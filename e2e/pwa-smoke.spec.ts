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
