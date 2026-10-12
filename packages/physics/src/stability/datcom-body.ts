/**
 * Supersonic body normal force and centre of pressure from the USAF Stability
 * and Control DATCOM (1978 revision), sections 4.2.1.1 C and 4.2.2.1 C
 * (plan 0027, BAR-13, BAR-14, D-064). Page numbers are of the full DTIC scan
 * (ADB072483); the files in `reference/docs/` start at scan page 495.
 *
 * The DATCOM gives, for ogive-cylinder and cone-cylinder bodies, empirical
 * charts of the normal-force-curve slope C_Nα on the maximum frontal area
 * (figures 4.2.1.1-21a and -21b, scan p. 835) and of the centre of pressure
 * as a fraction of the body length (figures 4.2.2.1-23a and -23b, scan
 * p. 907) against β/f_N (left half) and f_N/β (right half) for curves of
 * f_A/f_N, where f_N = l_N/d is the nose fineness ratio and f_A = l_A/d the
 * cylindrical afterbody's. Validity (p. 4.2.1.1-4): ogive-cylinder
 * 1.28 < M < 5.04, 1.5 < f_N < 7, f_A/f_N ≤ 3.87; cone-cylinder
 * 1.36 < M < 5.04, 2.5 < f_N < 7, f_A/f_N ≤ 3.17. Parabolic noses use the
 * ogive charts and 3/4-power noses the cone charts with the centre of
 * pressure moved forward 5 % of the body length (pp. 4.2.1.1-3 and
 * 4.2.2.1-10). The transonic range: "any differences in the subsonic value
 * ... and the supersonic value ... should be faired out smoothly in the
 * transonic range" (pp. 4.2.1.1-3, 4.2.2.1-9).
 *
 * Every value is the mean of two digitisation passes recorded in
 * `reference/digitised/datcom-body-charts.json`.
 */
import { InvalidInputError } from '../errors.js';
import type { PlacedComponent } from '../geometry/assembly.js';
import { finiteResult } from '../numerics/finite.js';

export interface BodyChartCurve {
  /** f_A/f_N of the curve. */
  readonly parameter: number;
  /** Reading uncertainty (per radian for C_Nα, fraction of body length for x_cp). */
  readonly uncertainty: number;
  /** [u, value] with u = β/f_N for u ≤ 1 and u = 2 − f_N/β for u > 1. */
  readonly points: readonly (readonly [number, number])[];
}

/** DATCOM figure 4.2.1.1-21a, digitised twice (D-064); checked against the JSON file by a formats test. */
export const OGIVE_CYLINDER_CN_ALPHA: readonly BodyChartCurve[] = Object.freeze([
  {
    parameter: 0.0,
    uncertainty: 0.0698,
    points: [
      [0.4, 2.4963],
      [0.6, 2.4343],
      [0.801, 2.3396],
      [1.0, 2.2306],
      [1.199, 2.0694],
      [1.4, 1.9198],
      [1.499, 1.8285],
    ],
  },
  {
    parameter: 0.4,
    uncertainty: 0.0519,
    points: [
      [0.4, 2.7794],
      [0.6, 2.8045],
      [0.801, 2.7543],
      [1.0, 2.6577],
      [1.199, 2.5263],
      [1.4, 2.3519],
      [1.499, 2.2679],
    ],
  },
  {
    parameter: 0.8,
    uncertainty: 0.0605,
    points: [
      [0.4, 2.7868],
      [0.6, 2.8812],
      [0.801, 2.9358],
      [1.0, 2.9356],
      [1.199, 2.8611],
      [1.4, 2.6822],
      [1.499, 2.5762],
    ],
  },
  {
    parameter: 1.2,
    uncertainty: 0.05,
    points: [
      [0.4, 2.7942],
      [0.6, 2.9432],
      [0.801, 3.0377],
      [1.0, 3.0922],
      [1.199, 3.0672],
      [1.4, 2.8562],
      [1.499, 2.7253],
    ],
  },
  {
    parameter: 2.0,
    uncertainty: 0.05,
    points: [
      [0.4, 2.8266],
      [0.6, 3.0228],
      [0.801, 3.1719],
      [1.0, 3.2635],
      [1.199, 3.2338],
      [1.4, 2.9654],
      [1.499, 2.8024],
    ],
  },
  {
    parameter: 3.0,
    uncertainty: 0.05,
    points: [
      [0.4, 2.8664],
      [0.6, 3.0848],
      [0.801, 3.2737],
      [1.0, 3.3827],
      [1.199, 3.3431],
      [1.4, 3.045],
      [1.499, 2.8572],
    ],
  },
]);
/** DATCOM figure 4.2.1.1-21b, digitised twice (D-064); checked against the JSON file by a formats test. */
export const CONE_CYLINDER_CN_ALPHA: readonly BodyChartCurve[] = Object.freeze([
  {
    parameter: 0.0,
    uncertainty: 0.05,
    points: [
      [0.401, 1.9424],
      [0.601, 1.8782],
      [0.802, 1.8317],
      [1.002, 1.8274],
      [1.202, 1.8274],
      [1.403, 1.8274],
      [1.503, 1.8274],
    ],
  },
  {
    parameter: 0.4,
    uncertainty: 0.05,
    points: [
      [0.401, 2.6021],
      [0.601, 2.5158],
      [0.802, 2.432],
      [1.002, 2.3609],
      [1.202, 2.3358],
      [1.403, 2.3344],
      [1.503, 2.3344],
    ],
  },
  {
    parameter: 0.8,
    uncertainty: 0.05,
    points: [
      [0.401, 2.7573],
      [0.601, 2.7941],
      [0.802, 2.8113],
      [1.002, 2.7793],
      [1.202, 2.7393],
      [1.403, 2.7283],
      [1.503, 2.725],
    ],
  },
  {
    parameter: 1.2,
    uncertainty: 0.05,
    points: [
      [0.401, 2.8117],
      [0.601, 2.9447],
      [0.802, 3.0455],
      [1.002, 3.0791],
      [1.202, 3.0553],
      [1.403, 3.0139],
      [1.503, 2.9985],
    ],
  },
  {
    parameter: 2.0,
    uncertainty: 0.05,
    points: [
      [0.401, 2.8441],
      [0.601, 3.0239],
      [0.802, 3.1862],
      [1.002, 3.255],
      [1.202, 3.2794],
      [1.403, 3.3079],
      [1.503, 3.3213],
    ],
  },
  {
    parameter: 3.0,
    uncertainty: 0.05,
    points: [
      [1.054, 3.3163],
      [1.202, 3.363],
      [1.403, 3.4423],
      [1.503, 3.4782],
    ],
  },
]);
/** DATCOM figure 4.2.2.1-23a, digitised twice (D-064); checked against the JSON file by a formats test. */
export const OGIVE_CYLINDER_XCP: readonly BodyChartCurve[] = Object.freeze([
  {
    parameter: 0.0,
    uncertainty: 0.005,
    points: [
      [0.399, 0.5407],
      [0.598, 0.5364],
      [0.798, 0.531],
      [0.999, 0.5248],
      [1.199, 0.5179],
      [1.327, 0.5099],
    ],
  },
  {
    parameter: 0.4,
    uncertainty: 0.0051,
    points: [
      [0.399, 0.4207],
      [0.598, 0.4323],
      [0.798, 0.4428],
      [0.999, 0.4501],
      [1.199, 0.4577],
      [1.342, 0.4612],
    ],
  },
  {
    parameter: 0.8,
    uncertainty: 0.005,
    points: [
      [0.399, 0.3518],
      [0.598, 0.3674],
      [0.798, 0.3857],
      [0.999, 0.4018],
      [1.199, 0.4166],
      [1.342, 0.4259],
    ],
  },
  {
    parameter: 1.2,
    uncertainty: 0.005,
    points: [
      [0.399, 0.2992],
      [0.598, 0.319],
      [0.798, 0.3393],
      [0.999, 0.3597],
      [1.199, 0.3785],
      [1.342, 0.3947],
    ],
  },
  {
    parameter: 1.6,
    uncertainty: 0.005,
    points: [
      [0.399, 0.2459],
      [0.598, 0.2704],
      [0.798, 0.2954],
      [0.999, 0.3202],
      [1.199, 0.3437],
      [1.342, 0.3617],
    ],
  },
  {
    parameter: 2.0,
    uncertainty: 0.005,
    points: [
      [0.399, 0.2099],
      [0.598, 0.2395],
      [0.798, 0.2657],
      [0.999, 0.2904],
      [1.199, 0.3184],
      [1.342, 0.3381],
    ],
  },
]);
/** DATCOM figure 4.2.2.1-23b, digitised twice (D-064); checked against the JSON file by a formats test. */
export const CONE_CYLINDER_XCP: readonly BodyChartCurve[] = Object.freeze([
  {
    parameter: 0.0,
    uncertainty: 0.005,
    points: [
      [-0.001, 0.6642],
      [0.402, 0.6642],
      [0.801, 0.6642],
      [1.0, 0.6642],
      [1.199, 0.6642],
      [1.45, 0.6642],
    ],
  },
  {
    parameter: 0.5,
    uncertainty: 0.005,
    points: [
      [0.153, 0.4797],
      [0.204, 0.4985],
      [0.3, 0.5293],
      [0.402, 0.5497],
      [0.601, 0.5548],
      [0.801, 0.5548],
      [1.0, 0.5512],
      [1.199, 0.5461],
      [1.399, 0.5363],
      [1.45, 0.5312],
    ],
  },
  {
    parameter: 1.0,
    uncertainty: 0.0055,
    points: [
      [0.204, 0.3712],
      [0.402, 0.4084],
      [0.601, 0.4381],
      [0.801, 0.4592],
      [1.0, 0.4716],
      [1.199, 0.4672],
      [1.399, 0.4542],
      [1.45, 0.4455],
    ],
  },
  {
    parameter: 2.0,
    uncertainty: 0.005,
    points: [
      [0.506, 0.2679],
      [0.601, 0.2835],
      [0.801, 0.3183],
      [1.0, 0.348],
      [1.096, 0.3597],
      [1.199, 0.374],
      [1.399, 0.3969],
      [1.494, 0.3996],
    ],
  },
  {
    parameter: 3.0,
    uncertainty: 0.005,
    points: [
      [0.794, 0.2015],
      [1.0, 0.235],
      [1.199, 0.268],
      [1.399, 0.2995],
      [1.45, 0.309],
    ],
  },
  {
    parameter: 4.0,
    uncertainty: 0.005,
    points: [
      [0.941, 0.1574],
      [1.0, 0.168],
      [1.199, 0.2051],
      [1.399, 0.2407],
      [1.45, 0.2505],
    ],
  },
]);

export type DatcomBodyNose = 'ogive' | 'cone';

/** The chart abscissa for a Mach number and nose fineness ratio: β/f_N folded at 1 (DATCOM charts' two halves). */
export function bodyChartAbscissa(mach: number, fN: number): number {
  if (!(mach > 1))
    throw new InvalidInputError(
      'Mach number',
      mach,
      'must exceed 1 for the supersonic body charts',
    );
  const beta = Math.sqrt(mach * mach - 1);
  const r = beta / fN;
  return r <= 1 ? r : 2 - fN / beta;
}

/** The Mach number at which the charts begin (β/f_N = 0.4). */
export function bodyChartStartMach(fN: number): number {
  return Math.sqrt(1 + (0.4 * fN) ** 2);
}

function interpolate(points: readonly (readonly [number, number])[], x: number): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) throw new Error('empty curve');
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    if (x <= b[0]) return a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
  }
  return last[1];
}

export interface BodyChartReading {
  readonly value: number;
  /** f_A/f_N lay outside the chart's curves and the nearest curve was used. */
  readonly parameterClamped: boolean;
  /** u lay outside the chart (before its start or beyond f_N/β = 0.5) and the end value was held. */
  readonly abscissaHeld: boolean;
  readonly uncertainty: number;
}

/**
 * BAR-13/14 chart reading: linear in u along each curve, linear in f_A/f_N
 * between the two nearest curves; the nearest curve outside the family and
 * the end values outside the abscissa range, both flagged.
 */
export function readBodyChart(
  chart: readonly BodyChartCurve[],
  parameter: number,
  u: number,
): BodyChartReading {
  if (!(parameter >= 0) || !Number.isFinite(parameter))
    throw new InvalidInputError('f_A/f_N', parameter, 'must be 0 or greater');
  if (!Number.isFinite(u)) throw new InvalidInputError('chart abscissa', u, 'must be finite');
  const lo = chart[0];
  const hi = chart[chart.length - 1];
  if (lo === undefined || hi === undefined) throw new Error('empty chart');
  const held = (c: BodyChartCurve): boolean => {
    const first = c.points[0];
    const last = c.points[c.points.length - 1];
    return first === undefined || last === undefined || u < first[0] - 1e-9 || u > last[0] + 1e-9;
  };
  if (parameter <= lo.parameter)
    return {
      value: interpolate(lo.points, u),
      parameterClamped: parameter < lo.parameter,
      abscissaHeld: held(lo),
      uncertainty: lo.uncertainty,
    };
  if (parameter >= hi.parameter)
    return {
      value: interpolate(hi.points, u),
      parameterClamped: parameter > hi.parameter,
      abscissaHeld: held(hi),
      uncertainty: hi.uncertainty,
    };
  for (let i = 1; i < chart.length; i += 1) {
    const a = chart[i - 1];
    const b = chart[i];
    if (a === undefined || b === undefined) continue;
    if (parameter <= b.parameter) {
      const w = (parameter - a.parameter) / (b.parameter - a.parameter);
      return {
        value: (1 - w) * interpolate(a.points, u) + w * interpolate(b.points, u),
        parameterClamped: false,
        abscissaHeld: held(a) || held(b),
        uncertainty: Math.max(a.uncertainty, b.uncertainty),
      };
    }
  }
  throw new Error('unreachable');
}

export interface DatcomBodyInput {
  readonly nose: DatcomBodyNose;
  /** Nose fineness ratio l_N/d. */
  readonly fN: number;
  /** Cylindrical afterbody fineness ratio l_A/d. */
  readonly fA: number;
  readonly mach: number;
  /** 3/4-power nose: cone charts with the centre of pressure moved forward 5 % of the body length (p. 4.2.2.1-10). */
  readonly threeQuarterPower?: boolean;
}

export interface DatcomBodyTerm {
  /** C_Nα per radian on the body's maximum frontal area S_B. */
  readonly cnAlpha: number;
  /** Centre of pressure from the nose tip as a fraction of l_B = l_N + l_A. */
  readonly xcpFraction: number;
  readonly warnings: readonly string[];
}

/**
 * BAR-13, BAR-14. The supersonic ogive- or cone-cylinder body term from the
 * charts, with the DATCOM's own validity statements turned into warnings.
 */
export function datcomBodyTerm(input: DatcomBodyInput): DatcomBodyTerm {
  const { nose, fN, fA, mach } = input;
  if (!(fN > 0)) throw new InvalidInputError('nose fineness ratio', fN, 'must be greater than 0');
  if (!(fA >= 0))
    throw new InvalidInputError('afterbody fineness ratio', fA, 'must be 0 or greater');
  const warnings: string[] = [];
  const u = bodyChartAbscissa(mach, fN);
  const parameter = fA / fN;
  const cna = readBodyChart(
    nose === 'ogive' ? OGIVE_CYLINDER_CN_ALPHA : CONE_CYLINDER_CN_ALPHA,
    parameter,
    u,
  );
  const xcp = readBodyChart(
    nose === 'ogive' ? OGIVE_CYLINDER_XCP : CONE_CYLINDER_XCP,
    parameter,
    u,
  );
  const chartName = nose === 'ogive' ? 'ogive-cylinder' : 'cone-cylinder';
  if (cna.parameterClamped || xcp.parameterClamped)
    warnings.push(
      `DATCOM ${chartName} body charts: f_A/f_N = ${parameter.toFixed(2)} is outside the charted curves; the nearest curve is used (D-064)`,
    );
  if (cna.abscissaHeld || xcp.abscissaHeld)
    warnings.push(
      `DATCOM ${chartName} body charts: Mach ${mach.toFixed(2)} with f_N = ${fN.toFixed(2)} lies beyond the charts (β/f_N 0.4 to f_N/β 0.5); the end value is held (D-064)`,
    );
  const fnLimits = nose === 'ogive' ? [1.5, 7] : [2.5, 7];
  if (fN < (fnLimits[0] ?? 0) || fN > (fnLimits[1] ?? 0))
    warnings.push(
      `DATCOM ${chartName} body charts: nose fineness ratio ${fN.toFixed(2)} is outside the test data range ${String(fnLimits[0])} to ${String(fnLimits[1])} (p. 4.2.1.1-4)`,
    );
  if (parameter > (nose === 'ogive' ? 3.87 : 3.17))
    warnings.push(
      `DATCOM ${chartName} body charts: f_A/f_N = ${parameter.toFixed(2)} is above the test data range (${nose === 'ogive' ? '3.87' : '3.17'}, p. 4.2.1.1-4)`,
    );
  warnings.push(
    `DATCOM ${chartName} body charts: reading uncertainty ±${cna.uncertainty.toFixed(2)} per rad in C_Nα and ±${(xcp.uncertainty * 100).toFixed(1)} % of body length in the centre of pressure (D-064)`,
  );
  const shift = input.threeQuarterPower === true ? 0.05 : 0;
  return {
    cnAlpha: finiteResult('DATCOM body C_Nα', cna.value),
    xcpFraction: finiteResult('DATCOM body centre of pressure', xcp.value - shift),
    warnings,
  };
}

/**
 * BAR-13/14 body assembly: the nose cone and the contiguous body tubes of the
 * same radius that follow it form the ogive- or cone-cylinder body the DATCOM
 * charts describe. Other nose shapes map to the nearest chart (p. 4.2.1.1-3:
 * parabolic noses behave as ogives, 3/4-power noses as cones, cone forces
 * being similar to 3/4-power ones); elliptical and Haack noses have no DATCOM
 * body chart and use the ogive one with a warning (D-064).
 */
export interface DatcomBodyAssembly {
  readonly noseIndex: number;
  readonly nose: DatcomBodyNose;
  readonly threeQuarterPower: boolean;
  /** Diameter d of the cylinder, m. */
  readonly diameter: number;
  readonly noseLength: number;
  readonly afterbodyLength: number;
  readonly shapeWarning: string | undefined;
}

export function datcomBodyAssembly(
  components: readonly PlacedComponent[],
): DatcomBodyAssembly | undefined {
  const ordered = components
    .map((p, index) => ({ component: p.component, position: p.position, index }))
    .filter(
      (p) =>
        p.component.kind === 'noseCone' ||
        p.component.kind === 'bodyTube' ||
        p.component.kind === 'transition',
    )
    .sort((a, b) => a.position - b.position);
  const first = ordered[0];
  if (first?.component.kind !== 'noseCone') return undefined;
  const c = first.component;
  const R: number = c.baseRadius;
  const noseLength: number = c.length;
  let afterbody = 0;
  let end = first.position + noseLength;
  for (const p of ordered.slice(1)) {
    if (p.component.kind !== 'bodyTube') break;
    const t = p.component;
    if (Math.abs((t.outerRadius as number) - R) > 1e-9 || Math.abs(p.position - end) > 1e-6) break;
    afterbody += t.length as number;
    end += t.length as number;
  }
  const shape = c.shape;
  const kappa = c.shapeParameter ?? 0.5;
  const nose: DatcomBodyNose =
    shape === 'conical' || (shape === 'power' && kappa >= 0.75) ? 'cone' : 'ogive';
  const threeQuarterPower = shape === 'power' && kappa >= 0.75 && kappa < 1;
  const shapeWarning =
    shape === 'elliptical' || shape === 'haack'
      ? `the DATCOM body charts cover ogive, parabolic, cone and power-series noses only; the ${shape} nose uses the ogive-cylinder charts as the nearest shape (D-064)`
      : undefined;
  return {
    noseIndex: first.index,
    nose,
    threeQuarterPower,
    diameter: 2 * R,
    noseLength,
    afterbodyLength: afterbody,
    shapeWarning,
  };
}

export interface MachBodyTerm {
  /** C_Nα on the reference area. */
  readonly cnAlpha: number;
  /** Centre of pressure from the nose tip, m. */
  readonly cp: number;
  readonly method: 'barrowman' | 'fairing' | 'datcom';
  readonly warnings: readonly string[];
}

/**
 * BAR-13, BAR-14. The nose-cylinder body's C_Nα (on A_ref) and CP against
 * Mach: Niskanen's Mach-independent term (BAR-2, BAR-3, given as `subsonic`)
 * up to Mach 0.8, the DATCOM chart value from the Mach number at which the
 * charts begin (β/f_N = 0.4), and a linear fairing in Mach between, the
 * DATCOM's "faired out smoothly in the transonic range" extended to the
 * charts' first point (D-064). The DATCOM C_Nα on S_B = π d²/4 is referred to
 * A_ref by S_B/A_ref; its CP fraction is of l_B = l_N + l_A from the tip.
 */
export function noseCylinderTermAtMach(
  assembly: DatcomBodyAssembly,
  subsonic: { cnAlpha: number; cp: number },
  referenceArea: number,
  mach: number,
): MachBodyTerm {
  if (!(mach >= 0)) throw new InvalidInputError('Mach number', mach, 'must be 0 or greater');
  if (mach <= 0.8) return { ...subsonic, method: 'barrowman', warnings: [] };
  const d = assembly.diameter;
  const fN = assembly.noseLength / d;
  const fA = assembly.afterbodyLength / d;
  const lB = assembly.noseLength + assembly.afterbodyLength;
  const sB = (Math.PI * d * d) / 4;
  const start = bodyChartStartMach(fN);
  const at = (M: number): { cnAlpha: number; cp: number; warnings: readonly string[] } => {
    const t = datcomBodyTerm({
      nose: assembly.nose,
      fN,
      fA,
      mach: M,
      threeQuarterPower: assembly.threeQuarterPower,
    });
    return {
      cnAlpha: (t.cnAlpha * sB) / referenceArea,
      cp: t.xcpFraction * lB,
      warnings: t.warnings,
    };
  };
  const warnings: string[] = assembly.shapeWarning === undefined ? [] : [assembly.shapeWarning];
  if (mach >= start) {
    const r = at(mach);
    return {
      cnAlpha: finiteResult('body C_Nα', r.cnAlpha),
      cp: finiteResult('body CP', r.cp),
      method: 'datcom',
      warnings: [...warnings, ...r.warnings],
    };
  }
  const r = at(start);
  const w = (mach - 0.8) / (start - 0.8);
  warnings.push(
    `body normal force: faired linearly in Mach between Niskanen's slender-body term at Mach 0.8 and the DATCOM ${assembly.nose}-cylinder charts, which begin at Mach ${start.toFixed(2)} for this nose (β/f_N = 0.4); the DATCOM prescribes a smooth fairing across the transonic range and gives no values in between (D-064)`,
  );
  return {
    cnAlpha: finiteResult('body C_Nα', (1 - w) * subsonic.cnAlpha + w * r.cnAlpha),
    cp: finiteResult('body CP', (1 - w) * subsonic.cp + w * r.cp),
    method: 'fairing',
    warnings: [...warnings, ...r.warnings],
  };
}
