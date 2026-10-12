/** Aerodynamic forces and moments at angle of attack (plan 0010 part A, AERO-1 to AERO-5). */
import { describe, expect, it } from 'vitest';
import { InvalidInputError, NotImplementedError } from '../errors.js';
import type { TrapezoidFinSetComponent } from '../geometry/components.js';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import {
  centreOfPressure,
  finChordFraction,
  finSetTerm,
  supersonicFinCnAlpha,
} from '../stability/barrowman.js';
import { dimensionless, mach, metres, pascals, radians, squareMetres } from '../units/si.js';
import {
  aerodynamicForcesAndMoments,
  normalForceAtAngle,
  pitchDampingMoment,
  rollDampingMoment,
  type AeroInputs,
} from './aerodynamics.js';
import { vec3 } from './vector.js';

const OR = { finRollReduction: false };
const DEG5 = (5 * Math.PI) / 180;
const fins = R1_COMPONENTS.find((p) => p.component.kind === 'finSet')
  ?.component as TrapezoidFinSetComponent;

describe('BAR-10 fin CP fraction, eqs. (3.35), (3.36)', () => {
  // R1 fins: A = 2 × 0.0064/0.006 = 2.1333.
  const A = 2.13333;
  it('0.25 up to Mach 0.5; at Mach 2 (Aβ = 3.6950): (3.69504 − 0.67)/(2 × 3.69504 − 1) = 0.473397; continuous and flat at both ends', () => {
    expect(finChordFraction(mach(0.3), A)).toBe(0.25);
    expect(finChordFraction(mach(0.5), A)).toBe(0.25);
    expect(finChordFraction(mach(2), A)).toBeCloseTo(0.473397, 5);
    expect(finChordFraction(mach(2 - 1e-9), A)).toBeCloseTo(0.473397, 5);
    expect(finChordFraction(mach(0.5 + 1e-9), A)).toBeCloseTo(0.25, 9);
    const h = 1e-5;
    expect(Math.abs(finChordFraction(mach(0.5 + h), A) - 0.25) / h).toBeLessThan(1e-3);
    expect(finChordFraction(mach(1.2), A)).toBeGreaterThan(0.25);
    expect(finChordFraction(mach(3), A)).toBeGreaterThan(finChordFraction(mach(2), A));
  });
  it('finSetTerm moves the CP aft above Mach 0.5 and interpolates in the transonic band (BAR-12, D-056)', () => {
    const aRef = squareMetres(Math.PI * 0.025 ** 2);
    const slow = finSetTerm(fins, aRef, mach(0.3), 'worst', false);
    const fast = finSetTerm(fins, aRef, mach(0.7), 'worst', false);
    expect(fast.cpX).toBeGreaterThan(slow.cpX);
    expect(slow.chordFraction).toBe(0.25);
    expect(finSetTerm(fins, aRef, mach(0.9), 'worst', false).regime).toBe('transonic');
    expect(finSetTerm(fins, aRef, mach(1.1), 'worst', false).regime).toBe('transonic');
    expect(finSetTerm(fins, aRef, mach(1.5), 'worst', false).regime).toBe('supersonic');
  });
});

describe('BAR-11 supersonic fin normal force, eqs. (3.41) to (3.49)', () => {
  it('M = 2, R1 fin (A_fin/A_ref = 3.05577): K₁ = 2/√3 = 1.154701, K₂ = (38.4 − 12)/36 = 0.733333, K₃ = 310.08/280.59 = 1.10509; at α = 0: 3.52851', () => {
    // K₃: (2.4 × 256 + (3.92 − 9.8 − 5) × 64 + 24 × 16 + 8)/(6 × 3^3.5) = (614.4 − 696.32 + 384 + 8)/280.592 = 310.08/280.592 = 1.105093.
    const aRef = Math.PI * 0.025 ** 2;
    expect(supersonicFinCnAlpha(mach(2), 0.006, aRef, 0)).toBeCloseTo(3.05577 * 1.154701, 4);
    const at5 = supersonicFinCnAlpha(mach(2), 0.006, aRef, DEG5);
    expect(at5).toBeCloseTo(3.05577 * (1.154701 + 0.733333 * DEG5 + 1.105093 * DEG5 * DEG5), 4);
    expect(() => supersonicFinCnAlpha(mach(1), 0.006, aRef, 0)).toThrow(InvalidInputError);
  });
});

describe('AERO-1, AERO-2 normal force at angle of attack (R1, Mach 0.3, OpenRocket-equivalent mode)', () => {
  it('at α = 0 the CP equals the design-window CP and C_N = 0', () => {
    const r = normalForceAtAngle(R1_COMPONENTS, mach(0.3), radians(0), radians(0), OR);
    expect(r.cn).toBe(0);
    expect(r.cp).toBeCloseTo(
      centreOfPressure(R1_COMPONENTS, {
        mach: mach(0.3),
        rollAngle: 'worst',
        finRollReduction: false,
      }).cp,
      12,
    );
    expect(r.contributions.map((c) => c.source)).toEqual([
      'nose cone (3.19)',
      'fins (subsonic, 3 fins, K 1.2381)',
    ]);
  });
  it('at α = 5°: nose 2 sin α/α = 1.99746, nose lift 0.12191 at 2L/3, tube lift 1.21908 at 0.35, fins 15.4506; C_N = 1.63966, CP = 0.47565 m', () => {
    // sin 5° = 0.0871557, α = 0.0872665 rad, sin²α = 0.0075961, A_ref = 1.9635e-3.
    // Nose lift: 1.1 × (R L = 0.0025) × 0.0075961/1.9635e-3 / α = 0.0106385/0.0872665 = 0.121908, centroid 2L/3 = 0.066667.
    // Tube lift: 1.1 × 0.025 × 0.0075961/1.9635e-3 / α = 0.106385/0.0872665 = 1.21908 at 0.35.
    // Moment sum: (1.99746 × 0.066667 + 0.121908 × 0.066667 + 1.21908 × 0.35 + 15.4506 × 0.541667)/(1.99746 + 0.121908 + 1.21908 + 15.4506)
    //   = (0.133164 + 0.008127 + 0.426678 + 8.369075)/18.78905 = 8.937044/18.78905 = 0.475653.
    const r = normalForceAtAngle(R1_COMPONENTS, mach(0.3), radians(DEG5), radians(0), OR);
    const by = (s: string): number =>
      r.contributions.find((c) => c.source.startsWith(s))?.cn ?? Number.NaN;
    expect(by('nose cone (3.19)') / DEG5).toBeCloseTo(1.99746, 5);
    expect(by('nose cone body lift') / DEG5).toBeCloseTo(0.121908, 5);
    expect(by('body tube lift') / DEG5).toBeCloseTo(1.21908, 4);
    expect(by('fins') / DEG5).toBeCloseTo(15.4506, 3);
    expect(r.cnAlpha).toBeCloseTo(18.78905, 3);
    expect(r.cn).toBeCloseTo(1.63966, 4);
    expect(r.cp).toBeCloseTo(0.475653, 5);
    // The CP moves forward with angle of attack (Niskanen p. 12).
    expect(r.cp).toBeLessThan(0.487227);
  });
  it('the displayed mode (roll reduction) depends on the lateral airflow angle; the OpenRocket mode does not', () => {
    const displayed = { finRollReduction: true };
    const a0 = normalForceAtAngle(R1_COMPONENTS, mach(0.3), radians(DEG5), radians(0), displayed);
    const a60 = normalForceAtAngle(
      R1_COMPONENTS,
      mach(0.3),
      radians(DEG5),
      radians(Math.PI / 3),
      displayed,
    );
    expect(a60.cn).toBeGreaterThan(a0.cn);
    expect(
      normalForceAtAngle(R1_COMPONENTS, mach(0.3), radians(DEG5), radians(Math.PI / 3), OR).cn,
    ).toBeCloseTo(
      normalForceAtAngle(R1_COMPONENTS, mach(0.3), radians(DEG5), radians(0), OR).cn,
      12,
    );
  });
});

describe('AERO-4, AERO-5 damping', () => {
  it('pitch damping R1 at 10 rad/s, ρ = 1.225, CG 0.387: body 0.018183 + fins 0.0024476 = 0.020631 N·m', () => {
    // Fore portion 0.387 m: cone (mean radius R/2 = 0.0125 over 0.1) and tube 0.287 at 0.025 → mean 0.021770;
    //   aft 0.213 m at 0.025. 0.275 × 1.225 × (0.387⁴ × 0.021770 + 0.213⁴ × 0.025) × 100
    //   = 0.336875 × (0.0224302 × 0.021770 + 0.0020583 × 0.025) × 100 = 0.336875 × 5.3975e-4 × 100 = 0.018183.
    // Fins: ξ = 0.541667 − 0.387 = 0.154667; 0.3 × 1.225 × 3 × 0.006 × 0.154667³ × 100 = 0.006615 × 0.0037000 × 100 = 0.0024476.
    const nf = normalForceAtAngle(R1_COMPONENTS, mach(0.3), radians(0), radians(0), OR);
    expect(pitchDampingMoment(nf.bodyPieces, nf.finCps, 0.387, 1.225, 10)).toBeCloseTo(0.020631, 5);
    expect(pitchDampingMoment(nf.bodyPieces, nf.finCps, 0.387, 1.225, 0)).toBe(0);
  });
  it('roll damping R1: Σ = 2.5083·10⁻⁵ m⁴; at 50 m/s (q = 1531.25), 20 rad/s, Mach 0.147 (β = 0.98914): 3 × 2π/0.98914 × 0.4 × 1531.25 × 2.5083e-5 = 0.29276 N·m', () => {
    // Σ = 0.15 × 0.025² × 0.08/2 + 0.2 × 0.025 × 0.0064/3 + 0.25 × 0.000512/12 = 3.75e-6 + 1.0667e-5 + 1.0667e-5 = 2.5083e-5.
    expect(rollDampingMoment([fins], mach(0.147), 1531.25, 50, 20)).toBeCloseTo(0.29276, 4);
    expect(rollDampingMoment([fins], mach(0.147), 1531.25, 50, 0)).toBe(0);
    expect(() => rollDampingMoment([fins], mach(0.85), 1531.25, 300, 1)).toThrow(
      NotImplementedError,
    );
  });
});

describe('combined forces and moments (R1 at 50.25 m/s airspeed, Mach 0.3 table, α = 5°)', () => {
  const base: AeroInputs = {
    components: R1_COMPONENTS,
    mach: mach(0.3),
    angleOfAttack: radians(DEG5),
    lateralAirflowAngle: radians(0),
    axialAirspeedSign: -1,
    dynamicPressure: pascals(1546.5625),
    airspeed: 50.249378,
    density: 1.225,
    cg: metres(0.387),
    angularVelocityBody: vec3(0, 0, 0),
    cd0: dimensionless(0.75745),
    options: OR,
  };
  it('normal force 4.9793 N opposes the lateral airflow (+y) and the moment restores the nose towards it; axial drag 1.3 × ... along +x', () => {
    // N = 1546.5625 × 1.9635e-3 × 1.63966 = 4.9793 N; ΔX = 0.475653 − 0.387 = 0.088653; τ_z = −N ΔX = −0.44143 N·m.
    // C_A = 0.75745 × s(5°) with s = 1 + 0.3 × smoothstep(5/17 = 0.29412) = 1 + 0.3 × (3 × 0.086505 − 2 × 0.025443) = 1 + 0.3 × 0.208630 = 1.062589; C_A = 0.80486.
    const r = aerodynamicForcesAndMoments(base);
    expect(r.normalForce).toBeCloseTo(4.9793, 3);
    expect(r.forceBody.y).toBeCloseTo(-4.9793, 3);
    expect(r.forceBody.z).toBeCloseTo(0, 12);
    expect(r.momentBody.z).toBeCloseTo(-0.44143, 3);
    expect(r.momentBody.y).toBeCloseTo(0, 12);
    expect(r.axialDragCoefficient).toBeCloseTo(0.80486, 4);
    expect(r.forceBody.x).toBeCloseTo(1546.5625 * 1.9635e-3 * 0.80486, 2);
    expect(r.forceBody.x).toBeGreaterThan(0); // pushes aft for nose-first flight
    expect(r.warnings).toEqual([]);
  });
  it('lateral airflow along +z rotates the force and moment accordingly; damping opposes the rates', () => {
    const r = aerodynamicForcesAndMoments({
      ...base,
      lateralAirflowAngle: radians(Math.PI / 2),
      angularVelocityBody: vec3(20, 0, 10),
    });
    expect(r.forceBody.z).toBeCloseTo(-4.9793, 3);
    expect(r.momentBody.y).toBeCloseTo(0.44143 - 0.020631 * 0, 2);
    // Pitch damping at 10 rad/s (0.020631 N·m) acts along −z here (the rate is about +z), roll damping along −x.
    expect(r.momentBody.z).toBeCloseTo(-0.020631, 4);
    expect(r.momentBody.x).toBeCloseTo(
      -0.29276 * (1546.5625 / 1531.25) * (50.249378 / 50) ** -1 * (50.249378 / 50),
      1,
    );
    expect(r.rollDampingMoment).toBeGreaterThan(0);
    expect(r.pitchDampingMoment).toBeCloseTo(0.020631, 5);
  });
  it('tail-first flight flips the axial force and flags the mirrored scaling', () => {
    const r = aerodynamicForcesAndMoments({
      ...base,
      axialAirspeedSign: 1,
      angleOfAttack: radians(Math.PI - DEG5),
    });
    expect(r.forceBody.x).toBeLessThan(0);
    expect(r.warnings.join()).toContain('D-033');
  });
});
