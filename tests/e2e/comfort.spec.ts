import { test, expect } from '@playwright/test';

test('acesso mantém campos legíveis e permite conferir a senha sem perder o valor', async ({ page }) => {
  await page.goto('/login');
  const password = page.getByLabel('Senha', { exact: true });
  await password.fill('senha-apenas-de-teste');
  await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('senha-apenas-de-teste');
  await page.getByRole('button', { name: 'Ocultar senha', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await password.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('login informa o envio e preserva os valores para corrigir um erro', async ({ page }) => {
  let finish!: () => void;
  const responseReady = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/api/auth', async route => {
    await responseReady;
    await route.fulfill({ status: 422, json: { error: 'Confira seu e-mail e senha.' } });
  });
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill('teste@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha-apenas-de-teste');
  await page.getByRole('button', { name: 'Entrar no meu espaço', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Entrando…', exact: true })).toBeDisabled();
  finish();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Confira seu e-mail e senha.');
  await expect(page.getByRole('main').getByRole('alert')).toBeFocused();
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('teste@example.com');
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('senha-apenas-de-teste');
  await expect(page.getByRole('button', { name: 'Entrar no meu espaço', exact: true })).toBeEnabled();
});

test('menu móvel prende o foco, fecha com Escape e a fila mantém informações sem rolagem lateral', async ({ page, request, context }) => {
  await request.post('/api/consentimento/cookies', { data: { optional: false } });
  await request.post('/api/auth', { data: { action: 'demo' } });
  await context.addCookies((await request.storageState()).cookies);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/e/aurora/chamados');
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Navegação do espaço' });
  await expect(drawer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fechar menu', exact: true })).toBeFocused();
  await drawer.getByRole('button', { name: 'Sair da conta', exact: true }).focus();
  await page.keyboard.press('Tab');
  expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir navegação', exact: true })).toBeFocused();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.locator('tbody tr').first().getByText('Não atribuído', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('textbox', { name: 'Buscar chamados' }).fill('sem-resultado-para-teste');
  await expect(page.getByRole('heading', { name: 'Nenhum chamado por aqui.' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await expect(page).toHaveURL(/\/e\/aurora\/chamados$/);
  await expect(page.locator('tbody tr')).toHaveCount(6);
});
