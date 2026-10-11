import { describe, expect, it } from 'vitest';
import { metres } from '../units/si.js';
import { noseProfile, transitionProfile, type Profile } from './profiles.js';
import { integrate, innerRadius, revolutionMassProperties } from './revolution.js';

const cylinder = (R: number, L: number): Profile => ({
  length: L,
  radius: () => R,
  slope: () => 0,
});

describe('integrate (composite 5-point Gauss–Legendre)', () => {
  it('is exact for polynomials up to degree 9 on one panel', () => {
    // ∫₀¹ x⁹ dx = 0.1
    expect(integrate((x) => x ** 9, 1, 1)).toBeCloseTo(0.1, 14);
  });
  it('integrates √x to 1e-6 relative with 512 panels: ∫₀¹ √x dx = 2/3', () => {
    expect(Math.abs(integrate(Math.sqrt, 1, 512) - 2 / 3)).toBeLessThan(1e-6 * (2 / 3));
  });
});

describe('solid cylinder (closed forms as oracle)', () => {
  // R = 0.02, L = 0.1, ρ = 1000: V = π R² L = 1.2566371e-4 m³; m = 0.12566371 kg; CG = 0.05;
  // I_x = ½ m R² = 0.5 × 0.12566371 × 4e-4 = 2.5132741e-5;
  // I_y = m (3R² + L²)/12 = 0.12566371 × (0.0012 + 0.01)/12 = 0.12566371 × 9.3333333e-4 = 1.1728613e-4.
  const p = revolutionMassProperties(cylinder(0.02, 0.1), 1000);
  it('volume, mass, CG', () => {
    expect(p.volume).toBeCloseTo(1.2566371e-4, 11);
    expect(p.mass).toBeCloseTo(0.12566371, 8);
    expect(p.cgX).toBeCloseTo(0.05, 12);
  });
  it('inertias', () => {
    expect(p.inertiaRotational).toBeCloseTo(2.5132741e-5, 12);
    expect(p.inertiaLongitudinal).toBeCloseTo(1.1728613e-4, 11);
  });
});

describe('solid cone (closed forms as oracle)', () => {
  // R = 0.025, L = 0.1, ρ = 160 (R1's balsa nose): V = π R² L/3 = 6.5449847e-5; m = 0.010471976; CG = 3L/4 = 0.075;
  // I_x = (3/10) m R² = 0.3 × 0.010471976 × 6.25e-4 = 1.9634954e-6;
  // I_y about CG = m (3R²/20 + 3L²/80) = 0.010471976 × (9.375e-5 + 3.75e-4) = 4.9087385e-6.
  const p = revolutionMassProperties(noseProfile('conical', metres(0.1), metres(0.025)), 160);
  it('matches the cone formulae', () => {
    expect(p.volume).toBeCloseTo(6.5449847e-5, 12);
    expect(p.mass).toBeCloseTo(0.010471976, 9);
    expect(p.cgX).toBeCloseTo(0.075, 12);
    expect(p.inertiaRotational).toBeCloseTo(1.9634954e-6, 13);
    expect(p.inertiaLongitudinal).toBeCloseTo(4.9087385e-6, 13);
  });
});

describe('hollow tube via a shell profile', () => {
  // Outer R = 0.025, wall 0.001 (inner 0.024), L = 0.5, ρ = 700 (R1's body tube):
  // V = π (R² − r²) L = π × 4.9e-5 × 0.5 = 7.6969020e-5; m = 0.053878314; I_x = ½ m (R² + r²) = 0.5 × 0.053878314 × 1.201e-3 = 3.2353928e-5;
  // I_y = m [3 (R² + r²) + L²]/12 = 0.053878314 × (3.603e-3 + 0.25)/12 = 0.053878314 × 2.1133583e-2 = 1.1386418e-3.
  const p = revolutionMassProperties(cylinder(0.025, 0.5), 700, 0.001);
  it('matches the tube formulae', () => {
    expect(p.volume).toBeCloseTo(7.696902e-5, 12);
    expect(p.mass).toBeCloseTo(0.053878314, 9);
    expect(p.cgX).toBeCloseTo(0.25, 12);
    expect(p.inertiaRotational).toBeCloseTo(3.2353928e-5, 12);
    expect(p.inertiaLongitudinal).toBeCloseTo(1.1386418e-3, 10);
  });
});

describe('uniform-wall shells', () => {
  it('inner radius of a cone wall is reduced by t/cos α (exact for straight profiles)', () => {
    // Boat tail R₁ = 0.027, R₂ = 0.018, L = 0.05: tan α = 0.18, √(1 + 0.0324) = 1.016071; t = 0.0015 → 0.0015241.
    const p = transitionProfile('conical', metres(0.05), metres(0.027), metres(0.018));
    expect(innerRadius(p, 0.0015, 0)).toBeCloseTo(0.027 - 0.0015241, 6);
  });

  it('conical boat tail shell volume by hand: frustum minus inner frustum', () => {
    // Outer frustum V = πL/3 (R₁² + R₁R₂ + R₂²) = 0.05235988 × 1.539e-3 = 8.058e-5.
    // Inner radii 0.0254759 and 0.0164759: V_i = 0.05235988 × (6.49021e-4 + 4.19741e-4 + 2.71455e-4) = 7.0176e-5.
    // Shell = 1.0407e-5 m³ (OpenRocket: 1.0409e-5, reference/rockets/components/r2-ogive-boattail.csv).
    const p = revolutionMassProperties(
      transitionProfile('conical', metres(0.05), metres(0.027), metres(0.018)),
      1050,
      0.0015,
    );
    expect(p.volume).toBeCloseTo(1.0407e-5, 8);
    expect(p.mass).toBeCloseTo(0.010929, 5);
  });

  it('quadrature converges: doubling the panels changes a tangent-ogive shell by less than 1e-6 relative', () => {
    const profile = noseProfile('ogive', metres(0.15), metres(0.027), 1);
    const a = revolutionMassProperties(profile, 1050, 0.002, 512);
    const b = revolutionMassProperties(profile, 1050, 0.002, 1024);
    expect(Math.abs(a.volume - b.volume) / b.volume).toBeLessThan(1e-6);
    expect(Math.abs(a.cgX - b.cgX) / b.cgX).toBeLessThan(1e-6);
    expect(
      Math.abs(a.inertiaLongitudinal - b.inertiaLongitudinal) / b.inertiaLongitudinal,
    ).toBeLessThan(1e-5);
  });

  it('a Von Kármán shell (vertical tip) converges to 1e-5 relative', () => {
    const profile = noseProfile('haack', metres(0.13), metres(0.016), 0);
    const a = revolutionMassProperties(profile, 1850, 0.002, 512);
    const b = revolutionMassProperties(profile, 1850, 0.002, 2048);
    expect(Math.abs(a.volume - b.volume) / b.volume).toBeLessThan(1e-5);
  });
});
