/** Integrator order tests (plan 0010, DYN-10, DYN-11, D-037). */
import { describe, expect, it } from 'vitest';
import { NonFiniteResultError } from '../errors.js';
import {
  DORMAND_PRINCE_TABLEAU,
  dormandPrinceStep,
  errorNorm,
  nextStepSize,
  rk4Step,
  type Derivative,
} from './integrators.js';

const decay: Derivative = (_t, y) => [-(y[0] ?? 0)];
const oscillator: Derivative = (_t, y) => [y[1] ?? 0, -(y[0] ?? 0)];

function integrate(
  step: (f: Derivative, t: number, y: number[], h: number) => number[],
  f: Derivative,
  y0: number[],
  T: number,
  n: number,
): number[] {
  let y = y0;
  const h = T / n;
  for (let i = 0; i < n; i++) y = step(f, i * h, y, h);
  return y;
}

describe('tableau consistency (Dormand and Prince 1980, Table 2)', () => {
  it('Σb₅ = Σb₄ = 1, row sums equal c, Σb c = 1/2, Σb c² = 1/3', () => {
    const { a, b5, b4, c } = DORMAND_PRINCE_TABLEAU;
    const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);
    expect(sum(b5)).toBeCloseTo(1, 15);
    expect(sum(b4)).toBeCloseTo(1, 15);
    a.forEach((row, i) => {
      expect(sum(row)).toBeCloseTo(c[i] ?? 0, 14);
    });
    expect(sum(b5.map((b, i) => b * (c[i] ?? 0)))).toBeCloseTo(0.5, 15);
    expect(sum(b5.map((b, i) => b * (c[i] ?? 0) ** 2))).toBeCloseTo(1 / 3, 15);
  });
});

describe('DYN-10 RK4', () => {
  it('ẏ = −y over t = 1: error falls 16× per halving (order 4); one step by hand', () => {
    // One RK4 step of ẏ = −y from y = 1 with h = 0.1: k1 = −1, k2 = −0.95, k3 = −0.9525, k4 = −0.90475;
    // y1 = 1 − 0.1/6 × (1 + 1.9 + 1.905 + 0.90475) = 1 − 0.0951625 = 0.9048375 (exact e^−0.1 = 0.9048374).
    expect(rk4Step(decay, 0, [1], 0.1)[0]).toBeCloseTo(0.9048375, 7);
    const e1 = Math.abs((integrate(rk4Step, decay, [1], 1, 10)[0] ?? 0) - Math.exp(-1));
    const e2 = Math.abs((integrate(rk4Step, decay, [1], 1, 20)[0] ?? 0) - Math.exp(-1));
    const e3 = Math.abs((integrate(rk4Step, decay, [1], 1, 40)[0] ?? 0) - Math.exp(-1));
    expect(e1 / e2).toBeGreaterThan(14);
    expect(e1 / e2).toBeLessThan(18);
    expect(e2 / e3).toBeGreaterThan(14);
  });
  it('harmonic oscillator over 2π with 200 steps returns within 1e-6; a NaN derivative is caught', () => {
    const y = integrate(rk4Step, oscillator, [1, 0], 2 * Math.PI, 200);
    expect(y[0]).toBeCloseTo(1, 6);
    expect(y[1]).toBeCloseTo(0, 6);
    expect(() => rk4Step(() => [Number.NaN], 0, [1], 0.1)).toThrow(NonFiniteResultError);
  });
});

describe('DYN-11 Dormand–Prince RK5(4)', () => {
  const dp5 = (f: Derivative, t: number, y: number[], h: number): number[] =>
    dormandPrinceStep(f, t, y, h).y5;
  const dp4 = (f: Derivative, t: number, y: number[], h: number): number[] =>
    dormandPrinceStep(f, t, y, h).y4;
  it('the fifth-order solution of ẏ = −y gains about 32× per halving; the embedded fourth-order 16×', () => {
    const exact = Math.exp(-1);
    const e5 = [10, 20, 40].map((n) =>
      Math.abs((integrate(dp5, decay, [1], 1, n)[0] ?? 0) - exact),
    );
    const e4 = [10, 20, 40].map((n) =>
      Math.abs((integrate(dp4, decay, [1], 1, n)[0] ?? 0) - exact),
    );
    expect((e5[0] ?? 0) / (e5[1] ?? 1)).toBeGreaterThan(25);
    expect((e5[1] ?? 0) / (e5[2] ?? 1)).toBeGreaterThan(25);
    expect((e4[0] ?? 0) / (e4[1] ?? 1)).toBeGreaterThan(13);
    expect((e4[0] ?? 0) / (e4[1] ?? 1)).toBeLessThan(20);
    expect(e5[2]).toBeLessThan(1e-9);
  });
  it('the oscillator over 2π: fifth order, and the error estimate tracks the true local error within a factor of 3', () => {
    const e5 = [20, 40, 80].map((n) =>
      Math.hypot(
        (integrate(dp5, oscillator, [1, 0], 2 * Math.PI, n)[0] ?? 0) - 1,
        integrate(dp5, oscillator, [1, 0], 2 * Math.PI, n)[1] ?? 0,
      ),
    );
    expect((e5[0] ?? 0) / (e5[1] ?? 1)).toBeGreaterThan(24);
    expect((e5[1] ?? 0) / (e5[2] ?? 1)).toBeGreaterThan(24);
    const step = dormandPrinceStep(oscillator, 0, [1, 0], 0.5);
    const trueErr4 = Math.hypot(
      (step.y4[0] ?? 0) - Math.cos(0.5),
      (step.y4[1] ?? 0) + Math.sin(0.5),
    );
    const est = Math.hypot(step.errorEstimate[0] ?? 0, step.errorEstimate[1] ?? 0);
    expect(est / trueErr4).toBeGreaterThan(1 / 3);
    expect(est / trueErr4).toBeLessThan(3);
  });
  it('adaptive stepping holds a 1e-9 tolerance over 100 periods of the oscillator', () => {
    const o = { relativeTolerance: 1e-9, absoluteTolerance: 1e-12, maxStep: 1, minStep: 1e-9 };
    let t = 0;
    let y = [1, 0];
    let h = 0.1;
    const T = 200 * Math.PI;
    let steps = 0;
    while (t < T) {
      const hh = Math.min(h, T - t);
      const r = dormandPrinceStep(oscillator, t, y, hh);
      const e = errorNorm(r.errorEstimate, y, r.y5, o);
      if (e <= 1) {
        y = r.y5;
        t += hh;
      }
      h = nextStepSize(hh, e, o);
      steps++;
      if (steps > 1e6) throw new Error('too many steps');
    }
    expect(y[0]).toBeCloseTo(1, 6);
    expect(y[1]).toBeCloseTo(0, 6);
    expect(steps).toBeLessThan(20000);
  });
});
