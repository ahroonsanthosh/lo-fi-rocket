/**
 * The Content-Security-Policy lists every outside host the code contacts and nothing looser
 * (plan 0061 step 1, D-090).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONNECT_HOSTS, CONTENT_SECURITY_POLICY } from './content-security-policy.js';

const PACKAGES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const directive = (name: string): string[] =>
  CONTENT_SECURITY_POLICY.split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.split(' ')
    .slice(1) ?? [];

describe('CONTENT_SECURITY_POLICY', () => {
  it('lists every https origin quoted in the source of the packages the page bundles', () => {
    const origins = new Set<string>();
    for (const pkg of ['physics', 'formats', 'viewer', 'ui', 'app']) {
      for (const file of sources(join(PACKAGES, pkg, 'src'))) {
        if (file.endsWith('content-security-policy.ts')) continue;
        for (const m of readFileSync(file, 'utf8').matchAll(/['"`](https:\/\/[^/'"`$\s]+)/g)) {
          if (m[1] !== undefined) origins.add(m[1]);
        }
      }
    }
    // The six services in CONNECT_HOSTS today (ThrustCurve, Nominatim, four tile hosts).
    expect([...origins].sort()).toEqual(Object.keys(CONNECT_HOSTS).sort());
    for (const origin of origins) expect(directive('connect-src')).toContain(origin);
  });

  it('runs only its own scripts and allows no plugins, base change or form submission', () => {
    expect(directive('default-src')).toEqual(["'none'"]);
    expect(directive('script-src')).toEqual(["'self'"]);
    expect(directive('worker-src')).toEqual(["'self'"]);
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('base-uri')).toEqual(["'none'"]);
    expect(directive('form-action')).toEqual(["'none'"]);
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    // It is written into an attribute in double quotes.
    expect(CONTENT_SECURITY_POLICY).not.toContain('"');
  });
});
