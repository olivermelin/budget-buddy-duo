import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';

function getSupabaseRef(): string {
  const urlFromEnv = process.env.VITE_SUPABASE_URL;
  if (urlFromEnv) {
    return urlFromEnv.match(/https?:\/\/([^.\s]+)\.supabase\.co/)?.[1] ?? 'local';
  }
  try {
    const file = existsSync('.env.local') ? '.env.local' : '.env';
    const content = readFileSync(file, 'utf8');
    return content.match(/VITE_SUPABASE_URL=https?:\/\/([^.\s]+)\.supabase\.co/)?.[1] ?? 'local';
  } catch {
    return 'local';
  }
}

process.env.SUPABASE_PROJECT_REF = getSupabaseRef();

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
