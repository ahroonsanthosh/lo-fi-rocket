/**
 * Wind (plan 0008, ENV-1). Niskanen §4.1.2 pp. 56 to 57: the wind is a
 * steady unidirectional velocity plus a zero-mean turbulence; only the
 * steady part is implemented here (turbulence and altitude profiles are
 * Phase 5, CLAUDE.md 6.4). Direction convention: docs/conventions.md.
 */
import { InvalidInputError, NotImplementedError } from '../errors.js';
import { vec3, type Vec3 } from '../flight/vector.js';
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

export type WindModel = ConstantWind | VectorWind | { readonly kind: 'profile' | 'turbulent' };

/** Wind velocity vector at the given altitude above the pad (constant models ignore it). */
export function windVelocity(model: WindModel, altitudeAbovePad: number): Vec3 {
  if (!Number.isFinite(altitudeAbovePad)) {
    throw new InvalidInputError('altitude above the pad', altitudeAbovePad, 'must be finite');
  }
  switch (model.kind) {
    case 'constant': {
      const s: number = model.speed;
      const psi: number = model.from;
      if (!(s >= 0) || !Number.isFinite(s)) {
        throw new InvalidInputError('wind speed', s, 'must be 0 m/s or greater');
      }
      if (!Number.isFinite(psi))
        throw new InvalidInputError('wind direction', psi, 'must be finite');
      // Blowing from ψ means the velocity points towards ψ + π.
      return vec3(-s * Math.sin(psi), -s * Math.cos(psi), 0);
    }
    case 'vector':
      if (![model.velocity.x, model.velocity.y, model.velocity.z].every(Number.isFinite)) {
        throw new InvalidInputError('wind velocity', model.velocity, 'must be finite');
      }
      return model.velocity;
    case 'profile':
      throw new NotImplementedError('wind profiles by altitude (Phase 5)');
    case 'turbulent':
      throw new NotImplementedError('wind turbulence (Niskanen §4.1.2 pink noise, Phase 5)');
  }
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
