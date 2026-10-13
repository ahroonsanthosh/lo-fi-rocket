/**
 * Issue #36: a motor that does not fit its mount tube is reported in the
 * flight warnings (and is available to the stability panel). The example's
 * mount is an inner tube 75 mm long, outer radius 12.5 mm, wall 0.5 mm, so
 * 24.0 mm inside; the review used the Estes E16 (29 mm by 114 mm).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metres, simulateFlight } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { motorFromRse } from '../motor-definition.js';
import { parseRse } from '../rse.js';
import { exampleDesign } from './example.js';
import type { RocketDesign } from './model.js';
import {
  designFlightWarnings,
  designMotorFitProblems,
  designSimulationOptions,
  designVehicle,
} from './to-physics.js';

const MOTORS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'reference',
  'motors',
);

function withE16(): RocketDesign {
  const d = exampleDesign();
  const mount = d.motorMount;
  if (mount?.motor === undefined) throw new Error('the example has a motor');
  const rse = parseRse(readFileSync(join(MOTORS, 'Estes_E16.rse'), 'utf8'))[0];
  if (rse === undefined) throw new Error('no E16');
  return {
    ...d,
    motorMount: { ...mount, motor: { ...mount.motor, definition: motorFromRse(rse) } },
  };
}

describe('motor fit (issue #36)', () => {
  it('the example D12 (24 mm by 70 mm) fits its 24.0 mm, 75 mm mount', () => {
    expect(designMotorFitProblems(exampleDesign())).toEqual([]);
  });

  it('the E16 (29 mm by 114 mm): too wide by 5 mm and 39 mm ahead of the 75 mm tube', () => {
    const d = withE16();
    const mountName = d.components.find((c) => c.id === d.motorMount?.componentId)?.name ?? '';
    // By hand: inside 2 (12.5 − 0.5) = 24.0 mm; the motor's front is 114 − 75 = 39.0 mm ahead of the tube.
    expect(designMotorFitProblems(d)).toEqual([
      `The motor is 29.0 mm wide but the mount tube "${mountName}" is 24.0 mm inside, so it does not fit: the mass, CG, stability and flight shown are for a rocket that cannot be built. Choose a 24.0 mm motor or a wider mount tube.`,
      `The motor is 114.0 mm long and its front end sits 39.0 mm ahead of the front of the mount tube "${mountName}", so it does not fit: lengthen the mount tube, let the motor overhang the back more, or choose a shorter motor.`,
    ]);
    const r = simulateFlight(designVehicle(d), designSimulationOptions(d));
    const codes = designFlightWarnings(d, r).filter((w) => w.code === 'motor-fit');
    expect(codes).toHaveLength(2);
  });

  it('an overhang that brings the motor front inside the tube removes the length problem', () => {
    const d = withE16();
    const mount = d.motorMount;
    if (mount === undefined) throw new Error('no mount');
    const back: RocketDesign = { ...d, motorMount: { ...mount, overhang: metres(0.039) } };
    expect(designMotorFitProblems(back)).toHaveLength(1);
  });
});
