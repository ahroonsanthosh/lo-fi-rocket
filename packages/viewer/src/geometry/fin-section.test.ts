/**
 * Fin cross-sections drawn to the design's section (plan 3d-0002). The
 * half-thickness shapes by hand, the chord lookup on a trapezoid by hand,
 * and the lofted fin's thickness bounded by the design's thickness.
 */
import { describe, expect, it } from 'vitest';
import { chordAt, finSectionGeometry, sectionHalfThickness } from './fin-section.js';
import type { FinPart } from './rocket-model.js';

describe('sectionHalfThickness by hand (fraction of t/2)', () => {
  it('square is full everywhere; wedge rises linearly; double-wedge peaks at mid-chord', () => {
    expect(sectionHalfThickness('square', 0, 0.1, 0.003)).toBe(1);
    expect(sectionHalfThickness('square', 1, 0.1, 0.003)).toBe(1);
    expect(sectionHalfThickness('wedge', 0, 0.1, 0.003)).toBe(0);
    expect(sectionHalfThickness('wedge', 0.25, 0.1, 0.003)).toBe(0.25);
    expect(sectionHalfThickness('wedge', 1, 0.1, 0.003)).toBe(1);
    expect(sectionHalfThickness('double-wedge', 0.5, 0.1, 0.003)).toBe(1);
    expect(sectionHalfThickness('double-wedge', 0.25, 0.1, 0.003)).toBe(0.5);
    expect(sectionHalfThickness('double-wedge', 1, 0.1, 0.003)).toBe(0);
  });
  it('rounded: semicircles of radius t/2 at both edges, full between', () => {
    // c = 0.1, t = 0.004: a = t/(2c) = 0.02. At s = 0: 0; at s = 0.01: √(1 − (0.01/0.02)²) = √0.75.
    expect(sectionHalfThickness('rounded', 0, 0.1, 0.004)).toBe(0);
    expect(sectionHalfThickness('rounded', 0.01, 0.1, 0.004)).toBeCloseTo(Math.sqrt(0.75), 12);
    expect(sectionHalfThickness('rounded', 0.5, 0.1, 0.004)).toBe(1);
    expect(sectionHalfThickness('rounded', 0.99, 0.1, 0.004)).toBeCloseTo(Math.sqrt(0.75), 12);
  });
  it('airfoil: the NACA 00xx form, 1 at 30 % chord, 0 at the leading edge, thin at the trailing edge', () => {
    expect(sectionHalfThickness('airfoil', 0.3, 0.1, 0.003)).toBeCloseTo(1, 12);
    expect(sectionHalfThickness('airfoil', 0, 0.1, 0.003)).toBe(0);
    // y_t(1)/y_t(0.3) = 5(0.2969 − 0.126 − 0.3516 + 0.2843 − 0.1015) / (0.5 × 1.0004…) ≈ 0.021.
    expect(sectionHalfThickness('airfoil', 1, 0.1, 0.003)).toBeCloseTo(0.021, 2);
  });
});

const trapezoid: FinPart = {
  kind: 'fin',
  name: 'fin',
  finIndex: 0,
  // Root LE (0.5, 0.025), tip LE (0.55, 0.105), tip TE (0.6, 0.105), root TE (0.6, 0.025).
  corners: [
    [0.5, 0.025],
    [0.55, 0.105],
    [0.6, 0.105],
    [0.6, 0.025],
  ],
  thickness: 0.003,
  angle: 0,
};

describe('chordAt on a trapezoid by hand', () => {
  it('the leading edge sweeps 0.05 m over the 0.08 m span; the trailing edge is straight', () => {
    expect(chordAt(trapezoid.corners, 0.025)).toEqual([0.5, 0.6]);
    const mid = chordAt(trapezoid.corners, 0.065)!; // half span: LE at 0.525
    expect(mid[0]).toBeCloseTo(0.525, 12);
    expect(mid[1]).toBeCloseTo(0.6, 12);
    expect(chordAt(trapezoid.corners, 0.2)).toBeUndefined();
  });
});

describe('finSectionGeometry', () => {
  it.each(['rounded', 'airfoil', 'wedge', 'double-wedge'] as const)(
    '%s: every vertex within ±t/2 of the fin plane and inside the planform',
    (section) => {
      const g = finSectionGeometry(trapezoid, section);
      const pos = g.getAttribute('position');
      let maxOff = 0;
      for (let i = 0; i < pos.count; i++) {
        // Fin 1 at angle 0: the plane is z = 0, radial is +y.
        maxOff = Math.max(maxOff, Math.abs(pos.getZ(i)));
        // Positions are float32: 1e-6 m allows its rounding.
        expect(pos.getX(i)).toBeGreaterThanOrEqual(0.5 - 1e-6);
        expect(pos.getX(i)).toBeLessThanOrEqual(0.6 + 1e-6);
        expect(pos.getY(i)).toBeGreaterThanOrEqual(0.025 - 1e-6);
        expect(pos.getY(i)).toBeLessThanOrEqual(0.105 + 1e-6);
      }
      expect(maxOff).toBeLessThanOrEqual(0.0015 + 1e-7);
      expect(maxOff).toBeGreaterThan(0.0014);
    },
  );
});
