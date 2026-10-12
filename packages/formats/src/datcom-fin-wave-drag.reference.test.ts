/**
 * The DATCOM figure 4.1.5.1-29 table in the physics package equals the merged
 * file `reference/digitised/datcom-figure-4-1-5-1-29.json` (D-062): every
 * point and every uncertainty.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATCOM_FIGURE_4151_29 } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';

const FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'digitised',
  'datcom-figure-4-1-5-1-29.json',
);
interface Curve {
  aspect_parameter: number;
  uncertainty: number;
  points: number[][];
}
interface File {
  curves: Record<string, Curve>;
}

describe('DATCOM figure 4.1.5.1-29 table against the digitised file', () => {
  const data = JSON.parse(readFileSync(FILE, 'utf8')) as File;
  it('has the same curves, points and uncertainties', () => {
    const curves = Object.values(data.curves).sort(
      (a, b) => a.aspect_parameter - b.aspect_parameter,
    );
    expect(curves.map((c) => c.aspect_parameter)).toEqual(
      DATCOM_FIGURE_4151_29.map((c) => c.aspectParameter),
    );
    curves.forEach((c, i) => {
      const t = DATCOM_FIGURE_4151_29[i];
      if (t === undefined) throw new Error('missing curve');
      expect(t.uncertainty).toBe(c.uncertainty);
      expect(t.points.map((p) => [p[0], p[1]])).toEqual(c.points);
    });
  });
});
