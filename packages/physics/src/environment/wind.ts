/**
 * Wind (plans 0008 and 0016; ENV-1, ENV-3, ENV-4, ENV-5). Niskanen §4.1.2
 * pp. 56 to 60: the wind is a steady velocity plus a zero-mean turbulence
 * generated as pink noise. Direction convention: docs/conventions.md.
 *
 * - ENV-1: steady, uniform wind from a direction (plan 0008).
 * - ENV-3: a mean wind that varies with altitude as a user table, linear
 *   in altitude (the thesis assumes a constant mean, p. 60, and names
 *   layers as a future extension, p. 56; D-049).
 * - ENV-4: pink noise x_n = w_n − a₁ x_{n−1} − a₂ x_{n−2}, a_k = (k − 1 − α/2)
 *   a_{k−1}/k, α = 5/3, two poles, w_n Gaussian white noise (eqs. 4.5, 4.6,
 *   pp. 57 to 58, after Kasdin).
 * - ENV-5: samples at 20 Hz, divided by 2.252, U_n = U + σ_u x_n along the
 *   mean direction, linear interpolation in time (p. 58, p. 60 steps 1 to 3,
 *   eq. 4.7 for the intensity I_u = σ_u/U).
 */
import { InvalidInputError } from '../errors.js';
import { vec3, type Vec3 } from '../flight/vector.js';
import { createRandom } from '../numerics/random.js';
import type { MetresPerSecond, Radians } from '../units/si.js';

export interface ConstantWind {
  readonly kind: 'constant';
  readonly speed: MetresPerSecond;
  /** Meteorological direction the wind blows FROM, clockwise from north. */
  readonly from: Radians;
}

export interface VectorWind {
  readonly kind: 'vector';
  /** Wind velocity in world ENU coordinates, m/s. */
  readonly velocity: Vec3;
}

export interface WindLayer {
  /** Altitude above the pad of this row; rows increase in altitude and the first is 0. */
  readonly altitude: number;
  readonly speed: MetresPerSecond;
  readonly from: Radians;
}

/** ENV-3: mean wind by altitude; held constant below the first and above the last row. */
export interface ProfileWind {
  readonly kind: 'profile';
  readonly layers: readonly WindLayer[];
}

/** ENV-4, ENV-5: Niskanen's turbulence on top of a constant or profile mean. */
export interface TurbulentWind {
  readonly kind: 'turbulent';
  readonly mean: ConstantWind | ProfileWind;
  /** Turbulence intensity I_u = σ_u/U (eq. 4.7); 0.1 to 0.2 is "at the top of the range" for model rockets. */
  readonly intensity: number;
  /** Seed of the pseudorandom generator (RNG-1); kept with the results. */
  readonly seed: number;
}

export type WindModel = ConstantWind | VectorWind | ProfileWind | TurbulentWind;

/** Pink noise filter coefficients a₁, a₂ of eq. (4.6) for α = 5/3 and two poles. */
export const PINK_NOISE_ALPHA = 5 / 3;
export const PINK_NOISE_COEFFICIENTS: readonly number[] = (() => {
  const a: number[] = [1];
  for (let k = 1; k <= 2; k++) a.push(((k - 1 - PINK_NOISE_ALPHA / 2) * (a[k - 1] ?? 0)) / k);
  return a;
})();
/** The standard deviation of a long unscaled two-pole sequence, Niskanen p. 60 step 2. */
export const PINK_NOISE_STANDARD_DEVIATION = 2.252;
/** Turbulence generation frequency, Niskanen p. 58. */
export const TURBULENCE_SAMPLE_RATE_HZ = 20;

function meanVector(speed: number, from: number): Vec3 {
  // Blowing from ψ means the velocity points towards ψ + π.
  return vec3(-speed * Math.sin(from), -speed * Math.cos(from), 0);
}

function requireSpeedAndDirection(speed: number, from: number): void {
  if (!(speed >= 0) || !Number.isFinite(speed)) {
    throw new InvalidInputError('wind speed', speed, 'must be 0 m/s or greater');
  }
  if (!Number.isFinite(from)) throw new InvalidInputError('wind direction', from, 'must be finite');
}

export function validateWindLayers(layers: readonly WindLayer[]): void {
  const first = layers[0];
  if (first === undefined)
    throw new InvalidInputError('wind profile', 0, 'must have at least one row');
  if (first.altitude !== 0) {
    throw new InvalidInputError(
      'wind profile first altitude',
      first.altitude,
      'must be 0 m (the pad)',
    );
  }
  let previous = -1;
  layers.forEach((l, i) => {
    if (!Number.isFinite(l.altitude) || !(l.altitude > previous)) {
      throw new InvalidInputError(
        `wind profile row ${String(i + 1)} altitude`,
        l.altitude,
        'must increase down the table',
      );
    }
    requireSpeedAndDirection(l.speed, l.from);
    previous = l.altitude;
  });
}

/** ENV-3: the mean wind of a profile at an altitude, interpolating speed and direction linearly between rows. */
export function profileWindAt(
  layers: readonly WindLayer[],
  altitudeAbovePad: number,
): { speed: number; from: number } {
  const first = layers[0];
  const last = layers[layers.length - 1];
  if (first === undefined || last === undefined) {
    throw new InvalidInputError('wind profile', layers.length, 'must have at least one row');
  }
  if (altitudeAbovePad <= first.altitude) return { speed: first.speed, from: first.from };
  if (altitudeAbovePad >= last.altitude) return { speed: last.speed, from: last.from };
  for (let i = 1; i < layers.length; i++) {
    const a = layers[i - 1];
    const b = layers[i];
    if (a === undefined || b === undefined) continue;
    if (altitudeAbovePad <= b.altitude) {
      const f = (altitudeAbovePad - a.altitude) / (b.altitude - a.altitude);
      // Direction interpolated along the shorter way round the compass.
      let dFrom = (b.from as number) - (a.from as number);
      dFrom = ((dFrom + Math.PI) % (2 * Math.PI)) - Math.PI;
      if (dFrom < -Math.PI) dFrom += 2 * Math.PI;
      return { speed: a.speed + f * (b.speed - a.speed), from: (a.from as number) + f * dFrom };
    }
  }
  return { speed: last.speed, from: last.from };
}

function meanAt(
  mean: ConstantWind | ProfileWind,
  altitudeAbovePad: number,
): { speed: number; from: number } {
  if (mean.kind === 'constant') return { speed: mean.speed, from: mean.from };
  return profileWindAt(mean.layers, altitudeAbovePad);
}

/**
 * ENV-4, ENV-5: the normalised turbulence sequence x_n/2.252 at 20 Hz for
 * `count` samples from the seed. Two-pole IIR filter on Gaussian white noise.
 */
export function pinkNoiseSequence(seed: number, count: number): Float64Array {
  const random = createRandom(seed);
  const a1 = PINK_NOISE_COEFFICIENTS[1] ?? 0;
  const a2 = PINK_NOISE_COEFFICIENTS[2] ?? 0;
  const out = new Float64Array(count);
  let x1 = 0;
  let x2 = 0;
  for (let n = 0; n < count; n++) {
    const w = random.nextNormal();
    const x = w - a1 * x1 - a2 * x2;
    out[n] = x / PINK_NOISE_STANDARD_DEVIATION;
    x2 = x1;
    x1 = x;
  }
  return out;
}

export type WindField = (altitudeAbovePad: number, time: number) => Vec3;

function validateModel(model: WindModel): void {
  switch (model.kind) {
    case 'constant':
      requireSpeedAndDirection(model.speed, model.from);
      return;
    case 'vector':
      if (![model.velocity.x, model.velocity.y, model.velocity.z].every(Number.isFinite)) {
        throw new InvalidInputError('wind velocity', model.velocity, 'must be finite');
      }
      return;
    case 'profile':
      validateWindLayers(model.layers);
      return;
    case 'turbulent':
      if (!(model.intensity >= 0) || !Number.isFinite(model.intensity)) {
        throw new InvalidInputError(
          'turbulence intensity',
          model.intensity,
          'must be 0 or greater',
        );
      }
      validateModel(model.mean);
      return;
  }
}

/**
 * The wind as a function of altitude and time for one flight. The
 * turbulent sequence is generated once for `maxTime` so that every query
 * (any integrator stage, any step size) reads the same interpolated gust
 * (Niskanen p. 58).
 */
export function windField(model: WindModel, maxTime: number): WindField {
  validateModel(model);
  if (!(maxTime > 0) || !Number.isFinite(maxTime)) {
    throw new InvalidInputError('wind field duration', maxTime, 'must be greater than 0 s');
  }
  switch (model.kind) {
    case 'constant': {
      const v = meanVector(model.speed, model.from);
      return () => v;
    }
    case 'vector':
      return () => model.velocity;
    case 'profile':
      return (z) => {
        const m = profileWindAt(model.layers, z);
        return meanVector(m.speed, m.from);
      };
    case 'turbulent': {
      const dt = 1 / TURBULENCE_SAMPLE_RATE_HZ;
      const count = Math.ceil(maxTime / dt) + 2;
      const x = pinkNoiseSequence(model.seed, count);
      return (z, t) => {
        if (!Number.isFinite(t) || t < 0)
          throw new InvalidInputError('time', t, 'must be 0 s or greater');
        const m = meanAt(model.mean, z);
        const i = Math.min(count - 2, Math.floor(t / dt));
        const f = Math.min(1, t / dt - i);
        const xn = (x[i] ?? 0) * (1 - f) + (x[i + 1] ?? 0) * f;
        // U_n = U + σ_u x_n with σ_u = I_u U (eq. 4.7), along the mean direction.
        const u = m.speed + model.intensity * m.speed * xn;
        return meanVector(u, m.from);
      };
    }
  }
}

/** Wind velocity vector at the given altitude above the pad and time. */
export function windVelocity(model: WindModel, altitudeAbovePad: number, time = 0): Vec3 {
  if (!Number.isFinite(altitudeAbovePad)) {
    throw new InvalidInputError('altitude above the pad', altitudeAbovePad, 'must be finite');
  }
  return windField(model, Math.max(time, 1e-9) + 1)(altitudeAbovePad, time);
}

/**
 * OpenRocket's wind vector for its direction θ: (v sin θ, v cos θ, 0) in its
 * x-east, y-north frame (reference/rockets/settings.md), for comparisons.
 */
export function openRocketWind(speed: number, direction: number): VectorWind {
  return {
    kind: 'vector',
    velocity: vec3(speed * Math.sin(direction), speed * Math.cos(direction), 0),
  };
}
