/** The drawn recovery and landing attitude (plan 3d-0003, D-3D-7), by hand. */
import fc from 'fast-check';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { launcherFootprint } from './launcher.js';
import {
  blend,
  hangingNose,
  lyingAttitude,
  lyingHeight,
  noseAlong,
  restingPlace,
  SWAY_AMPLITUDE,
  SWAY_PERIOD_S,
} from './recovery-pose.js';

describe('recovery pose', () => {
  it('blend is 0 before, 1 after and 1/2 midway (smoothstep)', () => {
    expect(blend(0.9, 1, 0.8)).toBe(0);
    expect(blend(1.4, 1, 0.8)).toBeCloseTo(0.5, 12);
    expect(blend(2, 1, 0.8)).toBe(1);
  });
  it('hangs along the cord at the sway zero crossings and 6° off it at its peaks', () => {
    const up = new Vector3(0, 0, 1);
    expect(hangingNose(up, 0).distanceTo(up)).toBeLessThan(1e-12);
    const peak = hangingNose(up, SWAY_PERIOD_S / 4);
    expect(Math.acos(peak.dot(up))).toBeCloseTo(SWAY_AMPLITUDE, 9);
  });
  it('noseAlong turns body −x onto the nose direction', () => {
    const d = new Vector3(0.3, -0.4, 0.866).normalize();
    const nose = new Vector3(-1, 0, 0).applyQuaternion(noseAlong(d));
    expect(nose.distanceTo(d)).toBeLessThan(1e-12);
  });
  it('lyingHeight by hand: three fins of tip radius 0.105 m on a 0.025 m body rest at 0.105 cos 60° = 0.0525 m', () => {
    expect(lyingHeight(0.025, 0.105, 3)).toBeCloseTo(0.0525, 12);
    // Four fins: 0.105 cos 45° = 0.074246; no fins: the body radius.
    expect(lyingHeight(0.025, 0.105, 4)).toBeCloseTo(0.074246, 6);
    expect(lyingHeight(0.025, 0, 0)).toBe(0.025);
    // Short fins: the body touches first.
    expect(lyingHeight(0.05, 0.06, 3)).toBe(0.05);
  });
  it('lies with the nose horizontal along the drift and the gap between fins 1 and 2 straight down', () => {
    const q = lyingAttitude(new Vector3(0, 2, 5), 3);
    const nose = new Vector3(-1, 0, 0).applyQuaternion(q);
    expect(nose.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-12);
    // Body direction at π/3 from +y about +x: (0, cos 60°, sin 60°).
    const gap = new Vector3(0, Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)).applyQuaternion(q);
    expect(gap.distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-12);
    // A proper rotation (no mirror).
    expect(q.length()).toBeCloseTo(1, 12);
  });
});

describe('resting place', () => {
  // A 0.6 m rocket beside its guide 0.03 m along +y: the tripod's legs meet at (0, 0.03), its
  // feet 0.35 m out at 0.4, 2.4944 and 4.5888 rad; with 0.05 m of clearance the footprint's
  // radius is 0.40 m.
  const footprint = launcherFootprint(0.6, new Vector3(0, 1, 0), 0.03);
  const base = { length: 0.6, footprint, clearance: 0.05 };

  it('falls along the drift with the tail at the stored landing point', () => {
    const r = restingPlace({ ...base, landing: { x: 5, y: 0 }, drift: { x: 2, y: 0 } });
    expect(r.tail).toEqual({ x: 5, y: 0 });
    expect(r.fall).toEqual({ x: 1, y: 0 });
  });
  it('without a drift falls away from the launcher', () => {
    const r = restingPlace({ ...base, landing: { x: 0, y: 2.03 }, drift: { x: 0, y: 0.01 } });
    expect(r.tail).toEqual({ x: 0, y: 2.03 });
    expect(r.fall.x).toBeCloseTo(0, 12);
    expect(r.fall.y).toBeCloseTo(1, 12);
  });
  it('falling towards the launcher falls the other way', () => {
    // 0.6 m from the anchor along +x, drifting −x: the axis would reach the anchor.
    const r = restingPlace({ ...base, landing: { x: 0.6, y: 0.03 }, drift: { x: -1, y: 0 } });
    expect(r.fall.x).toBe(1);
    expect(Math.abs(r.fall.y)).toBe(0);
  });
  it('a landing on the launcher is drawn slid off it into the leg gap nearest the drift', () => {
    // No drift at the pad: away from the guide, (0, −1). The gaps' middles are at
    // 0.4 + π/3 + 2πk/3 = 1.44720, 3.54159, 5.63599 rad; the nearest to −π/2 is 5.63599
    // (dot products −0.99237, 0.38942, 0.60295). Tail: (0, 0.03) + 0.40 (cos, sin)(5.63599)
    // = (0.40 × 0.797777, 0.03 − 0.40 × 0.602953) = (0.319111, −0.211181).
    const r = restingPlace({ ...base, landing: { x: 0, y: 0 }, drift: { x: 0, y: 0 } });
    expect(r.tail.x).toBeCloseTo(0.319111, 6);
    expect(r.tail.y).toBeCloseTo(-0.211181, 6);
    expect(r.fall.x).toBeCloseTo(0.797777, 6);
    expect(r.fall.y).toBeCloseTo(-0.602953, 6);
  });
  it('property: the lying axis never comes within the launcher footprint', () => {
    const coord = fc.double({ min: -3, max: 3, noNaN: true });
    fc.assert(
      fc.property(
        coord,
        coord,
        coord,
        coord,
        fc.double({ min: 0.1, max: 3, noNaN: true }),
        fc.double({ min: 0, max: 0.2, noNaN: true }),
        (lx, ly, dx, dy, length, clearance) => {
          const r = restingPlace({
            landing: { x: lx, y: ly },
            drift: { x: dx, y: dy },
            length,
            footprint,
            clearance,
          });
          expect(Math.hypot(r.fall.x, r.fall.y)).toBeCloseTo(1, 12);
          const radius = footprint.spread + clearance;
          for (let k = 0; k <= 50; k++) {
            const s = (length * k) / 50;
            const px = r.tail.x + s * r.fall.x - footprint.anchor.x;
            const py = r.tail.y + s * r.fall.y - footprint.anchor.y;
            expect(Math.hypot(px, py)).toBeGreaterThan(radius - 1e-9);
          }
        },
      ),
    );
  });
});
