/**
 * The DATCOM large-angle chart tables in the physics package equal
 * reference/digitised/datcom-large-angle-charts.json (plan 0033, D-070).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as physics from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';

const FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'digitised',
  'datcom-large-angle-charts.json',
);
interface Curve {
  points: number[][];
  uncertainty: number;
}
interface Chart extends Partial<Curve> {
  curves?: Record<string, Curve>;
  left_until?: number;
  left?: Record<string, Curve>;
  right?: Record<string, Curve>;
}
const charts = (JSON.parse(readFileSync(FILE, 'utf8')) as { charts: Record<string, Chart> }).charts;

type Labelled = readonly physics.LabelledCurve[];
const plain = (p: physics.ChartPoints): number[][] => p.map((q) => [q[0], q[1]]);
const family = (
  c: Record<string, Curve>,
): { label: number; uncertainty: number; points: number[][] }[] =>
  Object.entries(c)
    .map(([k, v]) => ({ label: Number(k), uncertainty: v.uncertainty, points: v.points }))
    .sort((a, b) => a.label - b.label);
const asPlain = (l: Labelled): { label: number; uncertainty: number; points: number[][] }[] =>
  l.map((c) => ({ label: c.label, uncertainty: c.uncertainty, points: plain(c.points) }));

const SINGLE: [physics.ChartPoints, string][] = [
  [physics.DATCOM_FIGURE_4212_35A, '4.2.1.2-35a'],
  [physics.DATCOM_FIGURE_4212_35B, '4.2.1.2-35b'],
  [physics.DATCOM_FIGURE_4133_55A_D, '4.1.3.3-55a-right'],
  [physics.DATCOM_FIGURE_4133_55B, '4.1.3.3-55b'],
  [physics.DATCOM_FIGURE_4134_24B_C1, '4.1.3.4-24b-C1'],
  [physics.DATCOM_FIGURE_4134_24B_C2, '4.1.3.4-24b-C2'],
  [physics.DATCOM_FIGURE_4134_25A, '4.1.3.4-25a'],
  [physics.DATCOM_FIGURE_4143_21A, '4.1.4.3-21a'],
  [physics.DATCOM_FIGURE_4143_21B, '4.1.4.3-21b'],
];
const FAMILIES: [Labelled, string][] = [
  [physics.DATCOM_FIGURE_4133_55A, '4.1.3.3-55a-left'],
  [physics.DATCOM_FIGURE_4134_24A, '4.1.3.4-24a'],
  [physics.DATCOM_FIGURE_4143_22A, '4.1.4.3-22a'],
  [physics.DATCOM_FIGURE_4143_22B, '4.1.4.3-22b'],
  [physics.DATCOM_FIGURE_4143_23A, '4.1.4.3-23a'],
  [physics.DATCOM_FIGURE_4143_23B, '4.1.4.3-23b'],
  [physics.DATCOM_FIGURE_4143_24A, '4.1.4.3-24a'],
  [physics.DATCOM_FIGURE_4143_24B_PRE, '4.1.4.3-24b-pre'],
  [physics.DATCOM_FIGURE_4143_24B_POST, '4.1.4.3-24b-post'],
];
const TWO: [physics.TwoFamilyChart, string][] = [
  [physics.DATCOM_FIGURE_4134_23A, '4.1.3.4-23a'],
  [physics.DATCOM_FIGURE_4134_23B, '4.1.3.4-23b'],
  [physics.DATCOM_FIGURE_4134_25B, '4.1.3.4-25b'],
];

describe('DATCOM large-angle charts against the digitised file', () => {
  it('every chart of the file is in the physics tables, value for value', () => {
    const covered = new Set([...SINGLE, ...FAMILIES, ...TWO].map(([, k]) => k));
    expect([...covered].sort()).toEqual(Object.keys(charts).sort());
    for (const [table, key] of SINGLE) expect(plain(table)).toEqual(charts[key]?.points);
    for (const [table, key] of FAMILIES)
      expect(asPlain(table)).toEqual(family(charts[key]?.curves ?? {}));
    for (const [table, key] of TWO) {
      const c = charts[key];
      expect(table.leftUntil).toBe(c?.left_until);
      expect(asPlain(table.left)).toEqual(family(c?.left ?? {}));
      expect(asPlain(table.right)).toEqual(family(c?.right ?? {}));
    }
  });
  it('every curve is sorted by abscissa', () => {
    const all = [
      ...SINGLE.map(([t]) => t),
      ...FAMILIES.flatMap(([t]) => t.map((c) => c.points)),
      ...TWO.flatMap(([t]) => [...t.left, ...t.right].map((c) => c.points)),
    ];
    for (const p of all)
      for (let i = 1; i < p.length; i++) expect(p[i]![0]).toBeGreaterThanOrEqual(p[i - 1]![0]);
  });
});
