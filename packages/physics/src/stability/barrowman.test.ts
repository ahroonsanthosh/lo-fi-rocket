/**
 * Barrowman stability tests (plan 0006). Hand values from
 * reference/rockets/hand-checks.md and the closed forms worked in the
 * comments; OpenRocket values from reference/rockets/values.csv (black-box
 * reference, OpenRocket-equivalent mode, D-016).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError, NotImplementedError } from '../errors.js';
import type { PlacedComponent } from '../geometry/assembly.js';
import type { TrapezoidFinSetComponent } from '../geometry/components.js';
import {
  R1_COMPONENTS,
  R2_COMPONENTS,
  R3_COMPONENTS,
  R4_COMPONENTS,
  R5_COMPONENTS,
  REFERENCE_MOTORS,
} from '../geometry/reference-rockets.js';
import {
  kilograms,
  kilogramsPerCubicMetre,
  mach,
  metres,
  radians,
  squareMetres,
} from '../units/si.js';
import {
  bodyTerm,
  centreOfPressure,
  finRollFactor,
  finSetTerm,
  maximumBodyDiameter,
  noseConeTerm,
  prandtlBeta,
  rocketStability,
  stabilityMargin,
  transitionTerm,
  type CentreOfPressureOptions,
  DEFAULT_TRANSONIC_FIN_INTERPOLATION,
  type TransonicFinInterpolation,
} from './barrowman.js';

const OR_MODE: CentreOfPressureOptions = {
  mach: mach(0.3),
  rollAngle: 'worst',
  finRollReduction: false,
};
const DISPLAY_MODE: CentreOfPressureOptions = {
  mach: mach(0.3),
  rollAngle: 'worst',
  finRollReduction: true,
};
const first = <K extends PlacedComponent['component']['kind']>(
  list: readonly PlacedComponent[],
  kind: K,
): Extract<PlacedComponent['component'], { kind: K }> => {
  const found = list.find((p) => p.component.kind === kind);
  if (found === undefined) throw new Error(`no ${kind}`);
  return found.component as Extract<PlacedComponent['component'], { kind: K }>;
};

describe('BAR-1 Prandtl factor, eq. (3.13)', () => {
  it('β = √(1 − M²): M = 0.3 → 0.953939; M = 0 → 1', () => {
    // √(1 − 0.09) = √0.91 = 0.9539392
    expect(prandtlBeta(mach(0.3))).toBeCloseTo(0.953939, 6);
    expect(prandtlBeta(mach(0))).toBe(1);
  });
  it('M ≥ 1 is not implemented; NaN and negative are invalid', () => {
    expect(() => prandtlBeta(mach(1))).toThrow(NotImplementedError);
    expect(() => prandtlBeta(mach(1.5))).toThrow(NotImplementedError);
    expect(() => prandtlBeta(-0.1 as never)).toThrow(InvalidInputError);
  });
});

describe('BAR-2, BAR-3 body components, eqs. (3.19) and (3.28)', () => {
  it('R1 conical nose (hand-checks.md): C_Nα = 2, X = 2L/3 = 0.066667 m', () => {
    // A(l) = πR² = A_ref, A(0) = 0 → C_Nα = 2(A_ref − 0)/A_ref = 2.
    // V = πR²L/3 → X = (L·πR² − πR²L/3)/πR² = 2L/3 = 0.0666667.
    const nose = first(R1_COMPONENTS, 'noseCone');
    const term = noseConeTerm(nose, squareMetres(Math.PI * 0.025 ** 2));
    expect(term.cnAlpha).toBeCloseTo(2, 9);
    expect(term.cpX).toBeCloseTo(2 / 30, 7);
  });
  it('Von Kármán noses (R3, R5): V = πR²L/2 exactly, so X = L/2', () => {
    // Haack (A.9), (A.10) with C = 0: r² = (R²/π)(θ − sin 2θ/2), x = L(1 − cos θ)/2, dx = (L/2) sin θ dθ.
    // V = ∫π r² dx = R²(L/2)∫₀^π (θ − sin 2θ/2) sin θ dθ = R²(L/2)(π − 0) = πR²L/2
    // (∫₀^π θ sin θ dθ = π; ∫₀^π sin 2θ sin θ/2 dθ = ∫₀^π sin²θ cos θ dθ = [sin³θ/3]₀^π = 0).
    // Hence X = L − V/(πR²) = L/2: 0.050 for R3 (L = 0.1), 0.065 for R5 (L = 0.13).
    const r3 = noseConeTerm(first(R3_COMPONENTS, 'noseCone'), squareMetres(Math.PI * 0.0127 ** 2));
    const r5 = noseConeTerm(first(R5_COMPONENTS, 'noseCone'), squareMetres(Math.PI * 0.016 ** 2));
    expect(r3.cnAlpha).toBeCloseTo(2, 9);
    expect(r3.cpX).toBeCloseTo(0.05, 7);
    expect(r5.cpX).toBeCloseTo(0.065, 7);
  });
  it('tangent ogive noses (R2, R4) against the closed-form volume', () => {
    // Tangent ogive (A.2) to (A.5), κ = 1: r(x) = √(ρ² − (L − x)²) − a, ρ = (R² + L²)/(2R), a = ρ − R.
    // V = π∫₀^L (√(ρ² − u²) − a)² du = π[(ρ² + a²)L − L³/3 − 2a·(L√(ρ² − L²) + ρ² asin(L/ρ))/2].
    // R2: L = 0.15, R = 0.027: ρ = 0.4301667, a = 0.4031667, V = 1.849047e-4 m³,
    //     X = L − V/(πR²) = 0.15 − 1.849047e-4/2.290221e-3 = 0.069263.
    // R4: L = 0.2, R = 0.033: ρ = 0.6225606, a = 0.5895606, V = 3.677533e-4, X = 0.092507.
    const closedForm = (L: number, R: number): number => {
      const rho = (R * R + L * L) / (2 * R);
      const a = rho - R;
      const V =
        Math.PI *
        ((rho * rho + a * a) * L -
          L ** 3 / 3 -
          a * (L * Math.sqrt(rho * rho - L * L) + rho * rho * Math.asin(L / rho)));
      return L - V / (Math.PI * R * R);
    };
    expect(closedForm(0.15, 0.027)).toBeCloseTo(0.069263, 6);
    const r2 = noseConeTerm(first(R2_COMPONENTS, 'noseCone'), squareMetres(Math.PI * 0.027 ** 2));
    const r4 = noseConeTerm(first(R4_COMPONENTS, 'noseCone'), squareMetres(Math.PI * 0.033 ** 2));
    expect(r2.cpX).toBeCloseTo(closedForm(0.15, 0.027), 8);
    expect(r4.cpX).toBeCloseTo(closedForm(0.2, 0.033), 8);
    expect(r4.cpX).toBeCloseTo(0.092507, 6);
  });
  it('R2 conical boat tail: C_Nα = −1.111111, X_B = 0.023333 m (frustum closed form)', () => {
    // A(0) = π·0.027² = π·7.29e-4, A(l) = π·0.018² = π·3.24e-4, A_ref = π·7.29e-4.
    // C_Nα = 2(A(l) − A(0))/A_ref = 2(3.24 − 7.29)/7.29 = −1.1111111.
    // V = πl(r_f² + r_f r_a + r_a²)/3 = π·0.05·(7.29e-4 + 4.86e-4 + 3.24e-4)/3 = π·2.565e-5 = 8.05818e-5 m³.
    // X_B = (l A(l) − V)/(A(l) − A(0)) = π(1.62e-5 − 2.565e-5)/π(3.24e-4 − 7.29e-4) = 9.45e-6/4.05e-4 = 0.0233333.
    const term = transitionTerm(
      first(R2_COMPONENTS, 'transition'),
      squareMetres(Math.PI * 0.027 ** 2),
    );
    expect(term.cnAlpha).toBeCloseTo(-1.111111, 6);
    expect(term.cpX).toBeCloseTo(0.0233333, 7);
    expect(term.cpX).toBeCloseTo(7 / 300, 9);
  });
  it('a cylinder produces no normal force and no CP', () => {
    const term = bodyTerm(1, 1, 5, 2, 1);
    expect(term.cnAlpha).toBe(0);
    expect(Number.isNaN(term.cpX)).toBe(true);
  });
});

describe('BAR-7 fin count and roll angle factor, eq. (3.54)', () => {
  it('three fins: 1.50[1 − 0.15 cos²(3θ/2)]: θ = 0 → 1.275, θ = 60° → 1.50; without reduction 1.50', () => {
    expect(finRollFactor(3, radians(0), true)).toBeCloseTo(1.275, 12);
    expect(finRollFactor(3, radians(Math.PI / 3), true)).toBeCloseTo(1.5, 12);
    expect(finRollFactor(3, 'worst', true)).toBeCloseTo(1.275, 12);
    expect(finRollFactor(3, 'worst', false)).toBe(1.5);
    expect(finRollFactor(3, radians(0.7), false)).toBe(1.5);
  });
  it('four fins: 2.00[1 − 0.06 sin²(2θ)]: θ = 45° → 1.88, θ = 0 → 2.00; worst 1.88', () => {
    expect(finRollFactor(4, radians(Math.PI / 4), true)).toBeCloseTo(1.88, 12);
    expect(finRollFactor(4, radians(0), true)).toBeCloseTo(2, 12);
    expect(finRollFactor(4, 'worst', true)).toBeCloseTo(1.88, 12);
    expect(finRollFactor(4, 'worst', false)).toBe(2);
  });
  it('one and two fins: Σ sin²(2πk/N + θ): N = 1 at 90° → 1, N = 2 at 90° → 2, worst → 0', () => {
    expect(finRollFactor(1, radians(Math.PI / 2), true)).toBeCloseTo(1, 12);
    expect(finRollFactor(2, radians(Math.PI / 2), true)).toBeCloseTo(2, 12);
    expect(finRollFactor(1, 'worst', true)).toBeCloseTo(0, 12);
    expect(finRollFactor(2, 'worst', false)).toBeCloseTo(0, 12);
  });
  it('five to eight fins: 2.37, 2.74, 2.99, 3.24 regardless of θ or mode', () => {
    expect(finRollFactor(5, radians(1), true)).toBe(2.37);
    expect(finRollFactor(6, 'worst', false)).toBe(2.74);
    expect(finRollFactor(7, radians(2), true)).toBe(2.99);
    expect(finRollFactor(8, 'worst', true)).toBe(3.24);
  });
  it('nine fins are outside the source; zero or fractional counts are invalid', () => {
    expect(() => finRollFactor(9, 'worst', true)).toThrow(NotImplementedError);
    expect(() => finRollFactor(0, 'worst', true)).toThrow(InvalidInputError);
    expect(() => finRollFactor(2.5, 'worst', true)).toThrow(InvalidInputError);
    expect(() => finRollFactor(3, radians(Number.NaN), true)).toThrow(InvalidInputError);
  });
});

describe('BAR-5, BAR-6, BAR-8 fin set, eqs. (3.34), (3.40), (3.55), (3.56): R1 by hand', () => {
  const fins = first(R1_COMPONENTS, 'finSet');
  const Aref = squareMetres(Math.PI * 0.025 ** 2);
  it('X_f = 0.041667 m from the root leading edge', () => {
    // (x_t/3)(c_r + 2c_t)/(c_r + c_t) = (0.05/3)(0.2/0.15) = 0.0222222;
    // (1/6)(c_r² + c_t² + c_r c_t)/(c_r + c_t) = (1/6)(0.01 + 0.0025 + 0.005)/0.15 = 0.0194444. Sum 0.0416667.
    expect(finSetTerm(fins, Aref, mach(0.3), 'worst', false).cpX).toBeCloseTo(0.0416667, 7);
  });
  it('(C_Nα)₁ = 8.3195, K_T(B) = 1.238095, (C_Nα)_T(B) = 15.4506 without reduction, 13.1330 with it', () => {
    // A_fin = 0.0060, s² = 0.0064, A_ref = 1.963495e-3; tan Γ_c = (0.05 + 0.025 − 0.05)/0.08 = 0.3125, cos Γ_c = 0.954480.
    // 2π s²/A_ref = 20.4800; β s²/(A_fin cos Γ_c) = 0.953939·0.0064/(0.006·0.954480) = 1.066072;
    // √(1 + 1.066072²) = 1.461706; (C_Nα)₁ = 20.48/2.461706 = 8.31944.
    // K = 1 + 0.025/(0.08 + 0.025) = 1.2380952; 1.5 × 8.31944 × 1.2380952 = 15.4504; × 0.85 = 13.1328.
    const or = finSetTerm(fins, Aref, mach(0.3), 'worst', false);
    expect(or.cnAlphaSingleFin).toBeCloseTo(8.3195, 3);
    expect(or.interferenceFactor).toBeCloseTo(1.238095, 6);
    expect(or.finCountFactor).toBe(1.5);
    expect(or.cnAlpha).toBeCloseTo(15.4506, 3);
    const display = finSetTerm(fins, Aref, mach(0.3), 'worst', true);
    expect(display.cnAlpha).toBeCloseTo(13.133, 3);
    expect(display.rollAngle).toBe(0);
  });
  it('the transonic band uses the BAR-12 interpolation (D-056); invalid geometry throws', () => {
    expect(finSetTerm(fins, Aref, mach(0.5), 'worst', false).chordFraction).toBe(0.25);
    expect(finSetTerm(fins, Aref, mach(0.9), 'worst', false).regime).toBe('transonic');
    expect(() => finSetTerm({ ...fins, span: metres(0) }, Aref, mach(0.3), 'worst', false)).toThrow(
      InvalidInputError,
    );
    expect(() =>
      finSetTerm({ ...fins, rootChord: metres(0) }, Aref, mach(0.3), 'worst', false),
    ).toThrow(InvalidInputError);
  });
});

describe('BAR-4, BAR-9 whole rocket: R1 by hand (hand-checks.md)', () => {
  it('OpenRocket-equivalent mode: CP 0.487227 m, stability 2.0041 cal at CG 0.387022', () => {
    // X = (2 × 0.066667 + 15.4506 × 0.541667)/(2 + 15.4506) = 8.5025/17.4506 = 0.487227.
    const r = centreOfPressure(R1_COMPONENTS, OR_MODE);
    expect(r.cp).toBeCloseTo(0.487227, 6);
    expect(r.cnAlpha).toBeCloseTo(17.4506, 3);
    expect(r.referenceDiameter).toBe(0.05);
    expect(r.contributions.map((c) => c.kind)).toEqual(['noseCone', 'finSet']);
    expect(stabilityMargin(r.cp, metres(0.387022), r.referenceDiameter)).toBeCloseTo(2.0041, 4);
    expect(r.finRollReduction).toBe(false);
  });
  it('display mode: CP 0.478890 m, stability 1.8374 cal', () => {
    // X = (2 × 0.066667 + 13.1330 × 0.541667)/15.1330 = 7.2471/15.1330 = 0.478890.
    const r = centreOfPressure(R1_COMPONENTS, DISPLAY_MODE);
    expect(r.cp).toBeCloseTo(0.47889, 6);
    expect(stabilityMargin(r.cp, metres(0.387022), r.referenceDiameter)).toBeCloseTo(1.8374, 4);
    expect(r.finRollReduction).toBe(true);
    expect(r.rollAngle).toBe('worst');
  });
  it('rocketStability: liftoff and burnout margins (CG 0.387022 and 0.364906 from values.csv)', () => {
    const m = REFERENCE_MOTORS.r1;
    const motor = (mass: number) => ({
      mass: kilograms(mass),
      length: metres(m.length),
      diameter: metres(m.diameter),
      aftEnd: metres(m.aftEnd),
    });
    const s = rocketStability(
      R1_COMPONENTS,
      motor(m.totalMass),
      motor(m.totalMass - m.propellantMass),
      OR_MODE,
    );
    expect(s.cgLiftoff).toBeCloseTo(0.387022, 6);
    expect(s.cgBurnout).toBeCloseTo(0.364906, 5);
    expect(s.marginLiftoff).toBeCloseTo(2.0041, 4);
    // (0.487227 − 0.364906)/0.05 = 2.4464
    expect(s.marginBurnout).toBeCloseTo(2.4464, 4);
  });
});

describe('acceptance: CP within 2 % and stability within 1 % of OpenRocket (values.csv) in OpenRocket-equivalent mode', () => {
  const cases = [
    { name: 'R1', components: R1_COMPONENTS, cp: 0.487149, cg: 0.387022, stab: 2.0025, d: 0.05 },
    { name: 'R2', components: R2_COMPONENTS, cp: 0.571037, cg: 0.484548, stab: 1.6016, d: 0.054 },
    { name: 'R3', components: R3_COMPONENTS, cp: 0.449111, cg: 0.356248, stab: 3.656, d: 0.0254 },
    { name: 'R4', components: R4_COMPONENTS, cp: 0.807795, cg: 0.625038, stab: 2.769, d: 0.066 },
    { name: 'R5', components: R5_COMPONENTS, cp: 0.526894, cg: 0.43553, stab: 2.8551, d: 0.032 },
  ];
  for (const c of cases) {
    it(`${c.name}: CP ${String(c.cp)} m, stability ${String(c.stab)} cal`, () => {
      const r = centreOfPressure(c.components, OR_MODE);
      expect(r.referenceDiameter).toBeCloseTo(c.d, 12);
      const cpDiff = Math.abs(r.cp - c.cp) / c.cp;
      expect(cpDiff, 'CP').toBeLessThan(0.02);
      // Observed agreement (independent Python check, plan 0006): 0.016 % to 0.035 %.
      expect(cpDiff, 'CP (observed)').toBeLessThan(5e-4);
      const margin = stabilityMargin(r.cp, metres(c.cg), r.referenceDiameter);
      expect(Math.abs(margin - c.stab) / c.stab, 'stability').toBeLessThan(0.01);
    });
  }
  it('display mode never puts the CP aft of the OpenRocket-equivalent CP, and records the mode', () => {
    for (const c of cases) {
      const or = centreOfPressure(c.components, OR_MODE);
      const display = centreOfPressure(c.components, DISPLAY_MODE);
      expect(display.cp).toBeLessThanOrEqual(or.cp);
      expect(display.finRollReduction).toBe(true);
      expect(or.finRollReduction).toBe(false);
    }
  });
  it('a given roll angle equal to the worst one reproduces the worst case (R1, three fins, θ = 0)', () => {
    const worst = centreOfPressure(R1_COMPONENTS, DISPLAY_MODE);
    const atZero = centreOfPressure(R1_COMPONENTS, { ...DISPLAY_MODE, rollAngle: radians(0) });
    const atSixty = centreOfPressure(R1_COMPONENTS, {
      ...DISPLAY_MODE,
      rollAngle: radians(Math.PI / 3),
    });
    expect(atZero.cp).toBe(worst.cp);
    expect(atSixty.cp).toBeGreaterThan(worst.cp);
    expect(atSixty.cp).toBeCloseTo(centreOfPressure(R1_COMPONENTS, OR_MODE).cp, 12);
  });
});

describe('validation', () => {
  it('needs an aerodynamic component, a positive reference diameter and a positive total C_Nα', () => {
    const tube: PlacedComponent = {
      position: metres(0),
      component: {
        kind: 'bodyTube',
        length: metres(0.5),
        outerRadius: metres(0.025),
        wallThickness: metres(0.001),
        density: kilogramsPerCubicMetre(700),
      },
    };
    expect(() => centreOfPressure([tube], OR_MODE)).toThrow(InvalidInputError);
    expect(() => centreOfPressure([], OR_MODE)).toThrow(InvalidInputError);
    const boatTailOnly = R2_COMPONENTS.filter((p) => p.component.kind === 'transition');
    expect(() => centreOfPressure(boatTailOnly, OR_MODE)).toThrow(/must be greater than 0/);
    expect(() =>
      centreOfPressure(R1_COMPONENTS, { ...OR_MODE, referenceDiameter: metres(0) }),
    ).toThrow(InvalidInputError);
    expect(centreOfPressure(R1_COMPONENTS, { ...OR_MODE, mach: mach(1.0) }).cp).toBeGreaterThan(0);
    expect(() => stabilityMargin(metres(0.5), metres(0.4), metres(0))).toThrow(InvalidInputError);
    expect(maximumBodyDiameter(R2_COMPONENTS)).toBe(0.054);
  });
  it('an explicit reference diameter changes the margin, not the CP', () => {
    const a = centreOfPressure(R1_COMPONENTS, OR_MODE);
    const b = centreOfPressure(R1_COMPONENTS, { ...OR_MODE, referenceDiameter: metres(0.1) });
    expect(b.cp).toBeCloseTo(a.cp, 12);
    expect(stabilityMargin(b.cp, metres(0.387022), b.referenceDiameter)).toBeCloseTo(2.0041 / 2, 4);
  });
});

describe('properties', () => {
  const finSet = (over: Partial<TrapezoidFinSetComponent>): TrapezoidFinSetComponent => ({
    kind: 'finSet',
    count: 3,
    rootChord: metres(0.1),
    tipChord: metres(0.05),
    sweep: metres(0.05),
    span: metres(0.08),
    thickness: metres(0.003),
    density: kilogramsPerCubicMetre(600),
    bodyRadius: metres(0.025),
    ...over,
  });
  const base = R1_COMPONENTS.filter((p) => p.component.kind !== 'finSet');

  it('adding a fin set whose CP is aft of the rocket CP never moves the CP forward', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.double({ min: 0.02, max: 0.2, noNaN: true }),
        fc.double({ min: 0, max: 0.2, noNaN: true }),
        fc.double({ min: 0, max: 0.2, noNaN: true }),
        fc.double({ min: 0.01, max: 0.2, noNaN: true }),
        fc.double({ min: 0.2, max: 0.5, noNaN: true }),
        (count, cr, ct, xt, s, position) => {
          const before = centreOfPressure(base, OR_MODE);
          const fins = finSet({
            count,
            rootChord: metres(cr),
            tipChord: metres(ct),
            sweep: metres(xt),
            span: metres(s),
          });
          const term = finSetTerm(fins, before.referenceArea, OR_MODE.mach, 'worst', false);
          fc.pre(term.cnAlpha > 0 && position + term.cpX >= before.cp);
          const after = centreOfPressure(
            [...base, { component: fins, position: metres(position) }],
            OR_MODE,
          );
          return after.cp >= before.cp - 1e-12;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('raising the Mach number below 0.5 never moves the CP forward for a fins-aft rocket', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.49, noNaN: true }),
        fc.double({ min: 0, max: 0.49, noNaN: true }),
        (m1, m2) => {
          const [lo, hi] = m1 <= m2 ? [m1, m2] : [m2, m1];
          const a = centreOfPressure(R1_COMPONENTS, { ...OR_MODE, mach: mach(lo) });
          const b = centreOfPressure(R1_COMPONENTS, { ...OR_MODE, mach: mach(hi) });
          return b.cp >= a.cp - 1e-12;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('the CP lies between the forward-most and aft-most component CPs when every term is positive', () => {
    for (const components of [R1_COMPONENTS, R3_COMPONENTS, R4_COMPONENTS, R5_COMPONENTS]) {
      const r = centreOfPressure(components, DISPLAY_MODE);
      const cps = r.contributions.map((c) => c.cp as number);
      expect(r.contributions.every((c) => c.cnAlpha > 0)).toBe(true);
      expect(r.cp).toBeGreaterThanOrEqual(Math.min(...cps));
      expect(r.cp).toBeLessThanOrEqual(Math.max(...cps));
    }
  });

  it('is deterministic', () => {
    const a = centreOfPressure(R2_COMPONENTS, DISPLAY_MODE);
    const b = centreOfPressure(R2_COMPONENTS, DISPLAY_MODE);
    expect(b).toEqual(a);
  });
});

describe('BAR-12 transonic fin interpolation candidates (D-056)', () => {
  // Fin s = 0.05, c_r = 0.1, c_t = 0.05, x_t = 0.03, A_ref = π 0.025² = 1.963495e-3, A_fin = 3.75e-3.
  // tan Γ_c = (0.03 + 0.025 − 0.05)/0.05 = 0.1, cos Γ_c = 0.995037; k = s²/(A_fin cos Γ_c) = 0.669992; C = 2π s²/A_ref = 8.
  // Mach 0.8: β = 0.6, u = 0.401995, √(1 + u²) = 1.077750: (3.40) = 8/2.077750 = 3.850272;
  //   slope = −8 (u/√(1+u²)) (−k·0.8/β)/(1 + √(1+u²))² = −8 × 0.372996 × (−0.893323)/4.317044 = 0.617438.
  // Mach 1.2: β = 0.663325, (3.49) at α = 0 = (A_fin/A_ref) 2/β = 1.909859 × 3.015113 = 5.758443; slope = −1.909859 × 2.4/β³ = −15.704843.
  // Mach 1.0 (t = 0.5): linear 4.804357; cubic 0.5 × 3.850272 + 0.125 × 0.4 × 0.617438 + 0.5 × 5.758443 − 0.125 × 0.4 × (−15.704843) = 5.620471;
  //   quadratic c = (5.758443 − 3.850272 − 0.246975)/0.16 = 10.382475, value 3.850272 + 0.123488 + 0.415299 = 4.389058.
  const fin: TrapezoidFinSetComponent = {
    kind: 'finSet',
    count: 1,
    rootChord: metres(0.1),
    tipChord: metres(0.05),
    sweep: metres(0.03),
    span: metres(0.05),
    thickness: metres(0.002),
    density: kilogramsPerCubicMetre(1000),
    bodyRadius: metres(0),
  };
  const aRef = squareMetres(Math.PI * 0.025 ** 2);
  const one = (m: number, c: TransonicFinInterpolation): number =>
    finSetTerm(fin, aRef, mach(m), radians(Math.PI / 2), false, 0, c).cnAlphaSingleFin;
  it('end values: (3.40) at 0.8 = 3.850272, (3.49) at 1.2 = 5.758443', () => {
    expect(one(0.8, 'linear')).toBeCloseTo(3.850272, 5);
    expect(one(1.2, 'linear')).toBeCloseTo(5.758443, 5);
  });
  it('Mach 1.0: linear 4.804357, cubic Hermite 5.620471, quadratic 4.389058', () => {
    expect(one(1.0, 'linear')).toBeCloseTo(4.804357, 5);
    expect(one(1.0, 'cubic-hermite')).toBeCloseTo(5.620471, 5);
    expect(one(1.0, 'quadratic-subsonic')).toBeCloseTo(4.389058, 5);
  });
  it('every candidate is continuous at both ends; the cubic matches both end slopes and the quadratic the subsonic one', () => {
    const h = 1e-6;
    for (const c of ['linear', 'cubic-hermite', 'quadratic-subsonic'] as const) {
      expect(Math.abs(one(0.8 + h, c) - one(0.8, c))).toBeLessThan(1e-4);
      expect(Math.abs(one(1.2 - h, c) - one(1.2, c))).toBeLessThan(1e-4);
    }
    const slope = (m: number, c: TransonicFinInterpolation, side: 1 | -1): number =>
      (one(m + side * h, c) - one(m, c)) / (side * h);
    expect(slope(0.8, 'cubic-hermite', 1)).toBeCloseTo(0.617438, 3);
    expect(slope(1.2, 'cubic-hermite', -1)).toBeCloseTo(-15.704843, 2);
    expect(slope(0.8, 'quadratic-subsonic', 1)).toBeCloseTo(0.617438, 3);
    expect(slope(0.8, 'linear', 1)).toBeCloseTo((5.758443 - 3.850272) / 0.4, 3);
  });
  it('the default candidate is the one chosen in D-056 and is what centreOfPressure uses', () => {
    const viaDefault = finSetTerm(
      fin,
      aRef,
      mach(1.0),
      radians(Math.PI / 2),
      false,
    ).cnAlphaSingleFin;
    expect(viaDefault).toBeCloseTo(one(1.0, DEFAULT_TRANSONIC_FIN_INTERPOLATION), 12);
  });
});
