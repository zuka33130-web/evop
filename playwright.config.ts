import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['github'], ['html', { open: 'never' }]],
  use: { launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args:['--no-sandbox','--disable-dev-shm-usage'] } : {}, baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', viewport: { width: 1440, height: 1000 } },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI },
});
