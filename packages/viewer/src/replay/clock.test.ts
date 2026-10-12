/**
 * Replay timing by hand (plan 0024).
 */
import { seconds, type FlightSample } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { displayPose, nearestStep, ReplayController } from './clock.js';

describe('nearestStep', () => {
  const times = [0, 0.5, 1, 2];
  it('returns the step whose time is closest; outside the range the ends', () => {
    expect(nearestStep(times, -1)).toBe(0);
    expect(nearestStep(times, 0)).toBe(0);
    expect(nearestStep(times, 0.2)).toBe(0); // 0.2 from 0, 0.3 from 0.5
    expect(nearestStep(times, 0.3)).toBe(1); // 0.3 from 0, 0.2 from 0.5
    expect(nearestStep(times, 1.9)).toBe(3);
    expect(nearestStep(times, 1.4)).toBe(2); // 0.4 from 1, 0.6 from 2
    expect(nearestStep(times, 2)).toBe(3);
    expect(nearestStep(times, 7)).toBe(3);
  });
  it('an exact tie goes to the earlier step', () => {
    expect(nearestStep(times, 0.25)).toBe(0);
    expect(nearestStep(times, 0.75)).toBe(1);
    expect(nearestStep(times, 1.5)).toBe(2);
  });
  it('rejects an empty series and a non-finite time', () => {
    expect(() => nearestStep([], 0)).toThrow(/no stored steps/);
    expect(() => nearestStep(times, Number.NaN)).toThrow(/not finite/);
  });
});

function sample(t: number, x: number, qw: number, qx: number, cg: number): FlightSample {
  return {
    time: seconds(t),
    phase: 'coast',
    position: { x, y: 2 * x, z: 3 * x },
    velocity: { x: 0, y: 0, z: 0 },
    orientation: { w: qw, x: qx, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    altitude: 3 * x,
    speed: 0,
    airspeed: 0,
    mach: 0,
    angleOfAttack: 0,
    acceleration: 0,
    thrust: 0,
    aerodynamicForce: 0,
    cd0: 0,
    mass: 1,
    cg: cg,
    cp: 0,
    stabilityCalibers: 0,
  };
}

describe('displayPose', () => {
  const samples = [sample(0, 0, 1, 0, 0.3), sample(1, 10, 0, 1, 0.4), sample(3, 40, 0, 1, 0.4)];
  it('at a stored time it is the stored pose, by reference', () => {
    const p = displayPose(samples, 1);
    expect(p.position).toBe(samples[1]!.position);
    expect(p.orientation).toBe(samples[1]!.orientation);
    expect(p.cg).toBe(0.4);
    expect(displayPose(samples, -5).position).toBe(samples[0]!.position);
    expect(displayPose(samples, 9).position).toBe(samples[2]!.position);
  });
  it('between stored steps it blends linearly (display only): t = 2 is halfway from (10, 20, 30) to (40, 80, 120)', () => {
    const p = displayPose(samples, 2);
    expect(p.position).toEqual({ x: 25, y: 50, z: 75 });
    expect(p.cg).toBeCloseTo(0.4, 15);
    // Both neighbours have the same orientation; the blend is that orientation, unit norm.
    expect(p.orientation).toEqual({ w: 0, x: 1, y: 0, z: 0 });
  });
  it('the quaternion blend is normalised: halfway between identity and a 180° roll is a 90° roll', () => {
    const p = displayPose(samples, 0.5);
    // nlerp of (1,0,0,0) and (0,1,0,0) at f = 0.5: (0.5, 0.5, 0, 0) / √0.5 = (√½, √½, 0, 0).
    expect(p.orientation.w).toBeCloseTo(Math.SQRT1_2, 15);
    expect(p.orientation.x).toBeCloseTo(Math.SQRT1_2, 15);
    expect(
      Math.hypot(p.orientation.w, p.orientation.x, p.orientation.y, p.orientation.z),
    ).toBeCloseTo(1, 15);
  });
});

describe('ReplayController', () => {
  it('plays at the chosen speed, pauses at the end, and seeks within the range', () => {
    const c = new ReplayController(10);
    expect(c.current).toEqual({ time: 0, playing: false, speed: 1, duration: 10 });
    expect(c.advance(1).time).toBe(0); // paused: no motion
    c.play();
    expect(c.advance(1.5).time).toBe(1.5);
    c.setSpeed(4);
    expect(c.advance(1).time).toBe(5.5);
    const end = c.advance(5); // 5.5 + 20 > 10: stops at the end
    expect(end).toEqual({ time: 10, playing: false, speed: 4, duration: 10 });
    c.seek(-3);
    expect(c.current.time).toBe(0);
    c.seek(42);
    expect(c.current.time).toBe(10);
    c.seek(2.5);
    c.toggle();
    expect(c.current.playing).toBe(true);
    c.toggle();
    expect(c.current.playing).toBe(false);
  });
  it('playing from the end starts over', () => {
    const c = new ReplayController(2);
    c.seek(2);
    c.play();
    expect(c.current.time).toBe(0);
  });
  it('rejects a negative duration and a non-positive speed', () => {
    expect(() => new ReplayController(-1)).toThrow(/0 or greater/);
    expect(() => {
      new ReplayController(1).setSpeed(0);
    }).toThrow(/greater than 0/);
  });
});
