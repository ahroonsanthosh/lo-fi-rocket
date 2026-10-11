/**
 * Golden regression file for the atmosphere (CLAUDE.md section 7.6): the
 * model's outputs at every 1 000 m from −5 000 m to 86 000 m, compared
 * bit-exactly. Regenerate with UPDATE_GOLDEN=1 only when a physics change is
 * intended, and explain the change in the commit message.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { metres } from '../units/si.js';
import {
  USSA1976_MAX_ALTITUDE,
  USSA1976_MIN_ALTITUDE,
  standardAtmosphere1976,
} from './ussa1976.js';

const GOLDEN_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'golden',
  'ussa1976.json',
);

interface GoldenRow {
  readonly z: number;
  readonly h: number;
  readonly tM: number;
  readonly t: number;
  readonly p: number;
  readonly rho: number;
  readonly cs: number;
  readonly mu: number;
  readonly eta: number;
}

function compute(): GoldenRow[] {
  const rows: GoldenRow[] = [];
  for (let z = USSA1976_MIN_ALTITUDE; z <= USSA1976_MAX_ALTITUDE; z += 1000) {
    const s = standardAtmosphere1976(metres(z));
    rows.push({
      z,
      h: s.geopotentialAltitude,
      tM: s.molecularScaleTemperature,
      t: s.temperature,
      p: s.pressure,
      rho: s.density,
      cs: s.speedOfSound,
      mu: s.dynamicViscosity,
      eta: s.kinematicViscosity,
    });
  }
  return rows;
}

describe('USSA1976 golden file', () => {
  it('matches golden/ussa1976.json bit for bit', () => {
    const rows = compute();
    if (process.env['UPDATE_GOLDEN'] === '1') {
      writeFileSync(GOLDEN_PATH, JSON.stringify(rows, null, 2) + '\n');
    }
    const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as GoldenRow[];
    expect(golden.length).toBe(rows.length);
    rows.forEach((row, i) => {
      const g = golden[i]!;
      for (const key of Object.keys(row) as (keyof GoldenRow)[]) {
        expect(Object.is(row[key], g[key]), `${key} at Z = ${String(row.z)} m`).toBe(true);
      }
    });
  });
});
