import { defineConfig, devices } from '@playwright/test';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabase || !['localhost', '127.0.0.1'].includes(new URL(supabase).hostname)
    || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.DEMO_PASSWORD) {
  throw new Error('Configure URL local, chave pública do Supabase e DEMO_PASSWORD.');
}

const origin = 'http://127.0.0.1:3107';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/admin-access.spec.ts',
  workers: 1,
  use: { ...devices['Desktop Chrome'], baseURL: origin, trace: 'off', screenshot: 'off', video: 'off' },
  webServer: {
    command: 'pnpm exec next dev --hostname 127.0.0.1 --port 3107',
    url: origin,
    timeout: 120000,
    env: { NEXT_PUBLIC_SITE_URL: origin, DEMO_MODE: 'false', SUPABASE_SERVICE_ROLE_KEY: '' },
  },
});
