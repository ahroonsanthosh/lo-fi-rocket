import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';
import { buildProvenance } from './src/build/physics-fingerprint.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export default defineProject({
  // D-072: the same build provenance as the app (vite.config.ts).
  define: { __LOFI_BUILD__: JSON.stringify(buildProvenance(REPO_ROOT)) },
  test: {
    name: 'app',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
