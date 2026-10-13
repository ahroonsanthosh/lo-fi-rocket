/**
 * Issue #33: a design with a recovery device that never opens leads its
 * warnings with the landing speed; the per-device reason follows.
 */
import { metres, seconds, simulateFlight } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { exampleDesign } from './example.js';
import type { DeployEvent, RocketDesign } from './model.js';
import { designFlightWarnings, designSimulationOptions, designVehicle } from './to-physics.js';

function withDeploy(event: DeployEvent, altitude?: number): RocketDesign {
  const d = exampleDesign();
  return {
    ...d,
    recovery: d.recovery.map((r) => ({
      ...r,
      deploy: {
        event,
        delay: seconds(0),
        ...(altitude === undefined ? {} : { altitude: metres(altitude) }),
      },
    })),
  };
}

describe('recovery-not-deployed (issue #33)', () => {
  for (const [label, design] of [
    ['altitude 500 m above a 173 m apogee', withDeploy('altitude', 500)],
    ['never', withDeploy('never')],
  ] as const) {
    it(`${label}: first warning gives the landing speed; the parachute is named after it`, () => {
      const r = simulateFlight(designVehicle(design), designSimulationOptions(design));
      const w = designFlightWarnings(design, r);
      const speed = r.summary.groundHitVelocity ?? Number.NaN;
      expect(speed).toBeGreaterThan(10);
      expect(w[0]).toEqual({
        code: 'recovery-not-deployed',
        message: `No recovery device opened, so the rocket hits the ground at ${speed.toFixed(1)} m/s, fast enough to hurt someone and to damage the rocket. The reason for each device is given below.`,
      });
      expect(w.some((x) => x.message.startsWith('"Parachute" never opened'))).toBe(true);
    });
  }

  it('the example as shipped has no such warning', () => {
    const d = exampleDesign();
    const r = simulateFlight(designVehicle(d), designSimulationOptions(d));
    expect(designFlightWarnings(d, r).some((x) => x.code === 'recovery-not-deployed')).toBe(false);
  });
});
