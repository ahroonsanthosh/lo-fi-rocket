/**
 * The distributable server (plan 0062 part 3): one self-contained Node file, and the Claude
 * Desktop extension (`.mcpb`, manifest version 0.3 of @anthropic-ai/mcpb) that wraps it. Nothing
 * is fetched at install or run time; the user runs exactly the file the site publishes, and its
 * SHA-256 is published beside it.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';
import { defineConfig, type Plugin } from 'vite';
import { SERVER_VERSION } from './src/version.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'dist');
export const BUNDLE = 'lo-fi-rocket-mcp.mjs';
export const EXTENSION = 'lo-fi-rocket.mcpb';

/** The extension's manifest (schema: @anthropic-ai/mcpb mcpb-manifest-v0.3; checked by the smoke test). */
export const MANIFEST = {
  manifest_version: '0.3',
  name: 'lo-fi-rocket',
  display_name: 'Lo-Fi Rocket',
  version: SERVER_VERSION,
  description:
    'Model and simulate model and high-power rockets: Claude builds the design, the engine computes every number with sourced physics.',
  long_description:
    'A local rocket design and flight simulator. Paste a specification, a parts list or a file (OpenRocket .ork, RASAero II .CDX1, RASP .eng, RockSim .rse) and Claude builds and flies it in one step, using the ThrustCurve.org catalogue for motors it does not have, then reports stability, flight, landing and Monte Carlo dispersion with every approximation and a confidence rating. Runs on your computer; it reads and writes no files and contacts only ThrustCurve.org.',
  author: {
    name: 'Lo-Fi Rocket contributors',
    url: 'https://github.com/ahroonsanthosh/lo-fi-rocket',
  },
  homepage: 'https://ahroonsanthosh.github.io/lo-fi-rocket/',
  repository: { type: 'git', url: 'https://github.com/ahroonsanthosh/lo-fi-rocket' },
  server: {
    type: 'node',
    entry_point: 'server/index.mjs',
    mcp_config: { command: 'node', args: ['${__dirname}/server/index.mjs'] },
  },
  keywords: ['rocketry', 'model rocket', 'simulation', 'openrocket'],
  compatibility: { platforms: ['darwin', 'win32', 'linux'], runtimes: { node: '>=18.0.0' } },
};

/** After the build: the `.mcpb` and the checksums file. */
const packExtension: Plugin = {
  name: 'lo-fi-rocket-mcpb',
  apply: 'build',
  closeBundle() {
    const server = readFileSync(join(OUT, BUNDLE));
    const extension = zipSync(
      {
        'manifest.json': strToU8(`${JSON.stringify(MANIFEST, null, 2)}\n`),
        'server/index.mjs': server,
      },
      // A fixed date keeps the archive identical for identical sources (CLAUDE.md 5, determinism).
      { level: 9, mtime: new Date('2026-01-01T00:00:00Z') },
    );
    writeFileSync(join(OUT, EXTENSION), extension);
    const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');
    writeFileSync(
      join(OUT, 'SHA256SUMS'),
      `${sha(server)}  ${BUNDLE}\n${sha(extension)}  ${EXTENSION}\n`,
    );
  },
};

export default defineConfig({
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: 'src/main.ts',
    outDir: OUT,
    emptyOutDir: true,
    target: 'node18',
    minify: false,
    sourcemap: false,
    rolldownOptions: {
      output: { entryFileNames: BUNDLE, banner: '#!/usr/bin/env node' },
    },
  },
  plugins: [packExtension],
});
