import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = dirname(fileURLToPath(import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('package boundary (owner rule: display only)', () => {
  it('no source imports the physics or formats packages or reaches into them', () => {
    const offenders = sources(root)
      .filter((p) => !p.endsWith('boundary.test.ts'))
      .filter((p) =>
        /from ['"](@lo-fi-rocket\/(physics|formats)|[./]*\/(physics|formats)\/)/.test(
          readFileSync(p, 'utf8'),
        ),
      );
    expect(offenders).toEqual([]);
  });
  it('package.json depends on neither', () => {
    const pkg = readFileSync(join(root, '../package.json'), 'utf8');
    expect(pkg).not.toContain('@lo-fi-rocket/physics');
    expect(pkg).not.toContain('@lo-fi-rocket/formats');
  });
});
