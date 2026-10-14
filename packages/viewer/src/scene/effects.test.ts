/**
 * The illustrative effects follow the stored result (plan 3d-0001,
 * D-3D-1): the flame and the smoke only where the stored thrust is above
 * zero, the smoke drifting by the wind input times its age, and a canopy
 * only after its stored deployment event, at the design's diameter.
 * Expected values by hand.
 */
import type { FlightResult, FlightSample } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { SI_FORMATTER } from '../units.js';
import { REFERENCE_ROCKETS, referenceFlight } from '../test-support/reference-flights.js';
import {
  bracket,
  CANOPY_DOME_ANGLE,
  canopyPoint,
  deployedCanopies,
  groundCloud,
  displayThrust,
  inflation,
  smokeEmissions,
  smokePuffs,
  windVelocity,
} from './effects.js';
import { FlightScene, PAD_GAP, PAD_HEIGHT } from './flight-scene.js';

function sample(time: number, thrust: number, z: number): FlightSample {
  return {
    time,
    phase: thrust > 0 ? 'powered' : 'coast',
    position: { x: 0, y: 0, z },
    velocity: { x: 0, y: 0, z: 10 },
    orientation: { w: Math.SQRT1_2, x: 0, y: Math.SQRT1_2, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    altitude: z,
    speed: 10,
    airspeed: 10,
    mach: 0.03,
    angleOfAttack: 0,
    acceleration: 0,
    thrust,
    aerodynamicForce: 0,
    cd0: 0.5,
    mass: 1,
    cg: 0.3,
    cp: 0.4,
    stabilityCalibers: 1,
  } as unknown as FlightSample;
}

describe('bracket and displayThrust by hand', () => {
  const samples = [sample(0, 10, 0), sample(1, 30, 5), sample(2, 0, 12)];
  it('blends linearly between the neighbouring stored steps and clamps outside', () => {
    expect(bracket(samples, 0.25).f).toBe(0.25);
    expect(displayThrust(samples, 0.25)).toBe(15); // 10 + 0.25 × 20
    expect(displayThrust(samples, 1.5)).toBe(15); // 30 − 0.5 × 30
    expect(displayThrust(samples, 2)).toBe(0);
    expect(displayThrust(samples, -1)).toBe(10);
    expect(displayThrust(samples, 9)).toBe(0);
  });
});

describe('windVelocity by hand: v = −speed (sin ψ, cos ψ, 0)', () => {
  it('a wind from the west (270°) blows east; from the north blows south', () => {
    const w = windVelocity({ speed: 5, from: 1.5 * Math.PI });
    expect(w.x).toBeCloseTo(5, 12);
    expect(w.y).toBeCloseTo(0, 12);
    const n = windVelocity({ speed: 2, from: 0 });
    expect(n.y).toBe(-2);
    expect(windVelocity(undefined)).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('smokePuffs by hand', () => {
  const options = { startSize: 0.2, growth: 0.5, billow: 0.4, fade: 10, jitter: 0 };
  const emissions = [
    { time: 1, origin: { x: 0, y: 0, z: 10 }, scatter: { x: 0.3, y: 0.1, z: -0.2 } },
    { time: 4, origin: { x: 1, y: 1, z: 30 }, scatter: { x: 0, y: 0, z: 0 } },
  ];
  it('a puff emitted at 1 s seen at 3 s has drifted 2 s of wind, grown and faded', () => {
    const puffs = smokePuffs(emissions, { x: 3, y: -4, z: 0 }, 3, options);
    expect(puffs).toHaveLength(1); // the 4 s puff is not emitted yet
    const p = puffs[0]!;
    expect(p.position).toEqual({ x: 6, y: -8, z: 10 }); // origin + (3, −4, 0) × 2
    // 0.2 + 0.5 × 2 + 0.4 (1 − e^(−2/0.3)) = 1.2 + 0.4 × 0.998727 = 1.599491
    expect(p.size).toBeCloseTo(1.599491, 6);
    expect(p.opacity).toBeCloseTo(Math.exp(-0.2), 12); // e^(−2/10), fully faded in
  });
  it('drops puffs fainter than 0.01 (age above fade × ln 100 = 46 s)', () => {
    expect(smokePuffs(emissions, { x: 0, y: 0, z: 0 }, 60, options)).toHaveLength(0);
  });
});

describe('inflation', () => {
  it('is 0 before deployment, starts at 0.15 and is full after 0.51 s', () => {
    expect(inflation(-0.01)).toBe(0);
    expect(inflation(0)).toBe(0.15);
    expect(inflation(0.3)).toBeCloseTo(0.65, 12);
    expect(inflation(0.6)).toBe(1);
  });
});

describe('deployedCanopies', () => {
  it('matches a stored deployment event to its device by name; an unknown device is not drawn', () => {
    const result = {
      events: [
        { kind: 'apogee', time: 5, detail: '' },
        { kind: 'deployment', time: 5.2, detail: 'Drogue deployed (at apogee); C_D A = 0.01 m²' },
        { kind: 'deployment', time: 20, detail: 'Main deployed (at 150 m); C_D A = 0.5 m²' },
        { kind: 'deployment', time: 21, detail: 'Streamer deployed (...)' },
      ],
    } as unknown as FlightResult;
    const c = deployedCanopies(result, [
      { name: 'Main', diameter: 0.9 },
      { name: 'Drogue', diameter: 0.3 },
    ]);
    expect(c).toEqual([
      { name: 'Drogue', diameter: 0.3, deployedAt: 5.2 },
      { name: 'Main', diameter: 0.9, deployedAt: 20 },
    ]);
  });
});

describe.each(REFERENCE_ROCKETS)('effects on the stored flight of $id', (rocket) => {
  const f = referenceFlight(rocket);
  const scene = new FlightScene({
    result: f.result,
    components: f.components,
    rail: {
      length: 1.5,
      angleFromVertical: f.options.rail.angleFromVertical,
      azimuth: f.options.rail.azimuth,
    },
    wind: { speed: 5, from: 1.5 * Math.PI },
    format: SI_FORMATTER,
    recovery: f.vehicle.recovery.map((d) => ({ name: d.name, diameter: d.diameter })),
  });

  it('every smoke emission is at a time of positive blended stored thrust', () => {
    const e = smokeEmissions(f.result, scene.rocketLength);
    expect(e.length).toBeGreaterThan(10);
    for (const x of e) expect(displayThrust(f.result.samples, x.time)).toBeGreaterThan(0);
    // Emitted in time order (smokePuffs relies on it).
    for (let i = 1; i < e.length; i++) expect(e[i]!.time).toBeGreaterThanOrEqual(e[i - 1]!.time);
  });

  it('the flame shows exactly where the blended stored thrust is above zero', () => {
    const end = f.result.samples[f.result.samples.length - 1]!.time;
    for (let k = 0; k <= 200; k++) {
      const t = (end * k) / 200;
      scene.setTime(t);
      expect(scene.flameVisible).toBe(displayThrust(f.result.samples, t) > 0);
    }
  });

  it('the drawn ground is below the rocket at rest, and no canopy shows before its stored deployment', () => {
    scene.setStep(0);
    expect(scene.groundZ).toBeLessThan(0);
    for (const c of scene.canopyList) {
      scene.setTime(c.deployedAt - 0.05);
      expect(scene.scene.getObjectByName(`canopy-${c.name}`)?.visible).toBe(false);
      scene.setTime(c.deployedAt + 1);
      const g = scene.scene.getObjectByName(`canopy-${c.name}`);
      expect(g?.visible).toBe(true);
      expect(g?.userData['diameter']).toBe(c.diameter);
    }
  });
});

describe('groundCloud by hand', () => {
  const o = { groundZ: -0.3, start: 0, end: 0.5, reach: 2, size: 1, fade: 6 };
  it('has no puff before ignition and only the puffs born so far', () => {
    expect(groundCloud({ x: 0, y: 0, z: 0 }, -0.1, o)).toHaveLength(0);
    // Puffs are born every 0.5/24 s: at t = 0.1, the five puffs 0..4 (born 0, 0.0208, … 0.0833).
    expect(groundCloud({ x: 0, y: 0, z: 0 }, 0.1, o)).toHaveLength(5);
  });
  it('puff 0 at age 1 s: rolled out 2 × 0.6 × (1 − e^(−1/0.8)) along +x, drifted by the wind, risen 0.3 m', () => {
    const [p] = groundCloud({ x: 1, y: 0, z: 0 }, 1, o);
    const roll = 2 * 0.6 * (1 - Math.exp(-1 / 0.8)); // 0.8562
    expect(p!.position.x).toBeCloseTo(roll + 1, 12);
    expect(p!.position.y).toBeCloseTo(0, 12);
    expect(p!.position.z).toBeCloseTo(-0.3 + 0.3 * 1 + 0.3, 12);
    expect(p!.size).toBeCloseTo(0.35 + 0.65 * (1 - Math.exp(-1 / 0.6)), 12);
  });
});

describe('canopyPoint', () => {
  it('pulls the seams in to 93 % and keeps the rim within 10 % under the design radius', () => {
    const D = 0.6;
    const R = D / 2 / Math.sin(CANOPY_DOME_ANGLE);
    // At a seam (φ = 0) the hem is at the full dome angle: radius 0.93 × D/2.
    const seam = canopyPoint(0, Math.PI, R);
    expect(Math.hypot(seam.x, seam.z)).toBeCloseTo((0.93 * D) / 2, 12);
    let max = 0;
    for (let k = 0; k <= 240; k++) {
      const p = canopyPoint((2 * Math.PI * k) / 240, Math.PI, R);
      max = Math.max(max, Math.hypot(p.x, p.z));
    }
    expect(max).toBeLessThanOrEqual(D / 2);
    expect(max).toBeGreaterThan((0.9 * D) / 2);
  });
});

describe('the scene with motors and a launcher (plan 3d-0002)', () => {
  const f = referenceFlight(REFERENCE_ROCKETS[0]);
  const make = (offsets: { y: number; z: number }[]): FlightScene =>
    new FlightScene({
      result: f.result,
      components: f.components,
      rail: {
        length: 1.5,
        angleFromVertical: f.options.rail.angleFromVertical,
        azimuth: f.options.rail.azimuth,
      },
      wind: undefined,
      format: SI_FORMATTER,
      motor: { diameter: 0.018, length: 0.07, aftEnd: 0.62, offsets, manufacturer: 'AeroTech' },
      scheme: 'carbon',
    });

  it('draws the ground below the nozzle at rest by the pad gap and height', () => {
    const scene = make([{ y: 0, z: 0 }]);
    scene.setStep(0);
    expect(scene.groundZ).toBeCloseTo(scene.restBottomZ - PAD_GAP - PAD_HEIGHT, 12);
    expect(scene.scene.getObjectByName('motors')).toBeDefined();
    expect(scene.scene.getObjectByName('launch-rail')).toBeDefined();
  });

  it('hangs the igniter leads from the nozzle until liftoff, then drops them on the deflector', () => {
    const scene = make([{ y: 0, z: 0 }]);
    const liftoff = f.result.events.find(
      (e) => e.kind === 'liftoff' || e.kind === 'rail-exit',
    )!.time;
    scene.setTime(Math.max(0, liftoff - 0.01));
    expect(scene.scene.getObjectByName('igniter-leads')!.visible).toBe(true);
    expect(scene.scene.getObjectByName('igniter-leads-fallen')!.visible).toBe(false);
    scene.setTime(liftoff + 0.5);
    expect(scene.scene.getObjectByName('igniter-leads')!.visible).toBe(false);
    expect(scene.scene.getObjectByName('igniter-leads-fallen')!.visible).toBe(true);
  });

  it('lights one flame per motor of a cluster', () => {
    const scene = make([
      { y: 0.01, z: 0 },
      { y: -0.01, z: 0 },
    ]);
    scene.setTime(0.2);
    let flames = 0;
    scene.scene.traverse((o) => {
      if (o.name === 'exhaust-flame' && o.visible) flames++;
    });
    expect(flames).toBe(2);
  });
});
