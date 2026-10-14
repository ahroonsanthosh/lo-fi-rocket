/** Large-angle normal force and CP from the DATCOM (plan 0033, HA-1 to HA-10, D-070). */
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import type { TrapezoidFinSetComponent } from '../geometry/components.js';
import {
  crossflowDragCoefficient,
  crossflowDragProportionality,
  incidenceAngle,
  jorgensenPotentialFactor,
  jorgensenViscousFactor,
  leadingEdgeParameter,
  normalForceAt90,
  taperRatioFactors,
  wingAnalysis,
  wingCentreOfPressure,
  wingNormalForce,
  wingPlanform,
  wingShapeParameter,
} from './datcom-large-angle.js';

const deg = (x: number): number => (x * Math.PI) / 180;

describe('HA-1, HA-2 cross-flow drag charts (DATCOM figure 4.2.1.2-35)', () => {
  it('η at the digitised points and between them; held, and reported, beyond the drawn fineness ratios', () => {
    expect(crossflowDragProportionality(12).value).toBeCloseTo(0.7028, 12);
    // Midpoint of 12 (0.7028) and 13 (0.7136): 0.7082.
    expect(crossflowDragProportionality(12.5).value).toBeCloseTo(0.7082, 12);
    expect(crossflowDragProportionality(12.5).held).toBe(false);
    expect(crossflowDragProportionality(1)).toEqual({ value: 0.5592, held: true });
    expect(crossflowDragProportionality(40)).toEqual({ value: 0.7878, held: true });
    expect(() => crossflowDragProportionality(0)).toThrow(InvalidInputError);
  });
  it('c_dc: 1.2 at low cross-flow Mach, the peak near M_c = 1, the folded scale above 1', () => {
    expect(crossflowDragCoefficient(0).value).toBe(1.2);
    // M_c = 0.3 is k = 3: 1.2112; M_c = 1 is k = 10: 1.796; M_c = 2 is k = 20 − 5 = 15: 1.4074.
    expect(crossflowDragCoefficient(0.3).value).toBeCloseTo(1.2112, 12);
    expect(crossflowDragCoefficient(1).value).toBeCloseTo(1.796, 12);
    expect(crossflowDragCoefficient(2).value).toBeCloseTo(1.4074, 12);
    // Drawn to k = 18.9, M_c = 10/1.1 = 9.09.
    expect(crossflowDragCoefficient(20)).toEqual({ value: 1.2549, held: true });
    expect(() => crossflowDragCoefficient(-0.1)).toThrow(InvalidInputError);
  });
});

describe('HA-3 Jorgensen body factors (DATCOM eq. 4.2.1.2-c)', () => {
  it('α′ is α up to 90° and 180° − α beyond; outside [0, 180°] it throws', () => {
    expect(incidenceAngle(deg(30))).toBeCloseTo(deg(30), 15);
    expect(incidenceAngle(deg(150))).toBeCloseTo(deg(30), 14);
    expect(() => incidenceAngle(deg(181))).toThrow(InvalidInputError);
  });
  it('potential factor sin 2α′ cos(α′/2)/2: 0 at 0, 90 and 180°, α to first order, sin 60° cos 15°/2 = 0.4182582 at 30° and 150°', () => {
    expect(jorgensenPotentialFactor(0)).toBe(0);
    expect(jorgensenPotentialFactor(deg(90))).toBeCloseTo(0, 15);
    expect(jorgensenPotentialFactor(Math.PI)).toBeCloseTo(0, 15);
    expect(jorgensenPotentialFactor(1e-4) / 1e-4).toBeCloseTo(1, 7);
    expect(jorgensenPotentialFactor(deg(30))).toBeCloseTo(0.4182582, 7);
    expect(jorgensenPotentialFactor(deg(150))).toBeCloseTo(0.4182582, 7);
  });
  it('viscous factor η c_dc sin²α′ for fineness 12 at Mach 0.3 and 30°: 0.7028 × 1.2 × 0.25 = 0.21084', () => {
    // M_c = 0.3 sin 30° = 0.15 is k = 1.5, on the flat 1.2 part of figure 35b.
    const v = jorgensenViscousFactor(deg(30), 0.3, 12);
    expect(v.eta.value).toBeCloseTo(0.7028, 12);
    expect(v.cdc.value).toBeCloseTo(1.2, 12);
    expect(v.factor).toBeCloseTo(0.21084, 10);
    expect(jorgensenViscousFactor(deg(150), 0.3, 12).factor).toBeCloseTo(0.21084, 10);
    expect(jorgensenViscousFactor(0, 0.3, 12).factor).toBe(0);
  });
});

describe('HA-5 leading-edge parameter Δy (DATCOM p. 4.1.3.2-19)', () => {
  it('square edges: 0, figure 23a; rounded R1 fin (t = 3 mm, MAC 77.78 mm): 1.18287 %, figure 23a', () => {
    expect(leadingEdgeParameter('square', 0.003, 0.0777778)).toEqual({ deltaY: 0, chart: '23a' });
    // r = 1.5 mm; at 0.06 c = 4.67 mm the ordinate is r; at x = 0.0015 c = 0.116667 mm it is
    // √(2 r x − x²) = 0.579990 mm; Δy = 100 (1.5 − 0.579990)/77.7778 = 1.18287 %.
    const r = leadingEdgeParameter('rounded', 0.003, 0.07777777777777778);
    expect(r.deltaY).toBeCloseTo(1.18287, 5);
    expect(r.chart).toBe('23a');
  });
  it('double wedge t/c = 3 %: 5.85 × 0.03 = 0.1755 % (the DATCOM relation Δy = 5.85 tan δ); circular arc t/c = 6 %: 0.66065 %, figure 23b', () => {
    const dw = leadingEdgeParameter('double-wedge', 0.03, 1);
    expect(dw.deltaY).toBeCloseTo(0.1755, 12);
    expect(dw.chart).toBe('23b');
    // R = c²/(4t) + t/4 = 4.181667; y(0.06) = 0.0067869, y(0.0015) = 0.00018038; Δy = 0.66065 %.
    const arc = leadingEdgeParameter('airfoil', 0.06, 1);
    expect(arc.deltaY).toBeCloseTo(0.66065, 5);
    expect(arc.chart).toBe('23b');
    expect(leadingEdgeParameter('wedge', 0.03, 1).chart).toBeUndefined();
  });
});

describe('HA-7 wing normal force (DATCOM section 4.1.3.3 A)', () => {
  it('J of eq. 4.1.3.3-e and C_N at 90° reproduce the sample problem (p. 4.1.3.3-16, -17): J = 6.36, C_N(90°) = 1.30 for A = 6', () => {
    // C1 printed 0.3 but used as C1 + 1 = 1.31; C2 = 1.06, A = 6, β = 0.98, tan Λ_LE = 0.1566 (cos = 0.988):
    // 0.3 × 1.31 × 6.12245 × 0.98797 × (2.6986 − 0.276509³) = 2.37718 × 2.67746 = 6.3647.
    expect(wingShapeParameter(0.31, 1.06, 6, 0.98, 0.1566)).toBeCloseTo(6.36, 2);
    expect(normalForceAt90(6).value).toBeCloseTo(1.3, 1);
  });
  it('the sample problem table (pp. 4.1.3.3-17, -18) within the chart-reading tolerance 0.045', () => {
    // Inputs as printed: C_Nα = 4.56/rad, C_Lmax = 0.975, α_CLmax = 13.3°, C*_Lmax = 0.71, J = 6.36, β² = 0.96, C_N(90°) = 1.30.
    const input = {
      cnAlpha: 4.56,
      cLmax: 0.975,
      alphaCLmax: deg(13.3),
      cLmaxStar: 0.71,
      j: 6.36,
      beta: Math.sqrt(0.96),
      cn90: 1.3,
    };
    const table: [number, number][] = [
      [5, 0.415],
      [10, 0.823],
      [13.3, 1.002],
      [16, 0.99],
      [18, 0.9],
      [20, 0.87],
      [22, 0.85],
      [30, 0.94],
      [50, 1.35],
      [70, 1.54],
      [90, 1.3],
    ];
    for (const [a, cn] of table)
      expect(Math.abs(wingNormalForce(input, deg(a)).cn - cn)).toBeLessThan(0.045);
    // Below the stall the J ≥ 3 curve: flat 2.8423 to 0.601, so ΔC_Naa(0.370) = 2.8423 (sample 2.84) and C_N(5°) is exact to 0.001.
    expect(wingNormalForce(input, deg(5)).cn).toBeCloseTo(0.415, 3);
    expect(wingNormalForce(input, deg(13.3)).cn).toBeCloseTo(0.975 / Math.cos(deg(13.3)), 12);
    expect(wingNormalForce(input, deg(90)).cn).toBeCloseTo(1.3, 12);
    expect(wingNormalForce(input, deg(20)).beyondStall).toBe(true);
    expect(() => wingNormalForce(input, deg(91))).toThrow(InvalidInputError);
  });
});

describe('HA-4, HA-6 low-aspect-ratio maximum lift (DATCOM section 4.1.3.4 A Method 3)', () => {
  it('C1, C2 at λ = 0.3: 0.49 and 0.90 (sample problem p. 4.1.3.4-9 reads 0.5 and 0.91); outside 0 to 1 it throws', () => {
    const f = taperRatioFactors(0.3);
    expect(f.c1).toBeCloseTo(0.49, 2);
    expect(f.c2).toBeCloseTo(0.9018, 4);
    expect(() => taperRatioFactors(1.2)).toThrow(InvalidInputError);
  });
  it('the sample problem (A = 1, Λ_LE = 45°, λ = 0.3, Δy = 1.37 %, M = 0.6): C_Lmax 1.04 and α_CLmax 34.3° within the chart readings', () => {
    // Printed: X = 1.326, (C_Lmax)_base 1.12 (figure 23a), ΔC_Lmax −0.08, (α_CLmax)_base 30.8°, Δα 3.5°.
    // Ours: (C_Lmax)_base on the Δy ≥ 1.35 curve at X = 1.330 is 1.139 (0.02 above the printed reading); ΔC_Lmax −0.081;
    // (α_CLmax)_base 30.8°; Δα 3.5°.
    const a = wingAnalysis(
      {
        aspectRatio: 1,
        taperRatio: 0.3,
        tanLeadingEdge: 1,
        sweepHeld: false,
        deltaY: 1.37,
        chart: '23a',
      },
      0.6,
    );
    expect(Math.abs(a.cLmax - 1.04)).toBeLessThan(0.03);
    expect(Math.abs((a.alphaCLmax * 180) / Math.PI - 34.3)).toBeLessThan(0.5);
    expect(a.notes).toEqual([]);
  });
  it('a high-aspect-ratio wing and a single wedge are approximated and said (plan 0066), and Δy below the drawn curves is reported', () => {
    // A = 5 is above the low-aspect-ratio limit of eq. 4.1.3.4-c: the low-aspect-ratio method is
    // used with its charts held at their ends, and the note says so.
    const high = wingAnalysis(
      {
        aspectRatio: 5,
        taperRatio: 0.5,
        tanLeadingEdge: 0,
        sweepHeld: false,
        deltaY: 0,
        chart: '23a',
      },
      0,
    );
    expect(high.notes.join()).toMatch(/aspect ratio 5\.00 is above the low-aspect-ratio limit/);
    expect(high.cLmax).toBeGreaterThan(0);
    // A single wedge (no family) reads the 23b family exactly, with its note.
    const planform = {
      aspectRatio: 1.2,
      taperRatio: 0.5,
      tanLeadingEdge: 0.4,
      sweepHeld: false,
      deltaY: 0.3,
    };
    const wedge = wingAnalysis({ ...planform, chart: undefined }, 0.3);
    const family23b = wingAnalysis({ ...planform, chart: '23b' }, 0.3);
    expect(wedge.cLmax).toBe(family23b.cLmax);
    expect(wedge.alphaCLmax).toBe(family23b.alphaCLmax);
    expect(wedge.notes.join()).toMatch(/single-wedge section, thickest at the trailing edge/);
    const r1 = wingAnalysis(
      {
        aspectRatio: 2.1333,
        taperRatio: 0.5,
        tanLeadingEdge: 0.625,
        sweepHeld: false,
        deltaY: 0,
        chart: '23a',
      },
      0.3,
    );
    expect(r1.notes.join()).toContain('below the lowest curve');
  });
});

describe('HA-8 wing centre of pressure (DATCOM section 4.1.4.3 A Method 1), R1 fins', () => {
  const fin = R1_COMPONENTS.find((p) => p.component.kind === 'finSet')
    ?.component as TrapezoidFinSetComponent;
  const analysis = wingAnalysis(wingPlanform(fin, false), 0.3);
  it('step 1 at 0°, step 2 at the stall, step 4 (the area centroid) at 90°', () => {
    expect(wingCentreOfPressure(analysis, 0, 0.4).cp).toBeCloseTo(0.4, 12);
    // Step 2: (x/c_r)_1 at Δy = 0 is held at the chart start, 0.700 (reported); C3(0.5) = 1.025, (C3 + 1) A tan Λ_LE =
    // 2.025 × 2.13333 × 0.625 = 2.700; figure 22a at A = 2.133: A = 2 gives −0.133, A = 2.5 gives −0.152 → −0.138.
    // (x/c_r)_CLmax = 0.700 − 0.138 = 0.562.
    const atStall = wingCentreOfPressure(analysis, analysis.alphaCLmax, 0.4);
    expect(atStall.cp).toBeCloseTo(0.562, 2);
    expect(atStall.notes.join()).toContain('4.1.4.3-21a');
    // Step 4: σ = A(1 + λ) tan Λ_LE/4 = 2.13333 × 1.5 × 0.625/4 = 0.5; (1/3)(0.5 + 0.5 + 1.25/1.5) = 0.611111,
    // the planform centroid [c_r² + c_r c_t + c_t² + x_t (c_r + 2 c_t)]/(3 (c_r + c_t)) = 0.0275/0.45 m = 0.611111 c_r.
    expect(wingCentreOfPressure(analysis, Math.PI / 2, 0.4).cp).toBeCloseTo(0.611111, 6);
  });
  it('step 5 is linear in α between tan⁻¹(tan α_CLmax/0.6) and 90°', () => {
    const at = Math.atan(Math.tan(analysis.alphaCLmax) / 0.6);
    const xt = wingCentreOfPressure(analysis, at, 0.4).cp;
    const mid = wingCentreOfPressure(analysis, (at + Math.PI / 2) / 2, 0.4).cp;
    expect(mid).toBeCloseTo((xt + 0.611111) / 2, 6);
  });
});
