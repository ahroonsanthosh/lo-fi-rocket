/**
 * The rendered pose matches the simulator's stored attitude and position
 * (plan 0024): at sampled steps of all five reference rockets, the rocket
 * object's nose axis in the scene equals the physics `noseDirection` of the
 * stored quaternion, its position is the stored position, and the nose tip
 * is the stored CG offset along the axis. Event markers sit at the stored
 * positions. Grid and camera placement by hand.
 */
import { noseDirection, radians, type FlightResult } from '@lo-fi-rocket/physics';
import { Line, Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { SI_FORMATTER } from '../units.js';
import { REFERENCE_ROCKETS, referenceFlight } from '../test-support/reference-flights.js';
import {
  cameraPose,
  FlightScene,
  gridSpacing,
  horizontalExtent,
  verticalExtent,
} from './flight-scene.js';

function sceneFor(rocket: (typeof REFERENCE_ROCKETS)[number]): {
  scene: FlightScene;
  result: FlightResult;
} {
  const f = referenceFlight(rocket);
  const scene = new FlightScene({
    result: f.result,
    components: f.components,
    rail: { length: 1.5, angleFromVertical: radians(0.05), azimuth: radians(0.3) },
    wind: { speed: 5, from: 1.5 * Math.PI },
    format: SI_FORMATTER,
  });
  return { scene, result: f.result };
}

describe.each(REFERENCE_ROCKETS)('FlightScene for $id', (rocket) => {
  const { scene, result } = sceneFor(rocket);

  it('at every 20th stored step the scene axis equals noseDirection of the stored quaternion within 1e-12', () => {
    let checked = 0;
    for (let i = 0; i < result.samples.length; i += 20) {
      const s = result.samples[i]!;
      scene.setStep(i);
      const expected = noseDirection(s.orientation);
      const axis = scene.noseAxisInScene();
      const n = Math.hypot(axis.x, axis.y, axis.z);
      expect(Math.abs(axis.x / n - expected.x)).toBeLessThan(1e-12);
      expect(Math.abs(axis.y / n - expected.y)).toBeLessThan(1e-12);
      expect(Math.abs(axis.z / n - expected.z)).toBeLessThan(1e-12);
      // The rocket object sits at the stored position (the CG), exactly.
      expect(scene.rocket.position.x).toBe(s.position.x);
      expect(scene.rocket.position.y).toBe(s.position.y);
      expect(scene.rocket.position.z).toBe(s.position.z);
      // The nose tip is cg metres from the CG along the nose direction.
      const tip = scene.noseTipInScene();
      expect(Math.abs(tip.x - (s.position.x + s.cg * expected.x))).toBeLessThan(1e-12);
      expect(Math.abs(tip.y - (s.position.y + s.cg * expected.y))).toBeLessThan(1e-12);
      expect(Math.abs(tip.z - (s.position.z + s.cg * expected.z))).toBeLessThan(1e-12);
      // The readouts are that step's.
      expect(scene.readouts().sample).toBe(s);
      expect(scene.time).toBe(s.time);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('on the rail the nose points along the rail direction (0.05 rad from vertical towards azimuth 0.3 rad)', () => {
    scene.setStep(0);
    const axis = scene.noseAxisInScene();
    const n = Math.hypot(axis.x, axis.y, axis.z);
    // railDirection: (sin θ sin ψ, sin θ cos ψ, cos θ), DYN-6.
    expect(axis.x / n).toBeCloseTo(Math.sin(0.05) * Math.sin(0.3), 12);
    expect(axis.y / n).toBeCloseTo(Math.sin(0.05) * Math.cos(0.3), 12);
    expect(axis.z / n).toBeCloseTo(Math.cos(0.05), 12);
  });

  it('setTime at a stored time gives the stored pose; between steps the readouts are the nearest step', () => {
    const i = Math.floor(result.samples.length / 3);
    const a = result.samples[i]!;
    const b = result.samples[i + 1]!;
    scene.setTime(a.time);
    expect(scene.stepIndex).toBe(i);
    expect(scene.rocket.position.z).toBe(a.position.z);
    const t = (a.time as number) + 0.3 * ((b.time as number) - (a.time as number));
    scene.setTime(t);
    expect(scene.stepIndex).toBe(i);
    expect(scene.readouts().sample).toBe(a);
    expect(scene.readouts().time).toBe(a.time);
    // The drawn position lies between the two stored positions (display blend only).
    const z = scene.rocket.position.z;
    expect(z).toBeGreaterThanOrEqual(Math.min(a.position.z, b.position.z) - 1e-12);
    expect(z).toBeLessThanOrEqual(Math.max(a.position.z, b.position.z) + 1e-12);
  });

  it('every event marker mesh is at the stored position of its step and carries a label with the stored time', () => {
    for (const m of scene.markers) {
      const mesh = scene.scene.children.find(
        (c): c is Mesh =>
          c instanceof Mesh &&
          c.name === `event-${m.event.kind}` &&
          c.userData['index'] === m.index,
      );
      expect(mesh).toBeDefined();
      expect(mesh!.position.x).toBe(m.position.x);
      expect(mesh!.position.y).toBe(m.position.y);
      expect(mesh!.position.z).toBe(m.position.z);
      const label = scene.labels.find((l) => l.kind === 'event' && l.position === m.position);
      expect(label!.text).toContain(SI_FORMATTER.format(m.time, 'time'));
    }
    const apogee = scene.markers.find((m) => m.event.kind === 'apogee')!;
    expect(apogee.position.z).toBe(result.summary.apogee);
  });

  it('the flight path has one vertex per stored step; the grid covers the flight; the wind label reads the input', () => {
    const path = scene.scene.getObjectByName('flight-path');
    expect(path).toBeInstanceOf(Line);
    expect((path as Line).geometry.getAttribute('position').count).toBe(result.samples.length);
    expect(scene.gridHalfSize).toBeGreaterThanOrEqual(horizontalExtent(result));
    expect(verticalExtent(result)).toBe(result.summary.apogee);
    expect(scene.labels.find((l) => l.kind === 'wind')!.text).toBe('Wind 5.0 m/s from 270.0°');
    expect(scene.scene.getObjectByName('launch-rail')).toBeDefined();
    expect(scene.duration).toBe(result.samples[result.samples.length - 1]!.time);
  });
});

describe('gridSpacing by hand', () => {
  it('gives 1, 2 or 5 × 10ⁿ with 5 to 10 cells over the extent', () => {
    expect(gridSpacing(10)).toBe(1); // target 1 → 1
    expect(gridSpacing(25)).toBe(5); // target 2.5 → 5
    expect(gridSpacing(170)).toBe(20); // target 17 → 20
    expect(gridSpacing(1000)).toBe(100);
    expect(gridSpacing(1300)).toBe(200);
    expect(gridSpacing(6)).toBe(1); // target 0.6 → 1 (10 × 0.1)
    expect(() => gridSpacing(0)).toThrow();
  });
});

describe('cameraPose by hand', () => {
  it('follow sits 5 rocket lengths (at least 2 m) away along (−1, −1, 0.6); pad stands at (0, −3, 1.7); orbit is free', () => {
    const f = cameraPose('follow', { x: 10, y: 20, z: 30 }, 0.6)!;
    const d = 3; // max(2, 5 × 0.6)
    const n = Math.hypot(1, 1, 0.6);
    expect(f.position.x).toBeCloseTo(10 - d / n, 12);
    expect(f.position.y).toBeCloseTo(20 - d / n, 12);
    expect(f.position.z).toBeCloseTo(30 + (0.6 * d) / n, 12);
    expect(f.target).toEqual({ x: 10, y: 20, z: 30 });
    expect(cameraPose('follow', { x: 0, y: 0, z: 0 }, 0.1)!.position.z).toBeCloseTo(
      (0.6 * 2) / n,
      12,
    );
    expect(cameraPose('pad', { x: 1, y: 2, z: 3 }, 0.6)).toEqual({
      position: { x: 0, y: -3, z: 1.7 },
      target: { x: 1, y: 2, z: 3 },
    });
    expect(cameraPose('orbit', { x: 1, y: 2, z: 3 }, 0.6)).toBeUndefined();
  });
  it('overview looks at half the apogee from 3 radii away along (−1, −1, 0.35), radius = max(5, horizontal, apogee/2)', () => {
    const o = cameraPose('overview', { x: 9, y: 9, z: 9 }, 0.6, { horizontal: 40, vertical: 170 })!;
    const radius = 85; // max(5, 40, 85)
    const d = 3 * radius;
    const n = Math.hypot(1, 1, 0.35);
    expect(o.target).toEqual({ x: 0, y: 0, z: 85 });
    expect(o.position.x).toBeCloseTo(-d / n, 12);
    expect(o.position.y).toBeCloseTo(-d / n, 12);
    expect(o.position.z).toBeCloseTo(85 + (0.35 * d) / n, 12);
    expect(cameraPose('overview', { x: 0, y: 0, z: 0 }, 0.6)!.target).toEqual({ x: 0, y: 0, z: 0 });
  });
});
