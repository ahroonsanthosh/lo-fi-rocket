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
import { flutterGeometry, flutterVelocity } from '../stability/flutter.js';
import { dragCoefficient } from '../drag/drag.js';
import { validateLaunch } from '../environment/launch.js';
import { windField, type WindField } from '../environment/wind.js';
import {
  IntegrationUnstableError,
  InvalidInputError,
  NonFiniteResultError,
  SimulationStalledError,
} from '../errors.js';
import { combineRocket, structuralMassParts, type MotorMass } from '../geometry/assembly.js';
import { validateComponentFit } from '../geometry/fit.js';
import type { MassProperties } from '../geometry/revolution.js';
import { burnTime, motorMassAt, thrustAt, validateMotor } from '../motor/motor.js';
import { finiteResult } from '../numerics/finite.js';
import { maximumBodyDiameter } from '../stability/barrowman.js';
import { dimensionless, metres, seconds, type Metres, type Seconds } from '../units/si.js';
import {
  aerodynamicForcesAndMoments,
  normalForceAtAngle,
  DEFAULT_LARGE_ANGLE_METHOD,
  type LargeAngleMethod,
} from './aerodynamics.js';
import { finLargeAngleAvailability } from '../stability/datcom-large-angle.js';
import {
  bodyToWorld,
  flightParameters,
  initialOrientation,
  noseDirection,
  worldToBody,
  type FlightParameters,
} from './frames.js';
import { gravityAt, seaLevelGravity } from './gravity.js';
import {
  dormandPrinceStep,
  errorNorm,
  nextStepSize,
  rk4Step,
  type Derivative,
  rk4StabilityFunction,
  rk4StableStep,
} from './integrators.js';
import { quaternionMultiply, quaternionNormalise, type Quaternion } from './quaternion.js';
import { add, cross, dot, norm, scale, sub, vec3, type Vec3 } from './vector.js';
import {
  DEFAULT_MINIMUM_STABILITY_MARGIN,
  type DragCurve,
  type FlightVehicle,
  type RecoveryDevice,
  type SimulationOptions,
} from './vehicle.js';

/** D-047: linear interpolation of an imported C_D table in Mach; outside the table is an error. */
export function dragCurveAt(curve: DragCurve, machNumber: number): number {
  const pts = curve.points;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first === undefined || last === undefined || pts.length < 2) {
    throw new InvalidInputError('drag curve', pts.length, 'must have at least two points');
  }
  if (!(machNumber >= first.mach && machNumber <= last.mach)) {
    throw new InvalidInputError(
      `Mach number for the drag curve "${curve.label}"`,
      machNumber,
      `must lie within the table, ${String(first.mach)} to ${String(last.mach)} (the curve is not extrapolated)`,
    );
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a === undefined || b === undefined) continue;
    if (machNumber <= b.mach) {
      const f = (machNumber - a.mach) / (b.mach - a.mach);
      return a.cd + f * (b.cd - a.cd);
    }
  }
  return last.cd;
}

export function validateDragCurve(curve: DragCurve): void {
  if (curve.points.length < 2) {
    throw new InvalidInputError('drag curve', curve.points.length, 'must have at least two points');
  }
  let previous = Number.NEGATIVE_INFINITY;
  curve.points.forEach((p, i) => {
    if (!Number.isFinite(p.mach) || !(p.mach > previous)) {
      throw new InvalidInputError(
        `drag curve point ${String(i)} Mach`,
        p.mach,
        'must increase along the table',
      );
    }
    if (!Number.isFinite(p.cd) || p.cd < 0) {
      throw new InvalidInputError(
        `drag curve point ${String(i)} C_D`,
        p.cd,
        'must be 0 or greater',
      );
    }
    previous = p.mach;
  });
}

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
  | 'max-time'
  | 'model-limit';

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
  /** (CP − CG)/d with the CP of the in-flight margin: with the DATCOM model the more forward of its CP and the small-angle model's (D-070). */
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
  /** Airspeed |v − v_wind| at the first deployment of any recovery device, whatever its trigger (review F-1, F-3). */
  readonly deploymentVelocity: number | undefined;
  readonly deploymentTime: number | undefined;
  /** Vertical speed at landing (positive down). */
  readonly descentRate: number | undefined;
  readonly groundHitVelocity: number | undefined;
  readonly landingDistance: number | undefined;
  /** Bearing of the landing point from the pad, clockwise from north, radians. */
  readonly landingDirection: number | undefined;
  readonly flightTime: number;
  /** 'model-limit': the flight left the aerodynamic model's angle-of-attack range (D-046) and was not continued. */
  readonly endReason: 'landing' | 'max-time' | 'model-limit';
  /**
   * The smallest stability margin, at the CP for the actual Mach number and
   * angle of attack and the CG of the moment, over every accepted step of
   * powered flight (rail exit to burnout) and of coast (burnout to apogee);
   * undefined when the phase did not occur or had no aerodynamics (plan 0030).
   */
  readonly minimumStability: {
    readonly powered: StabilityPoint | undefined;
    readonly coast: StabilityPoint | undefined;
  };
  /** Per fin set (plan 0031): the lowest flutter-speed margin V_f/V of the ascent, or why it was not evaluated. */
  readonly flutter: readonly FlutterMargin[];
}

export type FlutterMargin =
  | {
      readonly finIndex: number;
      /** Lowest V_f/airspeed over powered flight and coast; below 1 the flight exceeds the TN 4197 flutter speed. */
      readonly ratio: number;
      readonly time: number;
      readonly mach: number;
      readonly airspeed: number;
      /** V_f at that moment, m/s (local pressure and speed of sound). */
      readonly flutterVelocity: number;
    }
  | { readonly finIndex: number; readonly ratio: undefined; readonly reason: string };

export interface StabilityPoint {
  /** (CP − CG)/d, calibers. */
  readonly calibers: number;
  readonly time: number;
  readonly mach: number;
  /** Radians. */
  readonly angleOfAttack: number;
  readonly cp: number;
  readonly cg: number;
  /** The normal force model whose CP gave this margin, the more forward of the two (D-070). */
  readonly model: LargeAngleMethod;
}

/**
 * D-046: the small-angle normal force model of Niskanen chapter 3 (Barrowman's
 * fins as flat plates at small angles, p. 26; body terms with sin α) is
 * applied up to 90°, the limit of the thesis's own angle-of-attack drag
 * scaling (p. 53); beyond it a six-degree-of-freedom flight is not continued.
 * With the DATCOM large-angle model (D-070) the limit applies only at Mach 1
 * and above.
 */
export const AERO_MAX_ANGLE_OF_ATTACK = Math.PI / 2;

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
    /** The seed of the turbulence generator when the wind is turbulent (ENV-5), so the flight can be reproduced. */
    readonly windSeed: number | undefined;
    /** The label of the imported drag curve when one replaced the drag model (D-047). */
    readonly dragCurve: string | undefined;
    /** The large-angle method in effect (D-070). */
    readonly largeAngleMethod: LargeAngleMethod;
  };
  /** Present for fixed-step RK4 runs: the stability and accuracy check that every step passed (D-063). */
  readonly stepCheck: StepCheck | undefined;
}

// State vector layout: [x, y, z, vx, vy, vz, qw, qx, qy, qz, wx, wy, wz]

/**
 * DYN-17. Linearised rates of the state at an instant, s⁻¹, from the model's
 * own force and moment laws, for the RK4 step check (D-063):
 *  - roll: the roll damping moment of AERO-5 to AERO-7 is C_r ω_x, so
 *    I_rot ω̇_x = −C_r ω_x decays at C_r/I_rot;
 *  - pitchNatural: the restoring moment of AERO-1/AERO-2 about the CG at
 *    small α is −q A_ref C_Nα (X_CP − X_CG) α, so I_long α̈ = −k α has the
 *    natural frequency ω_n = √(q A_ref C_Nα (X_CP − X_CG)/I_long) (0 when the
 *    margin is negative: a diverging true solution is not a step question);
 *  - pitchDamping: the AERO-4 damping moment C_p ω_t² linearised about the
 *    current transverse rate, 2 C_p |ω_t|/I_long;
 *  - drag: the drag force ½ρ v² C A along the velocity linearised about v,
 *    ρ v C A/m (the axial drag in flight, the deployed devices in descent).
 */
export interface LinearisedRates {
  readonly roll: number;
  readonly pitchNatural: number;
  readonly pitchDamping: number;
  readonly drag: number;
}

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
  readonly rates: LinearisedRates;
}

/** Result of the RK4 step check over a run (DYN-16, DYN-17, D-063). */
export interface StepCheck {
  /** The smallest safe step found along the run (0.9 of the stability boundary over all modes), s. */
  readonly minimumSafeStep: number;
  readonly minimumSafeStepTime: number;
  readonly minimumSafeStepMode: 'roll' | 'pitch' | 'drag';
  /** The largest h ω_n met: the pitch oscillation's phase advance per step, rad. */
  readonly maxPitchStepAngle: number;
  /** The numerical amplitude loss of the pitch oscillation per step at that angle, 1 − |R(i h ω_n)|. */
  readonly maxPitchAmplitudeLossPerStep: number;
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
  /** The wind for this flight (ENV-1, ENV-3 to ENV-5), built once so every stage reads the same gust. */
  readonly wind: WindField;
  readonly deployedArea: { area: number }; // Σ C_D A of deployed devices (mutable through the run)
  /** Set by the burnout event so that no integrator stage evaluated at exactly t_burn sees thrust. */
  readonly motorState: { burnedOut: boolean };
  /** The large-angle method in effect (D-070): the requested one, or 'linear' when a fin set is not covered. */
  readonly largeAngleMethod: LargeAngleMethod;
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

function sampleFlight(
  ctx: Context,
  phase: FlightPhase,
  t: number,
  y: readonly number[],
): FlightParameters | undefined {
  return derive(ctx, phase, t, y).derived.flight;
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
  const wind = ctx.wind(s.position.z, Math.max(0, t));
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
  let rates: LinearisedRates = { roll: 0, pitchNatural: 0, pitchDamping: 0, drag: 0 };
  if (phase === 'descent') {
    // DYN-14: the deployed devices provide the whole drag: F = −½ ρ |v_air| v_air Σ C_D A.
    const vAir = sub(s.velocity, wind);
    const speed = norm(vAir);
    const drag = scale(vAir, -0.5 * atm.density * speed * ctx.deployedArea.area);
    forceWorld = add(forceWorld, drag);
    aeroForce = norm(drag);
    rates = { ...rates, drag: (atm.density * speed * ctx.deployedArea.area) / m };
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
    if (ctx.options.dragCurve !== undefined) {
      cd0 = dragCurveAt(ctx.options.dragCurve, flight.mach);
    } else {
      const drag = dragCoefficient({
        components: ctx.vehicle.components,
        mach: flight.mach,
        reynolds: flight.reynolds,
        roughnessHeight: ctx.vehicle.roughnessHeight,
        ...(ctx.motorDiameter === undefined
          ? {}
          : { motor: { diameter: metres(ctx.motorDiameter), thrusting } }),
        baseDragMotorRule: ctx.options.baseDragMotorRule,
        ...(ctx.options.baseDragMethod === undefined
          ? {}
          : { baseDragMethod: ctx.options.baseDragMethod }),
        referenceDiameter: metres(ctx.referenceDiameter),
      });
      cd0 = drag.cd0;
      warnings.push(...drag.warnings);
    }
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
          largeAngleMethod: ctx.largeAngleMethod,
        },
      });
      warnings.push(...aero.warnings);
      forceWorld = add(forceWorld, bodyToWorld(q, aero.forceBody));
      momentBody = aero.momentBody;
      aeroForce = norm(aero.forceBody);
      cp = aero.cp;
      // DYN-17: the linearised rates for the step check.
      const aRef = (Math.PI * ctx.referenceDiameter ** 2) / 4;
      const qDyn: number = flight.dynamicPressure;
      const stiffness = qDyn * aRef * aero.cnAlpha * ((aero.cp as number) - (mp.cg as number));
      const transverse = Math.hypot(wBody.y, wBody.z);
      rates = {
        roll: aero.rollDampingCoefficient / (mp.inertiaRotational as number),
        pitchNatural: Math.sqrt(Math.max(0, stiffness / (mp.inertiaLongitudinal as number))),
        pitchDamping:
          (2 * aero.pitchDampingCoefficient * transverse) / (mp.inertiaLongitudinal as number),
        drag:
          flight.airspeed > 0
            ? (atm.density * flight.airspeed * aero.axialDragCoefficient * aRef) / m
            : 0,
      };
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
      rates,
    },
  };
}

/**
 * DYN-16, DYN-17 (D-063). The RK4 step check at one instant: the eigenvalues
 * of the linearised roll, pitch and drag dynamics and the largest step for
 * which every one lies inside the RK4 stability region, with a factor 0.9
 * for the change of the rates within a step. Also the pitch oscillation's
 * phase advance per step h ω_n and its numerical amplitude loss 1 − |R(i h ω_n)|.
 */
export function rk4StepCheck(
  h: number,
  rates: LinearisedRates,
): {
  safeStep: number;
  limitedBy: 'roll' | 'pitch' | 'drag';
  pitchStepAngle: number;
  pitchAmplitudeLoss: number;
} {
  const modes: { mode: 'roll' | 'pitch' | 'drag'; re: number; im: number }[] = [
    { mode: 'roll', re: -rates.roll, im: 0 },
    { mode: 'drag', re: -rates.drag, im: 0 },
  ];
  // Pitch: λ² + λ_d λ + ω_n² = 0.
  const disc = rates.pitchDamping ** 2 - 4 * rates.pitchNatural ** 2;
  if (disc >= 0) {
    modes.push({ mode: 'pitch', re: (-rates.pitchDamping - Math.sqrt(disc)) / 2, im: 0 });
  } else {
    modes.push({ mode: 'pitch', re: -rates.pitchDamping / 2, im: Math.sqrt(-disc) / 2 });
  }
  let safeStep = Number.POSITIVE_INFINITY;
  let limitedBy: 'roll' | 'pitch' | 'drag' = 'pitch';
  for (const m of modes) {
    const hb = 0.9 * rk4StableStep(m.re, m.im);
    if (hb < safeStep) {
      safeStep = hb;
      limitedBy = m.mode;
    }
  }
  const pitchStepAngle = h * rates.pitchNatural;
  return {
    safeStep,
    limitedBy,
    pitchStepAngle,
    pitchAmplitudeLoss: 1 - rk4StabilityFunction(0, pitchStepAngle),
  };
}

/** D-063: the RK4 run stops when the pitch oscillation would lose more than this per step. */
export const RK4_MAX_PITCH_AMPLITUDE_LOSS = 0.1;
/** D-063: a warning is attached above this loss per step. */
export const RK4_WARN_PITCH_AMPLITUDE_LOSS = 0.01;

/** Off the rail and not landed: powered flight, coast, or descent under a recovery device. */
function isAirborne(phase: FlightPhase): boolean {
  return phase === 'powered' || phase === 'coast' || phase === 'descent';
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

/**
 * D-070: the large-angle method in effect for a flight. 'datcom' needs every
 * fin set to be covered by the DATCOM charts (HA-5, HA-6); otherwise the
 * small-angle model and the 90° limit (D-046) apply, with a warning naming
 * the reason.
 */
function effectiveLargeAngleMethod(
  vehicle: FlightVehicle,
  options: SimulationOptions,
  warnings: Set<string>,
): LargeAngleMethod {
  const requested = options.largeAngleMethod ?? DEFAULT_LARGE_ANGLE_METHOD;
  if (requested === 'linear') return 'linear';
  for (const p of vehicle.components) {
    if (p.component.kind !== 'finSet') continue;
    const av = finLargeAngleAvailability(p.component);
    if (!av.available) {
      warnings.add(
        `The large-angle model (DATCOM, D-070) does not cover this fin set: ${av.reason}. The small-angle model is used instead, and the flight ends if the angle of attack passes 90° (D-046).`,
      );
      return 'linear';
    }
  }
  return 'datcom';
}

/** Run the simulation. */
export function simulateFlight(vehicle: FlightVehicle, options: SimulationOptions): FlightResult {
  const launch = validateLaunch(options.site, options.rail);
  const warnings = new Set<string>(launch.warnings.map((w) => w.message));
  if (vehicle.motor.kind === 'definition') validateMotor(vehicle.motor.definition);
  const maxTime: number = options.maxTime;
  if (!(maxTime > 0))
    throw new InvalidInputError('maximum simulation time', maxTime, 'must be greater than 0 s');
  if (options.dragCurve !== undefined) validateDragCurve(options.dragCurve);
  validateComponentFit(vehicle.components);
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
    wind: windField(options.wind, maxTime),
    largeAngleMethod: effectiveLargeAngleMethod(vehicle, options, warnings),
  };

  // M-4: a device on the ejection charge needs a charge. A plugged motor (no delay) or the ideal motor of the
  // analytical cases has none, so the device can never open; say so before the flight, not only after it.
  const ejectionDevices = vehicle.recovery.filter((d) => d.deploy.event === 'ejection');
  const hasEjectionCharge =
    vehicle.motor.kind === 'definition' && vehicle.motor.ejectionDelay !== undefined;
  if (!hasEjectionCharge) {
    for (const d of ejectionDevices) {
      warnings.add(
        `"${d.name}" is set to open at the motor's ejection charge, but ${vehicle.motor.kind === 'ideal' ? 'this motor model has no ejection charge' : 'the motor is plugged (it has no ejection delay)'}, so it never opens and the rocket comes down without it. Set it to open at apogee or at an altitude (with an altimeter), or choose a motor with an ejection delay.`,
      );
    }
  }

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
  // F-1: the first deployment, whatever its trigger (apogee, altitude, ejection charge, launch, delay).
  let deployment: { t: number; v: number } | undefined;
  // F-3: the speed relative to the air, |v − v_wind| (DYN-7, Niskanen §4.2.4 p. 65), which sets the deployment load
  // through the dynamic pressure; the descent drag of DYN-14 already uses it.
  const airspeedAt = (tt: number, yy: readonly number[]): number => {
    const st = unpack(yy);
    return norm(sub(st.velocity, ctx.wind(st.position.z, Math.max(0, tt))));
  };

  const deploy = (device: RecoveryDevice, at: number, why: string): void => {
    if (deployed.has(device)) return;
    deployed.add(device);
    // Every caller deploys at the current state: a timed action runs at its step boundary, an event
    // handler after the state has been advanced to the bisected crossing.
    deployment ??= { t: at, v: airspeedAt(at, y) };
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
  const minimumMargin = options.minimumStabilityMargin ?? DEFAULT_MINIMUM_STABILITY_MARGIN;
  if (!Number.isFinite(minimumMargin)) {
    throw new InvalidInputError(
      'minimum stability margin',
      minimumMargin,
      'must be a finite number of calibers',
    );
  }
  const lowest: { powered: StabilityPoint | undefined; coast: StabilityPoint | undefined } = {
    powered: undefined,
    coast: undefined,
  };
  // Plan 0031: the TN 4197 flutter speed of every fin set with a shear modulus, at the local atmosphere.
  const flutterFins = vehicle.components.flatMap(({ component: c }, index) =>
    c.kind === 'finSet'
      ? [
          {
            index,
            fin: c,
            geometry: c.shearModulus === undefined ? undefined : flutterGeometry(c),
          },
        ]
      : [],
  );
  const flutterLowest = new Map<number, Extract<FlutterMargin, { ratio: number }>>();
  const record = (force: boolean): void => {
    const recordNow = force || t - lastRecorded >= recordInterval - 1e-12;
    if (!recordNow && phase !== 'powered' && phase !== 'coast') return;
    const { derived } = derive(ctx, phase, t, y);
    // Plan 0030: the in-flight margin at every accepted step of powered flight and coast.
    // D-070: the margin uses the more forward of the DATCOM CP and the small-angle model's CP (the conservative
    // choice: they differ at moderate angles, see the decision); the minimum covers nose-forward flight (α ≤ 90°).
    const f = derived.flight;
    let cp = derived.cp;
    let model: StabilityPoint['model'] = ctx.largeAngleMethod;
    if (
      ctx.largeAngleMethod === 'datcom' &&
      f !== undefined &&
      options.degreesOfFreedom === 6 &&
      phase !== 'descent' &&
      phase !== 'landed' &&
      Number.isFinite(cp) &&
      (f.angleOfAttack as number) <= AERO_MAX_ANGLE_OF_ATTACK
    ) {
      const linear = normalForceAtAngle(
        vehicle.components,
        f.mach,
        f.angleOfAttack,
        f.lateralAirflowAngle,
        {
          finRollReduction: options.finRollReduction,
          referenceDiameter: metres(ctx.referenceDiameter),
          largeAngleMethod: 'linear',
        },
      ).cp;
      if (linear < cp) {
        cp = linear;
        model = 'linear';
      }
    }
    if (
      (phase === 'powered' || phase === 'coast') &&
      Number.isFinite(cp) &&
      (f === undefined || (f.angleOfAttack as number) <= AERO_MAX_ANGLE_OF_ATTACK)
    ) {
      const calibers = (cp - derived.cg) / referenceDiameter;
      const current = lowest[phase];
      if (current === undefined || calibers < current.calibers) {
        lowest[phase] = {
          calibers,
          time: t,
          mach: f?.mach ?? Number.NaN,
          angleOfAttack: f?.angleOfAttack ?? Number.NaN,
          cp,
          cg: derived.cg,
          model,
        };
      }
    }
    if ((phase === 'powered' || phase === 'coast') && derived.flight !== undefined) {
      const airspeed = derived.flight.airspeed;
      const atm = ctx.atmosphere(metres((options.site.altitude as number) + unpack(y).position.z));
      for (const { index, fin, geometry } of flutterFins) {
        if (fin.shearModulus === undefined || geometry === undefined || !(airspeed > 0)) continue;
        const vf = flutterVelocity(geometry, fin.shearModulus, atm.pressure, atm.speedOfSound);
        const ratio = vf / airspeed;
        const current = flutterLowest.get(index);
        if (current === undefined || ratio < current.ratio) {
          flutterLowest.set(index, {
            finIndex: index,
            ratio,
            time: t,
            mach: derived.flight.mach,
            airspeed,
            flutterVelocity: vf,
          });
        }
      }
    }
    if (!recordNow) return;
    const s = unpack(y);
    const acc = norm(derived.accelerationWorld);
    maxAcceleration = Math.max(maxAcceleration, acc);
    // One sample per instant: a timed event that falls exactly on a step boundary is recorded again at the
    // same time; the later record holds the state after the event, so it replaces the earlier one.
    if ((samples.at(-1)?.time as number | undefined) === t) samples.pop();
    samples.push({
      time: seconds(t),
      phase,
      position: s.position,
      velocity: s.velocity,
      orientation: s.orientation,
      angularVelocity: s.angularVelocity,
      altitude: s.position.z,
      speed: norm(s.velocity),
      // F-3: without flight parameters (descent, landed), the airspeed is still |v − v_wind|, not the ground speed.
      airspeed: derived.flight?.airspeed ?? airspeedAt(t, y),
      mach: derived.flight?.mach ?? Number.NaN,
      angleOfAttack: derived.flight?.angleOfAttack ?? Number.NaN,
      acceleration: acc,
      thrust: derived.thrust,
      aerodynamicForce: derived.aeroForce,
      cd0: derived.cd0,
      mass: derived.mass,
      cg: derived.cg,
      cp: derived.cp,
      stabilityCalibers: Number.isNaN(cp) ? Number.NaN : (cp - derived.cg) / referenceDiameter,
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
  let landing: { t: number; vz: number; speed: number; x: number; y: number } | undefined;
  let endReason: 'landing' | 'max-time' | 'model-limit' = 'max-time';
  let stopped = false;
  let maxVelocity = 0;
  let maxMach = 0;
  let steps = 0;
  let stepCheck: StepCheck | undefined;
  let pitchLossWarned = false;

  while (phase !== 'landed' && !stopped && t < maxTime) {
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
      record(true);
      continue;
    }
    if (options.integrator.kind === 'rk4') {
      // D-063: never take an RK4 step outside the stability region of the linearised dynamics.
      const check = rk4StepCheck(hTry, derive(ctx, phase, t, y).derived.rates);
      if (
        stepCheck === undefined ||
        check.safeStep < stepCheck.minimumSafeStep ||
        check.pitchStepAngle > stepCheck.maxPitchStepAngle
      ) {
        stepCheck = {
          minimumSafeStep: Math.min(check.safeStep, stepCheck?.minimumSafeStep ?? Infinity),
          minimumSafeStepTime:
            stepCheck === undefined || check.safeStep < stepCheck.minimumSafeStep
              ? t
              : stepCheck.minimumSafeStepTime,
          minimumSafeStepMode:
            stepCheck === undefined || check.safeStep < stepCheck.minimumSafeStep
              ? check.limitedBy
              : stepCheck.minimumSafeStepMode,
          maxPitchStepAngle: Math.max(check.pitchStepAngle, stepCheck?.maxPitchStepAngle ?? 0),
          maxPitchAmplitudeLossPerStep: Math.max(
            check.pitchAmplitudeLoss,
            stepCheck?.maxPitchAmplitudeLossPerStep ?? 0,
          ),
        };
      }
      if (hTry > check.safeStep) {
        throw new IntegrationUnstableError(
          t,
          `${check.limitedBy} dynamics`,
          check.safeStep,
          check.limitedBy === 'roll'
            ? `the roll damping decays at ${derive(ctx, phase, t, y).derived.rates.roll.toFixed(0)} per second and RK4 is only stable for a step below 2.785 divided by that rate; a larger step makes the roll rate grow every step instead of decaying.`
            : check.limitedBy === 'pitch'
              ? `the pitch oscillation runs at ${derive(ctx, phase, t, y).derived.rates.pitchNatural.toFixed(0)} rad/s and RK4 is only stable for a step below 2.83 divided by that frequency.`
              : `the drag decelerates at ${derive(ctx, phase, t, y).derived.rates.drag.toFixed(0)} per second and RK4 is only stable for a step below 2.785 divided by that rate.`,
        );
      }
      if (check.pitchAmplitudeLoss > RK4_MAX_PITCH_AMPLITUDE_LOSS) {
        throw new IntegrationUnstableError(
          t,
          'pitch accuracy',
          (1.4 / derive(ctx, phase, t, y).derived.rates.pitchNatural) * 0.9,
          `the pitch oscillation advances ${check.pitchStepAngle.toFixed(2)} rad per step and RK4 would damp its amplitude by ${(check.pitchAmplitudeLoss * 100).toFixed(0)} % every step, a numerical loss, not the rocket's.`,
        );
      }
      if (check.pitchAmplitudeLoss > RK4_WARN_PITCH_AMPLITUDE_LOSS && !pitchLossWarned) {
        pitchLossWarned = true;
        warnings.add(
          `RK4 step check: the pitch oscillation advances up to ${check.pitchStepAngle.toFixed(2)} rad per step, so RK4 damps its amplitude numerically by about ${(check.pitchAmplitudeLoss * 100).toFixed(1)} % per step (D-063); apogee and velocities are not affected on the reference rockets, the oscillation history is. Use a step below ${((1.0 / derive(ctx, phase, t, y).derived.rates.pitchNatural) * 0.9).toPrecision(2)} s or the Dormand–Prince integrator for the oscillation.`,
        );
      }
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
      if (attempt.errorNorm > 1) {
        const f = derive(ctx, phase, t, y).derived.flight;
        throw new SimulationStalledError(
          t,
          `the Dormand–Prince error estimate is ${attempt.errorNorm.toExponential(2)} times the tolerance even at the minimum step of 1e-9 s (phase ${phase}${f === undefined ? '' : `, angle of attack ${(((f.angleOfAttack as number) * 180) / Math.PI).toFixed(1)}°`}); the state is changing discontinuously. Use the RK4 integrator with a fixed step or loosen the tolerance.`,
        );
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
    // F-2: apogee is the top of the flight in every airborne phase, also after a recovery device opened on the
    // way up (an early ejection charge); the apogee- and altitude-triggered devices depend on it.
    // (`deploy` sets 'descent' from a closure, which the compiler's narrowing of `phase` does not see.)
    if (isAirborne(phase) && !apogeeReached)
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
    // D-046: the angle-of-attack limit of the aerodynamic model, checked after the other events of the
    // step (apogee and a deployment at apogee take precedence, and a descent is drag-only).
    if (
      fired === undefined &&
      (phase === 'powered' || phase === 'coast') &&
      options.degreesOfFreedom === 6
    ) {
      const aoa = (yy: readonly number[]): number => {
        const f = sampleFlight(ctx, phase, t, yy);
        return f === undefined ? 0 : f.angleOfAttack;
      };
      // D-070: the DATCOM model continues through 180° below Mach 1; the 90° limit remains otherwise.
      const beyond = (yy: readonly number[]): boolean => {
        const f = sampleFlight(ctx, phase, t, yy);
        if (f === undefined || f.angleOfAttack <= AERO_MAX_ANGLE_OF_ATTACK) return false;
        return ctx.largeAngleMethod === 'linear' || (f.mach as number) >= 1;
      };
      if (beyond(y)) {
        // Already beyond the limit at the start of the step (a rocket falling tail-first from apogee).
        yNext = y;
        tNext = t;
        fired = { kind: 'model-limit', g: aoa };
      } else if (beyond(yNext)) {
        let lo = 0;
        let hi = hTry;
        let yHi = yNext;
        for (let i = 0; i < 80 && hi - lo > 1e-10; i++) {
          const mid = (lo + hi) / 2;
          const yMid = normaliseOrientation(stepOnce(mid).yNext);
          if (beyond(yMid)) {
            hi = mid;
            yHi = yMid;
          } else lo = mid;
        }
        yNext = yHi;
        tNext = t + hi;
        fired = { kind: 'model-limit', g: aoa };
      }
    }
    y = yNext;
    t = tNext;
    const s = unpack(y);
    const speed = norm(s.velocity);
    maxVelocity = Math.max(maxVelocity, speed);
    let liftoffNow = false;
    if (!liftedOff && speed > 0) {
      liftedOff = true;
      liftoffNow = true;
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
              // The crossing time, fixed now: `t` has moved on by the time the action runs.
              const crossing = t;
              if (delay <= 0)
                deploy(device, t, `descending through ${String(device.deploy.altitude)} m`);
              else
                timed.push({
                  time: crossing + delay,
                  kind: 'deployment',
                  detail: '',
                  action: () => {
                    deploy(
                      device,
                      crossing + delay,
                      `${String(delay)} s after ${String(device.deploy.altitude)} m`,
                    );
                  },
                });
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
        case 'model-limit': {
          stopped = true;
          endReason = 'model-limit';
          const f = sampleFlight(ctx, phase, t, y);
          const deg = f === undefined ? Number.NaN : ((f.angleOfAttack as number) * 180) / Math.PI;
          const supersonic = ctx.largeAngleMethod === 'datcom';
          events.push({
            kind: 'model-limit',
            time: seconds(t),
            detail: supersonic
              ? `angle of attack reached ${deg.toFixed(1)}° at Mach 1 or above, beyond the large-angle model (D-070); the flight is not continued`
              : `angle of attack reached ${deg.toFixed(1)}°, the 90° limit of the aerodynamic model; the flight is not continued (D-046)`,
          });
          warnings.add(
            supersonic
              ? `The flight ended at ${t.toFixed(3)} s because the angle of attack reached ${deg.toFixed(1)}° at Mach 1 or above: the large-angle model (DATCOM, D-070) covers fins beyond 90° only below Mach 1, and the DATCOM supersonic high-angle charts are not implemented. The rocket was flying backwards or tumbling at supersonic speed.`
              : `The flight ended at ${t.toFixed(3)} s because the angle of attack reached ${deg.toFixed(1)}°: the small-angle normal force model (Niskanen chapter 3, Barrowman fins as flat plates) is applied only up to 90° (D-046). The rocket was flying backwards or tumbling; a recovery device deploying at apogee avoids this.`,
          );
          break;
        }
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
    record(fired !== undefined || liftoffNow);
  }
  if (phase !== 'landed' && !stopped)
    events.push({
      kind: 'max-time',
      time: seconds(t),
      detail: `maximum simulation time ${String(maxTime)} s reached in phase ${phase}`,
    });
  // M-4: the charge was due after the flight ended (a delay longer than the flight), so its devices never opened.
  if (hasEjectionCharge && !events.some((e) => e.kind === 'ejection-charge')) {
    const due = motorBurn + (vehicle.motor.ejectionDelay as number);
    const ended =
      endReason === 'landing' ? `landed at ${t.toFixed(2)} s` : `ended at ${t.toFixed(2)} s`;
    for (const d of ejectionDevices) {
      if (deployed.has(d)) continue;
      warnings.add(
        `"${d.name}" is set to open at the motor's ejection charge, due at ${due.toFixed(2)} s, but the flight ${ended}, before the charge fired, so it never opened. Choose a shorter ejection delay; one that fires near apogee (${apogee === undefined ? 'not reached' : `${apogee.t.toFixed(2)} s, ${(apogee.t - motorBurn).toFixed(1)} s after burnout`}) is usual.`,
      );
    }
  }

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
    minimumStability: { powered: lowest.powered, coast: lowest.coast },
    flutter: flutterFins.map(({ index, fin }): FlutterMargin => {
      if (fin.shearModulus === undefined) {
        return {
          finIndex: index,
          ratio: undefined,
          reason: 'no shear modulus for the fin material',
        };
      }
      return (
        flutterLowest.get(index) ?? {
          finIndex: index,
          ratio: undefined,
          reason: 'no powered or coasting flight with aerodynamics',
        }
      );
    }),
  };
  for (const f of summary.flutter) {
    if (f.ratio === undefined) {
      if (f.reason.startsWith('no shear modulus'))
        warnings.add(
          `Fin flutter not checked for the fin set at component ${String(f.finIndex)}: enter the fin material's shear modulus (NACA TN 4197).`,
        );
    } else if (f.ratio < 1) {
      warnings.add(
        `Fin flutter: the fin set at component ${String(f.finIndex)} reaches ${f.airspeed.toFixed(0)} m/s at t = ${f.time.toFixed(2)} s (Mach ${f.mach.toFixed(2)}), above its NACA TN 4197 flutter speed of ${f.flutterVelocity.toFixed(0)} m/s there: the fins may flutter and fail. Thicker fins, a stiffer material, a smaller span or a slower flight raise the margin.`,
      );
    }
  }
  for (const [name, p] of [
    ['powered flight', lowest.powered],
    ['coast', lowest.coast],
  ] as const) {
    if (p !== undefined && p.calibers < minimumMargin) {
      warnings.add(
        `In-flight stability margin fell to ${p.calibers.toFixed(2)} calibers during ${name} (t = ${p.time.toFixed(2)} s, Mach ${p.mach.toFixed(2)}, angle of attack ${((p.angleOfAttack * 180) / Math.PI).toFixed(1)}°), below the ${minimumMargin.toFixed(2)} caliber minimum: the rocket may not fly straight there. The margin uses the CP at that Mach number and angle of attack (plan 0030).`,
      );
    }
  }
  return {
    samples,
    events,
    summary,
    warnings: [...warnings],
    modes: {
      dragCurve: options.dragCurve?.label,
      aerodynamics: options.aerodynamics,
      finRollReduction: options.finRollReduction,
      baseDragMotorRule: options.baseDragMotorRule,
      integrator:
        options.integrator.kind === 'rk4'
          ? `RK4 fixed step ${String(options.integrator.timeStep)} s`
          : `Dormand–Prince RK5(4) rtol ${String(options.integrator.relativeTolerance)} atol ${String(options.integrator.absoluteTolerance)}`,
      degreesOfFreedom: options.degreesOfFreedom,
      gravitySeaLevel: seaLevelGravity(options.gravity),
      windSeed: options.wind.kind === 'turbulent' ? options.wind.seed : undefined,
      largeAngleMethod: ctx.largeAngleMethod,
    },
    stepCheck,
  };
}
