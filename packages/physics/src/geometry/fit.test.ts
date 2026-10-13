/**
 * Component fit checks (review finding B-1, D-074). The cases are the
 * review's: each one gave a centre of pressure with no error before.
 */
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { simulateFlight } from '../flight/simulate.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from '../flight/gravity.js';
import type { FlightVehicle, SimulationOptions } from '../flight/vehicle.js';
import { D12 } from '../motor/motor.test.js';
import { mach, metres, radians, seconds } from '../units/si.js';
import { centreOfPressure } from '../stability/barrowman.js';
import type { PlacedComponent } from './assembly.js';
import { validateComponentFit } from './fit.js';
import {
  R1_COMPONENTS,
  R2_COMPONENTS,
  R3_COMPONENTS,
  R4_COMPONENTS,
  R5_COMPONENTS,
} from './reference-rockets.js';

const OPTIONS = { mach: mach(0.3), rollAngle: 'worst' as const, finRollReduction: false };

/** R1 with component `i` replaced by `f(component)`. */
function edited(i: number, f: (p: PlacedComponent) => PlacedComponent): PlacedComponent[] {
  return R1_COMPONENTS.map((p, j) => (j === i ? f(p) : p));
}
const finIndex = R1_COMPONENTS.findIndex((p) => p.component.kind === 'finSet');
const noseIndex = R1_COMPONENTS.findIndex((p) => p.component.kind === 'noseCone');
const tubeIndex = R1_COMPONENTS.findIndex((p) => p.component.kind === 'bodyTube');

describe('component fit (D-074)', () => {
  it('the five reference rockets fit', () => {
    for (const r of [R1_COMPONENTS, R2_COMPONENTS, R3_COMPONENTS, R4_COMPONENTS, R5_COMPONENTS]) {
      expect(() => {
        validateComponentFit(r);
      }).not.toThrow();
    }
  });

  it('a 12.5 mm nose on the 25 mm tube is rejected (the review: CP +0.79 cal, unsafe direction)', () => {
    const bad = edited(noseIndex, (p) =>
      p.component.kind === 'noseCone'
        ? { ...p, component: { ...p.component, baseRadius: metres(0.0125) } }
        : p,
    );
    expect(() => centreOfPressure(bad, OPTIONS)).toThrow(
      /body tube \(component \d+\) fore radius .*must equal the aft radius of the nose cone .*12\.500 mm.*Add a transition/,
    );
  });

  it('a fin body radius of 1 m on the 25 mm tube is rejected (the review: K_T(B) 1.5 instead of 1.238)', () => {
    const bad = edited(finIndex, (p) =>
      p.component.kind === 'finSet'
        ? { ...p, component: { ...p.component, bodyRadius: metres(1) } }
        : p,
    );
    expect(() => centreOfPressure(bad, OPTIONS)).toThrow(
      /fin set \(component \d+\) body radius .*must match the body it sits on, whose radius there is 25\.000 mm/,
    );
  });

  it('fins 5 m behind the rocket, or at x = −1 m, are rejected', () => {
    for (const x of [5, -1]) {
      const bad = edited(finIndex, (p) => ({ ...p, position: metres(x) }));
      expect(() => centreOfPressure(bad, OPTIONS)).toThrow(
        /fin set \(component \d+\) position .*root leading edge must be on the rocket body, between 0 and 0\.600000 m/,
      );
    }
  });

  it('a body that does not start at the nose tip, or has a gap or overlap, is rejected', () => {
    const shifted = R1_COMPONENTS.map((p) =>
      p.component.kind === 'noseCone' || p.component.kind === 'bodyTube'
        ? { ...p, position: metres((p.position as number) + 0.3) }
        : p,
    );
    expect(() => {
      validateComponentFit(shifted);
    }).toThrow(/must start at the nose tip, x = 0 m/);
    const gap = edited(tubeIndex, (p) => ({ ...p, position: metres(0.11) }));
    expect(() => {
      validateComponentFit(gap);
    }).toThrow(/there is a gap of 10\.000 mm/);
    const overlap = edited(tubeIndex, (p) => ({ ...p, position: metres(0.09) }));
    expect(() => {
      validateComponentFit(overlap);
    }).toThrow(/an overlap of 10\.000 mm/);
  });

  it('rail buttons must be on the body with its radius', () => {
    const buttons = R2_COMPONENTS.findIndex((p) => p.component.kind === 'railButton');
    const off = R2_COMPONENTS.map((p, j) => (j === buttons ? { ...p, position: metres(2) } : p));
    expect(() => {
      validateComponentFit(off);
    }).toThrow(/rail buttons .* must sit on the rocket body/);
    const wrongRadius = R2_COMPONENTS.map((p, j) =>
      j === buttons && p.component.kind === 'railButton'
        ? { ...p, component: { ...p.component, bodyRadius: metres(0.02) } }
        : p,
    );
    expect(() => {
      validateComponentFit(wrongRadius);
    }).toThrow(/rail buttons .* body radius/);
  });

  it('a fin chord may cross a joint or run past the base (ARCAS, NACA RM-10 models)', () => {
    // R1's fins moved 30 mm aft: the root chord ends 30 mm past the 0.600 m base.
    const overhang = edited(finIndex, (p) => ({
      ...p,
      position: metres((p.position as number) + 0.03),
    }));
    expect(() => {
      validateComponentFit(overhang);
    }).not.toThrow();
  });

  it('a component list without a body (a fin set studied alone) is not checked', () => {
    const fins = R1_COMPONENTS.filter((p) => p.component.kind === 'finSet');
    expect(() => {
      validateComponentFit(fins);
    }).not.toThrow();
  });

  it('the simulator applies the same checks before flying', () => {
    const bad = edited(finIndex, (p) => ({ ...p, position: metres(5) }));
    const vehicle: FlightVehicle = {
      components: bad,
      motor: {
        kind: 'definition',
        definition: D12,
        aftEnd: metres(0.6),
        ejectionDelay: seconds(5),
      },
      recovery: [],
      roughnessHeight: metres(60e-6),
    };
    const options: SimulationOptions = {
      site: { altitude: metres(0) },
      rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
      wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
      gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
      aerodynamics: 'niskanen',
      finRollReduction: false,
      baseDragMotorRule: 'always',
      integrator: { kind: 'rk4', timeStep: seconds(0.002) },
      maxTime: seconds(60),
      degreesOfFreedom: 6,
    };
    expect(() => simulateFlight(vehicle, options)).toThrow(InvalidInputError);
    expect(() => simulateFlight(vehicle, options)).toThrow(
      /root leading edge must be on the rocket body/,
    );
  });
});
