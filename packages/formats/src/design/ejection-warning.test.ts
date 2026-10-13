/**
 * Issue #9: the design-level warning when the motor's ejection charge fires
 * above the deployment-speed threshold (default 20 m/s) and no device opens at
 * that instant. The example design (R1, D12, parachute at apogee).
 */
import { seconds, simulateFlight } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { exampleDesign } from './example.js';
import type { RocketDesign } from './model.js';
import { designFlightWarnings, designSimulationOptions, designVehicle } from './to-physics.js';

function withDelay(delay: number): RocketDesign {
  const d = exampleDesign();
  const mount = d.motorMount;
  if (mount?.motor === undefined) throw new Error('the example has a motor');
  return {
    ...d,
    motorMount: { ...mount, motor: { ...mount.motor, ejectionDelay: seconds(delay) } },
  };
}

describe('ejection-velocity warning (issue #9)', () => {
  it('a 0 s delay fires at burnout, climbing fast: warned with the speed and the threshold', () => {
    const d = withDelay(0);
    const r = simulateFlight(designVehicle(d), designSimulationOptions(d));
    const e = r.summary.ejectionCharge;
    expect(e?.airspeed).toBeGreaterThan(20);
    const w = designFlightWarnings(d, r).find((x) => x.code === 'ejection-velocity');
    expect(w?.message).toBe(
      `The motor's ejection charge fires at 1.65 s at ${(e?.airspeed ?? Number.NaN).toFixed(1)} m/s, above 20 m/s: if the charge deploys the recovery, it opens fast enough to tear the parachute or shock cord or zipper the airframe. Choose a delay that fires near apogee.`,
    );
  });

  it('the example as shipped (5 s delay, after apogee) raises no ejection warning', () => {
    const d = withDelay(5);
    const r = simulateFlight(designVehicle(d), designSimulationOptions(d));
    expect(designFlightWarnings(d, r).some((x) => x.code === 'ejection-velocity')).toBe(false);
  });
});
