/**
 * Fixed-step RK4 and the adaptive Dormand–Prince RK5(4) pair (plan 0010,
 * DYN-10, DYN-11), on plain state vectors.
 *
 * RK4: Niskanen (2009) eqs. (4.20) to (4.22), p. 66. Dormand–Prince: the
 * method CLAUDE.md 6.5 requires; coefficients of the RK5(4)7M pair of
 * Dormand and Prince (1980), Table 2, checked here by the exact consistency
 * sums (Σb = Σb* = 1, row sums equal c, Σb c = 1/2, Σb c² = 1/3) and by the
 * order tests in integrators.test.ts, which would fail on any wrong entry
 * (D-037). The step-size controller is the project's own documented rule.
 */
import { InvalidInputError, NonFiniteResultError } from '../errors.js';

export type Derivative = (t: number, y: readonly number[]) => number[];

function axpy(y: readonly number[], h: number, k: readonly number[]): number[] {
  const out = new Array<number>(y.length);
  for (let i = 0; i < y.length; i++) out[i] = (y[i] ?? 0) + h * (k[i] ?? 0);
  return out;
}

function checkFinite(label: string, t: number, y: readonly number[]): void {
  for (let i = 0; i < y.length; i++) {
    const v = y[i];
    if (v === undefined || !Number.isFinite(v)) {
      throw new NonFiniteResultError(
        `${label} component ${String(i)} at t = ${String(t)} s`,
        v ?? Number.NaN,
      );
    }
  }
}

/** DYN-10. One classical RK4 step, eqs. (4.20) to (4.22). */
export function rk4Step(f: Derivative, t: number, y: readonly number[], h: number): number[] {
  if (!(h > 0) || !Number.isFinite(h))
    throw new InvalidInputError('time step', h, 'must be greater than 0 s');
  const k1 = f(t, y);
  const k2 = f(t + h / 2, axpy(y, h / 2, k1));
  const k3 = f(t + h / 2, axpy(y, h / 2, k2));
  const k4 = f(t + h, axpy(y, h, k3));
  const out = new Array<number>(y.length);
  for (let i = 0; i < y.length; i++) {
    out[i] =
      (y[i] ?? 0) + (h / 6) * ((k1[i] ?? 0) + 2 * (k2[i] ?? 0) + 2 * (k3[i] ?? 0) + (k4[i] ?? 0));
  }
  checkFinite('RK4 state', t + h, out);
  return out;
}

// Dormand–Prince RK5(4)7M, Table 2 of Dormand and Prince (1980).
const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1] as const;
const A: readonly (readonly number[])[] = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
];
/** Fifth-order weights (the propagated solution). */
const B5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0] as const;
/** Embedded fourth-order weights (for the error estimate). */
const B4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40] as const;

export const DORMAND_PRINCE_TABLEAU = { c: C, a: A, b5: B5, b4: B4 } as const;

export interface DormandPrinceStep {
  /** Fifth-order solution at t + h. */
  readonly y5: number[];
  /** Fourth-order embedded solution at t + h. */
  readonly y4: number[];
  /** |y5 − y4| per component. */
  readonly errorEstimate: number[];
}

/** DYN-11. One Dormand–Prince step with both solutions. */
export function dormandPrinceStep(
  f: Derivative,
  t: number,
  y: readonly number[],
  h: number,
): DormandPrinceStep {
  if (!(h > 0) || !Number.isFinite(h))
    throw new InvalidInputError('time step', h, 'must be greater than 0 s');
  const k: number[][] = [];
  for (let s = 0; s < 7; s++) {
    const ys = [...y];
    const row = A[s] ?? [];
    for (let j = 0; j < row.length; j++) {
      const aij = row[j] ?? 0;
      if (aij === 0) continue;
      const kj = k[j] ?? [];
      for (let i = 0; i < ys.length; i++) ys[i] = (ys[i] ?? 0) + h * aij * (kj[i] ?? 0);
    }
    k.push(f(t + h * (C[s] ?? 0), ys));
  }
  const y5 = [...y];
  const y4 = [...y];
  for (let s = 0; s < 7; s++) {
    const ks = k[s] ?? [];
    for (let i = 0; i < y.length; i++) {
      y5[i] = (y5[i] ?? 0) + h * (B5[s] ?? 0) * (ks[i] ?? 0);
      y4[i] = (y4[i] ?? 0) + h * (B4[s] ?? 0) * (ks[i] ?? 0);
    }
  }
  checkFinite('Dormand–Prince state', t + h, y5);
  const errorEstimate = y5.map((v, i) => Math.abs(v - (y4[i] ?? 0)));
  return { y5, y4, errorEstimate };
}

export interface AdaptiveOptions {
  readonly relativeTolerance: number;
  readonly absoluteTolerance: number;
  readonly maxStep: number;
  readonly minStep: number;
}

/**
 * Error norm used by the controller: the root mean square of the component
 * errors scaled by atol + rtol·max(|y|, |y_new|); a step is accepted when
 * the norm is at most 1.
 */
export function errorNorm(
  err: readonly number[],
  y: readonly number[],
  yNew: readonly number[],
  o: AdaptiveOptions,
): number {
  let sum = 0;
  for (let i = 0; i < err.length; i++) {
    const scale =
      o.absoluteTolerance +
      o.relativeTolerance * Math.max(Math.abs(y[i] ?? 0), Math.abs(yNew[i] ?? 0));
    sum += ((err[i] ?? 0) / scale) ** 2;
  }
  return Math.sqrt(sum / Math.max(1, err.length));
}

/**
 * Step-size rule (project convention, D-037): after a step with error norm e,
 * the next step is h·min(5, max(0.2, 0.9 e^(−1/5))); a rejected step is retried
 * with the reduced size; steps never exceed maxStep nor fall below minStep.
 */
export function nextStepSize(h: number, e: number, o: AdaptiveOptions): number {
  const factor = e === 0 ? 5 : Math.min(5, Math.max(0.2, 0.9 * e ** -0.2));
  return Math.min(o.maxStep, Math.max(o.minStep, h * factor));
}
