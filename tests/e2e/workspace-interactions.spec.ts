import { test, expect } from '@playwright/test';

test('quadro atualiza antes da resposta e reverte quando o servidor recusa', async ({ page, request, context }) => {
  const demo = await request.post('/api/auth', { data: { action: 'demo' } });
  expect(demo.ok()).toBe(true);
  await context.addCookies((await request.storageState()).cookies);

  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/chamados/*/transicoes', async route => {
    await gate;
    await route.fulfill({ status: 409, json: { error: 'O chamado foi atualizado por outra pessoa.' } });
  });

  await page.goto('/e/aurora/chamados');
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  const title = 'Acesso ao Figma para o time de design';
  const open = page.getByRole('region', { name: 'Aberto', exact: true });
  const progress = page.getByRole('region', { name: 'Em andamento', exact: true });

  try {
    await open.getByRole('article').filter({ hasText: title }).getByRole('button', { name: 'Assumir' }).click();
    await expect(progress.getByRole('link', { name: title })).toBeVisible();
  } finally {
    release();
  }

  await expect(open.getByRole('link', { name: title })).toBeVisible();
  await expect(page.getByText('O chamado foi atualizado por outra pessoa.')).toBeVisible();
});

test('atalho abre a paleta, mantém navegação por teclado e oferece acesso à privacidade', async ({ page }) => {
  await page.goto('/e/aurora');
  await page.getByRole('button', { name: 'Abrir comandos' }).focus();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Ir para' });
  const input = dialog.getByRole('textbox');
  await expect(input).toBeFocused();
  await input.fill('privacidade');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/meus-dados$/);
});

test('tema escuro persiste e a navegação inferior funciona no celular', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Tema', { exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(19, 23, 33)');
  await page.getByRole('button', { name: 'Conhecer a demonstração', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const bottom = page.getByRole('navigation', { name: 'Atalhos do workspace', exact: true });
  await expect(bottom).toBeVisible();
  await bottom.getByRole('link', { name: 'Chamados', exact: true }).click();
  await expect(page).toHaveURL(/\/e\/aurora\/chamados$/);
  await expect(page.getByRole('heading', { name: 'Chamados', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: 'artifacts/workspace-dark-mobile.png', fullPage: true });
});

test('arrastar move o chamado com o mesmo controle de versão da ação por botão', async ({ page, request, context }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Em telas de toque, a alternativa é o botão da ação.');
  await request.post('/api/auth', { data: { action: 'demo' } });
  await context.addCookies((await request.storageState()).cookies);
  await page.goto('/e/aurora/chamados');
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  const title = 'Acesso ao Figma para o time de design';
  const open = page.getByRole('region', { name: 'Aberto', exact: true });
  const progress = page.getByRole('region', { name: 'Em andamento', exact: true });
  const response = page.waitForResponse(result => result.url().includes('/transicoes') && result.request().method() === 'POST');
  await open.getByRole('article').filter({ hasText: title }).dragTo(progress, { sourcePosition: { x: 20, y: 20 }, targetPosition: { x: 20, y: 40 } });
  const moved = await response;
  expect(moved.status()).toBe(200);
  expect(moved.url()).toContain('/00000000-0000-4000-8000-000000000001/transicoes');
  await expect(progress.getByRole('link', { name: title })).toBeVisible();
  await page.getByLabel('Tema', { exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.screenshot({ path: 'artifacts/workspace-kanban-dark-desktop.png', fullPage: true });
});
