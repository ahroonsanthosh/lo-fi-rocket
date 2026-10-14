/**
 * Plan 0065: what the random-design tests found. The flight's numbers at the edge of float64 (a
 * roll rate decaying to nothing, the first instant off a still rail, a rail tilted by next to
 * nothing reach the subnormal numbers, where 1/x overflows; the equations there have finite
 * limits, which are what the code gives), and a canopy opening on a fast rocket after a long
 * smooth coast, where the adaptive step must shrink instead of failing.
 */
import { describe, expect, it } from 'vitest';
import { rocketMassProperties } from '../geometry/assembly.js';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import {
  kilogramsPerCubicMetre,
  mach,
  metres,
  metresPerSecondSquared,
  newtons,
  radians,
  seconds,
} from '../units/si.js';
import { rollDampingMoment } from './aerodynamics.js';
import { initialOrientation } from './frames.js';
import { quaternionNorm, rotationFromAngularVelocity } from './quaternion.js';
import { simulateFlight } from './simulate.js';
import type { SimulationOptions } from './vehicle.js';

describe('near-zero rates (plan 0065)', () => {
  it('rotate by a subnormal angular velocity: the axis is still the unit ω̂, the angle |ω|Δt', () => {
    for (const e of [-200, -310, -320]) {
      const x = 10 ** e;
      const q = rotationFromAngularVelocity({ x, y: x, z: 0 }, 0.01);
      // cos(φ/2) with φ below 1e-200 is 1; the vector part is ω̂ sin(φ/2), at most 1e-200.
      expect(q.w).toBe(1);
      expect(Math.abs(q.x)).toBeLessThan(1e-200);
      expect(q.x).toBe(q.y);
      expect(q.z).toBe(0);
      expect(quaternionNorm(q)).toBe(1);
    }
    // The ordinary path is unchanged: 90° about z in 1 s at π/2 rad/s gives cos 45° + k sin 45°.
    const q = rotationFromAngularVelocity({ x: 0, y: 0, z: Math.PI / 2 }, 1);
    expect(q.w).toBeCloseTo(Math.SQRT1_2, 15);
    expect(q.z).toBeCloseTo(Math.SQRT1_2, 15);
  });

  it('give no roll damping when the dynamic pressure has underflowed to 0', () => {
    const fin = {
      kind: 'finSet' as const,
      crossSection: 'square' as const,
      count: 3,
      rootChord: metres(0.05),
      tipChord: metres(0.03),
      sweep: metres(0.02),
      span: metres(0.04),
      thickness: metres(0.002),
      density: kilogramsPerCubicMetre(600),
      bodyRadius: metres(0.0125),
    };
    // v₀ = 3e-323 m/s: q = ½ρv₀² underflows to 0, ω/v₀ overflows; the moment ½ρωv₀NΣ(2π/β) is 0.
    expect(rollDampingMoment([fin], mach(0), 0, 3e-323, 1)).toBe(0);
    // An ordinary case is unchanged and opposes the roll rate (negative work).
    expect(Math.sign(rollDampingMoment([fin], mach(0.3), 6000, 100, 10))).not.toBe(0);
  });
});

describe('a rail tilted by next to nothing (plan 0065)', () => {
  it('starts the rocket as on a vertical rail, to within the tilt', () => {
    const vertical = initialOrientation(radians(0), radians(0));
    for (const angle of [1e-200, 1e-310, 5e-324]) {
      const q = initialOrientation(radians(angle), radians(1));
      expect(Math.abs(q.w - vertical.w)).toBeLessThan(1e-15);
      expect(Math.abs(q.x - vertical.x)).toBeLessThan(1e-15);
      expect(Math.abs(q.y - vertical.y)).toBeLessThan(1e-15);
      expect(Math.abs(q.z - vertical.z)).toBeLessThan(1e-15);
    }
  });
});

describe('a canopy opening at 261 m/s after a smooth vacuum coast (plan 0065)', () => {
  // R1 on an ideal 40 N motor for 1 s, no aerodynamics, so the coast is a parabola and the
  // Dormand–Prince step grows to its 0.05 s maximum; the canopy opens descending through 100 m.
  // The first trial step after it is far too long (the drag time constant is milliseconds) and
  // its stages left the atmosphere's range; it is now a rejected step, shrunk and retried.
  const options: SimulationOptions = {
    site: { altitude: metres(0) },
    rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
    wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
    gravity: { seaLevel: metresPerSecondSquared(9.80665), altitudeDependence: 'constant' },
    aerodynamics: 'none',
    finRollReduction: false,
    baseDragMotorRule: 'while-thrusting',
    integrator: {
      kind: 'dormand-prince',
      relativeTolerance: 1e-8,
      absoluteTolerance: 1e-10,
      initialStep: seconds(0.001),
      maxStep: seconds(0.05),
    },
    maxTime: seconds(600),
    degreesOfFreedom: 6,
  };
  for (const [diameter, terminal] of [
    // Terminal speed under the canopy alone (DYN-14 with the weight): v = √(2 m g / (ρ C_D A)),
    // m = 0.148304 kg (R1, the ideal motor massless), g = 9.80665, ρ = 1.225 kg/m³ at sea level
    // (ATM), C_D = 0.8. d = 1 m: A = 0.785398 m², v = √(2.90876 / 0.769690) = 1.94401 m/s.
    // d = 2 m: A = 3.14159 m², v = √(2.90876 / 3.07876) = 0.972005 m/s.
    [1, 1.94401],
    [2, 0.972005],
  ] as const) {
    it(`lands under a ${String(diameter)} m canopy at the terminal speed`, () => {
      expect(rocketMassProperties(R1_COMPONENTS).mass).toBeCloseTo(0.148304, 6);
      const r = simulateFlight(
        {
          components: R1_COMPONENTS,
          motor: { kind: 'ideal', thrust: newtons(40), burnTime: seconds(1) },
          recovery: [
            {
              name: 'Main',
              diameter: metres(diameter),
              dragCoefficient: 0.8,
              deploy: { event: 'altitude', altitude: metres(100), delay: seconds(0) },
            },
          ],
          roughnessHeight: metres(60e-6),
        },
        options,
      );
      expect(r.summary.endReason).toBe('landing');
      expect(r.summary.deploymentVelocity).toBeGreaterThan(250);
      expect(r.summary.groundHitVelocity).toBeCloseTo(terminal, 3);
    });
  }
});
