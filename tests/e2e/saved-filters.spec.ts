import { expect, test } from '@playwright/test';
import { LEGAL_VERSION } from '../../src/lib/legal';

test('salva filtros entre sessões e recupera conflito sem sobrescrever alterações', async ({ page, browser }) => {
  test.setTimeout(90_000);
  await page.goto('/login');
  const origin = new URL(page.url()).origin;
  const headers = { Origin: origin };
  expect((await page.request.post('/api/auth', { headers, data: {
    action: 'login', email: 'marina@aurora.example', password: process.env.DEMO_PASSWORD,
  } })).ok()).toBe(true);
  expect((await page.request.post('/api/privacidade', { headers, data: {
    action: 'accept_terms', termsAccepted: true, adultConfirmed: true,
    termsVersion: LEGAL_VERSION, privacyVersion: LEGAL_VERSION,
  } })).ok()).toBe(true);
  const settings = await page.request.get('/api/conta/configuracoes');
  const { preferences } = await settings.json();
  if (preferences.locale !== 'en') expect((await page.request.patch('/api/conta/preferencias', {
    headers, data: { patch: { locale: 'en' }, version: preferences.version },
  })).ok()).toBe(true);
  await page.goto('/e/aurora/chamados');
  const panel = page.getByRole('region', { name: 'Saved filters', exact: true });
  await expect(panel.getByText('No saved filters. Choose your queue filters and save a shortcut.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Search tickets', exact: true }).fill('VPN');
  await page.getByRole('combobox', { name: 'Filter priority' }).selectOption('high');
  await page.getByRole('combobox', { name: 'Filter assignee' }).selectOption('me');
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await panel.getByRole('textbox', { name: 'Filter name' }).fill('My triage');
  await panel.getByRole('button', { name: 'Save current filter' }).click();
  await expect(panel.getByText('Saved filters updated.')).toBeVisible();
  await page.reload();
  await expect(panel.getByRole('button', { name: 'My triage', exact: true })).toBeVisible();

  const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await other.addCookies(await page.context().cookies());
    const mobile = await other.newPage();
    await mobile.goto(origin + '/e/aurora/chamados');
    await mobile.getByRole('button', { name: 'My triage', exact: true }).click();
    await expect(mobile.getByRole('combobox', { name: 'Filter assignee' })).toHaveValue('me');
    await expect(mobile.getByRole('textbox', { name: 'Search tickets', exact: true })).toHaveValue('VPN');
    await expect(mobile.getByRole('combobox', { name: 'Filter priority' })).toHaveValue('high');
    await expect(mobile).toHaveURL(/assignee=me/);
    expect(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    const endpoint = '/api/empresas/aurora/filtros-salvos';
    const snapshot = await page.request.get(endpoint);
    expect(snapshot.headers()['cache-control']).toContain('no-store');
    const state = await snapshot.json();
    const changed = await mobile.request.put(origin + endpoint, { headers, data: { filters: state.filters, version: state.version } });
    expect(changed.ok()).toBe(true);
    // The desktop component still has the previous version.
    page.once('dialog', dialog => dialog.accept());
    await panel.getByRole('button', { name: 'Remove filter My triage' }).click();
    await expect(panel.getByRole('alert')).toHaveText('Filters changed in another session. Reload before saving.');
    await panel.getByRole('button', { name: 'Reload filters' }).click();
    await expect(panel.getByRole('button', { name: 'My triage', exact: true })).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await panel.getByRole('button', { name: 'Remove filter My triage' }).click();
    await expect(panel.getByText('No saved filters. Choose your queue filters and save a shortcut.')).toBeVisible();
  } finally { await other.close(); }
});
