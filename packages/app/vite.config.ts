import react from '@vitejs/plugin-react';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { CONTENT_SECURITY_POLICY } from './src/build/content-security-policy.js';
import { buildProvenance } from './src/build/physics-fingerprint.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The Content-Security-Policy meta tag, in the built page only (D-090). It goes straight after the
 * charset declaration, before any script or stylesheet, so it governs everything the page loads.
 */
const CHARSET = '<meta charset="UTF-8" />';
const contentSecurityPolicy: Plugin = {
  name: 'lo-fi-rocket-content-security-policy',
  apply: 'build',
  transformIndexHtml: (html) => {
    if (!html.includes(CHARSET)) throw new Error(`index.html has no ${CHARSET}`);
    return html.replace(
      CHARSET,
      `${CHARSET}\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
    );
  },
};

export default defineConfig({
  plugins: [react(), contentSecurityPolicy],
  // D-072: the app version and the physics source hash, stored with every Monte Carlo result.
  define: { __LOFI_BUILD__: JSON.stringify(buildProvenance(REPO_ROOT)) },
});
