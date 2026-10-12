/**
 * The DATCOM fin and carry-over chart tables in the physics package equal the
 * digitised files in reference/digitised/ (plan 0028, D-065).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DATCOM_FIGURE_4231_24,
  DATCOM_FIGURE_4132_56,
  DATCOM_FIGURE_4132_56G_LEFT,
  DATCOM_FIGURE_4132_60,
  DATCOM_FIGURE_4312_11A,
  DATCOM_FIGURE_4312_11B,
  DATCOM_FIGURE_4322_37A,
  DATCOM_FIGURE_4322_37B,
  type CarryOverChartCurve,
} from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';

const DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'digitised',
);
const load = (name: string): unknown => JSON.parse(readFileSync(join(DIR, name), 'utf8'));

interface Fig56 {
  panels: Record<
    string,
    {
      taper_ratio: number;
      curves: Record<string, { a_tan_le: number; uncertainty: number; points: number[][] }>;
    }
  >;
  panel_g: { left: { points: number[][] } };
}
interface Fig60 {
  curves: Record<string, { delta_perp_deg: number; points: number[][] }>;
}
interface Fig11 {
  figure_11a: { curves: Record<string, { uncertainty: number; points: number[][] }> };
  figure_11b: { curves: Record<string, { uncertainty: number; points: number[][] }> };
}
interface Fig37 {
  panels: Record<string, { points: number[][] }>;
}

const plain = (p: readonly (readonly [number, number])[]): number[][] => p.map((q) => [q[0], q[1]]);

describe('DATCOM fin charts against the digitised files', () => {
  it('figure 4.1.3.2-56 panels (a), (c), (e), (f) and (g)', () => {
    const f = load('datcom-figure-4-1-3-2-56.json') as Fig56;
    const keys = ['a', 'c', 'e', 'f'];
    expect(DATCOM_FIGURE_4132_56.length).toBe(keys.length);
    keys.forEach((k, i) => {
      const panel = f.panels[k];
      const table = DATCOM_FIGURE_4132_56[i];
      if (panel === undefined || table === undefined) throw new Error(`panel ${k} missing`);
      expect(table.taperRatio).toBe(panel.taper_ratio);
      const curves = Object.values(panel.curves).sort((a, b) => a.a_tan_le - b.a_tan_le);
      expect(table.curves.map((c) => c.aTanLe)).toEqual(curves.map((c) => c.a_tan_le));
      curves.forEach((c, j) => {
        expect(table.curves[j]?.uncertainty).toBe(c.uncertainty);
        expect(plain(table.curves[j]?.points ?? [])).toEqual(c.points);
      });
    });
    expect(plain(DATCOM_FIGURE_4132_56G_LEFT)).toEqual(f.panel_g.left.points);
  });
  it('figure 4.1.3.2-60', () => {
    const f = load('datcom-figure-4-1-3-2-60.json') as Fig60;
    const curves = Object.values(f.curves).sort((a, b) => a.delta_perp_deg - b.delta_perp_deg);
    expect(DATCOM_FIGURE_4132_60.map((c) => c.deltaPerpDeg)).toEqual(
      curves.map((c) => c.delta_perp_deg),
    );
    curves.forEach((c, i) => {
      expect(plain(DATCOM_FIGURE_4132_60[i]?.points ?? [])).toEqual(c.points);
    });
  });
  it('figures 4.3.1.2-11a and -11b', () => {
    const f = load('datcom-figure-4-3-1-2-11.json') as Fig11;
    const check = (
      table: readonly CarryOverChartCurve[],
      curves: Record<string, { uncertainty: number; points: number[][] }>,
    ): void => {
      // JSON.parse puts integer-like keys first; order as the chart does, inf then descending β cot Λ.
      const value = (n: string): number => (n === 'inf' ? Infinity : Number(n));
      const names = Object.keys(curves).sort((a, b) => value(b) - value(a));
      expect(table.map((c) => (c.betaCotLe === Infinity ? 'inf' : String(c.betaCotLe)))).toEqual(
        names.map((n) => (n === 'inf' ? 'inf' : String(Number(n)))),
      );
      names.forEach((n, i) => {
        expect(table[i]?.uncertainty).toBe(curves[n]?.uncertainty);
        expect(plain(table[i]?.points ?? [])).toEqual(curves[n]?.points);
      });
    };
    check(DATCOM_FIGURE_4312_11A, f.figure_11a.curves);
    check(DATCOM_FIGURE_4312_11B, f.figure_11b.curves);
  });
  it('figure 4.3.2.2-37 (a) and (b)', () => {
    const f = load('datcom-figure-4-3-2-2-37.json') as Fig37;
    expect(plain(DATCOM_FIGURE_4322_37A)).toEqual(f.panels['a']?.points);
    expect(plain(DATCOM_FIGURE_4322_37B)).toEqual(f.panels['b']?.points);
  });
});

describe('DATCOM figure 4.2.3.1-24 against the digitised file (D-069)', () => {
  it('six guide curves', () => {
    const f = load('datcom-figure-4-2-3-1-24.json') as {
      curves: Record<string, { start: number; points: number[][] }>;
    };
    const curves = Object.values(f.curves);
    expect(DATCOM_FIGURE_4231_24.map((c) => c.start)).toEqual(curves.map((c) => c.start));
    curves.forEach((c, i) => {
      expect(plain(DATCOM_FIGURE_4231_24[i]?.points ?? [])).toEqual(c.points);
    });
  });
});
