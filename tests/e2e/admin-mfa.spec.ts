import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Playwright also records a DOM error-context snapshot even when trace is off.
// Clear the sensitive setup screen before fixture teardown can snapshot it.
test.afterEach(async ({ page }) => {
  await page.goto('about:blank');
});

// RFC 6238, test-only. Production delegates code validation to Supabase Auth.
function totp(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret.toUpperCase().replace(/=+$/, '')]
    .map((char) => {
      const index = alphabet.indexOf(char);
      if (index < 0) throw new Error('Chave TOTP sintética inválida.');
      return index.toString(2).padStart(5, '0');
    })
    .join('');
  const bytes = bits.match(/.{8}/g)?.map((byte) => parseInt(byte, 2)) ?? [];
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

test('administrador precisa confirmar TOTP e uma nova sessão volta a exigir o código', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/login');
  const origin = new URL(page.url()).origin;
  const headers = { Origin: origin };
  const login = (email: string) =>
    page.request.post('/api/auth', {
      headers,
      data: { action: 'login', email, password: process.env.DEMO_PASSWORD },
    });
  expect((await login('marina@aurora.example')).ok()).toBe(true);
  expect((await page.request.get('/api/conta/mfa')).status()).toBe(403);
  expect(
    (await page.request.post('/api/conta/mfa', { headers, data: { action: 'enroll' } })).status(),
  ).toBe(403);
  expect((await login('mfa-admin@security.example')).ok()).toBe(true);

  const deniedMutation = await page.request.post('/api/privacidade', {
    headers,
    data: {
      action: 'answer',
      id: '24ebfb52-49c9-46bb-8d2f-06068b090c82',
      status: 'answered',
      response: 'Resposta sintética sem segundo fator.',
    },
  });
  expect(deniedMutation.status()).toBe(403);
  expect(await deniedMutation.json()).toEqual({
    error: 'Confirme o segundo fator para acessar a administração.',
  });

  await page.goto('/admin/privacidade');
  await expect(page.getByRole('link', { name: 'Confirmar segundo fator' })).toBeVisible();
  await page.getByRole('link', { name: 'Confirmar segundo fator' }).click();
  await expect(page.getByRole('heading', { name: 'Segurança da administração' })).toBeVisible();
  await page.getByRole('button', { name: 'Cadastrar autenticador' }).click();
  await expect(page.getByRole('textbox', { name: 'Chave de configuração' })).toBeVisible();
  const secret = await page.getByRole('textbox', { name: 'Chave de configuração' }).inputValue();
  // Read the synthetic secret only in memory; traces, screenshots and video are disabled.
  await expect(
    page.getByRole('img', { name: 'QR code para configurar o autenticador' }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: 'QR code para configurar o autenticador' })
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByRole('textbox', { name: 'Código de seis dígitos' }).fill(totp(secret));
  await page.getByRole('button', { name: 'Confirmar código' }).click();
  await expect(page.getByRole('link', { name: 'Ir para a administração' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Chave de configuração' })).toHaveCount(0);
  const elevated = await page.request.get('/api/conta/mfa');
  expect(elevated.headers()['cache-control']).toContain('no-store');
  const status = await elevated.json();
  expect(status.verified).toBe(true);
  expect(status).not.toHaveProperty('secret');
  const removal = await page.request.post('/api/conta/mfa', {
    headers,
    data: { action: 'cancel', factorId: status.factors[0].id },
  });
  expect(removal.status()).toBe(403);
  await page.getByRole('link', { name: 'Ir para a administração' }).click();
  await expect(
    page.getByText('Fila restrita ao administrador geral.', { exact: false }),
  ).toBeVisible();

  await page.request.post('/api/auth', { headers, data: { action: 'logout' } });
  expect((await login('mfa-admin@security.example')).ok()).toBe(true);
  const settings = await page.request.get('/api/conta/configuracoes');
  expect(settings.ok()).toBe(true);
  const { preferences } = await settings.json();
  const locale = await page.request.patch('/api/conta/preferencias', {
    headers,
    data: { patch: { locale: 'en' }, version: preferences.version },
  });
  expect(locale.ok()).toBe(true);
  await page.goto('/admin/privacidade');
  await page.getByRole('link', { name: 'Confirm second factor' }).click();
  await expect(page.getByRole('heading', { name: 'Administration security' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Setup key' })).toHaveCount(0);
  const before = await page.request.get('/api/conta/mfa');
  expect((await before.json()).verified).toBe(false);
  // Avoid reusing the enrollment time-step code: some providers reject replay.
  await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 1_000);
  await page.getByRole('textbox', { name: 'Six-digit code' }).fill(totp(secret));
  await page.getByRole('button', { name: 'Confirm code' }).click();
  await expect(page.getByRole('link', { name: 'Go to administration' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
