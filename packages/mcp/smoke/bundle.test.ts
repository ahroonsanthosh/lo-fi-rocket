/**
 * The distributable files (plan 0062 part 3), after `pnpm --filter @lo-fi-rocket/mcp build`:
 * the single-file server answers over stdio as Claude Code runs it, and the `.mcpb` passes the
 * official manifest validator and runs as Claude Desktop runs it.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest } from '@anthropic-ai/mcpb';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const BUNDLE = join(DIST, 'lo-fi-rocket-mcp.mjs');
const EXTENSION = join(DIST, 'lo-fi-rocket.mcpb');

async function talk(
  command: string,
  args: string[],
): Promise<{ tools: string[]; apogee: unknown }> {
  const client = new Client({ name: 'smoke', version: '0' });
  await client.connect(new StdioClientTransport({ command, args, stderr: 'pipe' }));
  try {
    const { tools } = await client.listTools();
    const created = await client.callTool({
      name: 'new_design',
      arguments: { name: 'Smoke', from: 'example' },
    });
    const id = (
      JSON.parse((created.content as { text: string }[])[0]?.text ?? '{}') as { id: string }
    ).id;
    const flown = await client.callTool({ name: 'simulate', arguments: { designId: id } });
    const summary = JSON.parse((flown.content as { text: string }[])[0]?.text ?? '{}') as {
      summary?: { apogee_m?: unknown };
    };
    return { tools: tools.map((t) => t.name), apogee: summary.summary?.apogee_m };
  } finally {
    await client.close();
  }
}

describe('the built server', () => {
  it('runs with node alone, lists its tools and flies the example', async () => {
    const out = await talk(process.execPath, [BUNDLE]);
    expect(out.tools).toHaveLength(23);
    expect(typeof out.apogee).toBe('number');
  });

  it('has its checksums published beside it', () => {
    const sums = readFileSync(join(DIST, 'SHA256SUMS'), 'utf8');
    const sha = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex');
    expect(sums).toBe(
      `${sha(BUNDLE)}  lo-fi-rocket-mcp.mjs\n${sha(EXTENSION)}  lo-fi-rocket.mcpb\n`,
    );
  });
});

describe('the Claude Desktop extension', () => {
  const files = unzipSync(new Uint8Array(readFileSync(EXTENSION)));

  it('holds the manifest and the same server file, and the manifest passes @anthropic-ai/mcpb', () => {
    expect(Object.keys(files).sort()).toEqual(['manifest.json', 'server/index.mjs']);
    expect(
      Buffer.from(files['server/index.mjs'] ?? new Uint8Array()).equals(readFileSync(BUNDLE)),
    ).toBe(true);
    const dir = mkdtempSync(join(tmpdir(), 'mcpb-'));
    writeFileSync(join(dir, 'manifest.json'), files['manifest.json'] ?? new Uint8Array());
    expect(validateManifest(join(dir, 'manifest.json'))).toBe(true);
  });

  it('runs as Claude Desktop runs it, from the unpacked folder', async () => {
    const manifest = JSON.parse(strFromU8(files['manifest.json'] ?? new Uint8Array())) as {
      server: { mcp_config: { command: string; args: string[] } };
    };
    const dir = mkdtempSync(join(tmpdir(), 'mcpb-run-'));
    mkdirSync(join(dir, 'server'));
    writeFileSync(join(dir, 'server', 'index.mjs'), files['server/index.mjs'] ?? new Uint8Array());
    expect(manifest.server.mcp_config.command).toBe('node');
    const args = manifest.server.mcp_config.args.map((a) => a.replace('${__dirname}', dir));
    const out = await talk(process.execPath, args);
    expect(out.tools).toHaveLength(23);
  });
});
