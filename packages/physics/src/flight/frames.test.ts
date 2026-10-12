/** Frames and flight parameters (plan 0008, DYN-6 to DYN-8). */
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { mach, metres, radians } from '../units/si.js';
import {
  BODY_NOSE,
  bodyToWorld,
  EAST,
  flightParameters,
  initialOrientation,
  NORTH,
  noseDirection,
  railDirection,
  REFERENCE_ORIENTATION,
  UP,
  velocityRegion,
  worldToBody,
} from './frames.js';
import { norm, vec3, type Vec3 } from './vector.js';

const closeTo = (a: Vec3, b: Vec3, digits = 12): void => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
  expect(a.z).toBeCloseTo(b.z, digits);
};

describe('DYN-6 reference orientation and rail direction', () => {
  it('sends the nose (body −x) up, body y north and body z east', () => {
    closeTo(bodyToWorld(REFERENCE_ORIENTATION, BODY_NOSE), UP, 15);
    closeTo(bodyToWorld(REFERENCE_ORIENTATION, vec3(0, 1, 0)), NORTH, 15);
    closeTo(bodyToWorld(REFERENCE_ORIENTATION, vec3(0, 0, 1)), EAST, 15);
    closeTo(worldToBody(REFERENCE_ORIENTATION, UP), BODY_NOSE, 15);
  });
  it('a rail 10° from vertical towards east: (sin 10°, 0, cos 10°) = (0.173648, 0, 0.984808)', () => {
    const d = railDirection(radians((10 * Math.PI) / 180), radians(Math.PI / 2));
    closeTo(d, vec3(0.17364818, 0, 0.98480775), 7);
    const q0 = initialOrientation(radians((10 * Math.PI) / 180), radians(Math.PI / 2));
    closeTo(noseDirection(q0), d, 14);
    expect(norm(noseDirection(q0))).toBeCloseTo(1, 14);
  });
  it('a rail towards north at 30°: nose at (0, 0.5, 0.866025); vertical rail is the reference orientation', () => {
    const q = initialOrientation(radians(Math.PI / 6), radians(0));
    closeTo(noseDirection(q), vec3(0, 0.5, Math.sqrt(3) / 2), 14);
    expect(initialOrientation(radians(0), radians(1.3))).toEqual(REFERENCE_ORIENTATION);
    expect(() => railDirection(radians(Math.PI / 2), radians(0))).toThrow(InvalidInputError);
    expect(() => railDirection(radians(-0.1), radians(0))).toThrow(InvalidInputError);
  });
});

describe('DYN-7, DYN-8 flight parameters by hand', () => {
  // Sea-level standard air: ρ = 1.2250 kg/m³, c = 340.294 m/s, ν = 1.4607e-5 m²/s (USSA76 Tables I and III).
  const air = {
    density: 1.225,
    speedOfSound: 340.294,
    kinematicViscosity: 1.4607e-5,
    referenceLength: metres(0.6),
  };
  it('vertical rocket at 50 m/s with a 5 m/s wind from the east', () => {
    // Wind from the east blows towards the west: wind velocity (−5, 0, 0). Airspeed = v − w = (5, 0, 50).
    // Body: east is body +z, up is body −x → (−50, 0, 5). α = atan(5/50) = 0.0996687 rad;
    // lateral angle atan2(z = 5, y = 0) = π/2; |v| = 50.249378; M = 0.147665; q = ½·1.225·2525 = 1546.5625 Pa;
    // Re = 50.249378 × 0.6 / 1.4607e-5 = 2.064053e6.
    const p = flightParameters({
      velocityWorld: vec3(0, 0, 50),
      windWorld: vec3(-5, 0, 0),
      orientation: REFERENCE_ORIENTATION,
      ...air,
    });
    closeTo(p.airspeedWorld, vec3(5, 0, 50), 15);
    closeTo(p.airspeedBody, vec3(-50, 0, 5), 13);
    expect(p.airspeed).toBeCloseTo(50.249378, 6);
    expect(p.angleOfAttack).toBeCloseTo(0.0996687, 7);
    expect(p.lateralAirflowAngle).toBeCloseTo(Math.PI / 2, 12);
    expect(p.mach).toBeCloseTo(0.147665, 6);
    expect(p.region).toBe('subsonic');
    expect(p.dynamicPressure).toBeCloseTo(1546.5625, 9);
    expect(p.reynolds).toBeCloseTo(2064053.3, 0);
  });
  it('no airspeed: zero angle of attack and zero lateral angle; a tail wind reduces the airspeed', () => {
    const still = flightParameters({
      velocityWorld: vec3(0, 0, 0),
      windWorld: vec3(0, 0, 0),
      orientation: REFERENCE_ORIENTATION,
      ...air,
    });
    expect(still.angleOfAttack).toBe(0);
    expect(still.lateralAirflowAngle).toBe(0);
    expect(still.mach).toBe(0);
    const tail = flightParameters({
      velocityWorld: vec3(0, 0, 50),
      windWorld: vec3(0, 0, 10),
      orientation: REFERENCE_ORIENTATION,
      ...air,
    });
    expect(tail.airspeed).toBe(40);
    expect(tail.angleOfAttack).toBeCloseTo(0, 12);
  });
  it('flying backwards (tail first) gives α = π; regions follow Table 3.1', () => {
    const back = flightParameters({
      velocityWorld: vec3(0, 0, -20),
      windWorld: vec3(0, 0, 0),
      orientation: REFERENCE_ORIENTATION,
      ...air,
    });
    expect(back.angleOfAttack).toBeCloseTo(Math.PI, 12);
    expect(velocityRegion(mach(0.79))).toBe('subsonic');
    expect(velocityRegion(mach(0.8))).toBe('transonic');
    expect(velocityRegion(mach(1.2))).toBe('supersonic');
    expect(velocityRegion(mach(5))).toBe('hypersonic');
  });
  it('rejects non-positive air properties', () => {
    expect(() =>
      flightParameters({
        velocityWorld: vec3(0, 0, 1),
        windWorld: vec3(0, 0, 0),
        orientation: REFERENCE_ORIENTATION,
        ...air,
        density: 0,
      }),
    ).toThrow(InvalidInputError);
    expect(() =>
      flightParameters({
        velocityWorld: vec3(0, 0, 1),
        windWorld: vec3(0, 0, 0),
        orientation: REFERENCE_ORIENTATION,
        ...air,
        referenceLength: metres(0),
      }),
    ).toThrow(InvalidInputError);
  });
});
