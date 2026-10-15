/**
 * Issue #19: warnings are plain language (CLAUDE.md 9): no decision IDs,
 * plan numbers, chart numbers or document paths; components by name. The
 * technical detail is kept in `notes`.
 */
import { describe, expect, it } from 'vitest';
import { R1_COMPONENTS, R5_COMPONENTS } from '../geometry/reference-rockets.js';
import { D12 } from '../motor/motor.test.js';
import { metres, newtons, radians, seconds } from '../units/si.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from './gravity.js';
import { simulateFlight } from './simulate.js';
import type { FlightVehicle, SimulationOptions } from './vehicle.js';

const OPTIONS: SimulationOptions = {
  site: { altitude: metres(0) },
  rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
  wind: { kind: 'vector', velocity: { x: 5, y: 0, z: 0 } },
  gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
  aerodynamics: 'niskanen',
  finRollReduction: false,
  baseDragMotorRule: 'always',
  baseDragMethod: 'niskanen',
  bodyFormFactor: 'niskanen',
  finFrictionLength: 'rocket',
  liftingSurfaceFactors: 'none',
  largeAngleMethod: 'datcom',
  integrator: { kind: 'rk4', timeStep: seconds(0.005) },
  maxTime: seconds(120),
  degreesOfFreedom: 6,
  recordInterval: seconds(0.05),
};
/** Decision IDs, plan numbers, DATCOM figures and sections, document paths, report and equation references. */
const JARGON =
  /\bD-\d{3}\b|\bplan \d{4}\b|\bfigure \d|\bDATCOM\b|docs\/|\bTN \d|\beq\. \(|\bBAR-\d|\bf_A\/f_N\b|Δy/;

const STILL: SimulationOptions = {
  ...OPTIONS,
  wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
};

const r1 = (names?: readonly string[]): FlightVehicle => ({
  components: R1_COMPONENTS,
  motor: { kind: 'definition', definition: D12, aftEnd: metres(0.6), ejectionDelay: seconds(5) },
  recovery: [],
  roughnessHeight: metres(60e-6),
  ...(names === undefined ? {} : { componentNames: names }),
});

describe('plain-language warnings (issue #19)', () => {
  it('R1 falling tail first in still air (the large-angle model in use): no jargon, the detail in notes', () => {
    const r = simulateFlight(r1(), STILL);
    expect(r.summary.regimes.largeAngle).toBe(true);
    for (const w of r.warnings) expect(w).not.toMatch(JARGON);
    // The chart-edge and method notes the issue quoted are kept, as notes.
    expect(r.notes.some((n) => /DATCOM|D-070/.test(n))).toBe(true);
  });

  it('R5 through the transonic band: the regime is a summary flag; no jargon in the warnings', () => {
    const r = simulateFlight(
      {
        components: R5_COMPONENTS,
        motor: { kind: 'ideal', thrust: newtons(238), burnTime: seconds(1.036) },
        recovery: [],
        roughnessHeight: metres(60e-6),
      },
      // The small-angle model ends the flight at apogee (D-046): only the ascent matters here, and it is quick.
      { ...STILL, largeAngleMethod: 'linear' },
    );
    expect(r.summary.regimes.transonic).toBe(true);
    for (const w of r.warnings) expect(w).not.toMatch(JARGON);
    expect(r.notes.length).toBeGreaterThan(0);
  }, 60_000);

  it('a fin set is named by its component name when names are given', () => {
    const names = R1_COMPONENTS.map((p, i) =>
      p.component.kind === 'finSet' ? 'Main fins' : `part ${String(i)}`,
    );
    const r = simulateFlight(r1(names), OPTIONS);
    expect(r.warnings).toContain(
      `Fin flutter not checked for "Main fins": enter the fin material's shear modulus (its stiffness) to check whether the fins can flutter.`,
    );
  });
});
