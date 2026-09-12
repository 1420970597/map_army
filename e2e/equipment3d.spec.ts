import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { gzipSync } from 'node:zlib';

// 资源失败用例直接拦截模型请求；PWA 行为由单独的冒烟文件覆盖。
test.use({ serviceWorkers: 'block' });

const equipment3d = { modelId: 'demo-aircraft', assetVersion: '1', attachments: [] };
const fixture = (configured = false, locked = false) => ({
  format: 'milxly',
  version: 1,
  document: {
    name: '三维验收',
    schemaVersion: 2,
    createdAt: 1,
    updatedAt: 1,
    layers: [{ id: 'demo-layer', name: '飞机图层', visible: true, locked, opacity: 1, order: 0 }],
    features: [
      {
        id: 'demo-unit',
        layerId: 'demo-layer',
        name: '示意飞机一号',
        sidc: '10030100001101000000',
        geometry: { kind: 'point', position: { lon: 116.4, lat: 39.9 } },
        textFields: {},
        createdAt: 1,
        updatedAt: 1,
        ...(configured ? { equipment3d } : {}),
      },
    ],
  },
});

async function openDetails(page: Page) {
  if (!page.url().includes('#map-army='))
    await page.getByRole('button', { name: '恢复', exact: true }).click();
  await page.getByRole('button', { name: '图层面板', exact: true }).click();
  await selectFeature(page);
}

async function selectFeature(page: Page) {
  await page
    .locator('.feature-row')
    .filter({ has: page.getByPlaceholder('示意飞机一号', { exact: true }) })
    .getByTitle('几何类型')
    .click();
  await page.getByRole('tab', { name: '三维模型' }).click();
}

async function seed(page: Page, configured = false, locked = false) {
  await page.addInitScript(
    (document) => {
      if (!localStorage.getItem('map-army.session.v1'))
        localStorage.setItem('map-army.session.v1', JSON.stringify(document));
    },
    fixture(configured, locked),
  );
  await page.goto('/');
  await openDetails(page);
}

test('三维挂载可拖放、替换、撤销并刷新恢复', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seed(page);
  await page.getByRole('button', { name: '关联示意飞机' }).click();
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  const canvas = page.locator('.equipment-canvas canvas');
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: '查看机腹' }).click();
  const emptyModel = await canvas.screenshot();
  await page
    .getByRole('button', { name: '副油箱（示意）', exact: true })
    .dragTo(page.getByRole('button', { name: '左翼挂点', exact: true }));
  const mounts = page.getByRole('list', { name: '当前装配' });
  await expect(mounts).toContainText('左翼：副油箱（示意）');
  expect((await canvas.screenshot()).equals(emptyModel)).toBe(false);
  await page.keyboard.press('Control+z');
  await selectFeature(page);
  await expect(mounts).toContainText('左翼：空');
  await page.keyboard.press('Control+Shift+z');
  await selectFeature(page);
  await expect(mounts).toContainText('左翼：副油箱（示意）');
  await page.getByRole('button', { name: '传感器吊舱（示意）', exact: true }).click();
  await page.getByRole('button', { name: '左翼挂点', exact: true }).click();
  await expect(mounts).toContainText('左翼：传感器吊舱（示意）');
  await page.getByRole('button', { name: '安装到机腹', exact: true }).click();
  await expect(mounts).toContainText('机腹：传感器吊舱（示意）');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('map-army.session.v1')!).document.features[0].equipment3d
            ?.attachments.length,
      ),
    )
    .toBe(2);
  await page.reload();
  await openDetails(page);
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  await expect(mounts).toContainText('左翼：传感器吊舱（示意）');
  await expect(mounts).toContainText('机腹：传感器吊舱（示意）');
  await page.getByRole('button', { name: '查看机腹' }).click();
  await page.locator('.inspector').screenshot({ path: 'test-results/equipment3d-assembly.png' });
  await page.getByRole('button', { name: '拆卸左翼挂载' }).click();
  await expect(mounts).toContainText('左翼：空');
  await page.getByRole('button', { name: '移除模型与所有挂载' }).click();
  await expect(page.getByRole('button', { name: '关联示意飞机' })).toBeVisible();
  await page.keyboard.press('Control+z');
  await selectFeature(page);
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  await expect(mounts).toContainText('机腹：传感器吊舱（示意）');
  expect(errors).toEqual([]);
});

test('页面内置模型库可直接选择并切换模型', async ({ page }) => {
  await seed(page);
  await expect(page.getByRole('button', { name: '关联示意飞机' })).toBeVisible();
  await expect(page.locator('.equipment-catalog')).toBeVisible();
  await page.getByRole('button', { name: '关联通用装甲车辆（类别示意）' }).click();
  await expect(page.locator('.equipment-model.is-selected')).toContainText(
    '通用装甲车辆（类别示意）',
  );
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  await page.getByRole('button', { name: '关联通用飞机（类别示意）' }).click();
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  await expect(page.getByRole('list', { name: '当前装配' })).toContainText('左翼：空');
  await page.keyboard.press('Control+z');
  await selectFeature(page);
  await expect(page.locator('.equipment-model.is-selected')).toContainText(
    '通用装甲车辆（类别示意）',
  );
});

test('AFSIM 许可模型可按自动识别类型筛选并加载', async ({ page }) => {
  await seed(page);
  await page.getByLabel('类型').selectOption('space');
  await expect(page.getByRole('button', { name: '关联Cubesat', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关联Cubesat', exact: true }).click();
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  await expect(page.locator('.equipment-canvas canvas')).toBeVisible();
  await expect(page.getByRole('list', { name: '当前装配' })).toBeEmpty();
});

test('取消拖动和不兼容安装不改变装配，旋转缩放可用', async ({ page }) => {
  await seed(page, true);
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '安装到机腹' })).toBeDisabled();
  const canvas = page.locator('.equipment-canvas canvas');
  const initial = await canvas.screenshot();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + 30, bounds.y + 35);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 130, bounds.y + 65, { steps: 8 });
  await page.mouse.up();
  const rotated = await canvas.screenshot();
  expect(rotated.equals(initial)).toBe(false);
  await page.mouse.wheel(0, -150);
  await expect.poll(async () => (await canvas.screenshot()).equals(rotated)).toBe(false);
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page
    .getByRole('button', { name: '副油箱（示意）', exact: true })
    .dispatchEvent('dragstart', { dataTransfer });
  await page
    .getByRole('button', { name: '左翼挂点', exact: true })
    .dispatchEvent('dragover', { dataTransfer });
  await expect(page.locator('.equipment-socket.is-target')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.equipment-socket.is-target')).toHaveCount(0);
  await expect(page.getByRole('list', { name: '当前装配' })).toContainText('左翼：空');
  await page.getByRole('button', { name: '重置视角' }).click();
  await page.locator('.inspector').screenshot({ path: 'test-results/equipment3d-empty.png' });
});

test('锁定图层仍可查看三维与切换页签，只禁止编辑', async ({ page }) => {
  await seed(page, true, true);
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '副油箱（示意）', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '移除模型与所有挂载' })).toBeDisabled();
  await page.getByRole('tab', { name: '编辑', exact: true }).click();
  await expect(
    page.locator('.inspector').getByRole('textbox', { name: '名称', exact: true }),
  ).toBeDisabled();
  await page.getByRole('tab', { name: '三维模型' }).click();
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  await page.locator('.inspector').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.locator('.inspector')).toHaveCount(0);
});

test('模型加载失败可重试，未知版本保持原装配', async ({ page }) => {
  await page.route('**/models/demo-v1/aircraft.glb', (route) => route.abort());
  await seed(page, true);
  await expect(page.getByRole('button', { name: '重新加载模型' })).toBeVisible();
  await page.unroute('**/models/demo-v1/aircraft.glb');
  await page.getByRole('button', { name: '重新加载模型' }).click();
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  await page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('map-army.session.v1')!);
    value.document.features[0].equipment3d.assetVersion = 'unavailable';
    localStorage.setItem('map-army.session.v1', JSON.stringify(value));
  });
  await page.reload();
  await openDetails(page);
  await expect(page.getByText('当前部署没有此模型版本；已保留原装配数据。')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('map-army.session.v1')!).document.features[0].equipment3d
          .assetVersion,
    ),
  ).toBe('unavailable');
});

test('只读分享允许模型查看但拒绝装配', async ({ page }) => {
  const payload = gzipSync(JSON.stringify(fixture(true))).toString('base64url');
  await page.goto(`/#map-army=view.z.${payload}`);
  await openDetails(page);
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '安装到左翼' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '移除模型与所有挂载' })).toBeDisabled();
  await page.getByRole('tab', { name: '预览', exact: true }).click();
  await expect(page.getByRole('img', { name: '完整符号预览' })).toBeVisible();
});

test('快速切换详情和画布中断后可重新打开', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seed(page, true);
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole('tab', { name: '预览', exact: true }).click();
    await page.getByRole('tab', { name: '三维模型' }).click();
  }
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  await page.locator('.equipment-canvas canvas').evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(page.getByRole('button', { name: '重新加载模型' })).toBeVisible();
  await page.getByRole('button', { name: '重新加载模型' }).click();
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('加载期间画布中断不会被加载成功覆盖', async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/models/demo-v1/aircraft.glb', async (route) => {
    await gate;
    await route.continue();
  });
  await seed(page, true);
  await expect(page.locator('.equipment-canvas canvas')).toBeVisible();
  await page.locator('.equipment-canvas canvas').evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(page.getByRole('button', { name: '重新加载模型' })).toBeVisible();
  const loaded = page.waitForResponse('**/models/demo-v1/aircraft.glb');
  release();
  await (await loaded).finished();
  // 等待加载器消费已收到的响应，再检查是否仍保留错误状态。
  await page.waitForTimeout(200);
  await expect(page.getByRole('button', { name: '重新加载模型' })).toBeVisible();
  await page.getByRole('button', { name: '重新加载模型' }).click();
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
});

test('新增详情文案随五种语言实时切换，帮助弹窗可覆盖详情', async ({ page }) => {
  await seed(page, true);
  await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
  const languages = [
    ['en', '3D model', 'Reset view'],
    ['de', '3D-Modell', 'Ansicht zurücksetzen'],
    ['fr', 'Modèle 3D', 'Réinitialiser la vue'],
    ['it', 'Modello 3D', 'Ripristina vista'],
    ['zh', '三维模型', '重置视角'],
  ];
  for (const [language, tab, reset] of languages) {
    await page.getByRole('button', { name: '选项', exact: true }).click();
    await page.getByRole('combobox', { name: '语言', exact: true }).selectOption(language);
    await page
      .getByRole('dialog', { name: '选项' })
      .getByRole('button', { name: '×', exact: true })
      .click();
    await expect(page.getByRole('tab', { name: tab, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: reset, exact: true })).toBeEnabled();
  }
  await page.keyboard.press('Shift+?');
  await expect(page.getByRole('dialog', { name: '快捷键帮助' })).toBeVisible();
  await page.getByRole('button', { name: '关闭快捷键帮助' }).click();
  await expect(page.getByRole('dialog', { name: '快捷键帮助' })).toHaveCount(0);
});

test.describe('移动端替代操作', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('触屏可点击安装并显示完整模型', async ({ page }) => {
    await seed(page, true);
    await expect(page.getByRole('button', { name: '重置视角' })).toBeEnabled();
    await page.getByRole('button', { name: '传感器吊舱（示意）', exact: true }).tap();
    await page.getByRole('button', { name: '安装到机腹' }).tap();
    await expect(page.getByRole('list', { name: '当前装配' })).toContainText(
      '机腹：传感器吊舱（示意）',
    );
    await page.getByRole('button', { name: '查看机腹' }).tap();
    await page.locator('.inspector').screenshot({ path: 'test-results/equipment3d-mobile.png' });
    const width = await page
      .locator('.inspector')
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(390);
  });
});
