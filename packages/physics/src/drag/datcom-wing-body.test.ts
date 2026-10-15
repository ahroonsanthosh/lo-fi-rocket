import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { PlacedComponent } from '../geometry/assembly.js';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import { mach, metres } from '../units/si.js';
import {
  chordLineSweepCosine,
  finThicknessBracket,
  liftingSurfaceFactor,
  maximumThicknessLine,
  wingBodyInterferenceFactor,
} from './datcom-wing-body.js';
import {
  dragCoefficient,
  LIFTING_SURFACE_FLAT_PLATE_NOTE,
  WING_BODY_EDGE_NOTE,
  WING_BODY_FAIRING_NOTE,
} from './drag.js';

describe('DRAG-26: the DATCOM wing-body friction factors (plan 0081)', () => {
  it("reproduces the DATCOM's sample problem 4.1.5.1 (p. 4.1.5.1-3), C_D0 = 0.00834, within the digitising tolerance", () => {
    // The cranked wing of the sample, M 0.13, its own C_f readings (figure 4.1.5.1-26) as given.
    // Inboard: C_f 0.00372, (t/c) 0.045 at x_t 0.35c (L = 1.2), Λ 48.4° (cos 0.6639), S_wet/S_ref 17.82/13.575.
    //   1 + 1.2(0.045) + 100(0.045)⁴ = 1.0544100; R_LS read from the table 0.9362 (the DATCOM read 0.934).
    //   0.00372 × 1.0544100 × 0.9362 × 1.3127072 = 0.0048205.
    // Outboard: C_f 0.00451, (t/c) 0.06 (L = 1.2), Λ 18.1° (cos 0.9505), S_wet/S_ref 9.33/13.575.
    //   1 + 0.072 + 100(0.06)⁴ = 1.0732960; R_LS 1.0643 (the DATCOM read 1.067).
    //   0.00451 × 1.0732960 × 1.0643 × 0.6872928 = 0.0035408.
    // Sum 0.0083613; the DATCOM's 0.00834 (and the test value 0.0086); 0.25 % apart.
    const inboard =
      0.00372 *
      finThicknessBracket(1.2, 0.045) *
      liftingSurfaceFactor(0.13, 0.6639).value *
      (17.82 / 13.575);
    const outboard =
      0.00451 *
      finThicknessBracket(1.2, 0.06) *
      liftingSurfaceFactor(0.13, 0.9505).value *
      (9.33 / 13.575);
    expect(inboard).toBeCloseTo(0.0048205, 6);
    expect(outboard).toBeCloseTo(0.0035408, 6);
    expect(Math.abs((inboard + outboard) / 0.00834 - 1)).toBeLessThan(0.006);
  });

  it('the thickness bracket 1 + L(t/c) + 100(t/c)⁴ (figure 4.1.5.1-28a)', () => {
    expect(finThicknessBracket(2, 0.05)).toBeCloseTo(1.100625, 12);
    expect(finThicknessBracket(1.2, 0.1)).toBeCloseTo(1.13, 12);
    expect(finThicknessBracket(1.2, 0)).toBe(1);
    expect(() => finThicknessBracket(2, -0.1)).toThrow();
  });

  it("R_LS and R_WB give the DATCOM's own readings within the digitising tolerance", () => {
    // Figure 4.1.5.1-28b, p. 4.5.3.1-5 and p. 4.3.3.1-5.
    expect(Math.abs(liftingSurfaceFactor(0.6, 0.6521).value - 1.002)).toBeLessThan(0.005);
    expect(Math.abs(liftingSurfaceFactor(0.7, 1).value - 1.205)).toBeLessThan(0.005);
    expect(Math.abs(liftingSurfaceFactor(0.7, 0.8572).value - 1.18)).toBeLessThan(0.005);
    // Figure 4.3.3.1-37, p. 4.5.3.1-5 and p. 4.3.3.1-6.
    expect(Math.abs(wingBodyInterferenceFactor(0.4, 6.68e6).value - 1.028)).toBeLessThan(0.003);
    expect(Math.abs(wingBodyInterferenceFactor(0.6, 6.68e6).value - 0.988)).toBeLessThan(0.003);
    expect(Math.abs(wingBodyInterferenceFactor(0.7, 6.68e6).value - 0.963)).toBeLessThan(0.003);
    expect(Math.abs(wingBodyInterferenceFactor(0.7, 2.96e6).value - 0.955)).toBeLessThan(0.003);
  });

  it('between Mach 0.9 and 1.0 both factors are faired linearly to 1, and are 1 above', () => {
    const rwb9 = wingBodyInterferenceFactor(0.9, 1e7);
    const rwb95 = wingBodyInterferenceFactor(0.95, 1e7);
    expect(rwb9.faired).toBe(false);
    expect(rwb95.faired).toBe(true);
    expect(rwb95.value).toBeCloseTo((rwb9.value + 1) / 2, 12);
    expect(wingBodyInterferenceFactor(1, 1e7).value).toBe(1);
    expect(wingBodyInterferenceFactor(2.5, 1e7).value).toBe(1);
    const rls9 = liftingSurfaceFactor(0.9, 0.8);
    expect(liftingSurfaceFactor(0.95, 0.8).value).toBeCloseTo((rls9.value + 1) / 2, 12);
    expect(liftingSurfaceFactor(1.5, 0.8).value).toBe(1);
  });

  it('outside a chart, the edge is held and flagged; inside, nothing is flagged', () => {
    const low = wingBodyInterferenceFactor(0.1, 1e7);
    expect(low.outside).toBe(true);
    expect(low.value).toBe(wingBodyInterferenceFactor(0.25, 1e7).value);
    const small = wingBodyInterferenceFactor(0.5, 1e6);
    expect(small.outside).toBe(true);
    expect(small.value).toBe(wingBodyInterferenceFactor(0.5, 10 ** 6.45).value);
    expect(wingBodyInterferenceFactor(0.5, 1e7).outside).toBe(false);
    const swept = liftingSurfaceFactor(0.5, 0.4);
    expect(swept.outside).toBe(true);
    expect(swept.value).toBe(liftingSurfaceFactor(0.5, 0.5).value);
    expect(liftingSurfaceFactor(0.5, 0.7).outside).toBe(false);
  });

  it("the maximum-thickness line's sweep on a trapezoid, by hand", () => {
    // c_r 0.1, c_t 0.05, tip leading edge 0.05 behind the root's, span 0.05:
    // leading edge tan = 0.05/0.05 = 1, cos 0.7071068; mid-chord tan = (0.05 − 0.025)/0.05 = 0.5,
    // cos 0.8944272; trailing edge tan = 0, cos 1.
    expect(chordLineSweepCosine(0.1, 0.05, 0.05, 0.05, 0)).toBeCloseTo(Math.SQRT1_2, 12);
    expect(chordLineSweepCosine(0.1, 0.05, 0.05, 0.05, 0.5)).toBeCloseTo(0.894427191, 9);
    expect(chordLineSweepCosine(0.1, 0.05, 0.05, 0.05, 1)).toBe(1);
    expect(chordLineSweepCosine(0.08, 0.08, 0, 0.04, 0.3)).toBe(1);
  });

  it('the thickness line and L by cross-section (eq. 4.1.5.1-a: L = 2 ahead of 0.30c, else 1.2)', () => {
    expect(maximumThicknessLine('square')).toEqual({ chordFraction: 0, location: 2 });
    expect(maximumThicknessLine('rounded')).toEqual({ chordFraction: 0, location: 2 });
    expect(maximumThicknessLine('airfoil')).toEqual({ chordFraction: 0.3, location: 1.2 });
    expect(maximumThicknessLine('double-wedge')).toEqual({ chordFraction: 0.5, location: 1.2 });
    expect(maximumThicknessLine('wedge')).toEqual({ chordFraction: 1, location: 1.2 });
  });

  it('properties: both factors are finite and within their charts for any input; R_LS rises with cos Λ and Mach to 0.9', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        fc.double({ min: 1e3, max: 1e10, noNaN: true }),
        (m, cos, re) => {
          const rls = liftingSurfaceFactor(m, cos).value;
          const rwb = wingBodyInterferenceFactor(m, re).value;
          return rls >= 0.81 && rls <= 1.36 && rwb >= 0.86 && rwb <= 1.08;
        },
      ),
    );
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.9, noNaN: true }),
        fc.double({ min: 0.5, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 0.9, noNaN: true }),
        fc.double({ min: 0.5, max: 1, noNaN: true }),
        (m1, c1, m2, c2) => {
          const [ma, mb] = m1 <= m2 ? [m1, m2] : [m2, m1];
          const [ca, cb] = c1 <= c2 ? [c1, c2] : [c2, c1];
          return (
            liftingSurfaceFactor(ma, ca).value <= liftingSurfaceFactor(mb, ca).value + 1e-12 &&
            liftingSurfaceFactor(ma, ca).value <= liftingSurfaceFactor(ma, cb).value + 1e-12
          );
        },
      ),
    );
  });

  it('in the drag model: no fins, no change; above Mach 1 only the 100(t/c)⁴ term remains', () => {
    const body = R1_COMPONENTS.filter((c) => c.component.kind !== 'finSet');
    const base = {
      reynolds: 3e6,
      roughnessHeight: metres(60e-6),
      baseDragMotorRule: 'never' as const,
    };
    const without = (
      m: number,
      factors: 'datcom' | 'none',
      components: readonly PlacedComponent[] = body,
    ): number =>
      dragCoefficient({ ...base, components, mach: mach(m), liftingSurfaceFactors: factors })
        .skinFriction.cd;
    // A body alone is not a wing-body: R_WB is not applied.
    expect(without(0.3, 'datcom')).toBe(without(0.3, 'none'));
    // R1's square fins above Mach 1: R_LS = R_WB = 1, and the bracket differs from 1 + 2t/c by
    // 100(t/c)⁴ alone, under 10⁻⁴ of the friction for R1's t/c below 0.05.
    const a = without(1.5, 'datcom', R1_COMPONENTS);
    const b = without(1.5, 'none', R1_COMPONENTS);
    expect(a).toBeGreaterThan(b);
    expect(a / b - 1).toBeLessThan(1e-4);
  });

  it("the chart edges and the fairing are named in the result's notes when used, and only then", () => {
    const at = (m: number, re: number, factors: 'datcom' | 'none'): readonly string[] =>
      dragCoefficient({
        components: R1_COMPONENTS,
        mach: mach(m),
        reynolds: re,
        roughnessHeight: metres(60e-6),
        baseDragMotorRule: 'never',
        liftingSurfaceFactors: factors,
      }).warnings;
    // R1 at Mach 0.1 and 10⁶: below the R_WB chart in both, with square-edged fins.
    expect(at(0.1, 1e6, 'datcom')).toEqual(
      expect.arrayContaining([WING_BODY_EDGE_NOTE, LIFTING_SURFACE_FLAT_PLATE_NOTE]),
    );
    expect(at(0.5, 1e7, 'datcom')).not.toContain(WING_BODY_EDGE_NOTE);
    expect(at(0.95, 1e7, 'datcom')).toContain(WING_BODY_FAIRING_NOTE);
    expect(at(1.2, 1e7, 'datcom')).not.toContain(WING_BODY_FAIRING_NOTE);
    for (const w of [WING_BODY_EDGE_NOTE, LIFTING_SURFACE_FLAT_PLATE_NOTE, WING_BODY_FAIRING_NOTE])
      expect(at(0.95, 1e6, 'none')).not.toContain(w);
  });
});
