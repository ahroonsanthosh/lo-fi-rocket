/**
 * Monte Carlo dispersion (plan 0017, D-051). Each run perturbs the design
 * with normal variations of user-entered standard deviations, sampled from
 * the seeded generator (RNG-1, RNG-2), and flies it with `simulateFlight`.
 * Statistics are rank based; nothing is fitted.
 */
import {
  createRandom,
  kilograms,
  kilogramsPerCubicMetre,
  metresPerSecond,
  newtons,
  radians,
  simulateFlight,
  type Component,
  type FlightSummary,
  type MotorDefinition,
} from '@lo-fi-rocket/physics';
import { designSimulationOptions, designVehicle, type PhysicsMode } from '../design/to-physics.js';
import type { DesignComponent, RocketDesign } from '../design/model.js';
import { FormatError } from '../errors.js';

export interface DispersionVariations {
  /** Standard deviation of the wind speed, m/s. */
  readonly windSpeed: number;
  /** Standard deviation of the direction the wind blows from, rad. */
  readonly windDirection: number;
  /** Standard deviation of the rail angle from vertical, rad. */
  readonly railAngle: number;
  /** Standard deviation of the rail azimuth, rad. */
  readonly railAzimuth: number;
  /** Standard deviation of a uniform scale on the thrust curve (fraction, 0.05 = 5 %). */
  readonly motorImpulseScale: number;
  /** Standard deviation of a uniform scale on the structural masses and densities (fraction). */
  readonly structuralMassScale: number;
}

export interface DispersionSettings {
  readonly runs: number;
  readonly seed: number;
  readonly variations: DispersionVariations;
}

export const ZERO_VARIATIONS: DispersionVariations = {
  windSpeed: 0,
  windDirection: 0,
  railAngle: 0,
  railAzimuth: 0,
  motorImpulseScale: 0,
  structuralMassScale: 0,
};

export interface SampledValues {
  readonly windSpeed: number;
  readonly windDirection: number;
  readonly railAngle: number;
  readonly railAzimuth: number;
  readonly motorImpulseScale: number;
  readonly structuralMassScale: number;
  /** Turbulence seed of this run, when the design has turbulence. */
  readonly turbulenceSeed: number | undefined;
}

export interface DispersionRun {
  readonly index: number;
  readonly sampled: SampledValues;
  readonly apogee: number;
  readonly maxVelocity: number;
  /** Landing point east and north of the pad, m; undefined when the run did not land. */
  readonly landingEast: number | undefined;
  readonly landingNorth: number | undefined;
  readonly landingDistance: number | undefined;
  readonly landingDirection: number | undefined;
  readonly flightTime: number;
  readonly endReason: FlightSummary['endReason'];
  /** The error message when the run could not be simulated. */
  readonly error: string | undefined;
}

export interface SampleStatistics {
  readonly count: number;
  readonly mean: number;
  readonly standardDeviation: number;
  readonly p5: number;
  readonly p50: number;
  readonly p95: number;
  readonly min: number;
  readonly max: number;
}

export interface DispersionSummary {
  readonly apogee: SampleStatistics | undefined;
  readonly landingDistance: SampleStatistics | undefined;
  /** Mean landing point, m east and north. */
  readonly meanLanding: { readonly east: number; readonly north: number } | undefined;
  /** 95th percentile of the distance from the mean landing point (D-051). */
  readonly containmentRadius95: number | undefined;
  readonly landed: number;
  readonly notLanded: number;
  readonly failed: number;
}

export interface DispersionResult {
  readonly seed: number;
  readonly settings: DispersionSettings;
  readonly runs: readonly DispersionRun[];
  readonly summary: DispersionSummary;
}

export class DispersionError extends FormatError {}

/** Rank-based percentile: the value at rank ⌈p N⌉ of the sorted sample (D-051). */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new DispersionError('percentile of an empty sample');
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil(p * sorted.length)));
  return sorted[rank - 1] ?? Number.NaN;
}

export function sampleStatistics(values: readonly number[]): SampleStatistics | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, x) => s + x, 0) / n;
  const variance = n > 1 ? sorted.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
  return {
    count: n,
    mean,
    standardDeviation: Math.sqrt(variance),
    p5: percentile(sorted, 0.05),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    min: sorted[0] ?? Number.NaN,
    max: sorted[n - 1] ?? Number.NaN,
  };
}

function scaleMotor(def: MotorDefinition, scale: number): MotorDefinition {
  return {
    ...def,
    points: def.points.map((p) => ({ time: p.time, thrust: newtons(p.thrust * scale) })),
  };
}

function scaleComponentMass(c: Component, scale: number): Component {
  switch (c.kind) {
    case 'massComponent':
    case 'parachute':
      return { ...c, mass: kilograms(c.mass * scale) };
    case 'noseCone':
    case 'transition':
    case 'bodyTube':
    case 'innerTube':
    case 'launchLug':
    case 'centeringRing':
    case 'bulkhead':
    case 'finSet':
    case 'railButton':
      return { ...c, density: kilogramsPerCubicMetre(c.density * scale) };
  }
}

/** The design of run k: the sampled variations applied to the base design. */
export function perturbDesign(design: RocketDesign, sampled: SampledValues): RocketDesign {
  // A negative speed or angle is the same physical vector with the direction reversed (not a clamp).
  let windSpeed = sampled.windSpeed;
  let windFrom = sampled.windDirection;
  if (windSpeed < 0) {
    windSpeed = -windSpeed;
    windFrom += Math.PI;
  }
  let railAngle = sampled.railAngle;
  let railAzimuth = sampled.railAzimuth;
  if (railAngle < 0) {
    railAngle = -railAngle;
    railAzimuth += Math.PI;
  }
  const wind = design.launch.wind;
  const windSettings =
    wind.profile === undefined
      ? { ...wind, speed: metresPerSecond(windSpeed), from: radians(windFrom) }
      : {
          ...wind,
          speed: metresPerSecond(windSpeed),
          from: radians(windFrom),
          profile: wind.profile.map((l, i) =>
            i === 0
              ? { ...l, speed: metresPerSecond(windSpeed), from: radians(windFrom) }
              : {
                  ...l,
                  speed: metresPerSecond(Math.max(0, l.speed + (windSpeed - wind.speed))),
                  from: radians(l.from + (windFrom - wind.from)),
                },
          ),
        };
  const turbulence =
    wind.turbulence === undefined || sampled.turbulenceSeed === undefined
      ? {}
      : { turbulence: { intensity: wind.turbulence.intensity, seed: sampled.turbulenceSeed } };
  // The structural mass scale applies to every mass the user gave as well as the computed ones: a
  // part's own mass override (D-073) and the as-built mass (D-089), which would otherwise hold the
  // mass fixed whatever the sample.
  const scale = sampled.structuralMassScale;
  const components: DesignComponent[] = design.components.map((c) => ({
    ...c,
    component: scaleComponentMass(c.component, scale),
    ...(c.massOverride?.mass === undefined
      ? {}
      : { massOverride: { ...c.massOverride, mass: kilograms(c.massOverride.mass * scale) } }),
  }));
  const asBuilt =
    design.asBuilt?.mass === undefined
      ? design.asBuilt
      : { ...design.asBuilt, mass: kilograms(design.asBuilt.mass * scale) };
  const mount = design.motorMount;
  return {
    ...design,
    components,
    ...(asBuilt === undefined ? {} : { asBuilt }),
    ...(mount?.motor === undefined
      ? {}
      : {
          motorMount: {
            ...mount,
            motor: {
              ...mount.motor,
              definition: scaleMotor(mount.motor.definition, sampled.motorImpulseScale),
            },
          },
        }),
    launch: {
      ...design.launch,
      rail: {
        ...design.launch.rail,
        angleFromVertical: radians(railAngle),
        azimuth: radians(railAzimuth),
      },
      wind: { ...windSettings, ...turbulence },
    },
  };
}

export function validateDispersionSettings(s: DispersionSettings): void {
  if (!Number.isInteger(s.runs) || s.runs < 1 || s.runs > 100000) {
    throw new DispersionError(
      `number of runs is invalid: received ${String(s.runs)}; must be a whole number from 1 to 100000`,
    );
  }
  if (!Number.isInteger(s.seed) || s.seed < 0 || s.seed > 0xffffffff) {
    throw new DispersionError(
      `seed is invalid: received ${String(s.seed)}; must be an integer between 0 and 4294967295`,
    );
  }
  for (const [k, v] of Object.entries(s.variations)) {
    if (!Number.isFinite(v) || v < 0) {
      throw new DispersionError(
        `variation "${k}" is invalid: received ${String(v)}; must be 0 or greater`,
      );
    }
  }
}

/** Sample run k's values from the generator (one normal deviate per variation, in a fixed order). */
export function sampleRun(
  design: RocketDesign,
  settings: DispersionSettings,
  random: ReturnType<typeof createRandom>,
  k: number,
): SampledValues {
  const v = settings.variations;
  const w = design.launch.wind;
  const r = design.launch.rail;
  return {
    windSpeed: (w.speed as number) + v.windSpeed * random.nextNormal(),
    windDirection: (w.from as number) + v.windDirection * random.nextNormal(),
    railAngle: (r.angleFromVertical as number) + v.railAngle * random.nextNormal(),
    railAzimuth: (r.azimuth as number) + v.railAzimuth * random.nextNormal(),
    motorImpulseScale: 1 + v.motorImpulseScale * random.nextNormal(),
    structuralMassScale: 1 + v.structuralMassScale * random.nextNormal(),
    turbulenceSeed: w.turbulence === undefined ? undefined : (settings.seed + k) % 0x100000000,
  };
}

export function summarise(runs: readonly DispersionRun[]): DispersionSummary {
  const landed = runs.filter(
    (r) => r.landingEast !== undefined && r.landingNorth !== undefined && r.error === undefined,
  );
  const failed = runs.filter((r) => r.error !== undefined).length;
  const notLanded = runs.length - landed.length - failed;
  const ok = runs.filter((r) => r.error === undefined);
  const meanEast =
    landed.length === 0
      ? undefined
      : landed.reduce((s, r) => s + (r.landingEast ?? 0), 0) / landed.length;
  const meanNorth =
    landed.length === 0
      ? undefined
      : landed.reduce((s, r) => s + (r.landingNorth ?? 0), 0) / landed.length;
  const fromMean =
    meanEast === undefined || meanNorth === undefined
      ? []
      : landed
          .map((r) =>
            Math.hypot((r.landingEast ?? 0) - meanEast, (r.landingNorth ?? 0) - meanNorth),
          )
          .sort((a, b) => a - b);
  return {
    apogee: sampleStatistics(ok.map((r) => r.apogee)),
    landingDistance: sampleStatistics(landed.map((r) => r.landingDistance ?? 0)),
    meanLanding:
      meanEast === undefined || meanNorth === undefined
        ? undefined
        : { east: meanEast, north: meanNorth },
    containmentRadius95: fromMean.length === 0 ? undefined : percentile(fromMean, 0.95),
    landed: landed.length,
    notLanded,
    failed,
  };
}

/** Fly one perturbed design; errors become the run's `error`, never an exception out of the batch. */
export function flyRun(
  design: RocketDesign,
  k: number,
  sampled: SampledValues,
  mode: PhysicsMode = 'displayed',
): DispersionRun {
  const base = { index: k, sampled };
  try {
    const d = perturbDesign(design, sampled);
    const r = simulateFlight(designVehicle(d), designSimulationOptions(d, mode));
    const s = r.summary;
    const dist = s.landingDistance;
    const dir = s.landingDirection;
    const landed = dist !== undefined && dir !== undefined;
    return {
      ...base,
      apogee: s.apogee,
      maxVelocity: s.maxVelocity,
      landingEast: landed
        ? (s.landingDistance ?? 0) * Math.sin(s.landingDirection ?? 0)
        : undefined,
      landingNorth: landed
        ? (s.landingDistance ?? 0) * Math.cos(s.landingDirection ?? 0)
        : undefined,
      landingDistance: s.landingDistance,
      landingDirection: s.landingDirection,
      flightTime: s.flightTime,
      endReason: s.endReason,
      error: undefined,
    };
  } catch (error) {
    return {
      ...base,
      apogee: Number.NaN,
      maxVelocity: Number.NaN,
      landingEast: undefined,
      landingNorth: undefined,
      landingDistance: undefined,
      landingDirection: undefined,
      flightTime: Number.NaN,
      endReason: 'max-time',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function runDispersion(
  design: RocketDesign,
  settings: DispersionSettings,
  onProgress?: (done: number, total: number) => void,
  mode: PhysicsMode = 'displayed',
): DispersionResult {
  validateDispersionSettings(settings);
  const random = createRandom(settings.seed);
  const runs: DispersionRun[] = [];
  for (let k = 0; k < settings.runs; k++) {
    const sampled = sampleRun(design, settings, random, k);
    runs.push(flyRun(design, k, sampled, mode));
    onProgress?.(k + 1, settings.runs);
  }
  return { seed: settings.seed, settings, runs, summary: summarise(runs) };
}
