/**
 * Plan 0073 part 2: streamers read from `.ork` files, against OpenRocket 24.12's own mass and
 * automatic drag coefficient for ten strips (`FinishProbe` part 3,
 * reference/rockets/finish-probe/values.txt), and kept in the design file.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  recoveryDragArea,
  rocketMassProperties,
  simulateFlight,
  streamerDragCoefficient,
} from '@lo-fi-rocket/physics';
import { describe, expect, it, vi } from 'vitest';
import { exampleDesign } from './design/example.js';
import { orkToDesign } from './design/from-ork.js';
import { parseDesign, serializeDesign } from './design/serialize.js';
import { CURRENT_SCHEMA_VERSION } from './design/model.js';
import { designVehicle, designSimulationOptions } from './design/to-physics.js';
import { orkRecoveryDevice, parseOrk, type OrkRocket } from './ork.js';

const PROBE = join(
  dirname(fileURLToPath(import.meta.url)),
  ...['..', '..', '..', 'reference', 'rockets', 'finish-probe'],
);
const values = readFileSync(join(PROBE, 'values.txt'), 'utf8').split('\n');
/** One number from the probe's line for streamer `i`. */
function probe(i: number, what: 'length' | 'width' | 'density' | 'mass' | 'cd'): number {
  const line = values.find((l) => l.startsWith(`STREAMER ${String(i)} length=`));
  const v = line === undefined ? undefined : new RegExp(` ${what}=([0-9.e+-]+)`).exec(line)?.[1];
  if (v === undefined) throw new Error(`streamer ${String(i)} ${what} not in values.txt`);
  return Number(v);
}
function structure(i: number): { mass: number; cg: number } {
  const line = values.find((l) => l.startsWith(`STREAMER ${String(i)} structure`));
  const m = line === undefined ? null : /mass=([0-9.e+-]+) cg=([0-9.e+-]+)/.exec(line);
  if (m?.[1] === undefined || m[2] === undefined) throw new Error('structure not in values.txt');
  return { mass: Number(m[1]), cg: Number(m[2]) };
}
const read = (i: number): OrkRocket =>
  parseOrk(
    new Uint8Array(readFileSync(join(PROBE, `streamer${String(i)}.ork`))),
    `streamer${String(i)}.ork`,
  );

vi.setConfig({ testTimeout: 60_000 });

describe('streamers in .ork files (plan 0073 part 2)', () => {
  it('reads every strip as a streamer, its mass and its automatic C_D as OpenRocket gives them', () => {
    for (let i = 0; i < 10; i++) {
      const rocket = read(i);
      const [device] = rocket.recoveryDevices;
      if (device?.kind !== 'streamer') throw new Error(`streamer ${String(i)} not read`);
      expect(device.length).toBe(probe(i, 'length'));
      expect(device.width).toBe(probe(i, 'width'));
      expect(device.surfaceDensity).toBe(probe(i, 'density'));
      expect(device.dragCoefficient).toBeUndefined();
      // Nothing about the streamer is approximated any more.
      expect(rocket.components.flatMap((c) => c.approximations ?? [])).toEqual([]);
      // The packed mass is the strip's area times the material's surface density.
      const packed = rocket.components[device.component]?.component;
      expect(packed?.kind === 'parachute' ? packed.mass : NaN).toBeCloseTo(probe(i, 'mass'), 12);
      const s = structure(i);
      const ours = rocketMassProperties(rocket.components);
      expect(Math.abs(ours.mass / s.mass - 1)).toBeLessThan(1e-6);
      expect(Math.abs(ours.cg / s.cg - 1)).toBeLessThan(1e-6);
      // Eq. (C.6) is OpenRocket's automatic C_D below its 0.4 cap.
      const cd = streamerDragCoefficient(device);
      expect(Math.min(cd, 0.4)).toBeCloseTo(probe(i, 'cd'), 9);
    }
  });

  it('the comparison mode takes OpenRocket’s 0.4 cap, the displayed mode eq. (C.6)', () => {
    // Strip 9, 0.05 m long and 0.5 m wide: eq. (C.6) gives 0.714, OpenRocket 0.4.
    const rocket = read(9);
    const [device] = rocket.recoveryDevices;
    if (device === undefined) throw new Error('no device');
    const physics = orkRecoveryDevice(device);
    expect(recoveryDragArea(physics, 'openrocket')).toBeCloseTo(0.4 * 0.025, 15);
    expect(recoveryDragArea(physics)).toBeCloseTo(0.714 * 0.025, 15);
    const { design } = orkToDesign(rocket, [], 'd');
    expect(designSimulationOptions(design, 'openrocket-equivalent').streamerDragMethod).toBe(
      'openrocket',
    );
    expect(designSimulationOptions(design).streamerDragMethod).toBeUndefined();
  });

  it('keeps the streamer through the design file, at schema 5', () => {
    const { design } = orkToDesign(read(0), [], 'd');
    const [device] = design.recovery;
    expect(device).toMatchObject({ kind: 'streamer', length: 0.6, width: 0.06 });
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(5);
    const text = serializeDesign(design);
    expect(parseDesign(text)).toEqual(design);
  });

  it('flies the example rocket on the streamer: the descent is that of its C_D A', () => {
    // The example (R1 with the D12) with the 0.6 × 0.06 m streamer of 80 g/m² instead of its
    // 0.3 m canopy: C_D A = 0.0906667 × 0.036 = 0.003264 m² against 0.8 π 0.3²/4 = 0.0565487 m², so
    // the terminal speed is √(0.0565487/0.003264) = 4.16 times the parachute's.
    const example = exampleDesign();
    const [streamer] = orkToDesign(read(0), [], 'd').design.recovery;
    if (streamer === undefined) throw new Error('no device');
    const withStreamer = {
      ...example,
      recovery: [{ ...streamer, deploy: example.recovery[0]?.deploy ?? streamer.deploy }],
    };
    const vehicle = designVehicle(withStreamer);
    expect(vehicle.recovery[0]).toMatchObject({ kind: 'streamer', length: 0.6 });
    const chute = simulateFlight(designVehicle(example), designSimulationOptions(example));
    const strip = simulateFlight(vehicle, designSimulationOptions(withStreamer));
    const ratio =
      (strip.summary.groundHitVelocity ?? NaN) / (chute.summary.groundHitVelocity ?? NaN);
    expect(Math.abs(ratio / Math.sqrt(0.0565487 / 0.003264) - 1)).toBeLessThan(0.01);
  });

  it('names the path and the problem in a bad streamer', () => {
    const { design } = orkToDesign(read(0), [], 'd');
    const doc = JSON.parse(serializeDesign(design)) as { recovery: Record<string, unknown>[] };
    const bad = structuredClone(doc);
    const first = bad.recovery[0];
    if (first === undefined) throw new Error('no device');
    delete first['width'];
    expect(() => parseDesign(JSON.stringify(bad))).toThrow(/recovery\[0\].*width/);
    const both = structuredClone(doc);
    const second = both.recovery[0];
    if (second === undefined) throw new Error('no device');
    second['diameter'] = 0.3;
    expect(() => parseDesign(JSON.stringify(both))).toThrow(/diameter/);
  });
});
