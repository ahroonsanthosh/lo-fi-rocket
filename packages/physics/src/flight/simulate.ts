/**
 * Flight simulation driver (plan 0010 parts B and C; DYN-9 to DYN-15).
 *
 * Sources: Niskanen (2009) §4.2 pp. 60 to 69: Newton's laws for the forces
 * of chapters 3 and 4 (p. 60, p. 65), RK4 (p. 66), the orientation update
 * (eq. 4.24, taken in its derivative form q̇ = ½ ω q, D-038), the launch
 * guide (p. 6, Table 4.2), the three-degree-of-freedom recovery descent
 * under the deployed devices (p. 67) and the simulation events (Table 4.2
 * p. 69). The rotational equation about the CG, I ω̇_b + ω_b × (I ω_b) = τ_b,
 * is rigid-body mechanics (D-036). Events are located at their exact
 * crossing by bisection on the step (owner's requirement, D-017).
 */
import { atmosphereModel, type StandardAtmosphereState } from '../atmosphere/ussa1976.js';
import { dragCoefficient } from '../drag/drag.js';
import { validateLaunch } from '../environment/launch.js';
import { windVelocity } from '../environment/wind.js';
import { InvalidInputError, NonFiniteResultError } from '../errors.js';
import { combineRocket, structuralMassParts, type MotorMass } from '../geometry/assembly.js';
import type { MassProperties } from '../geometry/revolution.js';
import { burnTime, motorMassAt, thrustAt, validateMotor } from '../motor/motor.js';
import { finiteResult } from '../numerics/finite.js';
import { maximumBodyDiameter } from '../stability/barrowman.js';
import { dimensionless, metres, seconds, type Metres, type Seconds } from '../units/si.js';
import { aerodynamicForcesAndMoments } from './aerodynamics.js';
import {
  bodyToWorld,
  flightParameters,
  initialOrientation,
  noseDirection,
  worldToBody,
  type FlightParameters,
} from './frames.js';
import { gravityAt } from './gravity.js';
import {
  dormandPrinceStep,
  errorNorm,
  nextStepSize,
  rk4Step,
  type Derivative,
} from './integrators.js';
import { quaternionMultiply, quaternionNormalise, type Quaternion } from './quaternion.js';
import { add, cross, dot, norm, scale, sub, vec3, type Vec3 } from './vector.js';
import type { FlightVehicle, RecoveryDevice, SimulationOptions } from './vehicle.js';

export type FlightPhase = 'on-rail' | 'powered' | 'coast' | 'descent' | 'landed';

export type FlightEventKind =
  | 'launch'
  | 'liftoff'
  | 'rail-exit'
  | 'burnout'
  | 'ejection-charge'
  | 'apogee'
  | 'deployment'
  | 'altitude'
  | 'landing'
  | 'max-time';

export interface FlightEvent {
  readonly kind: FlightEventKind;
  readonly time: Seconds;
  readonly detail: string;
}

export interface FlightSample {
  readonly time: Seconds;
  readonly phase: FlightPhase;
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly orientation: Quaternion;
  readonly angularVelocity: Vec3;
  /** Above the pad. */
  readonly altitude: number;
  readonly speed: number;
  readonly airspeed: number;
  readonly mach: number;
  readonly angleOfAttack: number;
  readonly acceleration: number;
  readonly thrust: number;
  /** Magnitude of the aerodynamic force, N. */
  readonly aerodynamicForce: number;
  readonly cd0: number;
  readonly mass: number;
  readonly cg: number;
  /** CP at the current angle of attack; NaN when no aerodynamics. */
  readonly cp: number;
  readonly stabilityCalibers: number;
}

export interface FlightSummary {
  readonly apogee: number;
  readonly timeToApogee: number;
  readonly maxVelocity: number;
  readonly maxMach: number;
  readonly maxAcceleration: number;
  readonly railExitVelocity: number;
  readonly railExitTime: number;
  readonly burnoutTime: number;
  readonly burnoutVelocity: number;
  readonly deploymentVelocity: number | undefined;
  readonly deploymentTime: number | undefined;
  /** Vertical speed at landing (positive down). */
  readonly descentRate: number | undefined;
  readonly groundHitVelocity: number | undefined;
  readonly landingDistance: number | undefined;
  /** Bearing of the landing point from the pad, clockwise from north, radians. */
  readonly landingDirection: number | undefined;
  readonly flightTime: number;
  readonly endReason: 'landing' | 'max-time';
}

export interface FlightResult {
  readonly samples: readonly FlightSample[];
  readonly events: readonly FlightEvent[];
  readonly summary: FlightSummary;
  readonly warnings: readonly string[];
  readonly modes: {
    readonly aerodynamics: 'niskanen' | 'none';
    readonly finRollReduction: boolean;
    readonly baseDragMotorRule: 'while-thrusting' | 'always';
    readonly integrator: string;
    readonly degreesOfFreedom: 6 | 3;
    readonly gravitySeaLevel: number;
  };
}

// State vector layout: [x, y, z, vx, vy, vz, qw, qx, qy, qz, wx, wy, wz]

interface Derived {
  readonly mass: number;
  readonly cg: number;
  readonly thrust: number;
  readonly aeroForce: number;
  readonly cd0: number;
  readonly cp: number;
  readonly flight: FlightParameters | undefined;
  readonly accelerationWorld: Vec3;
  readonly warnings: readonly string[];
}

interface Context {
  readonly vehicle: FlightVehicle;
  readonly options: SimulationOptions;
  readonly structure: readonly MassProperties[];
  readonly atmosphere: (z: Metres) => StandardAtmosphereState;
  readonly railDirection: Vec3;
  readonly railLength: number;
  readonly rocketLength: number;
  readonly referenceDiameter: number;
  readonly burnTime: number;
  readonly motorDiameter: number | undefined;
  readonly deployedArea: { area: number }; // Σ C_D A of deployed devices (mutable through the run)
  /** Set by the burnout event so that no integrator stage evaluated at exactly t_burn sees thrust. */
  readonly motorState: { burnedOut: boolean };
}

function unpack(y: readonly number[]): {
  position: Vec3;
  velocity: Vec3;
  orientation: Quaternion;
  angularVelocity: Vec3;
} {
  const g = (i: number): number => y[i] ?? Number.NaN;
  return {
    position: vec3(g(0), g(1), g(2)),
    velocity: vec3(g(3), g(4), g(5)),
    orientation: { w: g(6), x: g(7), y: g(8), z: g(9) },
    angularVelocity: vec3(g(10), g(11), g(12)),
  };
}

function pack(p: Vec3, v: Vec3, q: Quaternion, w: Vec3): number[] {
  return [p.x, p.y, p.z, v.x, v.y, v.z, q.w, q.x, q.y, q.z, w.x, w.y, w.z];
}

function motorMass(ctx: Context, t: number): MotorMass | undefined {
  const m = ctx.vehicle.motor;
  if (m.kind !== 'definition') return undefined;
  return motorMassAt(m.definition, seconds(Math.max(0, t)), m.aftEnd);
}

function thrustNow(ctx: Context, t: number): number {
  const m = ctx.vehicle.motor;
  if (m.kind === 'ideal') return t >= 0 && t <= m.burnTime ? m.thrust : 0;
  return thrustAt(m.definition, seconds(Math.max(0, t)));
}

/** Everything the equations of motion need at (t, y), for a given phase. */
function derive(
  ctx: Context,
  phase: FlightPhase,
  t: number,
  y: readonly number[],
): { dydt: number[]; derived: Derived } {
  const s = unpack(y);
  const q = quaternionNormalise(s.orientation);
  const altitudeAsl = (ctx.options.site.altitude as number) + s.position.z;
  const atm = ctx.atmosphere(metres(altitudeAsl));
  const wind = windVelocity(ctx.options.wind, s.position.z);
  const mp = combineRocket(ctx.structure, motorMass(ctx, t));
  const m: number = mp.mass;
  const g = gravityAt(ctx.options.gravity, metres(altitudeAsl));
  const weight = vec3(0, 0, -m * g);
  const warnings: string[] = [];

  let forceWorld = weight;
  let momentBody: Vec3 = vec3(0, 0, 0);
  const thrust =
    phase === 'descent' || phase === 'landed' || ctx.motorState.burnedOut ? 0 : thrustNow(ctx, t);
  const nose =
    ctx.options.degreesOfFreedom === 3
      ? velocityAlignedNose(s.velocity, ctx.railDirection)
      : noseDirection(q);
  forceWorld = add(forceWorld, scale(nose, thrust));

  let flight: FlightParameters | undefined;
  let aeroForce = 0;
  let cd0 = Number.NaN;
  let cp = Number.NaN;
  if (phase === 'descent') {
    // DYN-14: the deployed devices provide the whole drag: F = −½ ρ |v_air| v_air Σ C_D A.
    const vAir = sub(s.velocity, wind);
    const speed = norm(vAir);
    const drag = scale(vAir, -0.5 * atm.density * speed * ctx.deployedArea.area);
    forceWorld = add(forceWorld, drag);
    aeroForce = norm(drag);
  } else if (ctx.options.aerodynamics === 'niskanen' && phase !== 'landed') {
    flight = flightParameters({
      velocityWorld: s.velocity,
      windWorld: wind,
      orientation: q,
      density: atm.density,
      speedOfSound: atm.speedOfSound,
      kinematicViscosity: atm.kinematicViscosity,
      referenceLength: metres(ctx.rocketLength),
    });
    const thrusting = thrust > 0;
    const drag = dragCoefficient({
      components: ctx.vehicle.components,
      mach: flight.mach,
      reynolds: flight.reynolds,
      roughnessHeight: ctx.vehicle.roughnessHeight,
      ...(ctx.motorDiameter === undefined
        ? {}
        : { motor: { diameter: metres(ctx.motorDiameter), thrusting } }),
      baseDragMotorRule: ctx.options.baseDragMotorRule,
      referenceDiameter: metres(ctx.referenceDiameter),
    });
    cd0 = drag.cd0;
    warnings.push(...drag.warnings);
    if (ctx.options.degreesOfFreedom === 3) {
      // Cross-check mode: axis along the airspeed, zero angle of attack, drag only.
      const vAir = flight.airspeedWorld;
      const speed = flight.airspeed;
      if (speed > 0) {
        const dragForce = scale(
          vAir,
          (((-(flight.dynamicPressure as number) * (Math.PI * ctx.referenceDiameter ** 2)) / 4) *
            cd0) /
            speed,
        );
        forceWorld = add(forceWorld, dragForce);
        aeroForce = norm(dragForce);
      }
    } else {
      const wBody = worldToBody(q, s.angularVelocity);
      const axialSign: -1 | 0 | 1 =
        flight.airspeedBody.x < 0 ? -1 : flight.airspeedBody.x > 0 ? 1 : 0;
      const aero = aerodynamicForcesAndMoments({
        components: ctx.vehicle.components,
        mach: flight.mach,
        angleOfAttack: flight.angleOfAttack,
        lateralAirflowAngle: flight.lateralAirflowAngle,
        axialAirspeedSign: axialSign,
        dynamicPressure: flight.dynamicPressure,
        airspeed: flight.airspeed,
        density: atm.density,
        cg: mp.cg,
        angularVelocityBody: wBody,
        cd0: dimensionless(cd0),
        options: {
          finRollReduction: ctx.options.finRollReduction,
          referenceDiameter: metres(ctx.referenceDiameter),
        },
      });
      warnings.push(...aero.warnings);
      forceWorld = add(forceWorld, bodyToWorld(q, aero.forceBody));
      momentBody = aero.momentBody;
      aeroForce = norm(aero.forceBody);
      cp = aero.cp;
    }
  }

  let acceleration = scale(forceWorld, 1 / m);
  let angularAcceleration = vec3(0, 0, 0);
  let qdot: Quaternion = { w: 0, x: 0, y: 0, z: 0 };
  let velocity = s.velocity;
  if (phase === 'on-rail') {
    // DYN-12: only the force along the rail acts; the pad holds the rocket until the thrust exceeds the weight.
    const along = dot(forceWorld, ctx.railDirection);
    const travelled = dot(s.position, ctx.railDirection);
    const held = along <= 0 && travelled <= 1e-12 && dot(s.velocity, ctx.railDirection) <= 0;
    acceleration = held ? vec3(0, 0, 0) : scale(ctx.railDirection, along / m);
    velocity = scale(ctx.railDirection, dot(s.velocity, ctx.railDirection));
  } else if (phase === 'landed') {
    acceleration = vec3(0, 0, 0);
    velocity = vec3(0, 0, 0);
  } else if (phase !== 'descent' && ctx.options.degreesOfFreedom === 6) {
    // DYN-9 rotation: I ω̇_b = τ_b − ω_b × (I ω_b), I = diag(I_rot, I_long, I_long) about the CG.
    const wBody = worldToBody(q, s.angularVelocity);
    const iRot: number = mp.inertiaRotational;
    const iLong: number = mp.inertiaLongitudinal;
    const Iw = vec3(iRot * wBody.x, iLong * wBody.y, iLong * wBody.z);
    const gyro = cross(wBody, Iw);
    const alphaBody = vec3(
      (momentBody.x - gyro.x) / iRot,
      (momentBody.y - gyro.y) / iLong,
      (momentBody.z - gyro.z) / iLong,
    );
    angularAcceleration = bodyToWorld(q, alphaBody);
    // DYN-9 orientation: q̇ = ½ ω_w q (the derivative of eq. 4.24, D-038).
    const w = s.angularVelocity;
    qdot = quaternionMultiply({ w: 0, x: w.x / 2, y: w.y / 2, z: w.z / 2 }, q);
  }

  const dydt = pack(velocity, acceleration, qdot, angularAcceleration);
  for (let i = 0; i < dydt.length; i++) {
    const v = dydt[i];
    if (v === undefined || !Number.isFinite(v)) {
      throw new NonFiniteResultError(
        `state derivative component ${String(i)} at t = ${String(t)} s (phase ${phase})`,
        v ?? Number.NaN,
      );
    }
  }
  return {
    dydt,
    derived: {
      mass: m,
      cg: mp.cg,
      thrust,
      aeroForce,
      cd0,
      cp,
      flight,
      accelerationWorld: acceleration,
      warnings,
    },
  };
}

/** Cross-check mode: the axis follows the velocity (the rail direction before the rocket moves). */
function velocityAlignedNose(v: Vec3, rail: Vec3): Vec3 {
  const n = norm(v);
  return n > 1e-9 ? scale(v, 1 / n) : rail;
}

interface PendingTimed {
  readonly time: number;
  readonly kind: FlightEventKind;
  readonly detail: string;
  readonly action: () => void;
}

/** Run the simulation. */
export function simulateFlight(vehicle: FlightVehicle, options: SimulationOptions): FlightResult {
  const launch = validateLaunch(options.site, options.rail);
  const warnings = new Set<string>(launch.warnings.map((w) => w.message));
  if (vehicle.motor.kind === 'definition') validateMotor(vehicle.motor.definition);
  const maxTime: number = options.maxTime;
  if (!(maxTime > 0))
    throw new InvalidInputError('maximum simulation time', maxTime, 'must be greater than 0 s');
  const structure = structuralMassParts(vehicle.components);
  const rocketLength = vehicle.components.reduce((s, p) => {
    const c = p.component;
    return c.kind === 'noseCone' || c.kind === 'bodyTube' || c.kind === 'transition'
      ? s + (c.length as number)
      : s;
  }, 0);
  const referenceDiameter: number =
    vehicle.referenceDiameter ?? maximumBodyDiameter(vehicle.components);
  const motorBurn =
    vehicle.motor.kind === 'definition'
      ? (burnTime(vehicle.motor.definition) as number)
      : (vehicle.motor.burnTime as number);
  const ctx: Context = {
    vehicle,
    options,
    structure,
    atmosphere: atmosphereModel(options.atmosphere),
    railDirection: launch.railDirection,
    railLength: options.rail.length,
    rocketLength,
    referenceDiameter,
    burnTime: motorBurn,
    motorDiameter:
      vehicle.motor.kind === 'definition' ? vehicle.motor.definition.diameter : undefined,
    deployedArea: { area: 0 },
    motorState: { burnedOut: false },
  };

  const events: FlightEvent[] = [];
  const samples: FlightSample[] = [];
  let phase: FlightPhase = 'on-rail';
  let t = 0;
  let y = pack(
    vec3(0, 0, 0),
    vec3(0, 0, 0),
    initialOrientation(options.rail.angleFromVertical, options.rail.azimuth),
    vec3(0, 0, 0),
  );
  const timed: PendingTimed[] = [];
  let apogeeReached = false;
  let liftedOff = false;
  const deployed = new Set<RecoveryDevice>();

  const deploy = (device: RecoveryDevice, at: number, why: string): void => {
    if (deployed.has(device)) return;
    deployed.add(device);
    const area = (Math.PI * (device.diameter as number) ** 2) / 4;
    ctx.deployedArea.area += device.dragCoefficient * area;
    events.push({
      kind: 'deployment',
      time: seconds(at),
      detail: `${device.name} deployed (${why}); C_D A = ${(device.dragCoefficient * area).toFixed(4)} m²`,
    });
    if (phase !== 'landed') phase = 'descent';
  };
  const scheduleDeployments = (trigger: RecoveryDevice['deploy']['event'], at: number): void => {
    for (const device of vehicle.recovery) {
      if (device.deploy.event !== trigger || deployed.has(device)) continue;
      const delay: number = device.deploy.delay;
      if (delay <= 0) deploy(device, at, `at ${trigger}`);
      else
        timed.push({
          time: at + delay,
          kind: 'deployment',
          detail: '',
          action: () => {
            deploy(device, at + delay, `${String(delay)} s after ${trigger}`);
          },
        });
    }
  };

  events.push({ kind: 'launch', time: seconds(0), detail: 'ignition at t = 0' });
  scheduleDeployments('launch', 0);
  timed.push({
    time: motorBurn,
    kind: 'burnout',
    detail: `motor burnout at ${String(motorBurn)} s`,
    action: () => {
      ctx.motorState.burnedOut = true;
      if (phase === 'powered') phase = 'coast';
    },
  });
  if (vehicle.motor.kind === 'definition' && vehicle.motor.ejectionDelay !== undefined) {
    const tE = motorBurn + (vehicle.motor.ejectionDelay as number);
    timed.push({
      time: tE,
      kind: 'ejection-charge',
      detail: `ejection charge at ${tE.toFixed(3)} s`,
      action: () => {
        scheduleDeployments('ejection', tE);
      },
    });
  }

  const recordInterval =
    options.recordInterval === undefined ? 0 : (options.recordInterval as number);
  let lastRecorded = -Infinity;
  let maxAcceleration = 0;
  const record = (force: boolean): void => {
    if (!force && t - lastRecorded < recordInterval - 1e-12) return;
    const { derived } = derive(ctx, phase, t, y);
    const s = unpack(y);
    const acc = norm(derived.accelerationWorld);
    maxAcceleration = Math.max(maxAcceleration, acc);
    samples.push({
      time: seconds(t),
      phase,
      position: s.position,
      velocity: s.velocity,
      orientation: s.orientation,
      angularVelocity: s.angularVelocity,
      altitude: s.position.z,
      speed: norm(s.velocity),
      airspeed: derived.flight?.airspeed ?? norm(s.velocity),
      mach: derived.flight?.mach ?? Number.NaN,
      angleOfAttack: derived.flight?.angleOfAttack ?? Number.NaN,
      acceleration: acc,
      thrust: derived.thrust,
      aerodynamicForce: derived.aeroForce,
      cd0: derived.cd0,
      mass: derived.mass,
      cg: derived.cg,
      cp: derived.cp,
      stabilityCalibers: Number.isNaN(derived.cp)
        ? Number.NaN
        : (derived.cp - derived.cg) / referenceDiameter,
    });
    for (const w of derived.warnings) warnings.add(w);
    lastRecorded = t;
  };

  const f: Derivative = (tt, yy) => derive(ctx, phase, tt, yy).dydt;
  const stepOnce = (h: number): { yNext: number[]; errorNorm: number } => {
    if (options.integrator.kind === 'rk4') return { yNext: rk4Step(f, t, y, h), errorNorm: 0 };
    const r = dormandPrinceStep(f, t, y, h);
    const o = {
      relativeTolerance: options.integrator.relativeTolerance,
      absoluteTolerance: options.integrator.absoluteTolerance,
      maxStep: options.integrator.maxStep,
      minStep: 1e-9,
    };
    return { yNext: r.y5, errorNorm: errorNorm(r.errorEstimate, y, r.y5, o) };
  };
  const normaliseOrientation = (yy: number[]): number[] => {
    const q = quaternionNormalise({ w: yy[6] ?? 1, x: yy[7] ?? 0, y: yy[8] ?? 0, z: yy[9] ?? 0 });
    const out = [...yy];
    out[6] = q.w;
    out[7] = q.x;
    out[8] = q.y;
    out[9] = q.z;
    return out;
  };

  // Event functions g(y) whose sign change marks an event; each applies to some phases only.
  const railTravel = (yy: readonly number[]): number =>
    dot(unpack(yy).position, ctx.railDirection) - ctx.railLength;
  const verticalVelocity = (yy: readonly number[]): number => unpack(yy).velocity.z;
  const altitudeAbovePad = (yy: readonly number[]): number => unpack(yy).position.z;

  let h =
    options.integrator.kind === 'rk4'
      ? (options.integrator.timeStep as number)
      : (options.integrator.initialStep as number);
  if (!(h > 0)) throw new InvalidInputError('time step', h, 'must be greater than 0 s');
  record(true);
  let railExit: { t: number; v: number } | undefined;
  let burnout: { t: number; v: number } | undefined;
  let apogee: { t: number; z: number } | undefined;
  let deployment: { t: number; v: number } | undefined;
  let landing: { t: number; vz: number; speed: number; x: number; y: number } | undefined;
  let endReason: 'landing' | 'max-time' = 'max-time';
  let maxVelocity = 0;
  let maxMach = 0;
  let steps = 0;

  while (phase !== 'landed' && t < maxTime) {
    steps++;
    if (steps > 50_000_000)
      throw new InvalidInputError(
        'simulation steps',
        steps,
        'exceeded 5·10⁷; check the time step and tolerances',
      );
    // Do not step past the next timed event or the end time.
    timed.sort((a, b) => a.time - b.time);
    const nextTimed = timed[0];
    let hTry = Math.min(h, maxTime - t);
    if (nextTimed !== undefined && nextTimed.time > t) hTry = Math.min(hTry, nextTimed.time - t);
    if (nextTimed !== undefined && nextTimed.time <= t + 1e-12) {
      timed.shift();
      nextTimed.action();
      if (nextTimed.kind !== 'deployment')
        events.push({
          kind: nextTimed.kind,
          time: seconds(nextTimed.time),
          detail: nextTimed.detail,
        });
      if (nextTimed.kind === 'burnout') burnout = { t, v: norm(unpack(y).velocity) };
      if (nextTimed.kind === 'deployment' && deployment === undefined && deployed.size > 0)
        deployment = { t, v: norm(unpack(y).velocity) };
      record(true);
      continue;
    }
    let attempt = stepOnce(hTry);
    if (options.integrator.kind === 'dormand-prince') {
      const o = {
        relativeTolerance: options.integrator.relativeTolerance,
        absoluteTolerance: options.integrator.absoluteTolerance,
        maxStep: options.integrator.maxStep,
        minStep: 1e-9,
      };
      let tries = 0;
      while (attempt.errorNorm > 1 && hTry > 1e-9 && tries < 40) {
        hTry = nextStepSize(hTry, attempt.errorNorm, o);
        attempt = stepOnce(hTry);
        tries++;
      }
      h = nextStepSize(hTry, attempt.errorNorm, o);
    }
    let yNext = normaliseOrientation(attempt.yNext);
    let tNext = t + hTry;

    // Event detection on this step (DYN-13): find the earliest crossing by bisection on the step length.
    const candidates: {
      kind: FlightEventKind;
      g: (yy: readonly number[]) => number;
      direction: 'up' | 'down';
    }[] = [];
    if (phase === 'on-rail') {
      candidates.push({ kind: 'rail-exit', g: railTravel, direction: 'up' });
      // A rocket that slides back down the rail after a weak burn lands at the pad.
      if (liftedOff)
        candidates.push({
          kind: 'landing',
          g: (yy) => dot(unpack(yy).position, ctx.railDirection),
          direction: 'down',
        });
    }
    if ((phase === 'powered' || phase === 'coast') && !apogeeReached)
      candidates.push({ kind: 'apogee', g: verticalVelocity, direction: 'down' });
    if (phase !== 'on-rail')
      candidates.push({ kind: 'landing', g: altitudeAbovePad, direction: 'down' });
    if (apogeeReached) {
      for (const device of vehicle.recovery) {
        if (
          device.deploy.event === 'altitude' &&
          !deployed.has(device) &&
          device.deploy.altitude !== undefined
        ) {
          const alt: number = device.deploy.altitude;
          candidates.push({
            kind: 'altitude',
            g: (yy) => altitudeAbovePad(yy) - alt,
            direction: 'down',
          });
        }
      }
    }
    let fired: { kind: FlightEventKind; g: (yy: readonly number[]) => number } | undefined;
    for (const c of candidates) {
      const g0 = c.g(y);
      const g1 = c.g(yNext);
      const crossed = c.direction === 'up' ? g0 < 0 && g1 >= 0 : g0 > 0 && g1 <= 0;
      if (!crossed) continue;
      // Bisection on the step length to locate the crossing within 1e-9 s or 1e-10 in g.
      let lo = 0;
      let hi = hTry;
      let yHi = yNext;
      for (let i = 0; i < 80 && hi - lo > 1e-10; i++) {
        const mid = (lo + hi) / 2;
        const yMid = normaliseOrientation(stepOnce(mid).yNext);
        const gm = c.g(yMid);
        const midCrossed = c.direction === 'up' ? gm >= 0 : gm <= 0;
        if (midCrossed) {
          hi = mid;
          yHi = yMid;
        } else lo = mid;
      }
      if (hi < hTry) {
        hTry = hi;
        yNext = yHi;
        tNext = t + hi;
        fired = c;
      } else {
        fired = c;
      }
    }
    y = yNext;
    t = tNext;
    const s = unpack(y);
    const speed = norm(s.velocity);
    maxVelocity = Math.max(maxVelocity, speed);
    if (!liftedOff && speed > 0) {
      liftedOff = true;
      events.push({ kind: 'liftoff', time: seconds(t), detail: 'first motion on the rail' });
    }
    if (fired !== undefined) {
      switch (fired.kind) {
        case 'rail-exit':
          railExit = { t, v: speed };
          phase = t < motorBurn ? 'powered' : 'coast';
          events.push({
            kind: 'rail-exit',
            time: seconds(t),
            detail: `rail exit at ${speed.toFixed(3)} m/s after ${t.toFixed(4)} s`,
          });
          break;
        case 'apogee':
          apogeeReached = true;
          apogee = { t, z: s.position.z };
          events.push({
            kind: 'apogee',
            time: seconds(t),
            detail: `apogee ${s.position.z.toFixed(3)} m above the pad`,
          });
          scheduleDeployments('apogee', t);
          if (deployed.size > 0 && deployment === undefined) deployment = { t, v: speed };
          break;
        case 'altitude':
          for (const device of vehicle.recovery) {
            if (
              device.deploy.event === 'altitude' &&
              !deployed.has(device) &&
              device.deploy.altitude !== undefined &&
              Math.abs(s.position.z - (device.deploy.altitude as number)) < 1e-6
            ) {
              const delay: number = device.deploy.delay;
              if (delay <= 0)
                deploy(device, t, `descending through ${String(device.deploy.altitude)} m`);
              else
                timed.push({
                  time: t + delay,
                  kind: 'deployment',
                  detail: '',
                  action: () => {
                    deploy(
                      device,
                      t + delay,
                      `${String(delay)} s after ${String(device.deploy.altitude)} m`,
                    );
                  },
                });
              if (deployed.size > 0 && deployment === undefined) deployment = { t, v: speed };
            }
          }
          events.push({
            kind: 'altitude',
            time: seconds(t),
            detail: `altitude ${s.position.z.toFixed(3)} m crossed on descent`,
          });
          break;
        case 'landing':
          landing = { t, vz: -s.velocity.z, speed, x: s.position.x, y: s.position.y };
          phase = 'landed';
          endReason = 'landing';
          events.push({
            kind: 'landing',
            time: seconds(t),
            detail: `landing at ${speed.toFixed(3)} m/s, ${Math.hypot(s.position.x, s.position.y).toFixed(2)} m from the pad`,
          });
          break;
        case 'burnout':
        case 'deployment':
        case 'ejection-charge':
        case 'launch':
        case 'liftoff':
        case 'max-time':
          // timed events act through their own handlers; nothing to do here
          break;
      }
    }
    const sample = derive(ctx, phase, t, y).derived;
    if (sample.flight !== undefined) maxMach = Math.max(maxMach, sample.flight.mach);
    maxAcceleration = Math.max(maxAcceleration, norm(sample.accelerationWorld));
    record(fired !== undefined);
  }
  if (phase !== 'landed')
    events.push({
      kind: 'max-time',
      time: seconds(t),
      detail: `maximum simulation time ${String(maxTime)} s reached in phase ${phase}`,
    });

  const apogeeZ = samples.reduce((m, s) => Math.max(m, s.altitude), 0);
  const summary: FlightSummary = {
    apogee: finiteResult('apogee', apogee?.z ?? apogeeZ),
    timeToApogee: apogee?.t ?? Number.NaN,
    maxVelocity,
    maxMach,
    maxAcceleration,
    railExitVelocity: railExit?.v ?? Number.NaN,
    railExitTime: railExit?.t ?? Number.NaN,
    burnoutTime: burnout?.t ?? Number.NaN,
    burnoutVelocity: burnout?.v ?? Number.NaN,
    deploymentVelocity: deployment?.v,
    deploymentTime: deployment?.t,
    descentRate: landing?.vz,
    groundHitVelocity: landing?.speed,
    landingDistance: landing === undefined ? undefined : Math.hypot(landing.x, landing.y),
    landingDirection:
      landing === undefined
        ? undefined
        : (Math.atan2(landing.x, landing.y) + 2 * Math.PI) % (2 * Math.PI),
    flightTime: t,
    endReason,
  };
  return {
    samples,
    events,
    summary,
    warnings: [...warnings],
    modes: {
      aerodynamics: options.aerodynamics,
      finRollReduction: options.finRollReduction,
      baseDragMotorRule: options.baseDragMotorRule,
      integrator:
        options.integrator.kind === 'rk4'
          ? `RK4 fixed step ${String(options.integrator.timeStep)} s`
          : `Dormand–Prince RK5(4) rtol ${String(options.integrator.relativeTolerance)} atol ${String(options.integrator.absoluteTolerance)}`,
      degreesOfFreedom: options.degreesOfFreedom,
      gravitySeaLevel: options.gravity.seaLevel,
    },
  };
}
