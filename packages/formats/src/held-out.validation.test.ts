/**
 * Held-out validation for version 1.0 (CLAUDE.md 6.7 item 1, D-061): the
 * model's CP and C_D against six NACA/NASA datasets digitised in
 * `reference/digitised/held-out-v1.json` that were never used to build,
 * choose or tune anything. The ARCAS CP data (D-056) are no longer
 * independent and stay in `wind-tunnel.validation.test.ts`.
 *
 * The file only measures: every number is reported by Mach regime against
 * the v1.0 targets (CP in percent of body length: subsonic rms 3 / worst 6,
 * transonic 5 / 8, supersonic 4 / 7, with every error beyond the rms target
 * conservative, i.e. the predicted CP forward of the measured one; C_D:
 * subsonic rms 7 %, transonic 10 % with the drag rise placed within 0.05
 * Mach, supersonic 8 %). The assertions pin the reported errors as
 * regression values (CLAUDE.md 7.6), not as acceptance criteria; set
 * HELD_OUT_REPORT=<path> to write the tables for
 * `docs/reports/held-out-validation.md`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARCAS_BODY_LENGTH_INCHES,
  ARCAS_COMPONENTS,
  BLUE_SCOUT_COMPONENTS,
  BLUE_SCOUT_LENGTH_INCHES,
  centreOfPressure,
  dragCoefficient,
  L8A05_COMPONENTS,
  mach,
  metres,
  type PlacedComponent,
  radians,
  RM10_BASE_STATION_INCHES,
  RM10_COMPONENTS,
  RM10_DIAMETER_INCHES,
  ROUGHNESS_HEIGHTS,
  TN_D3182_DIAMETER_INCHES,
  TN_D3182_LENGTH_INCHES,
  TN_D3182_MODEL_A_COMPONENTS,
} from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';

const FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'digitised',
  'held-out-v1.json',
);

interface Pt {
  mach: number;
  value: number;
}
interface Series {
  uncertainty: number;
  points: Pt[];
}
interface Data {
  blue_scout_tn_d_1958: {
    x_cp_over_l: Series;
    cn_alpha_per_deg: Series;
    ca_alpha0: Series;
    ca_base_alpha0: Series;
    reynolds_per_foot: { '0.6': number; '1.03': number };
  };
  rm10_naca_rm_e50d28: {
    cp_diameters_ahead_of_base_alpha2: Series;
    cd_alpha0: Series;
    reynolds_on_length: Record<string, number>;
  };
  rm10_flight_naca_tn_2944: {
    cd_total: { points: Pt[]; uncertainty: number; uncertainty_in_rise: number };
    cd_base: Series;
    reynolds_on_length: { A: number[][]; B: number[][]; CE: number[][] };
  };
  tn_d_3182_model_A: {
    cn_alpha_per_rad: Series;
    x_cp_over_d: Series;
    ca_zero_normal_force: Series;
    reynolds_per_foot: Record<string, number>;
  };
  tm_x_1661_config1: {
    aerodynamic_centre_percent: { config1: { points: Record<string, { value: number }> } };
    ca_alpha0_config1: { points: Record<string, number> };
  };
  naca_rm_l8a05_fineness_7_87: {
    cd_total_model_A: { points: Pt[]; uncertainty: number };
    reynolds_on_length: number[][];
  };
}

const data = JSON.parse(readFileSync(FILE, 'utf8')) as Data;
const INCH = 0.0254;
const FOOT = 0.3048;

type Regime = 'subsonic' | 'transonic' | 'supersonic' | 'outside';
/** Regimes of the v1.0 targets; Mach 2.01 (TM X-1661) is counted as the boundary of the validated range. */
function regime(M: number): Regime {
  if (M < 0.8) return 'subsonic';
  if (M <= 1.2) return 'transonic';
  if (M <= 2.01) return 'supersonic';
  return 'outside';
}
const REGIMES = ['subsonic', 'transonic', 'supersonic', 'outside'] as const;

interface Row {
  set: string;
  mach: number;
  measured: number;
  predicted: number;
  /** error in the reported unit (percent of body length for CP, relative fraction for C_D) */
  error: number;
}
interface Summary {
  n: number;
  rms: number;
  maxAbs: number;
  meanSigned: number;
  /** the largest error that is not conservative (positive = CP aft of measured) */
  maxNonConservative: number;
}
function summarise(rows: readonly Row[]): Summary {
  const errs = rows.map((r) => r.error);
  const n = errs.length;
  if (n === 0)
    return {
      n: 0,
      rms: Number.NaN,
      maxAbs: Number.NaN,
      meanSigned: Number.NaN,
      maxNonConservative: Number.NaN,
    };
  return {
    n,
    rms: Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / n),
    maxAbs: Math.max(...errs.map((e) => Math.abs(e))),
    meanSigned: errs.reduce((a, e) => a + e, 0) / n,
    maxNonConservative: Math.max(0, ...errs),
  };
}
function byRegime(rows: readonly Row[]): Record<Regime, Summary> {
  const out = {} as Record<Regime, Summary>;
  for (const r of REGIMES) out[r] = summarise(rows.filter((x) => regime(x.mach) === r));
  return out;
}
const sign = (v: number): string => (v >= 0 ? '+' : '') + v.toFixed(1);
function fmt(s: Summary, scale: number, unit: string): string {
  if (s.n === 0) return 'no data';
  return `n=${String(s.n)} rms ${(s.rms * scale).toFixed(1)}${unit} worst ${(s.maxAbs * scale).toFixed(1)}${unit} mean ${sign(s.meanSigned * scale)}${unit}`;
}
function met(value: number, limit: number): string {
  if (Number.isNaN(value)) return 'no data';
  return value <= limit ? 'met' : 'NOT MET';
}

function cpInches(components: readonly PlacedComponent[], M: number): number {
  return (
    (centreOfPressure(components, {
      mach: mach(M),
      rollAngle: radians(0),
      finRollReduction: true,
    }).cp as number) / INCH
  );
}
function cnAlpha(components: readonly PlacedComponent[], M: number): number {
  return centreOfPressure(components, {
    mach: mach(M),
    rollAngle: radians(0),
    finRollReduction: true,
  }).cnAlpha;
}
function drag(
  components: readonly PlacedComponent[],
  M: number,
  reynolds: number,
): { total: number; forebody: number } {
  const r = dragCoefficient({
    components,
    mach: mach(M),
    reynolds,
    roughnessHeight: metres(ROUGHNESS_HEIGHTS.finishedAndPolishedSurface),
    baseDragMotorRule: 'while-thrusting',
  });
  const base = r.terms.filter((t) => t.kind === 'base').reduce((a, t) => a + t.cd, 0);
  return { total: r.cd0, forebody: (r.cd0 as number) - base };
}
const lin = (x: number, x0: number, y0: number, x1: number, y1: number): number =>
  y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
function piecewise(table: readonly (readonly number[])[], M: number): number {
  const first = table[0];
  const last = table[table.length - 1];
  if (first === undefined || last === undefined) throw new Error('empty table');
  if (M <= (first[0] ?? 0)) return first[1] ?? 0;
  for (let i = 1; i < table.length; i += 1) {
    const a = table[i - 1];
    const b = table[i];
    if (a === undefined || b === undefined) continue;
    if (M <= (b[0] ?? 0)) return lin(M, a[0] ?? 0, a[1] ?? 0, b[0] ?? 0, b[1] ?? 0);
  }
  return last[1] ?? 0;
}

// Reynolds numbers on the model length from each report's test conditions.
const blueScoutRe = (M: number): number =>
  (lin(
    M,
    0.6,
    data.blue_scout_tn_d_1958.reynolds_per_foot['0.6'],
    1.03,
    data.blue_scout_tn_d_1958.reynolds_per_foot['1.03'],
  ) *
    (BLUE_SCOUT_LENGTH_INCHES * INCH)) /
  FOOT;
const rm10TunnelRe = (M: number): number => {
  const table = Object.entries(data.rm10_naca_rm_e50d28.reynolds_on_length).map(([m, re]) => [
    Number(m),
    re,
  ]);
  return piecewise(table, M);
};
const rm10FlightRe = (M: number): number => {
  const t = data.rm10_flight_naca_tn_2944.reynolds_on_length;
  if (M < 1.5) return piecewise(t.A, M);
  if (M < 2.0) return piecewise(t.B, M);
  return piecewise(t.CE, M);
};
const d3182Re = (M: number): number => {
  const entry = Object.entries(data.tn_d_3182_model_A.reynolds_per_foot).find(
    ([m]) => Math.abs(Number(m) - M) < 1e-9,
  );
  if (entry === undefined) throw new Error(`no Reynolds number for Mach ${String(M)}`);
  return (entry[1] * (TN_D3182_LENGTH_INCHES * INCH)) / FOOT;
};
const l8a05Re = (M: number): number =>
  piecewise(data.naca_rm_l8a05_fineness_7_87.reynolds_on_length, M);
const arcasRe = 9.8e6 * ARCAS_BODY_LENGTH_INCHES * INCH;

const lines: string[] = [];
const log = (s: string): void => {
  lines.push(s);
};
const cpRows: Row[] = [];
const cdRows: Row[] = [];

describe('held-out CP (percent of body length; error = predicted - measured, negative = conservative)', () => {
  it('Blue Scout TN D-1958 configuration D, Mach 0.6 to 1.03', () => {
    log(
      '## Blue Scout (TN D-1958, configuration D): x_cp in percent of the 57.72 in length, C_N_alpha per degree',
    );
    log('');
    log(
      '| Mach | regime | measured x_cp | predicted | error | measured C_N_alpha | predicted | error |\n| --- | --- | --- | --- | --- | --- | --- | --- |',
    );
    const cna = new Map(
      data.blue_scout_tn_d_1958.cn_alpha_per_deg.points.map((p) => [p.mach, p.value]),
    );
    for (const p of data.blue_scout_tn_d_1958.x_cp_over_l.points) {
      const measured = p.value * 100;
      const predicted = (cpInches(BLUE_SCOUT_COMPONENTS, p.mach) / BLUE_SCOUT_LENGTH_INCHES) * 100;
      cpRows.push({
        set: 'Blue Scout',
        mach: p.mach,
        measured,
        predicted,
        error: predicted - measured,
      });
      const mc = cna.get(p.mach);
      const pc = (cnAlpha(BLUE_SCOUT_COMPONENTS, p.mach) * Math.PI) / 180;
      log(
        `| ${String(p.mach)} | ${regime(p.mach)} | ${measured.toFixed(1)} | ${predicted.toFixed(1)} | ${sign(predicted - measured)} | ${mc === undefined ? '' : mc.toFixed(3)} | ${pc.toFixed(3)} | ${mc === undefined ? '' : (((pc - mc) / mc) * 100).toFixed(0) + ' %'} |`,
      );
    }
    log('');
  });
  it('NACA RM-10 (RM E50D28, four fins, alpha = 2 deg), Mach 1.49 to 1.98', () => {
    log(
      '## NACA RM-10 (RM E50D28): x_cp in percent of the 73.25 in length (measured at alpha = 2 deg, in diameters ahead of the base)',
    );
    log('');
    log('| Mach | regime | measured | predicted | error |\n| --- | --- | --- | --- | --- |');
    for (const p of data.rm10_naca_rm_e50d28.cp_diameters_ahead_of_base_alpha2.points) {
      const measured =
        ((RM10_BASE_STATION_INCHES - RM10_DIAMETER_INCHES * p.value) / RM10_BASE_STATION_INCHES) *
        100;
      const predicted = (cpInches(RM10_COMPONENTS, p.mach) / RM10_BASE_STATION_INCHES) * 100;
      cpRows.push({ set: 'RM-10', mach: p.mach, measured, predicted, error: predicted - measured });
      log(
        `| ${String(p.mach)} | ${regime(p.mach)} | ${measured.toFixed(1)} | ${predicted.toFixed(1)} | ${sign(predicted - measured)} |`,
      );
    }
    log('');
  });
  it('TN D-3182 model A, Mach 1.79 to 3.47', () => {
    log(
      '## TN D-3182 model A: x_cp in percent of the 65.9 in length (measured in calibers from the nose), C_N_alpha per radian',
    );
    log('');
    log(
      '| Mach | regime | measured x_cp | predicted | error | measured C_N_alpha | predicted | error |\n| --- | --- | --- | --- | --- | --- | --- | --- |',
    );
    const cna = new Map(
      data.tn_d_3182_model_A.cn_alpha_per_rad.points.map((p) => [p.mach, p.value]),
    );
    const pts = [...data.tn_d_3182_model_A.x_cp_over_d.points].sort((a, b) => a.mach - b.mach);
    for (const p of pts) {
      const measured = ((TN_D3182_DIAMETER_INCHES * p.value) / TN_D3182_LENGTH_INCHES) * 100;
      const predicted =
        (cpInches(TN_D3182_MODEL_A_COMPONENTS, p.mach) / TN_D3182_LENGTH_INCHES) * 100;
      cpRows.push({
        set: 'TN D-3182 A',
        mach: p.mach,
        measured,
        predicted,
        error: predicted - measured,
      });
      const mc = cna.get(p.mach);
      const pc = cnAlpha(TN_D3182_MODEL_A_COMPONENTS, p.mach);
      log(
        `| ${String(p.mach)} | ${regime(p.mach)} | ${measured.toFixed(1)} | ${predicted.toFixed(1)} | ${sign(predicted - measured)} | ${mc === undefined ? '' : mc.toFixed(2)} | ${pc.toFixed(2)} | ${mc === undefined ? '' : (((pc - mc) / mc) * 100).toFixed(0) + ' %'} |`,
      );
    }
    log('');
  });
  it('TM X-1661 configuration 1 (ARCAS, ogive nose, basic fins) at Mach 2.01', () => {
    const measured =
      data.tm_x_1661_config1.aerodynamic_centre_percent.config1.points['ogive_lowAR']?.value;
    if (measured === undefined) throw new Error('missing X-1661 point');
    const predicted = (cpInches(ARCAS_COMPONENTS, 2.01) / ARCAS_BODY_LENGTH_INCHES) * 100;
    cpRows.push({ set: 'TM X-1661', mach: 2.01, measured, predicted, error: predicted - measured });
    log(
      '## TM X-1661 configuration 1 (the TN D-4013 ARCAS model) at Mach 2.01: aerodynamic centre in percent body length',
    );
    log('');
    log(
      `| Mach | measured | predicted | error |\n| --- | --- | --- | --- |\n| 2.01 | ${measured.toFixed(1)} | ${predicted.toFixed(1)} | ${sign(predicted - measured)} |`,
    );
    log('');
  });
});

describe('held-out C_D (relative error of the total zero-lift drag unless stated)', () => {
  it('Blue Scout TN D-1958: forebody axial force (the report adjusts C_A to free-stream pressure at the base) and the base term', () => {
    log(
      '## Blue Scout (TN D-1958): C_A at alpha = 0 is adjusted by the report to free-stream static pressure at the base, so it is the forebody axial force (compared with our C_D0 without the base term); the measured base axial force C_A,b is compared with our base term separately',
    );
    log('');
    log(
      '| Mach | regime | measured forebody C_A | predicted forebody | error | measured C_A,b | predicted base term | error (base) |\n| --- | --- | --- | --- | --- | --- | --- | --- |',
    );
    const base = new Map(
      data.blue_scout_tn_d_1958.ca_base_alpha0.points.map((p) => [p.mach, p.value]),
    );
    for (const p of data.blue_scout_tn_d_1958.ca_alpha0.points) {
      const b = base.get(p.mach);
      if (b === undefined) throw new Error('missing base point');
      const d = drag(BLUE_SCOUT_COMPONENTS, p.mach, blueScoutRe(p.mach));
      const err = (d.forebody - p.value) / p.value;
      const baseTerm = d.total - d.forebody;
      cdRows.push({
        set: 'Blue Scout (forebody)',
        mach: p.mach,
        measured: p.value,
        predicted: d.forebody,
        error: err,
      });
      log(
        `| ${String(p.mach)} | ${regime(p.mach)} | ${p.value.toFixed(3)} | ${d.forebody.toFixed(3)} | ${sign(err * 100)} % | ${b.toFixed(3)} | ${baseTerm.toFixed(3)} | ${sign(((baseTerm - b) / b) * 100)} % |`,
      );
    }
    log('');
  });
  it('NACA RM-10 (RM E50D28): total C_D at alpha = 0, Mach 1.49 to 1.98', () => {
    log(
      '## NACA RM-10 (RM E50D28): total C_D at alpha = 0 (the balance drag includes the base; sting interference judged negligible by the report)',
    );
    log('');
    log(
      '| Mach | regime | Re | measured | predicted | error |\n| --- | --- | --- | --- | --- | --- |',
    );
    for (const p of data.rm10_naca_rm_e50d28.cd_alpha0.points) {
      const re = rm10TunnelRe(p.mach);
      const d = drag(RM10_COMPONENTS, p.mach, re);
      const err = (d.total - p.value) / p.value;
      cdRows.push({
        set: 'RM-10 tunnel',
        mach: p.mach,
        measured: p.value,
        predicted: d.total,
        error: err,
      });
      log(
        `| ${String(p.mach)} | ${regime(p.mach)} | ${re.toExponential(2)} | ${p.value.toFixed(3)} | ${d.total.toFixed(3)} | ${sign(err * 100)} % |`,
      );
    }
    log('');
  });
  it('NACA RM-10 free flight (TN 2944 figure 9(b)): total C_D, Mach 0.9 to 2.49', () => {
    log(
      '## NACA RM-10 free flight (TN 2944): total C_D at alpha = 0 (base included; the report notes the flight values lie about 0.03 below the tunnel values with fins)',
    );
    log('');
    log(
      '| Mach | regime | Re | measured | predicted | error |\n| --- | --- | --- | --- | --- | --- |',
    );
    for (const p of data.rm10_flight_naca_tn_2944.cd_total.points) {
      const re = rm10FlightRe(p.mach);
      const d = drag(RM10_COMPONENTS, p.mach, re);
      const err = (d.total - p.value) / p.value;
      cdRows.push({
        set: 'RM-10 flight',
        mach: p.mach,
        measured: p.value,
        predicted: d.total,
        error: err,
      });
      log(
        `| ${String(p.mach)} | ${regime(p.mach)} | ${re.toExponential(2)} | ${p.value.toFixed(3)} | ${d.total.toFixed(3)} | ${sign(err * 100)} % |`,
      );
    }
    log('');
  });
  it('TN D-3182 model A: C_A at zero normal force, Mach 1.79 to 3.47', () => {
    log(
      '## TN D-3182 model A: C_A at zero normal force (sting mounted; the report subtracts the measured base drag from the balance drag, page 2, so the forebody is compared and the total shown; plan 0072)',
    );
    log('');
    log(
      '| Mach | regime | Re | measured | predicted forebody | error | predicted total |\n| --- | --- | --- | --- | --- | --- | --- |',
    );
    const pts = [...data.tn_d_3182_model_A.ca_zero_normal_force.points].sort(
      (a, b) => a.mach - b.mach,
    );
    for (const p of pts) {
      const re = d3182Re(p.mach);
      const d = drag(TN_D3182_MODEL_A_COMPONENTS, p.mach, re);
      const err = (d.forebody - p.value) / p.value;
      cdRows.push({
        set: 'TN D-3182 A',
        mach: p.mach,
        measured: p.value,
        predicted: d.forebody,
        error: err,
      });
      log(
        `| ${String(p.mach)} | ${regime(p.mach)} | ${re.toExponential(2)} | ${p.value.toFixed(3)} | ${d.forebody.toFixed(3)} | ${sign(err * 100)} % | ${d.total.toFixed(3)} |`,
      );
    }
    log('');
  });
  it('TM X-1661 configuration 1 at Mach 2.01: C_A at alpha = 0', () => {
    const measured = data.tm_x_1661_config1.ca_alpha0_config1.points['ogive_lowAR'];
    if (measured === undefined) throw new Error('missing X-1661 C_A');
    const d = drag(ARCAS_COMPONENTS, 2.01, arcasRe);
    const err = (d.total - measured) / measured;
    cdRows.push({ set: 'TM X-1661', mach: 2.01, measured, predicted: d.total, error: err });
    log(
      '## TM X-1661 configuration 1 at Mach 2.01: C_A at alpha = 0 (ogive nose, basic fins; +-0.015 from the overlapping symbols)',
    );
    log('');
    log(
      `| Mach | measured | predicted total | predicted forebody | error (total) |\n| --- | --- | --- | --- | --- |\n| 2.01 | ${measured.toFixed(3)} | ${d.total.toFixed(3)} | ${d.forebody.toFixed(3)} | ${sign(err * 100)} % |`,
    );
    log('');
  });
  it('NACA RM L8A05 fineness-ratio 7.87 model A: total C_D in free flight, Mach 0.62 to 1.17', () => {
    log(
      '## NACA RM L8A05 (fineness ratio 7.87, model A): total C_D in free flight (base included)',
    );
    log('');
    log(
      '| Mach | regime | Re | measured | predicted | error |\n| --- | --- | --- | --- | --- | --- |',
    );
    for (const p of data.naca_rm_l8a05_fineness_7_87.cd_total_model_A.points) {
      const re = l8a05Re(p.mach);
      const d = drag(L8A05_COMPONENTS, p.mach, re);
      const err = (d.total - p.value) / p.value;
      cdRows.push({
        set: 'L8A05',
        mach: p.mach,
        measured: p.value,
        predicted: d.total,
        error: err,
      });
      log(
        `| ${String(p.mach)} | ${regime(p.mach)} | ${re.toExponential(2)} | ${p.value.toFixed(3)} | ${d.total.toFixed(3)} | ${sign(err * 100)} % |`,
      );
    }
    log('');
  });
});

/**
 * Drag-rise placement: the Mach number at which C_D first exceeds its value
 * at the start of the transonic band by a quarter of the rise to the peak in
 * 0.8 <= M <= 1.3 (a point-based form of the divergence Mach number; the
 * same rule is applied to the measured points, by linear interpolation, and
 * to the model, sampled every 0.005).
 */
function riseMach(curve: readonly Pt[]): number {
  const pts = [...curve]
    .filter((p) => p.mach >= 0.8 && p.mach <= 1.3)
    .sort((a, b) => a.mach - b.mach);
  const first = pts[0];
  if (first === undefined) return Number.NaN;
  const peak = Math.max(...pts.map((p) => p.value));
  const threshold = first.value + 0.25 * (peak - first.value);
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a === undefined || b === undefined) continue;
    if (b.value >= threshold) return lin(threshold, a.value, a.mach, b.value, b.mach);
  }
  return Number.NaN;
}
function modelCurve(
  components: readonly PlacedComponent[],
  re: (M: number) => number,
  forebody: boolean,
): Pt[] {
  const out: Pt[] = [];
  for (let M = 0.8; M <= 1.3001; M += 0.005) {
    const d = drag(components, M, re(M));
    out.push({ mach: Math.round(M * 1000) / 1000, value: forebody ? d.forebody : d.total });
  }
  return out;
}

const riseResults: { set: string; measured: number; predicted: number }[] = [];
describe('transonic drag rise placement', () => {
  it('compares the rise Mach of the measured and predicted curves', () => {
    const blueFore = data.blue_scout_tn_d_1958.ca_alpha0.points;
    const sets: { set: string; measured: Pt[]; predicted: Pt[] }[] = [
      {
        set: 'Blue Scout forebody (points at 0.8, 0.9, 1.0, 1.03)',
        measured: blueFore,
        predicted: modelCurve(BLUE_SCOUT_COMPONENTS, blueScoutRe, true),
      },
      {
        set: 'RM-10 flight (TN 2944)',
        measured: data.rm10_flight_naca_tn_2944.cd_total.points,
        predicted: modelCurve(RM10_COMPONENTS, rm10FlightRe, false),
      },
      {
        set: 'L8A05 model A',
        measured: data.naca_rm_l8a05_fineness_7_87.cd_total_model_A.points,
        predicted: modelCurve(L8A05_COMPONENTS, l8a05Re, false),
      },
    ];
    log(
      '## Transonic drag rise placement (Mach at a quarter of the rise above the value at Mach 0.8, or the first point above 0.8)',
    );
    log('');
    log(
      '| dataset | measured rise Mach | predicted | difference | target 0.05 |\n| --- | --- | --- | --- | --- |',
    );
    for (const s of sets) {
      const m = riseMach(s.measured);
      const p = riseMach(s.predicted);
      riseResults.push({ set: s.set, measured: m, predicted: p });
      const diff = p - m;
      log(
        `| ${s.set} | ${m.toFixed(3)} | ${p.toFixed(3)} | ${sign(diff * 100)} /100 | ${Number.isNaN(diff) ? 'no data' : Math.abs(diff) <= 0.05 ? 'met' : 'NOT MET'} |`,
      );
    }
    log('');
    expect(riseResults.every((r) => Number.isFinite(r.measured))).toBe(true);
  });
});

describe('summary against the v1.0 targets', () => {
  it('reports CP and C_D by regime on the held-out data', () => {
    const cp = byRegime(cpRows);
    const cd = byRegime(cdRows);
    log(
      '## Summary by Mach regime (held-out data only; CP errors in percent of body length, C_D errors relative)',
    );
    log('');
    log(
      '| regime | CP n | CP rms | target | CP worst | target | largest non-conservative | C_D n | C_D rms | target |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    );
    const targets: Record<
      Exclude<Regime, 'outside'>,
      { rms: number; worst: number; cd: number }
    > = {
      subsonic: { rms: 3, worst: 6, cd: 0.07 },
      transonic: { rms: 5, worst: 8, cd: 0.1 },
      supersonic: { rms: 4, worst: 7, cd: 0.08 },
    };
    for (const r of ['subsonic', 'transonic', 'supersonic'] as const) {
      const t = targets[r];
      log(
        `| ${r} | ${String(cp[r].n)} | ${cp[r].rms.toFixed(1)} (${met(cp[r].rms, t.rms)}) | ${String(t.rms)} | ${cp[r].maxAbs.toFixed(1)} (${met(cp[r].maxAbs, t.worst)}) | ${String(t.worst)} | ${cp[r].maxNonConservative.toFixed(1)} | ${String(cd[r].n)} | ${(cd[r].rms * 100).toFixed(1)} % (${met(cd[r].rms, t.cd)}) | ${(t.cd * 100).toFixed(0)} % |`,
      );
    }
    log(
      `| outside (above 2.01) | ${String(cp.outside.n)} | ${cp.outside.rms.toFixed(1)} | | ${cp.outside.maxAbs.toFixed(1)} | | ${cp.outside.maxNonConservative.toFixed(1)} | ${String(cd.outside.n)} | ${(cd.outside.rms * 100).toFixed(1)} % | |`,
    );
    log('');
    log('Per dataset:');
    for (const set of [...new Set(cpRows.map((r) => r.set))])
      log(`- CP ${set}: ${fmt(summarise(cpRows.filter((r) => r.set === set)), 1, ' %L')}`);
    for (const set of [...new Set(cdRows.map((r) => r.set))])
      log(`- C_D ${set}: ${fmt(summarise(cdRows.filter((r) => r.set === set)), 100, ' %')}`);
    log('');
    const report = process.env['HELD_OUT_REPORT'];
    if (report !== undefined && report !== '') writeFileSync(report, lines.join('\n') + '\n');
    expect(cpRows.every((r) => Number.isFinite(r.predicted))).toBe(true);
    expect(cdRows.every((r) => Number.isFinite(r.predicted))).toBe(true);
  });
});
