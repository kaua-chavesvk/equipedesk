import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test('salva preferências e nome com sessão real e preserva o layout móvel', async ({ page }) => {
  await page.goto('/conta/configuracoes');
  await expect(page).toHaveURL(/\/login$/);
  const origin = new URL(page.url()).origin;
  const login = await page.request.post('/api/auth', {
    headers: { Origin: origin },
    data: { action: 'login', email: 'marina@aurora.example', password: process.env.DEMO_PASSWORD },
  });
  expect(login.ok()).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/conta/configuracoes');
  await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
  const appearance = page.getByRole('region', { name: 'Aparência e idioma' });
  await appearance.getByLabel('Tema', { exact: true }).selectOption('dark');
  await appearance.getByLabel('Tamanho do texto').selectOption('125');
  await appearance.getByLabel('Idioma').selectOption('en');
  await appearance.getByRole('button', { name: 'Salvar preferências' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.locator('html')).toHaveAttribute('data-text-scale', '125');
  await page.getByLabel('Display name').fill('Marina QA');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Display name')).toHaveValue('Marina QA');
  await expect(page.getByLabel('Text size')).toHaveValue('125');
  await page.goto('/aceitar-termos');
  await page.getByRole('checkbox', { name: /I have read and accept/ }).check();
  await page.getByRole('checkbox', { name: /I confirm that I am 18/ }).check();
  await page.getByRole('button', { name: 'Accept and continue', exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.goto('/e/aurora/chamados');
  await expect(page.getByRole('heading', { name: 'Tickets', exact: true })).toBeVisible();
  await page.goto('/e/aurora/equipe');
  await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
  await page.goto('/conta/configuracoes');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const original = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#002fa7' } }).jpeg().toBuffer();
  const input = page.getByLabel('Choose photo');
  await input.setInputFiles({ name: 'avatar.jpg', mimeType: 'image/jpeg', buffer: original });
  const crop = page.getByRole('dialog', { name: 'Crop photo' });
  await expect(crop).toBeVisible();
  const viewport = crop.getByRole('group', { name: 'Position photo' });
  await viewport.locator('img').evaluate(image => (image as HTMLImageElement).decode());
  await crop.getByRole('slider', { name: 'Zoom', exact: true }).focus();
  await page.keyboard.press('End');
  await viewport.scrollIntoViewIfNeeded();
  const box = (await viewport.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 32, box.y + box.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await viewport.focus();
  await page.keyboard.press('ArrowLeft');
  const position = await viewport.locator('img').evaluate(image => ({
    left: parseFloat(image.style.left), top: parseFloat(image.style.top),
  }));
  await expect(crop.getByRole('slider', { name: 'Zoom', exact: true })).toHaveValue('3');
  expect(position.left).toBeGreaterThan(-100);
  expect(position.top).toBeGreaterThan(-150);
  const stored = page.waitForResponse(response => response.url().endsWith('/api/conta/foto') && response.request().method() === 'POST');
  await crop.getByRole('button', { name: 'Save photo' }).click();
  expect((await stored).status()).toBe(201);
  const photo = page.locator('.settings-photo img');
  await expect(photo).toBeVisible();
  const src = await photo.getAttribute('src');
  const image = await page.request.get(src!);
  expect(image.status()).toBe(200);
  expect(await sharp(await image.body()).metadata()).toMatchObject({ format: 'webp', width: 256, height: 256 });
  await page.getByRole('button', { name: 'Remove photo' }).click();
  await expect(photo).toHaveCount(0);
  expect((await page.request.get(src!)).status()).toBe(404);
});
