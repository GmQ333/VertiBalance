import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4180',
    channel: 'msedge',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/start-e2e.mjs',
    url: 'http://127.0.0.1:4180/api/v1/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-edge', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-edge', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
