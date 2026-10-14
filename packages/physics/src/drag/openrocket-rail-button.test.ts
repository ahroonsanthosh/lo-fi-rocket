/**
 * DRAG-23 (plan 0071, D-108): OpenRocket 24.12's rail button drag, reproduced from the table of its
 * measured coefficients, against OpenRocket's own figures for buttons kept out of the table
 * (reference/rockets/drag-probe/).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import {
  openRocketRailButtonCoefficient,
  openRocketRailButtonDrag,
} from './openrocket-rail-button.js';
import { OPENROCKET_RAIL_BUTTON_TABLE } from './openrocket-rail-button-table.js';

const PROBE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'reference',
  'rockets',
  'drag-probe',
);

/** OpenRocket's kinematic viscosity at its static conditions, 293.15 K and 101325 Pa (values.txt). */
const NU_OPENROCKET = 1.52562878e-5;

type Row = Record<string, string>;
function csv(name: string): Row[] {
  const [head, ...lines] = readFileSync(join(PROBE, name), 'utf8').trim().split('\n');
  const keys = (head ?? '').split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [keys[i] ?? '', v])));
}
const num = (r: Row, k: string): number => Number(r[k]);

/** OpenRocket's C_D·A for the row's buttons, and ours for the same buttons. */
function both(r: Row, nu = NU_OPENROCKET): { openrocket: number; ours: number } {
  const front = num(r, 'noseLength') + num(r, 'x');
  const ours = openRocketRailButtonDrag({
    outerDiameter: num(r, 'od'),
    innerDiameter: num(r, 'id'),
    totalHeight: num(r, 'height'),
    baseHeight: num(r, 'base'),
    flangeHeight: num(r, 'flange'),
    positions: Array.from({ length: num(r, 'count') }, (_, i) => front + i * num(r, 'separation')),
    mach: num(r, 'mach'),
    reynoldsPerMetre: num(r, 'velocity') / nu,
  });
  return { openrocket: num(r, 'deltaCd') * num(r, 'refArea'), ours: ours.cdA };
}

describe('DRAG-23 table lookup', () => {
  it('returns the tabulated value at a node, and interpolates log-log between nodes by hand', () => {
    const [mach, row] = OPENROCKET_RAIL_BUTTON_TABLE[7] ?? [0, []];
    const a = row[20];
    const b = row[21];
    if (a === undefined || b === undefined) throw new Error('table too short');
    expect(openRocketRailButtonCoefficient(mach, a[0])).toBeCloseTo(a[1], 12);
    // Halfway in ln η, K is the geometric mean of the two nodes.
    const mid = Math.sqrt(a[0] * b[0]);
    expect(openRocketRailButtonCoefficient(mach, mid)).toBeCloseTo(Math.sqrt(a[1] * b[1]), 12);
  });

  it('is linear in Mach between rows, and holds the end rows outside them', () => {
    const [m0, r0] = OPENROCKET_RAIL_BUTTON_TABLE[10] ?? [0, []];
    const [m1, r1] = OPENROCKET_RAIL_BUTTON_TABLE[11] ?? [0, []];
    const eta = 1.5;
    const k0 = openRocketRailButtonCoefficient(m0, eta);
    const k1 = openRocketRailButtonCoefficient(m1, eta);
    expect(r0.length > 0 && r1.length > 0).toBe(true);
    expect(openRocketRailButtonCoefficient(0.25 * m0 + 0.75 * m1, eta)).toBeCloseTo(
      0.25 * k0 + 0.75 * k1,
      12,
    );
    const [first] = OPENROCKET_RAIL_BUTTON_TABLE[0] ?? [0];
    expect(openRocketRailButtonCoefficient(0, eta)).toBe(
      openRocketRailButtonCoefficient(first, eta),
    );
    expect(openRocketRailButtonCoefficient(9, eta)).toBe(openRocketRailButtonCoefficient(5, eta));
  });

  it('grows as η² below the table and is held above it', () => {
    const [mach, row] = OPENROCKET_RAIL_BUTTON_TABLE[5] ?? [0, []];
    const first = row[0];
    const last = row[row.length - 1];
    if (first === undefined || last === undefined) throw new Error('empty row');
    expect(openRocketRailButtonCoefficient(mach, first[0] / 4)).toBeCloseTo(first[1] / 16, 14);
    expect(openRocketRailButtonCoefficient(mach, last[0] * 10)).toBe(last[1]);
  });
});

describe('DRAG-23 against OpenRocket 24.12', () => {
  it('the frontal area is OD (base + flange) + ID (height − base − flange), by hand', () => {
    // 10 mm outer, 6 mm inner, 10 mm tall with a 2 mm base and a 2 mm flange: 10 × 4 + 6 × 6 =
    // 76 mm² per button, two buttons.
    const r = openRocketRailButtonDrag({
      outerDiameter: 0.01,
      innerDiameter: 0.006,
      totalHeight: 0.01,
      baseHeight: 0.002,
      flangeHeight: 0.002,
      positions: [0.3, 0.4],
      mach: 0.3,
      reynoldsPerMetre: 1e6,
    });
    expect(r.area).toBeCloseTo(2 * 76e-6, 15);
  });

  it('reproduces 80 random buttons held out of the table within 1 % (observed 0.82 %)', () => {
    const checks = csv('rail-button-table.csv').filter((r) => r['tag'] === 'check');
    expect(checks).toHaveLength(80);
    for (const r of checks) {
      const { openrocket, ours } = both(r);
      expect(Math.abs(ours / openrocket - 1)).toBeLessThan(0.01);
    }
  });

  it('reproduces the table rows themselves to their printed digits', () => {
    for (const r of csv('rail-button-table.csv').filter((x) => x['tag'] === 'table')) {
      const { openrocket, ours } = both(r);
      expect(Math.abs(ours / openrocket - 1)).toBeLessThan(2e-4);
    }
  });

  it('reproduces the sweeps of position, Mach, size, count and body, within 1 %', () => {
    // protuberance-sweeps.csv: every button row whose buttons all sit on the body tube.
    const rows = csv('protuberance-sweeps.csv').filter(
      (r) =>
        r['kind'] === 'button' &&
        num(r, 'x') + (num(r, 'count') - 1) * num(r, 'separation') + num(r, 'od') <=
          num(r, 'bodyLength'),
    );
    expect(rows.length).toBeGreaterThan(80);
    for (const r of rows) {
      const { openrocket, ours } = both(r);
      expect(Math.abs(ours / openrocket - 1), `${r['tag'] ?? ''} ${r['mach'] ?? ''}`).toBeLessThan(
        0.01,
      );
    }
  });

  it('follows the Reynolds number when the air is colder or warmer, within 1 %', () => {
    // rail-button-temperature.csv: the same button at 263.15, 293.15 and 313.15 K, each row with
    // OpenRocket's viscosity for that temperature.
    const rows = csv('rail-button-temperature.csv');
    expect(rows).toHaveLength(6);
    for (const r of rows) {
      const { openrocket, ours } = both(r, num(r, 'nu'));
      expect(Math.abs(ours / openrocket - 1)).toBeLessThan(0.01);
    }
  });

  it('gives no drag at rest and refuses a button ahead of the nose tip', () => {
    const at = (reynoldsPerMetre: number, positions: number[]): number =>
      openRocketRailButtonDrag({
        outerDiameter: 0.01,
        innerDiameter: 0.006,
        totalHeight: 0.01,
        baseHeight: 0.002,
        flangeHeight: 0.002,
        positions,
        mach: 0,
        reynoldsPerMetre,
      }).cdA;
    expect(at(0, [0.3])).toBe(0);
    expect(() => at(1e6, [0])).toThrow(InvalidInputError);
  });
});
