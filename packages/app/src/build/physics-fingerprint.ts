/**
 * Build provenance for simulation results (plan 0024 addendum, D-061).
 *
 * Run by the Vite and Vitest configurations in Node, never in the browser:
 * the app version from packages/app/package.json, and a SHA-256 over the
 * source of every non-test file under packages/physics/src and
 * packages/formats/src (path and content, in sorted path order). The
 * formats package is included because the design-to-physics adapter and
 * the Monte Carlo perturbation live there; a change to either can change a
 * replayed flight as much as a change to the physics itself.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface BuildProvenance {
  /** The app's package version. */
  readonly appVersion: string;
  /** SHA-256 (hex) of the physics and formats sources. */
  readonly physicsHash: string;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

/** SHA-256 over the non-test .ts files of the given source directories, relative to `root`. */
export function sourceHash(root: string, dirs: readonly string[]): string {
  const files = dirs
    .flatMap((d) => sourceFiles(join(root, d)))
    .map((p) => ({ path: relative(root, p).split(sep).join('/'), abs: p }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (files.length === 0) throw new Error(`sourceHash: no source files under ${dirs.join(', ')}`);
  const hash = createHash('sha256');
  for (const f of files) {
    hash.update(f.path);
    hash.update('\0');
    hash.update(readFileSync(f.abs));
    hash.update('\0');
  }
  return hash.digest('hex');
}

/** The provenance of this build; `repoRoot` is the repository root. */
export function buildProvenance(repoRoot: string): BuildProvenance {
  const pkg: unknown = JSON.parse(
    readFileSync(join(repoRoot, 'packages', 'app', 'package.json'), 'utf8'),
  );
  const version =
    typeof pkg === 'object' && pkg !== null && 'version' in pkg && typeof pkg.version === 'string'
      ? pkg.version
      : undefined;
  if (version === undefined)
    throw new Error('buildProvenance: packages/app/package.json has no version');
  return {
    appVersion: version,
    physicsHash: sourceHash(repoRoot, ['packages/physics/src', 'packages/formats/src']),
  };
}
