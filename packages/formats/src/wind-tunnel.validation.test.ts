/**
 * Wind tunnel validation (CLAUDE.md 6.7 item 1, plan 0021, D-056): the model's
 * CP and C_D against the held-out data of NASA TN D-4013, TN D-4014 (ARCAS)
 * and NACA RM A53D02, digitised in `reference/digitised/wind-tunnel-validation.json`.
 * The data are never used to build or tune the model; this file only
 * measures. The assertions pin the reported errors so that a physics change
 * that moves them is flagged (CLAUDE.md 7.6); the tables are printed for
 * `docs/reports/wind-tunnel-validation.md`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARCAS_BODY_LENGTH_INCHES,
  ARCAS_COMPONENTS,
  ARCAS_REYNOLDS,
  centreOfPressure,
  DEFAULT_TRANSONIC_FIN_INTERPOLATION,
  dragCoefficient,
  mach,
  metres,
  nacaA53d02Components,
  radians,
  ROUGHNESS_HEIGHTS,
  type TransonicFinInterpolation,
} from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';

const FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'digitised',
  'wind-tunnel-validation.json',
);

interface Point {
  mach: number;
  value: number;
}
interface Series {
  worst_disagreement: number;
  uncertainty: number;
  points: Point[];
}
interface Data {
  arcas: {
    cp_percent_transonic: Series;
    ca_corr_transonic: Series;
    cp_percent_supersonic: Series;
    ca_supersonic_single_pass: { points: { mach: number; ca: number; ca_forebody: number }[] };
    cn_alpha_per_rad_single_pass: {
      transonic: { mach: number; cn_alpha_0_to_4: number; cn_alpha_0_to_8: number }[];
      supersonic: { mach: number; cn_alpha_0_to_4: number; cn_alpha_0_to_8: number }[];
    };
  };
  naca_rm_a53d02: {
    cd_points_pass2: { mach: number; cd: number }[];
    table1_rounds: { mach: number; reynolds_millions: number }[];
  };
}

const data = JSON.parse(readFileSync(FILE, 'utf8')) as Data;
const INCH = 0.0254;
const CANDIDATES: readonly TransonicFinInterpolation[] = [
  'linear',
  'cubic-hermite',
  'quadratic-subsonic',
];

type Regime = 'subsonic' | 'transonic' | 'supersonic' | 'hypersonic';
function regime(M: number): Regime {
  if (M < 0.8) return 'subsonic';
  if (M <= 1.2) return 'transonic';
  if (M <= 5) return 'supersonic';
  return 'hypersonic';
}

interface Row {
  mach: number;
  measured: number;
  predicted: number;
}
interface Summary {
  n: number;
  rms: number;
  maxAbs: number;
  meanSigned: number;
}
function summarise(rows: readonly Row[], relative: boolean): Summary {
  const errs = rows.map((r) =>
    relative ? (r.predicted - r.measured) / r.measured : r.predicted - r.measured,
  );
  const n = errs.length;
  if (n === 0) return { n: 0, rms: Number.NaN, maxAbs: Number.NaN, meanSigned: Number.NaN };
  return {
    n,
    rms: Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / n),
    maxAbs: Math.max(...errs.map((e) => Math.abs(e))),
    meanSigned: errs.reduce((a, e) => a + e, 0) / n,
  };
}
function byRegime(rows: readonly Row[], relative: boolean): Record<Regime, Summary> {
  const out = {} as Record<Regime, Summary>;
  for (const r of ['subsonic', 'transonic', 'supersonic', 'hypersonic'] as const) {
    out[r] = summarise(
      rows.filter((x) => regime(x.mach) === r),
      relative,
    );
  }
  return out;
}
function fmt(s: Summary, scale: number, unit: string): string {
  if (s.n === 0) return 'no data';
  return `n=${String(s.n)} rms ${(s.rms * scale).toFixed(2)}${unit} max ${(s.maxAbs * scale).toFixed(2)}${unit} mean ${(s.meanSigned * scale >= 0 ? '+' : '') + (s.meanSigned * scale).toFixed(2)}${unit}`;
}

function arcasCpPercent(M: number, candidate: TransonicFinInterpolation): number {
  const r = centreOfPressure(ARCAS_COMPONENTS, {
    mach: mach(M),
    rollAngle: radians(0),
    finRollReduction: true,
    transonicFinInterpolation: candidate,
  });
  return ((r.cp as number) / (ARCAS_BODY_LENGTH_INCHES * INCH)) * 100;
}
function arcasCnAlpha(M: number): number {
  return centreOfPressure(ARCAS_COMPONENTS, {
    mach: mach(M),
    rollAngle: radians(0),
    finRollReduction: true,
  }).cnAlpha;
}
function arcasDrag(M: number, reynolds: number): { total: number; forebody: number } {
  const r = dragCoefficient({
    components: ARCAS_COMPONENTS,
    mach: mach(M),
    reynolds,
    roughnessHeight: metres(ROUGHNESS_HEIGHTS.finishedAndPolishedSurface),
    baseDragMotorRule: 'while-thrusting',
  });
  const base = r.terms.filter((t) => t.kind === 'base').reduce((a, t) => a + t.cd, 0);
  return { total: r.cd0, forebody: r.cd0 - base };
}
function nacaDrag(M: number, reynolds: number, section: 'square' | 'rounded'): number {
  return dragCoefficient({
    components: nacaA53d02Components(section),
    mach: mach(M),
    reynolds,
    roughnessHeight: metres(ROUGHNESS_HEIGHTS.finishedAndPolishedSurface),
    baseDragMotorRule: 'while-thrusting',
  }).cd0;
}

const lines: string[] = [];
const log = (s: string): void => {
  lines.push(s);
};

describe('ARCAS centre of pressure (TN D-4013 figure 11, TN D-4014 figure 7)', () => {
  const transonic = data.arcas.cp_percent_transonic.points;
  const supersonic = data.arcas.cp_percent_supersonic.points;
  const band = transonic.filter((p) => p.mach >= 0.8 && p.mach <= 1.2);
  const candidateErrors: Record<TransonicFinInterpolation, Summary> = {
    linear: summarise([], false),
    'cubic-hermite': summarise([], false),
    'quadratic-subsonic': summarise([], false),
  };
  it('compares each BAR-12 candidate in the band 0.8 to 1.2 (D-056)', () => {
    log('## Fin interpolation candidates: ARCAS x_cp, percent body length, 0.8 ≤ M ≤ 1.2');
    log('');
    log(
      `| Mach | measured | ${CANDIDATES.join(' | ')} |\n| --- | --- | ${CANDIDATES.map(() => '---').join(' | ')} |`,
    );
    for (const p of band) {
      const vals = CANDIDATES.map((c) => arcasCpPercent(p.mach, c));
      log(
        `| ${String(p.mach)} | ${p.value.toFixed(1)} | ${vals.map((v) => v.toFixed(1)).join(' | ')} |`,
      );
    }
    for (const c of CANDIDATES) {
      candidateErrors[c] = summarise(
        band.map((p) => ({
          mach: p.mach,
          measured: p.value,
          predicted: arcasCpPercent(p.mach, c),
        })),
        false,
      );
      log(`- ${c}: ${fmt(candidateErrors[c], 1, ' %L')}`);
    }
    log('');
    const best = [...CANDIDATES].sort((a, b) => candidateErrors[a].rms - candidateErrors[b].rms)[0];
    log(`Lowest rms: ${String(best)}; default in code: ${DEFAULT_TRANSONIC_FIN_INTERPOLATION}.`);
    expect(best).toBe(DEFAULT_TRANSONIC_FIN_INTERPOLATION);
  });
  it('reports the CP error by regime with the chosen candidate', () => {
    const rows: Row[] = [...transonic, ...supersonic].map((p) => ({
      mach: p.mach,
      measured: p.value,
      predicted: arcasCpPercent(p.mach, DEFAULT_TRANSONIC_FIN_INTERPOLATION),
    }));
    log(
      '## ARCAS x_cp, percent body length (digitisation uncertainty ±0.6 transonic, ±0.8 supersonic)',
    );
    log('');
    log('| Mach | regime | measured | predicted | error |\n| --- | --- | --- | --- | --- |');
    for (const r of rows)
      log(
        `| ${String(r.mach)} | ${regime(r.mach)} | ${r.measured.toFixed(1)} | ${r.predicted.toFixed(1)} | ${(r.predicted - r.measured >= 0 ? '+' : '') + (r.predicted - r.measured).toFixed(1)} |`,
      );
    const s = byRegime(rows, false);
    for (const k of ['subsonic', 'transonic', 'supersonic'] as const)
      log(`- ${k}: ${fmt(s[k], 1, ' %L')}`);
    log('');
    // Regression pins (not acceptance criteria): the observed errors with a margin.
    expect(s.subsonic.maxAbs).toBeLessThan(4);
    expect(s.transonic.rms).toBeLessThan(6);
    expect(s.supersonic.maxAbs).toBeLessThan(30);
  });
  it('reports C_Nα against the single-pass readings (low confidence)', () => {
    const pts = [
      ...data.arcas.cn_alpha_per_rad_single_pass.transonic,
      ...data.arcas.cn_alpha_per_rad_single_pass.supersonic,
    ];
    log(
      '## ARCAS C_Nα per radian (single-pass secant slopes of C_N over 0 to 4° and 0 to 8°, about ±15 % each; indicative only)',
    );
    log('');
    log(
      '| Mach | secant 0 to 4° | secant 0 to 8° | predicted | error vs 0 to 8° |\n| --- | --- | --- | --- | --- |',
    );
    const rows: Row[] = pts.map((p) => ({
      mach: p.mach,
      measured: p.cn_alpha_0_to_8,
      predicted: arcasCnAlpha(p.mach),
    }));
    for (const p of pts) {
      const predicted = arcasCnAlpha(p.mach);
      const err = ((predicted - p.cn_alpha_0_to_8) / p.cn_alpha_0_to_8) * 100;
      log(
        `| ${String(p.mach)} | ${p.cn_alpha_0_to_4.toFixed(2)} | ${p.cn_alpha_0_to_8.toFixed(2)} | ${predicted.toFixed(2)} | ${(err >= 0 ? '+' : '') + err.toFixed(0)} % |`,
      );
    }
    const s = byRegime(rows, true);
    for (const k of ['subsonic', 'transonic', 'supersonic'] as const)
      log(`- ${k}: ${fmt(s[k], 100, ' %')}`);
    log('');
    expect(rows.every((r) => Number.isFinite(r.predicted))).toBe(true);
  });
});

describe('ARCAS axial force (TN D-4013 figure 11 C_A,corr; TN D-4014 figure 5(b) with the chamber correction)', () => {
  it('compares the forebody drag (C_D0 without the base term) and reports by regime', () => {
    const t = data.arcas.ca_corr_transonic.points.map((p) => ({
      mach: p.mach,
      measured: p.value,
      predicted: arcasDrag(p.mach, ARCAS_REYNOLDS.tnD4013).forebody,
      total: arcasDrag(p.mach, ARCAS_REYNOLDS.tnD4013).total,
    }));
    const s = data.arcas.ca_supersonic_single_pass.points.map((p) => ({
      mach: p.mach,
      measured: p.ca_forebody,
      predicted: arcasDrag(p.mach, ARCAS_REYNOLDS.tnD4014).forebody,
      total: arcasDrag(p.mach, ARCAS_REYNOLDS.tnD4014).total,
    }));
    log(
      '## ARCAS forebody axial force coefficient at α ≈ 0 (sting mounted: base at free-stream pressure)',
    );
    log('');
    log(
      '| Mach | regime | measured | predicted forebody | predicted total | error |\n| --- | --- | --- | --- | --- | --- |',
    );
    for (const r of [...t, ...s])
      log(
        `| ${String(r.mach)} | ${regime(r.mach)} | ${r.measured.toFixed(3)} | ${r.predicted.toFixed(3)} | ${r.total.toFixed(3)} | ${(((r.predicted - r.measured) / r.measured) * 100 >= 0 ? '+' : '') + (((r.predicted - r.measured) / r.measured) * 100).toFixed(0)} % |`,
      );
    const by = byRegime([...t, ...s], true);
    for (const k of ['subsonic', 'transonic', 'supersonic'] as const)
      log(`- ${k}: ${fmt(by[k], 100, ' %')}`);
    log('');
    log('### ARCAS drag breakdown (contributions to C_D0 on A_ref) at selected Mach numbers');
    log('');
    const machs = [0.6, 0.9, 1.05, 1.5, 2.96, 4.63];
    const perMach = machs.map((m) =>
      dragCoefficient({
        components: ARCAS_COMPONENTS,
        mach: mach(m),
        reynolds: m < 1.3 ? ARCAS_REYNOLDS.tnD4013 : ARCAS_REYNOLDS.tnD4014,
        roughnessHeight: metres(ROUGHNESS_HEIGHTS.finishedAndPolishedSurface),
        baseDragMotorRule: 'while-thrusting',
      }),
    );
    const first = perMach[0];
    if (first === undefined) throw new Error('no breakdown');
    log(
      `| term | ${machs.map((m) => `M ${String(m)}`).join(' | ')} |\n| --- | ${machs.map(() => '---').join(' | ')} |`,
    );
    log(`| skin friction | ${perMach.map((r) => r.skinFriction.cd.toFixed(3)).join(' | ')} |`);
    first.terms.forEach((term, i) => {
      const vals = perMach.map((r) => r.terms[i]?.cd ?? Number.NaN);
      log(`| ${term.source} | ${vals.map((v) => v.toFixed(3)).join(' | ')} |`);
    });
    log(`| total C_D0 | ${perMach.map((r) => (r.cd0 as number).toFixed(3)).join(' | ')} |`);
    log('');
    // Regression pins (not acceptance criteria): the observed errors with a margin.
    expect(by.subsonic.rms).toBeLessThan(0.25);
    expect(by.transonic.rms).toBeLessThan(0.3);
    expect(by.supersonic.rms).toBeLessThan(0.9);
  });
});

describe('NACA RM A53D02 zero-lift drag (figure 11, free flight)', () => {
  it('compares the total C_D0 for both fin sections and reports by regime', () => {
    const rounds = data.naca_rm_a53d02.table1_rounds;
    const reynoldsAt = (M: number): number => {
      const nearest = [...rounds].sort((a, b) => Math.abs(a.mach - M) - Math.abs(b.mach - M))[0];
      if (nearest === undefined || Math.abs(nearest.mach - M) > 0.15)
        throw new Error(`no Table I round near Mach ${String(M)}`);
      return nearest.reynolds_millions * 1e6;
    };
    const rows = data.naca_rm_a53d02.cd_points_pass2.map((p) => {
      const re = reynoldsAt(p.mach);
      return {
        mach: p.mach,
        measured: p.cd,
        reynolds: re,
        square: nacaDrag(p.mach, re, 'square'),
        rounded: nacaDrag(p.mach, re, 'rounded'),
      };
    });
    log('## NACA RM A53D02 C_D at zero lift (free flight, base included; digitisation ±0.01)');
    log('');
    log(
      '| Mach | regime | Re | measured | square fins | rounded fins | error (square) | error (rounded) |\n| --- | --- | --- | --- | --- | --- | --- | --- |',
    );
    for (const r of rows)
      log(
        `| ${String(r.mach)} | ${regime(r.mach)} | ${r.reynolds.toExponential(2)} | ${r.measured.toFixed(3)} | ${r.square.toFixed(3)} | ${r.rounded.toFixed(3)} | ${(((r.square - r.measured) / r.measured) * 100).toFixed(0)} % | ${(((r.rounded - r.measured) / r.measured) * 100).toFixed(0)} % |`,
      );
    for (const section of ['square', 'rounded'] as const) {
      const by = byRegime(
        rows.map((r) => ({ mach: r.mach, measured: r.measured, predicted: r[section] })),
        true,
      );
      log(`- ${section} fins:`);
      for (const k of ['subsonic', 'transonic', 'supersonic', 'hypersonic'] as const)
        log(`  - ${k}: ${fmt(by[k], 100, ' %')}`);
    }
    log('');
    const square = byRegime(
      rows.map((r) => ({ mach: r.mach, measured: r.measured, predicted: r.square })),
      true,
    );
    // Regression pins (not acceptance criteria).
    expect(square.supersonic.rms).toBeLessThan(0.12);
    expect(square.transonic.rms).toBeLessThan(0.45);
    expect(square.hypersonic.rms).toBeLessThan(0.3);
  });
});

describe('report', () => {
  it('prints the tables', () => {
    const report = process.env['WIND_TUNNEL_REPORT'];
    if (report !== undefined && report !== '') writeFileSync(report, lines.join('\n') + '\n');
    console.log(lines.join('\n'));
    expect(lines.length).toBeGreaterThan(0);
  });
});
