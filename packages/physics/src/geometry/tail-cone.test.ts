/**
 * Plan 0068: a transition that ends in a point (a tail cone; OpenRocket's flipped nose cone,
 * reference/rockets/flipped-nose-probe/values.txt), GEO-7 with an aft radius of 0.
 */
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { transitionTerm } from '../stability/barrowman.js';
import { kilogramsPerCubicMetre, metres, squareMetres } from '../units/si.js';
import { componentMassProperties, type TransitionComponent } from './components.js';
import { noseProfile, transitionProfile } from './profiles.js';

describe('GEO-7 with an aft radius of 0 (plan 0068)', () => {
  it('a solid conical tail cone, by hand: mass, CG at L/4 from the base, CP at L/3, C_Nα −2', () => {
    // L = 0.1 m, R = 0.025 m, ρ = 1050 kg/m³. V = πR²L/3 = π(0.000625)(0.1)/3 = 6.544985e-5 m³,
    // m = 0.06872234 kg. A cone's CG is a quarter of its height from the base: 0.025 m from the
    // front, where the base is. Barrowman (BAR-3): C_Nα = 2(A_aft − A_fore)/A_ref = −2 on
    // A_ref = πR²; X = (L·A_aft − V)/(A_aft − A_fore) = V/A_fore = L/3 = 0.0333333 m (OpenRocket's
    // flipped conical cone: 0.553333333 − 0.52).
    const tail: TransitionComponent = {
      kind: 'transition',
      shape: 'conical',
      length: metres(0.1),
      foreRadius: metres(0.025),
      aftRadius: metres(0),
      density: kilogramsPerCubicMetre(1050),
    };
    const m = componentMassProperties(tail);
    expect(m.volume).toBeCloseTo(6.544985e-5, 11);
    expect(m.mass).toBeCloseTo(0.06872234, 8);
    expect(m.cgX).toBeCloseTo(0.025, 10);
    const t = transitionTerm(tail, squareMetres(Math.PI * 0.025 ** 2));
    expect(t.cnAlpha).toBeCloseTo(-2, 12);
    expect(t.cpX).toBeCloseTo(0.1 / 3, 10);
  });

  it('a narrowing ogive to 0 is the ogive nose reversed, point by point', () => {
    const L = metres(0.1);
    const R = metres(0.025);
    const tail = transitionProfile('ogive', L, R, metres(0), 1);
    const nose = noseProfile('ogive', L, R, 1);
    for (const x of [0, 0.01, 0.025, 0.05, 0.075, 0.099, 0.1]) {
      expect(tail.radius(x)).toBe(nose.radius(0.1 - x));
    }
  });

  it('still refuses a negative aft radius, and a fore radius of 0 (that is a nose cone)', () => {
    expect(() => transitionProfile('conical', metres(0.1), metres(0.025), metres(-0.001))).toThrow(
      InvalidInputError,
    );
    expect(() => transitionProfile('conical', metres(0.1), metres(0), metres(0.025))).toThrow(
      InvalidInputError,
    );
  });
});
