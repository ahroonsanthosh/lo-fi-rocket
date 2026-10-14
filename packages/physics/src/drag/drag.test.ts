/** Whole-rocket drag (plan 0009, DRAG-13, DRAG-14, GEO-13). */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { noseProfile } from '../geometry/profiles.js';
import { R1_COMPONENTS, R2_COMPONENTS } from '../geometry/reference-rockets.js';
import { dimensionless, mach, metres } from '../units/si.js';
import {
  axialDragCoefficient,
  axialDragScaling,
  dragCoefficient,
  jointAngle,
  meanAerodynamicChord,
  wettedArea,
  type DragInputs,
} from './drag.js';

describe('GEO-13 geometry helpers', () => {
  it('cone lateral area π R √(R² + L²) = π × 0.025 × 0.103078 = 0.0080957 m²; joint angle atan(0.25); R1 fin MAC (2/3)(0.01 + 0.005 + 0.0025)/0.15 = 0.077778', () => {
    const cone = noseProfile('conical', metres(0.1), metres(0.025));
    expect(wettedArea(cone)).toBeCloseTo(0.0080957, 7);
    expect(jointAngle(cone)).toBeCloseTo(Math.atan(0.25), 12);
    const ogive = noseProfile('ogive', metres(0.15), metres(0.027), 1);
    expect(jointAngle(ogive)).toBeCloseTo(0, 9);
    const fins = R1_COMPONENTS.find((p) => p.component.kind === 'finSet')?.component;
    if (fins?.kind !== 'finSet') throw new Error('no fins');
    expect(meanAerodynamicChord(fins)).toBeCloseTo(0.0777778, 7);
  });
});

describe('DRAG-13 R1 by hand (Niskanen §3.4)', () => {
  const base: DragInputs = {
    components: R1_COMPONENTS,
    mach: mach(0.159141),
    reynolds: 2224095.3,
    roughnessHeight: metres(60e-6),
    motor: { diameter: metres(0.024), thrusting: true },
    baseDragMotorRule: 'while-thrusting',
    baseDragMethod: 'niskanen',
  };
  it('at 54.1456 m/s, Mach 0.159141, R = 2.2241·10⁶, thrusting: C_D0 = 0.75745', () => {
    // Friction: roughness-limited C_f = 5.07166·10⁻³ (R > R_crit = 7.304·10⁵), × (1 − 0.1 × 0.025326) = 5.05881·10⁻³;
    //   A_wet,body = 0.0080957 + 0.0785398 = 0.0866355, f_B = 12, fins 0.036 m² with t/c̄ = 0.003/0.0777778:
    //   (1.0416667 × 0.0866355 + 1.0771429 × 0.036) × 5.05881e-3 / 1.9634954e-3 = 0.332418.
    // Nose (cone f_N = 2): subsonic interpolation 0.195477 × 0.159141^7.4922 + 0.047059 = 0.047059 (the M^b term is 2·10⁻⁷).
    // Fins (square, tan Γ_L = 0.625): stag 0.85 × (1 + 0.0063314 + 0.0000160) = 0.855395, × cos² 0.719101 = 0.615116;
    //   TE base 0.12 + 0.13 × 0.025326 = 0.123292; sum 0.738408 × N t s / A_ref = 0.738408 × 7.2e-4/1.9634954e-3 = 0.270769.
    // Base: 0.123292 × 1.51111e-3/1.9634954e-3 = 0.094886. Lug: 0.855395 × 2.8274e-5/1.9634954e-3 = 0.012318.
    // Total 0.332418 + 0.047059 + 0.270769 + 0.094886 + 0.012318 = 0.757450. OpenRocket at this time step: 0.776272 (−2.4 %, observed).
    const r = dragCoefficient(base);
    expect(r.skinFriction.regime).toBe('roughness-limited');
    expect(r.skinFriction.cd).toBeCloseTo(0.332418, 5);
    const byKind = (k: string): number =>
      r.terms.filter((t) => t.kind === k).reduce((s, t) => s + t.cd, 0);
    expect(byKind('noseCone')).toBeCloseTo(0.047059, 5);
    expect(byKind('finSet')).toBeCloseTo(0.270769, 5);
    expect(byKind('base')).toBeCloseTo(0.094886, 5);
    expect(byKind('launchLug')).toBeCloseTo(0.012318, 5);
    expect(r.cd0).toBeCloseTo(0.75745, 4);
    expect(r.rocketLength).toBe(0.6);
    expect(r.finenessRatio).toBeCloseTo(12, 12);
    expect(r.warnings).toEqual([]);
  });
  it('at rest (R = 0, M = 0): C_f = 1.48·10⁻², C_D0 = 1.39231 (OpenRocket prints 1.39408 at t = 0)', () => {
    // Friction 1.48e-2 × 0.129023/1.9634954e-3 = 0.972500; nose 0.047059; fins (0.85 × 0.719101 + 0.12) × 0.366692 = 0.268138;
    // base 0.12 × 0.769603 = 0.092352; lug 0.85 × 0.0144 = 0.012240. Total 1.392289 (rounding in the terms above; code gives 1.39231).
    const r = dragCoefficient({ ...base, mach: mach(0), reynolds: 0 });
    expect(r.cd0).toBeCloseTo(1.39231, 4);
  });
  it('plan 0073: fins at their own 5 µm finish: friction 0.232511 (body, 60 µm) + 0.073940 (fins) = 0.30645', () => {
    // Body as above: 5.05881e-3 × 1.0416667 × 0.0866355/1.9634954e-3 = 0.232511.
    // Fins at 5 µm: R_crit = 51 (5e-6/0.6)^(−1.039) = 9.657·10⁶ > R, so turbulent:
    //   1.5 ln(2224095.3) − 5.6 = 16.32221, C_f = 1/266.414 = 3.75355·10⁻³, × (1 − 0.1 × 0.025326) = 3.74401·10⁻³;
    //   × 1.0771429 × 0.036/1.9634954e-3 = 0.073940.
    const fins = R1_COMPONENTS.map((p) =>
      p.component.kind === 'finSet' ? { ...p, roughnessHeight: metres(5e-6) } : p,
    );
    const r = dragCoefficient({ ...base, components: fins });
    expect(r.skinFriction.cd).toBeCloseTo(0.30645, 5);
    // The other terms do not depend on the finish.
    const uniform = dragCoefficient(base);
    expect(r.cd0 - r.skinFriction.cd).toBeCloseTo(uniform.cd0 - uniform.skinFriction.cd, 12);
  });
  it('plan 0073: a part given the design’s own finish, or every part one other finish, changes nothing', () => {
    const same = R1_COMPONENTS.map((p) => ({ ...p, roughnessHeight: metres(60e-6) }));
    expect(dragCoefficient({ ...base, components: same }).cd0).toBe(dragCoefficient(base).cd0);
    const all = R1_COMPONENTS.map((p) => ({ ...p, roughnessHeight: metres(20e-6) }));
    expect(dragCoefficient({ ...base, components: all }).skinFriction.cd).toBe(
      dragCoefficient({ ...base, roughnessHeight: metres(20e-6) }).skinFriction.cd,
    );
    // The DATCOM base drag takes the body's wetted-area mean C_f, the one finish here.
    const datcom = { ...base, baseDragMethod: 'datcom' as const };
    expect(dragCoefficient({ ...datcom, components: all }).cd0).toBeCloseTo(
      dragCoefficient({ ...datcom, roughnessHeight: metres(20e-6) }).cd0,
      12,
    );
    const bad = R1_COMPONENTS.map((p, i) => (i === 0 ? { ...p, roughnessHeight: metres(-1) } : p));
    expect(() => dragCoefficient({ ...base, components: bad })).toThrow(InvalidInputError);
  });
  it('after burnout the base drag covers the whole base under the source rule, and keeps the motor removed under the OpenRocket rule (D-035)', () => {
    const coasting = dragCoefficient({
      ...base,
      motor: { diameter: metres(0.024), thrusting: false },
    });
    const or = dragCoefficient({
      ...base,
      motor: { diameter: metres(0.024), thrusting: false },
      baseDragMotorRule: 'always',
      baseDragMethod: 'niskanen',
    });
    // Full base: 0.123292 × 1 = 0.123292 against 0.094886 while thrusting: + 0.028406.
    expect(coasting.cd0 - base.components.length * 0 - dragCoefficient(base).cd0).toBeCloseTo(
      0.028406,
      5,
    );
    expect(or.cd0).toBeCloseTo(dragCoefficient(base).cd0, 12);
    expect(or.terms.find((t) => t.kind === 'base')?.source).toContain('always');
  });
  it("OpenRocket's rule (D-108) keeps the whole base, thrusting or not: the motor changes nothing", () => {
    // reference/rockets/drag-probe/values.txt: OpenRocket's base term is 0.12 + 0.13 M² on the whole
    // base with the motor in place, and its flight data the same thrusting and coasting.
    // By hand: the full base adds 0.028406 to the thrusting 0.757450 (the test above): 0.785856.
    const none = dragCoefficient({
      components: base.components,
      mach: base.mach,
      reynolds: base.reynolds,
      roughnessHeight: base.roughnessHeight,
      baseDragMotorRule: 'never',
      baseDragMethod: 'niskanen',
    });
    expect(none.cd0).toBeCloseTo(0.785856, 5);
    for (const thrusting of [true, false]) {
      const r = dragCoefficient({
        ...base,
        motor: { diameter: metres(0.024), thrusting },
        baseDragMotorRule: 'never',
        baseDragMethod: 'niskanen',
      });
      expect(r.cd0).toBe(none.cd0);
      expect(r.terms.find((t) => t.kind === 'base')?.source).toContain('base (full)');
    }
  });
  it('R2 (ogive, boat tail, rail buttons) at Mach 0.5 includes every term and no warning; at Mach 0.9 it warns about the transonic regime and the boat tail', () => {
    const r = dragCoefficient({
      components: R2_COMPONENTS,
      mach: mach(0.5),
      reynolds: 5e6,
      roughnessHeight: metres(60e-6),
      baseDragMotorRule: 'while-thrusting',
      baseDragMethod: 'niskanen',
    });
    expect(r.terms.map((t) => t.kind)).toEqual([
      'noseCone',
      'finSet',
      'railButton',
      'transition',
      'base',
    ]);
    expect(r.warnings).toEqual([]);
    expect(r.cd0).toBeGreaterThan(0.4);
    const t = dragCoefficient({
      components: R2_COMPONENTS,
      mach: mach(0.9),
      reynolds: 8e6,
      roughnessHeight: metres(60e-6),
      baseDragMotorRule: 'while-thrusting',
      baseDragMethod: 'niskanen',
    });
    expect(t.warnings.join('\n')).toContain('transonic regime');
    expect(t.warnings.join('\n')).toContain('expansion fans');
  });
  it('a fin set without a cross-section, or no external component, is rejected', () => {
    const fins = R1_COMPONENTS.find((p) => p.component.kind === 'finSet');
    if (fins?.component.kind !== 'finSet') throw new Error('no fins');
    const { crossSection: _cs, ...rest } = fins.component;
    expect(_cs).toBe('square');
    expect(() =>
      dragCoefficient({
        ...base,
        components: [
          ...R1_COMPONENTS.filter((p) => p !== fins),
          { component: rest, position: fins.position },
        ],
      }),
    ).toThrow(InvalidInputError);
    expect(() =>
      dragCoefficient({
        ...base,
        components: R1_COMPONENTS.filter((p) => p.component.kind === 'parachute'),
      }),
    ).toThrow(InvalidInputError);
  });
});

describe('DRAG-14 axial drag at angle of attack (Niskanen §3.4.7, D-033)', () => {
  it('s(0) = 1, s(17°) = 1.3, s(90°) = 0; midpoints 1.15 and 0.65; zero slopes at the knots', () => {
    const deg = (x: number): number => (x * Math.PI) / 180;
    expect(axialDragScaling(0).scale).toBe(1);
    expect(axialDragScaling(deg(17)).scale).toBeCloseTo(1.3, 12);
    expect(axialDragScaling(deg(90)).scale).toBeCloseTo(0, 12);
    expect(axialDragScaling(deg(8.5)).scale).toBeCloseTo(1.15, 12);
    expect(axialDragScaling(deg(53.5)).scale).toBeCloseTo(0.65, 12);
    const h = 1e-6;
    for (const knot of [0, deg(17), deg(90)]) {
      const a = axialDragScaling(Math.max(0, knot - h)).scale;
      const b = axialDragScaling(Math.min(Math.PI / 2, knot + h)).scale;
      expect(Math.abs(b - a) / h).toBeLessThan(1e-4);
    }
    expect(axialDragCoefficient(dimensionless(0.5), deg(17))).toBeCloseTo(0.65, 12);
  });
  it('beyond 90° the scaling is mirrored and flagged; outside [0, 180°] it throws', () => {
    const r = axialDragScaling((100 * Math.PI) / 180);
    expect(r.beyondSource).toBe(true);
    expect(r.scale).toBeCloseTo(axialDragScaling((80 * Math.PI) / 180).scale, 12);
    expect(axialDragScaling(Math.PI).scale).toBe(1);
    expect(() => axialDragScaling(-0.1)).toThrow(InvalidInputError);
    expect(() => axialDragScaling(3.2)).toThrow(InvalidInputError);
  });
});

describe('properties', () => {
  const inputs = (mach_: number, re: number): DragInputs => ({
    components: R1_COMPONENTS,
    mach: mach(mach_),
    reynolds: re,
    roughnessHeight: metres(60e-6),
    baseDragMotorRule: 'while-thrusting',
    baseDragMethod: 'niskanen',
  });
  it('C_D0 is positive and adding a launch lug never reduces it; results are deterministic', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.79, noNaN: true }),
        fc.double({ min: 0, max: 1e7, noNaN: true }),
        (m, re) => {
          const r = dragCoefficient(inputs(m, re));
          const withLug = dragCoefficient({
            ...inputs(m, re),
            components: [
              ...R1_COMPONENTS,
              {
                position: metres(0.2),
                component: {
                  kind: 'launchLug',
                  length: metres(0.03),
                  outerRadius: metres(0.004),
                  wallThickness: metres(0.0005),
                  density:
                    R1_COMPONENTS[1]!.component.kind === 'bodyTube'
                      ? R1_COMPONENTS[1]!.component.density
                      : (700 as never),
                  radialOffset: metres(0.029),
                },
              },
            ],
          });
          return r.cd0 > 0 && withLug.cd0 >= r.cd0 && dragCoefficient(inputs(m, re)).cd0 === r.cd0;
        },
      ),
      { numRuns: 100 },
    );
  });
});
