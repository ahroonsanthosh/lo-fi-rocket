/**
 * FLUT-1, FLUT-2 (plan 0031): NACA TN 4197 eqs. (16) to (18). Expected values
 * by hand, checked against the report's own worked example (p. 6).
 */
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { kilogramsPerCubicMetre, metres } from '../units/si.js';
import type { TrapezoidFinSetComponent } from '../geometry/components.js';
import { flutterGeometry, flutterVelocity, TN4197_MATERIALS } from './flutter.js';

const PSI = 4.4482216152605 / 0.0254 ** 2;

describe('FLUT-1 panel geometry', () => {
  it('A = s/c₀.₅₀, t/c₀.₅₀, λ = c_t/c_r', () => {
    // c_r 0.1, c_t 0.05: c₀.₅₀ = 0.075; s 0.075 → A = 1; t 0.003 → t/c = 0.04; λ = 0.5.
    const fin: TrapezoidFinSetComponent = {
      kind: 'finSet',
      count: 3,
      rootChord: metres(0.1),
      tipChord: metres(0.05),
      sweep: metres(0.03),
      span: metres(0.075),
      thickness: metres(0.003),
      density: kilogramsPerCubicMetre(1000),
      bodyRadius: metres(0.02),
    };
    const g = flutterGeometry(fin);
    expect(g.panelAspectRatio).toBeCloseTo(1, 12);
    expect(g.thicknessRatio).toBeCloseTo(0.04, 12);
    expect(g.taperRatio).toBe(0.5);
  });
});

describe('FLUT-2 flutter speed, TN 4197 eq. (16) with (17)', () => {
  const g = { panelAspectRatio: 2, thicknessRatio: 0.04, taperRatio: 1 };
  it("reproduces the report's X: A = 2, t/c = 0.04 gives about 1.25 × 10⁶ psi at standard pressure (p. 6)", () => {
    // X = 39.3 A³/((t/c)³(A + 2)) = 39.3 × 8/(6.4e-5 × 4) = 1.228 × 10⁶ psi. With G_E = X × (V/a)² the flutter
    // speed equals the speed of sound when G_E = X: (V_f/a)² = 1.
    const p0 = 101325;
    const X = (24 * 0.25 * 1.4 * p0 * 31250) / Math.PI; // the SI denominator at λ = 1, p = p₀
    expect(X / PSI / 1e6).toBeCloseTo(1.228, 3);
    expect(flutterVelocity(g, X, p0, 340.294)).toBeCloseTo(340.294, 9);
  });
  it('solid aluminium (TN 4197 figure 3: 4.05 × 10⁶ psi) at sea level: V_f = 618.0 m/s', () => {
    // Denominator 2.673803 × 101325 × 31250 = 8.46635e9 Pa; G = 4.05e6 × 6894.757 = 2.792377e10 Pa;
    // (V_f/a)² = 3.298193, V_f/a = 1.816093, V_f = 1.816093 × 340.294 = 618.0 m/s.
    const al = TN4197_MATERIALS.find((m) => m.name === 'aluminium');
    if (al === undefined) throw new Error('aluminium missing');
    expect(al.shearModulus).toBeCloseTo(2.792377e10, -4);
    expect(flutterVelocity(g, al.shearModulus, 101325, 340.294)).toBeCloseTo(618.0, 1);
  });
  it('scales as √(G/p) and with the taper term (λ + 1)/2', () => {
    const base = flutterVelocity(g, 1e9, 50000, 300);
    expect(flutterVelocity(g, 4e9, 50000, 300)).toBeCloseTo(2 * base, 9);
    expect(flutterVelocity(g, 1e9, 12500, 300)).toBeCloseTo(2 * base, 9);
    // λ = 0: (λ + 1)/2 = 1/2 halves the denominator, V_f × √2.
    expect(flutterVelocity({ ...g, taperRatio: 0 }, 1e9, 50000, 300)).toBeCloseTo(
      Math.SQRT2 * base,
      9,
    );
  });
  it('rejects non-positive inputs', () => {
    expect(() => flutterVelocity(g, 0, 101325, 340)).toThrow(InvalidInputError);
    expect(() => flutterVelocity(g, 1e9, 0, 340)).toThrow(InvalidInputError);
  });
});
