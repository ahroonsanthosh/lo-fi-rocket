/**
 * The DATCOM body chart tables in the physics package equal the merged file
 * `reference/digitised/datcom-body-charts.json` (D-064).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONE_CYLINDER_CN_ALPHA,
  CONE_CYLINDER_XCP,
  OGIVE_CYLINDER_CN_ALPHA,
  OGIVE_CYLINDER_XCP,
  type BodyChartCurve,
} from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';

const FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'digitised',
  'datcom-body-charts.json',
);
interface Curve {
  parameter: number;
  uncertainty: number;
  points: number[][];
}
interface File {
  charts: Record<string, Record<string, Curve>>;
}

describe('DATCOM body charts against the digitised file', () => {
  const data = JSON.parse(readFileSync(FILE, 'utf8')) as File;
  const pairs: [string, readonly BodyChartCurve[]][] = [
    ['21a_ogive_cna', OGIVE_CYLINDER_CN_ALPHA],
    ['21b_cone_cna', CONE_CYLINDER_CN_ALPHA],
    ['23a_ogive_xcp', OGIVE_CYLINDER_XCP],
    ['23b_cone_xcp', CONE_CYLINDER_XCP],
  ];
  for (const [name, table] of pairs) {
    it(`${name} matches`, () => {
      const curves = Object.values(data.charts[name] ?? {}).sort(
        (a, b) => a.parameter - b.parameter,
      );
      expect(curves.map((c) => c.parameter)).toEqual(table.map((c) => c.parameter));
      curves.forEach((c, i) => {
        const t = table[i];
        if (t === undefined) throw new Error('missing');
        expect(t.uncertainty).toBe(c.uncertainty);
        expect(t.points.map((p) => [p[0], p[1]])).toEqual(c.points);
      });
    });
  }
});
