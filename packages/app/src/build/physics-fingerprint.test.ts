/**
 * The physics source hash (D-061). Expected digests computed independently
 * with Python's hashlib over the same byte sequence:
 *   for (path, content) in sorted files: path + b"\0" + content + b"\0"
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CURRENT_PROVENANCE, describeProvenance, sameProvenance } from './provenance.js';
import { buildProvenance, sourceHash } from './physics-fingerprint.js';

function tree(a: string): string {
  const root = mkdtempSync(join(tmpdir(), 'lofi-hash-'));
  mkdirSync(join(root, 'pkg', 'src', 'sub'), { recursive: true });
  writeFileSync(join(root, 'pkg', 'src', 'a.ts'), a);
  writeFileSync(join(root, 'pkg', 'src', 'sub', 'b.ts'), 'export const b = 2;\n');
  // Test files and other extensions are not part of the physics.
  writeFileSync(join(root, 'pkg', 'src', 'a.test.ts'), 'anything');
  writeFileSync(join(root, 'pkg', 'src', 'notes.md'), 'anything');
  return root;
}

describe('sourceHash', () => {
  it('is the SHA-256 of the sorted non-test sources (hashlib by hand)', () => {
    expect(sourceHash(tree('export const a = 1;\n'), ['pkg/src'])).toBe(
      '6446de58a0bc4c8cb1adff141cb7662b5ad614023c86b52bcbe07a2ca5074c4b',
    );
  });
  it('changes when one source file changes', () => {
    expect(sourceHash(tree('export const a = 3;\n'), ['pkg/src'])).toBe(
      '5d433da7d009f76702e5248e632f6e47e14d86361b2b8e9d6557bd60499c8a5b',
    );
  });
  it('refuses an empty source set', () => {
    const root = mkdtempSync(join(tmpdir(), 'lofi-hash-'));
    mkdirSync(join(root, 'empty'));
    expect(() => sourceHash(root, ['empty'])).toThrow(/no source files/);
  });
});

describe('build provenance', () => {
  it('the running build carries the app version and the hash of the physics and formats sources', () => {
    const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
    const p = buildProvenance(repo);
    expect(CURRENT_PROVENANCE).toEqual(p);
    expect(p.appVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(p.physicsHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it('compares both fields and describes itself', () => {
    const a = { appVersion: '1.0.0', physicsHash: 'a'.repeat(64) };
    expect(sameProvenance(a, { ...a })).toBe(true);
    expect(sameProvenance(a, { ...a, appVersion: '1.0.1' })).toBe(false);
    expect(sameProvenance(a, { ...a, physicsHash: 'b'.repeat(64) })).toBe(false);
    expect(describeProvenance(a)).toBe('app 1.0.0, physics aaaaaaaaaaaa');
  });
});
