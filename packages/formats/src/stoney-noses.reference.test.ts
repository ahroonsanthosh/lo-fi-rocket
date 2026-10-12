/**
 * The transcribed curves in the physics package equal the merged digitisation
 * file `reference/digitised/tr-r-100-figure-12.json` (D-055): every point, the
 * uncertainty and the panel. The physics package stays free of file I/O, so the
 * check lives here.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STONEY_NOSES, type StoneyNose } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';

const FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'digitised',
  'tr-r-100-figure-12.json',
);

interface MergedPoint {
  mach: number;
  value: number;
  pass1: number | null;
  pass2: number;
  disagreement: number | null;
}
interface MergedCurve {
  panel: string;
  uncertainty: number;
  worst_disagreement: number;
  points: MergedPoint[];
}
interface Merged {
  curves: Record<string, MergedCurve>;
}

/** Physics key → merged file key. */
const KEYS: Record<StoneyNose, string> = {
  cone: 'cone',
  'power-1/4': 'power-1/4',
  'power-1/2': 'power-1/2',
  'power-3/4': 'power-3/4',
  'parabola-1/2': 'parabola-1/2',
  'parabola-3/4': 'parabola-3/4',
  parabola: 'parabola',
  'von-karman': 'von-karman-a',
  'lv-haack': 'lv-haack',
  ellipsoid: 'ellipsoid',
};

describe('STONEY_NOSES against reference/digitised/tr-r-100-figure-12.json', () => {
  const merged = JSON.parse(readFileSync(FILE, 'utf8')) as Merged;
  for (const [key, fileKey] of Object.entries(KEYS) as [StoneyNose, string][]) {
    it(`${key} equals the merged curve ${fileKey}`, () => {
      const curve = merged.curves[fileKey];
      expect(curve).toBeDefined();
      if (curve === undefined) return;
      const ours = STONEY_NOSES[key];
      expect(ours.panel).toBe(curve.panel === 'b' ? 'b' : 'a');
      expect(ours.uncertainty).toBe(curve.uncertainty);
      expect(ours.points.map(([m, v]) => [m, v])).toEqual(
        curve.points.map((p) => [p.mach, p.value]),
      );
      // The file's own bookkeeping: the mean of the passes and the uncertainty rule.
      for (const p of curve.points) {
        if (p.pass1 !== null) {
          // The file rounds to four decimals, so the mean may differ by half a unit in the last place.
          expect(Math.abs(p.value - (p.pass1 + p.pass2) / 2)).toBeLessThanOrEqual(5.001e-5);
          expect(Math.abs((p.disagreement ?? 0) - Math.abs(p.pass1 - p.pass2))).toBeLessThanOrEqual(
            5.001e-5,
          );
        }
      }
      expect(curve.uncertainty).toBeCloseTo(Math.max(curve.worst_disagreement / 2, 0.005), 4);
      // Increasing Mach, every value within the axis range.
      for (let i = 1; i < ours.points.length; i += 1) {
        const a = ours.points[i - 1];
        const b = ours.points[i];
        if (a !== undefined && b !== undefined) expect(b[0]).toBeGreaterThan(a[0]);
      }
      for (const [, v] of ours.points) expect(v).toBeGreaterThanOrEqual(0);
    });
  }
});
