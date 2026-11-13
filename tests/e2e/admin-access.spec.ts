import { test, expect } from '@playwright/test';

test('administrador de empresa não acessa a fila global nem responde pedidos', async ({ page }) => {
  const password = process.env.DEMO_PASSWORD;
  if (!password) throw new Error('Defina DEMO_PASSWORD para o Supabase local.');

  await page.goto('/admin/privacidade');
  await expect(page).toHaveURL(/\/login$/);

  const login = await page.request.post('/api/auth', {
    headers: { Origin: new URL(page.url()).origin },
    data: { action: 'login', email: 'marina@aurora.example', password },
  });
  expect(login.ok(), 'A conta de teste precisa autenticar de verdade').toBe(true);

  const origin = new URL(page.url()).origin;
  const ownRequest = await page.request.post('/api/privacidade', {
    headers: { Origin: origin },
    data: { action: 'request', kind: 'access', details: 'Pedido para verificar autorização de resposta.' },
  });
  expect(ownRequest.status()).toBe(201);
  const { id } = await ownRequest.json();

  await page.goto('/admin/privacidade');
  await expect(page.getByRole('heading', { name: 'Este caminho não está disponível.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Atendimento de privacidade' })).toHaveCount(0);

  const answer = await page.request.post('/api/privacidade', {
    headers: { Origin: origin },
    data: { action: 'answer', id, status: 'answered', response: 'Resposta de teste sem autorização global.' },
  });
  expect(answer.status()).toBe(403);

  const snapshot = await page.request.get('/api/privacidade');
  expect(snapshot.ok()).toBe(true);
  expect((await snapshot.json()).requests).toContainEqual(
    expect.objectContaining({ id, status: 'submitted', response: null }),
  );
});
