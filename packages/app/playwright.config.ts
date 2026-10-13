import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against the built app (plan 0015). The browser is the
 * Chromium preinstalled in the development container when present
 * (PLAYWRIGHT_CHROMIUM_PATH), otherwise Playwright's own.
 */
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'];

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  // The 3D replay builds its scenery on the main thread; CI has no GPU, so software WebGL holds
  // the page for about 4 s after "Simulate flight" before the results render (issue filed for
  // the 3d lane). The assertions are unchanged; only the wait for them is longer.
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1366, height: 768 },
    ...(executablePath === undefined ? {} : { launchOptions: { executablePath } }),
  },
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
