import react from '@vitejs/plugin-react';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { buildProvenance } from './src/build/physics-fingerprint.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export default defineConfig({
  plugins: [react()],
  // D-072: the app version and the physics source hash, stored with every Monte Carlo result.
  define: { __LOFI_BUILD__: JSON.stringify(buildProvenance(REPO_ROOT)) },
});
