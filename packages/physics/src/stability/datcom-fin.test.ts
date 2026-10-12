/**
 * BAR-15 to BAR-17 (plan 0028, D-065). Expected values are worked by hand from
 * the digitised chart readings in reference/digitised/*.json (quoted in each
 * test), not by running the code under test.
 */
import { describe, expect, it } from 'vitest';
import { metres, squareMetres, kilogramsPerCubicMetre, mach, radians } from '../units/si.js';
import type { PlacedComponent } from '../geometry/assembly.js';
import type { TrapezoidFinSetComponent } from '../geometry/components.js';
import { finChordFraction, finSetTerm } from './barrowman.js';
import {
  carryOverParameter,
  circularArcSemiwedge,
  exposedWing,
  finAfterbodyLength,
  finCarryOver,
  rectangularWingCnAlpha,
  sonicLeadingEdgeFactor,
  tableValue,
  wingSupersonicCnAlpha,
} from './datcom-fin.js';

const deg = (d: number): number => (d * Math.PI) / 180;

describe('exposed wing and table helpers', () => {
  it('A_e = 4s/(c_r + c_t), λ = c_t/c_r, tan Λ = x_t/s', () => {
    // c_r 0.1, c_t 0.05, s 0.08, x_t 0.06: A = 0.32/0.15 = 2.13333, λ = 0.5, tan Λ = 0.75.
    const w = exposedWing(0.1, 0.05, 0.08, 0.06);
    expect(w.aspectRatio).toBeCloseTo(2.133333, 6);
    expect(w.taperRatio).toBe(0.5);
    expect(w.tanLeadingEdge).toBeCloseTo(0.75, 12);
  });
  it('linear table interpolation, undefined outside', () => {
    const t = [
      [0, 1],
      [2, 5],
    ] as const;
    expect(tableValue(t, 0.5)).toBe(2);
    expect(tableValue(t, 2.1)).toBeUndefined();
  });
});

describe('BAR-15 wing normal-force slope, figure 4.1.3.2-56', () => {
  it('panel (g) right half: β C_Nα = 4 − 2/(Aβ)', () => {
    // A = 2, β = 1: 4 − 1 = 3 per rad.
    expect(rectangularWingCnAlpha(2, 1)).toBeCloseTo(3, 12);
  });
  it('panel (g) left half: C_Nα/A read at Aβ = 0.5 is 1.603', () => {
    // A = 1, β = 0.5: Aβ = 0.5, C_Nα = 1.603 × 1.
    expect(rectangularWingCnAlpha(1, 0.5)).toBeCloseTo(1.603, 6);
  });
  it('panel (e) λ = 1/2, A tan Λ = 2, right half u = 1.2: β C_Nα = 3.252', () => {
    // β = 1 (M = √2), tan Λ = 0.8 so u = 2 − 0.8 = 1.2; A = 2.5 (c_r 1, c_t 0.5, s 0.9375, x_t 0.75).
    const w = exposedWing(1, 0.5, 0.9375, 0.75);
    const r = wingSupersonicCnAlpha(w, Math.SQRT2);
    expect(r.cnAlpha).toBeCloseTo(3.252, 6);
  });
  it('interpolates in A tan Λ: 2.5 between curves 2 (3.252) and 3 (3.628) is 3.440', () => {
    // A = 3.125 (s = 1.171875), tan Λ = 0.8, x_t = 0.9375.
    const w = exposedWing(1, 0.5, 1.171875, 0.9375);
    expect(wingSupersonicCnAlpha(w, Math.SQRT2).cnAlpha).toBeCloseTo(3.44, 6);
  });
  it('interpolates in λ: 0.375 between panels (c) 3.604 and (e) 3.252 is 3.428', () => {
    // c_r 1, c_t 0.375: A = 4s/1.375 = 2.5 needs s = 0.859375; x_t = 0.8 s = 0.6875.
    const w = exposedWing(1, 0.375, 0.859375, 0.6875);
    expect(wingSupersonicCnAlpha(w, Math.SQRT2).cnAlpha).toBeCloseTo(3.428, 6);
  });
  it('panel (f) left half: λ = 1, A tan Λ = 1, u = 0.6 gives tan Λ C_Nα = 1.846', () => {
    // tan Λ = 1, β = 0.6 (M = √1.36); parallelogram c 1, s 0.5, x_t 0.5: A = 1.
    const w = exposedWing(1, 1, 0.5, 0.5);
    expect(wingSupersonicCnAlpha(w, Math.sqrt(1.36)).cnAlpha).toBeCloseTo(1.846, 6);
  });
  it('reports planforms outside the charts instead of extrapolating', () => {
    const forward = exposedWing(1, 0.5, 1, -0.2);
    expect(wingSupersonicCnAlpha(forward, 2).cnAlpha).toBeUndefined();
    const tooSwept = exposedWing(1, 0.5, 2, 4); // A tan Λ = 5.33 × 2 = 10.7
    expect(wingSupersonicCnAlpha(tooSwept, 2).cnAlpha).toBeUndefined();
    const nearlyUnswept = exposedWing(1, 0.5, 1, 0.05); // A tan Λ = 0.13, λ < 1
    expect(wingSupersonicCnAlpha(nearlyUnswept, 2).cnAlpha).toBeUndefined();
  });
});

describe('BAR-15 step 2: sonic-leading-edge correction, figure 4.1.3.2-60', () => {
  it('reads a curve point and interpolates in δ⊥', () => {
    // z = 0.65: 12° curve 0.910, 8° curve 0.936; 10° is their mean 0.923.
    expect(sonicLeadingEdgeFactor(deg(12), 0.65)).toBeCloseTo(0.91, 9);
    expect(sonicLeadingEdgeFactor(deg(10), 0.65)).toBeCloseTo(0.923, 9);
    expect(sonicLeadingEdgeFactor(0, 0.65)).toBe(1);
    expect(sonicLeadingEdgeFactor(deg(80), 0.9)).toBeUndefined();
  });
  it('is 1 away from the sonic region (beyond each curve end on the 1.0 line)', () => {
    expect(sonicLeadingEdgeFactor(deg(12), 0.3)).toBe(1);
    expect(sonicLeadingEdgeFactor(deg(12), 1.9)).toBe(1);
  });
  it('circular-arc semiwedge: tan(δ⊥/2) = t/(c cos Λ)', () => {
    // RM-10: t 0.454, c 9.07, Λ 60°: τ = 0.454/4.535 = 0.100110, δ⊥ = 2 atan τ = 0.199554 rad (11.43°).
    expect(circularArcSemiwedge(0.454, 9.07, Math.tan(deg(60)))).toBeCloseTo(0.199554, 5);
  });
  it('multiplies the theoretical value', () => {
    // Panel (f), A tan Λ = 1, u = 0.6 → 1.846 (above); z = 0.6 with δ⊥ = 12°: curve 12 at 0.57 = 0.959,
    // 0.62 = 0.928, so 0.6 → 0.9404; 1.846 × 0.9404 = 1.73598.
    const w = exposedWing(1, 1, 0.5, 0.5);
    expect(wingSupersonicCnAlpha(w, Math.sqrt(1.36), deg(12)).cnAlpha).toBeCloseTo(1.73598, 4);
  });
});

describe('BAR-16, BAR-17 body carry-over', () => {
  it('slender-body K_B(W) = (1 + d/b)² − (1 + d/b) and a.c. from figure 4.3.2.2-36b', () => {
    // r 0.05, s 0.1: d = 0.1, b = 0.3, d/b = 1/3: K_W(B) = 4/3, K_B(W) = 16/9 − 4/3 = 4/9.
    // Wing c 0.1, x_t 0.05 → A = 2, λ = 1, tan Λ = 0.5; β = 0.4 (M = √1.16): parameter
    // 0.4 × 2 × 2 × (0.5/0.4 + 1) = 3.6 ≤ 4. a.c. = min(0.5, 2 × 2 × 0.5/8) c_r = 0.25 × 0.1 = 0.025.
    const w = exposedWing(0.1, 0.1, 0.1, 0.05);
    expect(carryOverParameter(w, 0.4)).toBeCloseTo(3.6, 12);
    const co = finCarryOver(w, 0.1, 0.1, 0.05, 0, 3, Math.sqrt(1.16));
    expect(co.method).toBe('slender-body (figure 4.3.1.2-10)');
    expect(co.kWB).toBeCloseTo(4 / 3, 12);
    expect(co.kBW).toBeCloseTo(4 / 9, 12);
    expect(co.acFromRootLe).toBeCloseTo(0.025, 12);
  });
  it('figure 4.3.1.2-11b without afterbody, a.c. from figure 4.3.2.2-37b', () => {
    // c 0.1, s 0.1, x_t 0.1: A = 2, λ = 1, tan Λ = 1; β = 1 (M = √2): parameter 1·2·2·2 = 8 > 4.
    // β d/c_r = 1, β cot Λ = 1: chart 1.531. (C_Lα)_e = 2 given; b/d − 1 = 2:
    // K_B(W) = 1.531/(1 × 2 × 2 × 2) = 0.191375. a.c. 0.668 c_r = 0.0668.
    const w = exposedWing(0.1, 0.1, 0.1, 0.1);
    const co = finCarryOver(w, 0.1, 0.1, 0.05, 0, 2, Math.SQRT2);
    expect(co.method).toBe('figure 4.3.1.2-11b');
    expect(co.kBW).toBeCloseTo(0.191375, 9);
    expect(co.acFromRootLe).toBeCloseTo(0.0668, 9);
  });
  it('figure 4.3.1.2-11a when the afterbody is at least β d long', () => {
    // Same wing, afterbody 0.11 > β d = 0.1: chart 11a curve 1.0 at v = 1: 2.966 → K_B(W) = 0.37075;
    // a.c. 1.000 c_r.
    const w = exposedWing(0.1, 0.1, 0.1, 0.1);
    const co = finCarryOver(w, 0.1, 0.1, 0.05, 0.11, 2, Math.SQRT2);
    expect(co.method).toBe('figure 4.3.1.2-11a');
    expect(co.kBW).toBeCloseTo(0.37075, 9);
    expect(co.acFromRootLe).toBeCloseTo(0.1, 9);
  });
  it('interpolates between curves in tan Λ/β', () => {
    // tan Λ = 0.75 at β = 1: w = 0.75 between curves 2 (w 0.5, 1.937 at v = 1) and 1 (w 1, 1.531):
    // 1.937 + (1.531 − 1.937) × 0.5 = 1.734; K_B(W) = 1.734/8 = 0.21675.
    const w = exposedWing(0.1, 0.1, 0.1, 0.075);
    const co = finCarryOver(w, 0.1, 0.1, 0.05, 0, 2, Math.SQRT2);
    expect(co.kBW).toBeCloseTo(0.21675, 9);
  });
  it('leaves the carry-over out, with a warning, outside the digitised chart', () => {
    // β d/c_r = 1.732 × 0.1/0.05 = 3.46 > 2.6 (11b's digitised end).
    const w = exposedWing(0.05, 0.05, 0.1, 0.05);
    const co = finCarryOver(w, 0.05, 0.1, 0.05, 0, 2, 2);
    expect(co.method).toBe('not applied');
    expect(co.kBW).toBe(0);
    expect(co.warnings.length).toBe(1);
  });
  it('afterbody length behind the fin root trailing edge', () => {
    const tube = {
      kind: 'bodyTube',
      length: metres(1),
      outerRadius: metres(0.05),
      wallThickness: metres(0.001),
      density: kilogramsPerCubicMetre(1000),
    } as const;
    const fins: TrapezoidFinSetComponent = {
      kind: 'finSet',
      count: 4,
      rootChord: metres(0.1),
      tipChord: metres(0.1),
      sweep: metres(0),
      span: metres(0.1),
      thickness: metres(0.003),
      density: kilogramsPerCubicMetre(1000),
      bodyRadius: metres(0.05),
    };
    const comps: PlacedComponent[] = [
      { component: tube, position: metres(0) },
      { component: fins, position: metres(0.7) },
    ];
    expect(finAfterbodyLength(comps, 1)).toBeCloseTo(0.2, 12);
  });
});

describe('finSetTerm with the DATCOM method', () => {
  const fins: TrapezoidFinSetComponent = {
    kind: 'finSet',
    count: 4,
    rootChord: metres(0.1),
    tipChord: metres(0.1),
    sweep: metres(0),
    span: metres(0.075),
    thickness: metres(0.003),
    density: kilogramsPerCubicMetre(1000),
    bodyRadius: metres(0.05),
  };
  it('rectangular fins at Mach √2: [K_W(B) + K_B(W)] N (C_Nα)₁ with the carry-over at the root LE', () => {
    // c 0.1, s 0.075: A_e = 0.3/0.2 = 1.5; panel (g) with Aβ = 1.5: C_Nα = 4 − 2/1.5 = 2.666667;
    // (C_Nα)₁ = C_Nα A_fin/A_ref = 2.666667 (A_ref = A_fin = 0.0075). Parameter 1 × 1.5 × 2 × 1 = 3 ≤ 4:
    // d/b = 0.1/0.25 = 0.4, K_W(B) = 1.4, K_B(W) = 1.96 − 1.4 = 0.56; a.c. 0 (tan Λ = 0).
    // Four fins, no roll reduction: factor 2. C_Nα = 1.96 × 2 × 2.666667 = 10.453333; carry share 0.56/1.96.
    // Fin CP: quarter chord 0.025 + (f − 0.25) × 0.1, f = finChordFraction(√2, 2s²/A_fin = 1.5).
    const t = finSetTerm(
      fins,
      squareMetres(0.0075),
      mach(Math.SQRT2),
      radians(0),
      false,
      0,
      undefined,
      {
        method: 'datcom',
        afterbodyLength: 0,
      },
    );
    const f = finChordFraction(mach(Math.SQRT2), 1.5);
    const share = 0.56 / 1.96;
    expect(t.supersonicMethod).toBe('datcom');
    expect(t.cnAlpha).toBeCloseTo(10.453333, 5);
    expect(t.carryOver.cnAlpha).toBeCloseTo(10.453333 * share, 5);
    expect(t.cpX).toBeCloseTo((1 - share) * (0.025 + (f - 0.25) * 0.1), 12);
  });
  it('is continuous at the end of the fairing (Mach 1.4)', () => {
    const opts = { method: 'datcom', afterbodyLength: 0 } as const;
    const below = finSetTerm(
      fins,
      squareMetres(0.0075),
      mach(1.4 - 1e-9),
      radians(0),
      false,
      0,
      undefined,
      opts,
    );
    const at = finSetTerm(
      fins,
      squareMetres(0.0075),
      mach(1.4),
      radians(0),
      false,
      0,
      undefined,
      opts,
    );
    expect(below.cnAlpha).toBeCloseTo(at.cnAlpha, 6);
    expect(below.cpX).toBeCloseTo(at.cpX, 6);
  });
  it("the 'niskanen' method is unchanged: no carry-over", () => {
    const t = finSetTerm(fins, squareMetres(0.01), mach(2), radians(0), false);
    expect(t.supersonicMethod).toBe('niskanen');
    expect(t.carryOverFactor).toBe(0);
    expect(t.carryOver.cnAlpha).toBe(0);
  });
});
