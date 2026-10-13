/**
 * The confidence report (D-083, plan 0055 step 1).
 */
import { describe, expect, it } from 'vitest';
import { componentApproximations, confidenceOf, type Approximation } from './fidelity.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from './flight/gravity.js';
import { simulateFlight } from './flight/simulate.js';
import type { FlightVehicle, SimulationOptions } from './flight/vehicle.js';
import { R1_COMPONENTS } from './geometry/reference-rockets.js';
import { D12 } from './motor/motor.test.js';
import { metres, radians, seconds } from './units/si.js';

const approx = (impact: Approximation['impact']): Approximation => ({
  subject: 'Part',
  what: 'something',
  method: 'a method',
  effect: 'an effect',
  impact,
});

describe('confidenceOf: the rating rule of D-083', () => {
  it('none or only minor approximations: high', () => {
    expect(confidenceOf([]).level).toBe('high');
    expect(confidenceOf([approx('minor'), approx('minor')]).level).toBe('high');
    expect(confidenceOf([approx('minor')]).summary).toMatch(/1 small approximation,/);
  });
  it('any moderate: medium; any major: low, whatever else is listed', () => {
    expect(confidenceOf([approx('minor'), approx('moderate')]).level).toBe('medium');
    expect(confidenceOf([approx('moderate'), approx('major'), approx('minor')]).level).toBe('low');
    expect(confidenceOf([approx('major'), approx('major')]).summary).toMatch(
      /2 parts of this design are/,
    );
  });
});

describe('componentApproximations', () => {
  const fins = R1_COMPONENTS.find((c) => c.component.kind === 'finSet');
  if (fins?.component.kind !== 'finSet') throw new Error('R1 has fins');
  const finSet = fins.component;

  it('square fins are modelled exactly: nothing listed', () => {
    expect(componentApproximations([{ name: 'Fins', component: finSet }])).toEqual([]);
  });

  it('rounded and airfoil fins list the slab mass as a minor approximation (D-077)', () => {
    for (const crossSection of ['rounded', 'airfoil'] as const) {
      const [a, ...rest] = componentApproximations([
        { name: 'Fins', component: { ...finSet, crossSection } },
      ]);
      expect(rest).toEqual([]);
      expect(a?.subject).toBe('Fin set "Fins"');
      expect(a?.impact).toBe('minor');
      expect(a?.what).toContain(crossSection);
    }
  });
});

describe('a flight carries its approximations and confidence', () => {
  const options: SimulationOptions = {
    site: { altitude: metres(0) },
    rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
    wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
    gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
    aerodynamics: 'niskanen',
    finRollReduction: false,
    baseDragMotorRule: 'always',
    integrator: { kind: 'rk4', timeStep: seconds(0.005) },
    maxTime: seconds(120),
    degreesOfFreedom: 6,
    recordInterval: seconds(0.05),
  };
  const vehicle = (crossSection: 'square' | 'airfoil'): FlightVehicle => ({
    components: R1_COMPONENTS.map((c) =>
      c.component.kind === 'finSet' ? { ...c, component: { ...c.component, crossSection } } : c,
    ),
    componentNames: R1_COMPONENTS.map((c) => (c.component.kind === 'finSet' ? 'Fins' : 'Part')),
    motor: { kind: 'definition', definition: D12, aftEnd: metres(0.6), ejectionDelay: seconds(5) },
    recovery: [
      {
        name: 'Parachute',
        diameter: metres(0.3),
        dragCoefficient: 0.8,
        deploy: { event: 'apogee', delay: seconds(0) },
      },
    ],
    roughnessHeight: metres(60e-6),
  });

  it('R1 as built: no approximations, high confidence', () => {
    const r = simulateFlight(vehicle('square'), options);
    expect(r.approximations).toEqual([]);
    expect(r.confidence.level).toBe('high');
  }, 30000);

  it('R1 with airfoil fins: the slab mass is listed and the confidence stays high', () => {
    const r = simulateFlight(vehicle('airfoil'), options);
    expect(r.approximations.map((a) => a.subject)).toEqual(['Fin set "Fins"']);
    expect(r.confidence.level).toBe('high');
  }, 30000);
});
