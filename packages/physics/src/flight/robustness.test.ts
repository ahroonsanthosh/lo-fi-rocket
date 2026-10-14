/**
 * Plan 0065: what the random-design tests found. The flight's numbers at the edge of float64 (a
 * roll rate decaying to nothing, the first instant off a still rail, a rail tilted by next to
 * nothing reach the subnormal numbers, where 1/x overflows; the equations there have finite
 * limits, which are what the code gives), and a canopy opening on a fast rocket after a long
 * smooth coast, where the adaptive step must shrink instead of failing.
 */
import { describe, expect, it, vi } from 'vitest';
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
import type { FlightVehicle, SimulationOptions } from './vehicle.js';
import type { MotorDefinition } from '../motor/motor.js';
import { kilograms } from '../units/si.js';

// Several tests fly a whole 6-DOF flight to the ground at a tight tolerance: 2 to 4 s each here,
// and over the default 5 s on a loaded CI runner (PR #99, two different tests on two runs).
vi.setConfig({ testTimeout: 60_000 });

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

describe('wedge fins falling tail-first with no parachute (plan 0066)', () => {
  // R1 on a constant 12 N, 1.6 s motor with single-wedge fins and no recovery device: after apogee
  // it falls tail-first, past 90° angle of attack. The DATCOM large-angle model now covers the
  // wedge with the nearer chart family (listed), so the flight lands instead of ending there.
  const motor: MotorDefinition = {
    designation: 'C',
    manufacturer: 'Test',
    diameter: metres(0.024),
    length: metres(0.07),
    totalMass: kilograms(0.04),
    propellantMass: kilograms(0.02),
    points: [
      { time: seconds(0), thrust: newtons(12) },
      { time: seconds(1.6), thrust: newtons(12) },
    ],
    massRule: 'linear-in-time',
    sourceFormat: 'custom',
  };
  const vehicle: FlightVehicle = {
    components: R1_COMPONENTS.map((p) =>
      p.component.kind === 'finSet'
        ? { ...p, component: { ...p.component, crossSection: 'wedge' as const } }
        : p,
    ),
    componentNames: R1_COMPONENTS.map((p) => (p.component.kind === 'finSet' ? 'Fins' : '')),
    motor: { kind: 'definition', definition: motor, aftEnd: metres(0.6) },
    recovery: [],
    roughnessHeight: metres(60e-6),
  };
  const options = (largeAngleMethod: 'datcom' | 'linear'): SimulationOptions => ({
    site: { altitude: metres(0) },
    rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
    wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
    gravity: { seaLevel: metresPerSecondSquared(9.80665), altitudeDependence: 'constant' },
    aerodynamics: 'niskanen',
    finRollReduction: true,
    baseDragMotorRule: 'while-thrusting',
    largeAngleMethod,
    integrator: {
      kind: 'dormand-prince',
      relativeTolerance: 1e-8,
      absoluteTolerance: 1e-10,
      initialStep: seconds(0.001),
      maxStep: seconds(0.05),
    },
    maxTime: seconds(120),
    degreesOfFreedom: 6,
  });

  it("lands in the displayed mode, with the wedge fins' large-angle force listed", () => {
    const r = simulateFlight(vehicle, options('datcom'));
    expect(r.summary.endReason).toBe('landing');
    const listed = r.approximations.filter((a) => a.subject === 'Fin set "Fins"');
    expect(listed.map((a) => a.what)).toContain(
      'its normal force beyond the stall, and past 90° when the rocket tumbles',
    );
  });

  it('rates it minor while the flight stays below the stall, moderate once it goes past (plan 0067)', () => {
    // The first second is the vertical climb in still air (angle of attack about 0); the whole
    // flight falls tail-first after apogee, past the fins' stall.
    const impact = (maxTime: number): string | undefined =>
      simulateFlight(vehicle, {
        ...options('datcom'),
        maxTime: seconds(maxTime),
      }).approximations.find((a) => a.subject === 'Fin set "Fins"')?.impact;
    expect(impact(1)).toBe('minor');
    expect(impact(120)).toBe('moderate');
  });

  it('keeps the 90° limit in the OpenRocket-equivalent mode, and lists nothing for it', () => {
    const r = simulateFlight(vehicle, options('linear'));
    expect(r.summary.endReason).toBe('model-limit');
    expect(r.approximations.some((a) => a.what.startsWith('its normal force beyond'))).toBe(false);
  });
});

describe('an unstable rocket tumbling at Mach 2 (plan 0067)', () => {
  // R1 with 0.1 kg of ballast at its tail (−1.26 calibers at liftoff) on a constant 1200 N, 0.6 s
  // motor, in a 3 m/s wind: it passes Mach 2 and turns past 90° while still supersonic.
  const motor: MotorDefinition = {
    designation: 'X',
    manufacturer: 'Test',
    diameter: metres(0.024),
    length: metres(0.07),
    totalMass: kilograms(0.08),
    propellantMass: kilograms(0.05),
    points: [
      { time: seconds(0), thrust: newtons(1200) },
      { time: seconds(0.6), thrust: newtons(1200) },
    ],
    massRule: 'linear-in-time',
    sourceFormat: 'custom',
  };
  const vehicle: FlightVehicle = {
    components: [
      ...R1_COMPONENTS,
      {
        position: metres(0.58),
        component: {
          kind: 'massComponent',
          mass: kilograms(0.1),
          length: metres(0.02),
          radius: metres(0.02),
        },
      },
    ],
    motor: { kind: 'definition', definition: motor, aftEnd: metres(0.6) },
    recovery: [],
    roughnessHeight: metres(60e-6),
  };
  const options = (largeAngleMethod: 'datcom' | 'linear'): SimulationOptions => ({
    site: { altitude: metres(0) },
    rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
    wind: { kind: 'vector', velocity: { x: 3, y: 0, z: 0 } },
    gravity: { seaLevel: metresPerSecondSquared(9.80665), altitudeDependence: 'constant' },
    aerodynamics: 'niskanen',
    finRollReduction: true,
    baseDragMotorRule: 'while-thrusting',
    largeAngleMethod,
    integrator: {
      kind: 'dormand-prince',
      relativeTolerance: 1e-8,
      absoluteTolerance: 1e-10,
      initialStep: seconds(0.001),
      maxStep: seconds(0.05),
    },
    maxTime: seconds(200),
    degreesOfFreedom: 6,
  });

  it('lands in the displayed mode, the supersonic tumble listed as a major approximation', () => {
    const r = simulateFlight(vehicle, options('datcom'));
    expect(r.summary.endReason).toBe('landing');
    expect(r.summary.maxMach).toBeGreaterThan(2);
    const listed = r.approximations.filter((a) => a.what.includes('above Mach 1'));
    expect(listed.map((a) => [a.subject, a.impact])).toEqual([['The rocket', 'major']]);
    expect(r.notes.some((n) => n.includes('at Mach 1 or above'))).toBe(true);
  });

  it('keeps the 90° limit in the OpenRocket-equivalent mode, with nothing listed for it', () => {
    const r = simulateFlight(vehicle, options('linear'));
    expect(r.summary.endReason).toBe('model-limit');
    expect(r.approximations.some((a) => a.what.includes('above Mach 1'))).toBe(false);
  });
});

describe('sample fields without a modelled attitude (section 8)', () => {
  it('Mach, angle of attack, C_D0, CP and margin are NaN exactly under the canopy and after landing', () => {
    // R1 on an ideal 40 N, 1 s motor with the Niskanen aerodynamics and a 1 m canopy at 100 m on
    // the way down: the descent is the canopy drag alone (DYN-14), so no attitude is modelled.
    const r = simulateFlight(
      {
        components: R1_COMPONENTS,
        motor: { kind: 'ideal', thrust: newtons(40), burnTime: seconds(1) },
        recovery: [
          {
            name: 'Main',
            diameter: metres(1),
            dragCoefficient: 0.8,
            deploy: { event: 'altitude', altitude: metres(100), delay: seconds(0) },
          },
        ],
        roughnessHeight: metres(60e-6),
      },
      {
        site: { altitude: metres(0) },
        rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
        wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
        gravity: { seaLevel: metresPerSecondSquared(9.80665), altitudeDependence: 'constant' },
        aerodynamics: 'niskanen',
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
      },
    );
    expect(r.summary.endReason).toBe('landing');
    const phases = new Set(r.samples.map((s) => s.phase));
    expect(phases).toContain('descent');
    for (const s of r.samples) {
      const fields = [s.mach, s.angleOfAttack, s.cd0, s.cp, s.stabilityCalibers];
      if (s.phase === 'descent' || s.phase === 'landed') {
        expect(fields.every((x) => Number.isNaN(x))).toBe(true);
      } else {
        expect(fields.every((x) => Number.isFinite(x))).toBe(true);
      }
    }
  });
});
