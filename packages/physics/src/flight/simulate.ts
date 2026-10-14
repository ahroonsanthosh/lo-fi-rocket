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
import {
  clusterApproximations,
  componentApproximations,
  confidenceOf,
  type Approximation,
  type Confidence,
} from '../fidelity.js';
import { atmosphereModel, type StandardAtmosphereState } from '../atmosphere/ussa1976.js';
import { flutterGeometry, flutterVelocity } from '../stability/flutter.js';
import { dragCoefficient } from '../drag/drag.js';
import { validateLaunch } from '../environment/launch.js';
import { windField, type WindField } from '../environment/wind.js';
import {
  IntegrationUnstableError,
  InvalidInputError,
  NonFiniteResultError,
  PhysicsError,
  SimulationStalledError,
} from '../errors.js';
import {
  clusterSums,
  combineRocket,
  combineRocketMotors,
  structuralMassParts,
  type MotorMass,
  type PlacedComponent,
} from '../geometry/assembly.js';
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
  SUPERSONIC_REVERSE_FLOW_WARNING,
  type LargeAngleMethod,
} from './aerodynamics.js';
import {
  finLargeAngleApproximation,
  finLargeAngleAvailability,
  isLargeAngleApproximationWarning,
} from '../stability/datcom-large-angle.js';
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
  type MotorSource,
  type RecoveryDevice,
  type SeparationEvent,
  type SimulationOptions,
  type StageSeparation,
  type VehicleStages,
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
  | 'model-limit'
  // Plan 0064: a staged vehicle's motor ignitions and stage separations.
  | 'ignition'
  | 'separation';

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
  /**
   * When the motor's ejection charge fired, the airspeed |v − v_wind| and the
   * vertical velocity (positive up) at that instant; undefined when it did not
   * fire (plugged motor, or the flight ended first). Issue #9: without an
   * altimeter the charge is the deployment, whatever the devices are set to.
   */
  readonly ejectionCharge:
    | { readonly time: number; readonly airspeed: number; readonly verticalVelocity: number }
    | undefined;
  /**
   * Issue #17: the most negative stability margin of powered flight and coast
   * (CP ahead of the CG), or undefined when the margin stayed at 0 or above.
   * When set, the result's first warning says that the rocket is unstable and
   * that the flight shown is not a prediction.
   */
  readonly unstable: StabilityPoint | undefined;
  /**
   * The flight regimes met in powered flight and coast (issue #19): Mach 0.8 to 1.2, 1.2 to 2, above 2,
   * and angle of attack above 60°. The design warnings turn these into plain messages; the model's
   * technical notes on each are in `FlightResult.notes`.
   */
  readonly regimes: {
    readonly transonic: boolean;
    readonly supersonic: boolean;
    readonly beyondValidated: boolean;
    readonly largeAngle: boolean;
  };
  /**
   * 'model-limit': the flight left the aerodynamic model's angle-of-attack range (D-046) and was not
   * continued. 'no-ignition': no motor lit at launch or was due to light, so the rocket stayed on the
   * pad (plan 0064 part 2).
   */
  readonly endReason: 'landing' | 'max-time' | 'model-limit' | 'no-ignition';
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
  /**
   * What the user should know about this flight, one plain sentence or two each, saying what it means and
   * what to do (CLAUDE.md 9, issue #19). No decision or chart references.
   */
  readonly warnings: readonly string[];
  /**
   * Technical notes on the models used (chart limits, fairings, reading uncertainty, sources and decision
   * IDs), for a "details" view. They do not change what the user should do; the warnings carry that.
   */
  readonly notes: readonly string[];
  /**
   * Everything this flight did not model exactly, with the method used instead and its effect
   * (D-083, CLAUDE.md 1 rule 3), and the overall confidence they give.
   */
  readonly approximations: readonly Approximation[];
  readonly confidence: Confidence;
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

/**
 * One motor during a run. A one-stage vehicle has one, ignited at launch; a staged vehicle has one
 * per entry of its `stages.motors` (plan 0064), ignited by its event.
 */
interface MotorRuntime {
  readonly source: MotorSource;
  readonly stage: number;
  /** For events and messages; empty for a one-stage vehicle's motor. */
  readonly label: string;
  readonly burn: number;
  ignitedAt: number | undefined;
  /** Set by the burnout event so that no integrator stage evaluated at exactly t_burn sees thrust. */
  burnedOut: boolean;
  /** False once the motor's stage has separated. */
  attached: boolean;
}

/** The parts still attached (plan 0064): all of them for a one-stage vehicle. */
interface Configuration {
  components: readonly PlacedComponent[];
  /** Index of each attached part in the vehicle's `components`. */
  indices: ReadonlySet<number>;
  structure: readonly MassProperties[];
  rocketLength: number;
  referenceDiameter: number;
}

interface Context {
  readonly vehicle: FlightVehicle;
  readonly options: SimulationOptions;
  readonly atmosphere: (z: Metres) => StandardAtmosphereState;
  readonly railDirection: Vec3;
  readonly railLength: number;
  /** Changed only by a stage separation. */
  readonly config: Configuration;
  readonly motors: readonly MotorRuntime[];
  /** The wind for this flight (ENV-1, ENV-3 to ENV-5), built once so every stage reads the same gust. */
  readonly wind: WindField;
  readonly deployedArea: { area: number }; // Σ C_D A of deployed devices (mutable through the run)
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

/** A motor's mass at time t of the flight; unignited motors are loaded (plan 0064). */
function motorMass(motor: MotorRuntime, t: number): MotorMass | undefined {
  const m = motor.source;
  if (m.kind !== 'definition') return undefined;
  const since = motor.ignitedAt === undefined ? 0 : Math.max(0, t - motor.ignitedAt);
  const one = motorMassAt(m.definition, seconds(since), m.aftEnd);
  return m.cluster === undefined ? one : { ...one, cluster: m.cluster };
}

/** GEO-12: the attached parts and every attached motor (plan 0064); one motor exactly as before. */
function rocketMass(ctx: Context, t: number): ReturnType<typeof combineRocket> {
  const masses: MotorMass[] = [];
  for (const motor of ctx.motors) {
    if (!motor.attached) continue;
    const m = motorMass(motor, t);
    if (m !== undefined) masses.push(m);
  }
  return masses.length <= 1
    ? combineRocket(ctx.config.structure, masses[0])
    : combineRocketMotors(ctx.config.structure, masses);
}

/** One motor's thrust at time t of the flight: 0 before its ignition, after its burnout or once separated. */
function motorThrust(motor: MotorRuntime, t: number): number {
  if (!motor.attached || motor.burnedOut || motor.ignitedAt === undefined) return 0;
  const m = motor.source;
  const since = t - motor.ignitedAt;
  if (m.kind === 'ideal') return since >= 0 && since <= m.burnTime ? m.thrust : 0;
  // Plan 0057: a cluster's motors ignite together; their offsets are centred (or listed when not),
  // so the thrust is n times one motor's, along the axis.
  const one = thrustAt(m.definition, seconds(Math.max(0, since)));
  return m.cluster === undefined ? one : m.cluster.length * one;
}

/** The motor at the aft end of the attached vehicle: the lowest attached stage's (base drag, D-035). */
function baseMotor(ctx: Context): MotorRuntime | undefined {
  let base: MotorRuntime | undefined;
  for (const motor of ctx.motors) {
    if (!motor.attached || motor.source.kind !== 'definition') continue;
    if (base === undefined || motor.stage > base.stage) base = motor;
  }
  return base;
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
  const mp = rocketMass(ctx, t);
  const m: number = mp.mass;
  const g = gravityAt(ctx.options.gravity, metres(altitudeAsl));
  const weight = vec3(0, 0, -m * g);
  const warnings: string[] = [];

  let forceWorld = weight;
  let momentBody: Vec3 = vec3(0, 0, 0);
  const gated = phase === 'descent' || phase === 'landed';
  let thrust = 0;
  for (const motor of ctx.motors) thrust += gated ? 0 : motorThrust(motor, t);
  const base = baseMotor(ctx);
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
      referenceLength: metres(ctx.config.rocketLength),
    });
    // D-035: the base drag depends on whether the motor at the aft end is thrusting.
    const thrusting =
      ctx.motors.length === 1 ? thrust > 0 : base !== undefined && motorThrust(base, t) > 0;
    if (ctx.options.dragCurve !== undefined) {
      cd0 = dragCurveAt(ctx.options.dragCurve, flight.mach);
    } else {
      const baseCount =
        base?.source.kind === 'definition' ? clusterSums(base.source.cluster).count : 1;
      const drag = dragCoefficient({
        components: ctx.config.components,
        mach: flight.mach,
        reynolds: flight.reynolds,
        roughnessHeight: ctx.vehicle.roughnessHeight,
        ...(base?.source.kind !== 'definition'
          ? {}
          : {
              motor: {
                diameter: base.source.definition.diameter,
                thrusting,
                ...(baseCount === 1 || ctx.options.baseDragClusterMotors === 'one'
                  ? {}
                  : { count: baseCount }),
              },
            }),
        baseDragMotorRule: ctx.options.baseDragMotorRule,
        ...(ctx.options.baseDragMethod === undefined
          ? {}
          : { baseDragMethod: ctx.options.baseDragMethod }),
        referenceDiameter: metres(ctx.config.referenceDiameter),
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
          (((-(flight.dynamicPressure as number) * (Math.PI * ctx.config.referenceDiameter ** 2)) /
            4) *
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
        components: ctx.config.components,
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
          referenceDiameter: metres(ctx.config.referenceDiameter),
          largeAngleMethod: ctx.largeAngleMethod,
        },
      });
      warnings.push(...aero.warnings);
      forceWorld = add(forceWorld, bodyToWorld(q, aero.forceBody));
      momentBody = aero.momentBody;
      aeroForce = norm(aero.forceBody);
      cp = aero.cp;
      // DYN-17: the linearised rates for the step check.
      const aRef = (Math.PI * ctx.config.referenceDiameter ** 2) / 4;
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
  /** The motor whose burnout or charge this is; dropped if its stage separates first (plan 0064). */
  readonly owner?: MotorRuntime;
}

/**
 * D-070: the large-angle method in effect for a flight. 'datcom' needs every
 * fin set's cross-section (HA-5); without one the small-angle model and the
 * 90° limit (D-046) apply, with a warning naming the reason. Single wedges
 * and high aspect ratios are approximated and listed instead (D-102).
 */
function effectiveLargeAngleMethod(
  vehicle: FlightVehicle,
  options: SimulationOptions,
  notes: Set<string>,
): LargeAngleMethod {
  const requested = options.largeAngleMethod ?? DEFAULT_LARGE_ANGLE_METHOD;
  if (requested === 'linear') return 'linear';
  for (const p of vehicle.components) {
    if (p.component.kind !== 'finSet') continue;
    const av = finLargeAngleAvailability(p.component);
    if (!av.available) {
      notes.add(
        `The large-angle model (DATCOM, D-070) does not cover this fin set: ${av.reason}. The small-angle model is used instead, and the flight ends if the angle of attack passes 90° (D-046).`,
      );
      return 'linear';
    }
  }
  return 'datcom';
}

/**
 * Plan 0066 (D-102): the fin sets whose large-angle normal force (DATCOM, D-070) is approximated:
 * a single-wedge section or an aspect ratio above the low-aspect-ratio limit. Listed in the
 * displayed mode only; the OpenRocket-equivalent mode keeps the small-angle model and its limit.
 * Plan 0067 (D-103): minor while the flight stays below the stall, where the fin keeps its
 * validated slope; moderate once it went past the stall of an approximated fin set.
 */
function largeAngleApproximations(
  vehicle: FlightVehicle,
  method: LargeAngleMethod,
  beyondStall: boolean,
): Approximation[] {
  if (method !== 'datcom') return [];
  return vehicle.components.flatMap((p, i) => {
    if (p.component.kind !== 'finSet') return [];
    const reason = finLargeAngleApproximation(p.component);
    if (reason === undefined) return [];
    const name = vehicle.componentNames?.[i];
    return [
      {
        subject: `Fin set${name === undefined || name === '' ? '' : ` "${name}"`}`,
        what: 'its normal force beyond the stall, and past 90° when the rocket tumbles',
        method: reason,
        ...(beyondStall
          ? {
              effect:
                'this flight went past the fins’ stall (tumbling, flying backward or at a steep angle), so its path and landing point depend on the approximated force',
              impact: 'moderate' as const,
            }
          : {
              effect:
                'small: this flight stayed below the fins’ stall, where they keep their validated slope',
              impact: 'minor' as const,
            }),
      },
    ];
  });
}

/** Plan 0067 (D-103): tumbling or flying backward at Mach 1 or above, listed when a flight did it. */
const SUPERSONIC_REVERSE_FLOW_APPROXIMATION: Approximation = {
  subject: 'The rocket',
  what: 'the fin normal force while tumbling or flying backward above Mach 1',
  method:
    'the small-angle supersonic fin force (Niskanen eq. 3.49) applied to the reversed fin, at the reversed planform’s centre of pressure; no sourced method covers this (the DATCOM supersonic high-angle method is for 0 to 90°)',
  effect:
    'the tumbling motion, the path and the landing point are uncertain; the small-angle force over-predicts the fin force near 90°',
  impact: 'major',
};

/** Plan 0064 (D-091): what a staged flight does not model exactly, listed with its result (rule 3). */
export function stagingApproximations(stageCount: number): Approximation[] {
  if (stageCount < 2) return [];
  return [
    {
      subject: 'Stage separation',
      what: 'the separation itself',
      method:
        'instantaneous: the separated stages leave the vehicle at the separation event, with no separation impulse and no gap in time',
      effect:
        'a spring or charge that pushes the stages apart, or a slow separation, is not represented; the upper stage’s flight is otherwise unchanged',
      impact: 'minor',
    },
    {
      subject: 'Stage separation',
      what: 'the separated stages’ own flight',
      method:
        'not simulated (a version-1 non-goal, D-091): only the vehicle that flies on is followed',
      effect:
        'nothing on the upper stage’s flight; the booster’s apogee, descent and landing point are not given',
      impact: 'minor',
    },
    {
      subject: 'Stage separation',
      what: 'the airflow between the stages just before and after separation',
      method:
        'each configuration is the attached parts alone, with Niskanen’s component aerodynamics',
      effect: 'interstage interference on drag and stability is not represented; it is short-lived',
      impact: 'minor',
    },
  ];
}

/** Plan 0064 part 2: a separation event in words, with its delay ("1.5 s after its motor's burnout"). */
function separationInWords(sep: StageSeparation): string {
  const altitude = sep.altitude === undefined ? '' : `${(sep.altitude as number).toFixed(1)} m`;
  const event: Record<SeparationEvent, string> = {
    'upper-ignition': 'the ignition of the stage above it',
    ignition: 'its own motor’s ignition',
    burnout: 'its own motor’s burnout',
    ejection: 'its own motor’s ejection charge',
    launch: 'launch',
    apogee: 'apogee',
    'altitude-ascending': `climbing through ${altitude} above the pad`,
    'altitude-descending': `descending through ${altitude} above the pad`,
    never: 'never',
  };
  const delay: number = sep.delay;
  return delay > 0 ? `${String(delay)} s after ${event[sep.event]}` : `at ${event[sep.event]}`;
}

/**
 * Plan 0064 part 2 (rule 3): a motor that was due to ignite and never did, and a stage that was due
 * to separate and never did, change the flight in kind; each is said with its reason.
 */
function stagingWarnings(
  stages: VehicleStages,
  motors: readonly MotorRuntime[],
  separated: ReadonlySet<number>,
  stageName: (k: number) => string,
  ended: string,
): string[] {
  const out: string[] = [];
  stages.motors.forEach((m, i) => {
    const rt = motors[i];
    if (rt === undefined || rt.ignitedAt !== undefined || m.ignition.event === 'never') return;
    const of = m.ignition.of === undefined ? undefined : motors[m.ignition.of];
    let reason: string;
    if (!rt.attached) reason = `${stageName(m.stage)} separated before it was due`;
    else if (m.ignition.event === 'launch') {
      reason = `it was due ${String(m.ignition.delay)} s after launch, but ${ended} first`;
    } else if (of?.ignitedAt === undefined) {
      reason = `it is set to ignite at the ${m.ignition.event === 'burnout' ? 'burnout' : 'ejection charge'} of ${of?.label ?? 'another motor'}, which never ignited`;
    } else if (
      m.ignition.event === 'ejection' &&
      (of.source.kind !== 'definition' || of.source.ejectionDelay === undefined)
    ) {
      reason = `it is set to ignite at the ejection charge of ${of.label}, which is plugged (it has no ejection charge)`;
    } else {
      reason = `it is set to ignite ${m.ignition.delay > 0 ? `${String(m.ignition.delay)} s after` : 'at'} the ${m.ignition.event === 'burnout' ? 'burnout' : 'ejection charge'} of ${of.label}, but ${ended} first`;
    }
    out.push(
      `${rt.label} never ignited: ${reason}. The flight shown is without its thrust${rt.attached ? ', carrying the unburnt motor as dead weight' : ''}; check its ignition event.`,
    );
  });
  stages.separation.forEach((sep, k) => {
    if (k === 0 || sep.event === 'never' || separated.has(k)) return;
    out.push(
      `${stageName(k)} never separated: it is set to separate ${separationInWords(sep)}, which did not happen before ${ended}. The flight shown carries it, with its mass and drag, to the end.`,
    );
  });
  return out;
}

/** Plan 0064: the stages of a vehicle must describe it consistently; plain messages otherwise. */
function validateStages(vehicle: FlightVehicle): void {
  const st = vehicle.stages;
  if (st === undefined) return;
  const n = st.separation.length;
  if (!(n >= 1)) throw new InvalidInputError('number of stages', n, 'must be at least 1');
  const stageOk = (k: number): boolean => Number.isInteger(k) && k >= 0 && k < n;
  if (st.componentStage.length !== vehicle.components.length) {
    throw new InvalidInputError(
      'stage list of the parts',
      st.componentStage.length,
      `must give a stage for each of the ${String(vehicle.components.length)} parts`,
    );
  }
  st.componentStage.forEach((k, i) => {
    if (!stageOk(k)) {
      throw new InvalidInputError(
        `stage of part ${String(i)}`,
        k,
        `must be a stage from 0 to ${String(n - 1)}`,
      );
    }
  });
  if (!st.componentStage.includes(0)) {
    throw new InvalidInputError('top stage', 0, 'must hold at least one part');
  }
  if (st.motors.length === 0) {
    throw new InvalidInputError('motors of the stages', 0, 'at least one motor is required');
  }
  st.motors.forEach((m, i) => {
    validateMotor(m.motor.definition);
    if (!stageOk(m.stage)) {
      throw new InvalidInputError(
        `stage of motor ${String(i + 1)}`,
        m.stage,
        `must be a stage from 0 to ${String(n - 1)}`,
      );
    }
    const delay: number = m.ignition.delay;
    if (!Number.isFinite(delay) || delay < 0) {
      throw new InvalidInputError(
        `ignition delay of motor ${String(i + 1)}`,
        delay,
        'must be 0 s or more',
      );
    }
    if (m.ignition.event === 'burnout' || m.ignition.event === 'ejection') {
      const of = m.ignition.of;
      if (
        of === undefined ||
        !Number.isInteger(of) ||
        of < 0 ||
        of >= st.motors.length ||
        of === i
      ) {
        throw new InvalidInputError(
          `ignition of motor ${String(i + 1)}`,
          of ?? Number.NaN,
          `must name another motor (1 to ${String(st.motors.length)}) whose ${m.ignition.event === 'burnout' ? 'burnout' : 'ejection charge'} ignites it`,
        );
      }
    }
  });
  st.separation.forEach((sep, k) => {
    if (k === 0) return;
    const delay: number = sep.delay;
    if (!Number.isFinite(delay) || delay < 0) {
      throw new InvalidInputError(
        `separation delay of stage ${String(k + 1)}`,
        delay,
        'must be 0 s or more',
      );
    }
    if (sep.event === 'altitude-ascending' || sep.event === 'altitude-descending') {
      const altitude = sep.altitude === undefined ? Number.NaN : (sep.altitude as number);
      if (!Number.isFinite(altitude) || altitude <= 0) {
        throw new InvalidInputError(
          `separation altitude of stage ${String(k + 1)}`,
          altitude,
          'must be greater than 0 m above the pad',
        );
      }
    }
  });
  if (st.recoveryStage !== undefined) {
    if (st.recoveryStage.length !== vehicle.recovery.length) {
      throw new InvalidInputError(
        'stage list of the recovery devices',
        st.recoveryStage.length,
        `must give a stage for each of the ${String(vehicle.recovery.length)} devices`,
      );
    }
    st.recoveryStage.forEach((k, i) => {
      if (!stageOk(k)) {
        throw new InvalidInputError(
          `stage of recovery device ${String(i + 1)}`,
          k,
          `must be a stage from 0 to ${String(n - 1)}`,
        );
      }
    });
  }
}

/** Run the simulation. */
export function simulateFlight(vehicle: FlightVehicle, options: SimulationOptions): FlightResult {
  const launch = validateLaunch(options.site, options.rail);
  const warnings = new Set<string>(launch.warnings.map((w) => w.message));
  // Issue #19: model provenance goes to the notes; the warnings say what matters and what to do.
  const notes = new Set<string>();
  const finName = (index: number): string => {
    const name = vehicle.componentNames?.[index];
    return name === undefined || name === ''
      ? `the fin set (component ${String(index)})`
      : `"${name}"`;
  };
  const regimes = {
    transonic: false,
    supersonic: false,
    beyondValidated: false,
    largeAngle: false,
  };
  const used = { supersonicReverseFlow: false, approximatedFinBeyondStall: false };
  const stages = vehicle.stages;
  if (stages === undefined) {
    if (vehicle.motor.kind === 'definition') validateMotor(vehicle.motor.definition);
  } else {
    validateStages(vehicle);
  }
  const maxTime: number = options.maxTime;
  if (!(maxTime > 0))
    throw new InvalidInputError('maximum simulation time', maxTime, 'must be greater than 0 s');
  if (options.dragCurve !== undefined) validateDragCurve(options.dragCurve);
  validateComponentFit(vehicle.components);
  const configuration = (indices: ReadonlySet<number>): Configuration => {
    const components = vehicle.components.filter((_, i) => indices.has(i));
    return {
      components,
      indices,
      structure: structuralMassParts(components),
      rocketLength: components.reduce((s, p) => {
        const c = p.component;
        return c.kind === 'noseCone' || c.kind === 'bodyTube' || c.kind === 'transition'
          ? s + (c.length as number)
          : s;
      }, 0),
      referenceDiameter: vehicle.referenceDiameter ?? maximumBodyDiameter(components),
    };
  };
  const config = configuration(new Set(vehicle.components.map((_, i) => i)));
  const burnOf = (m: MotorSource): number =>
    m.kind === 'definition' ? burnTime(m.definition) : m.burnTime;
  const motors: MotorRuntime[] =
    stages === undefined
      ? [
          {
            source: vehicle.motor,
            stage: 0,
            label: '',
            burn: burnOf(vehicle.motor),
            ignitedAt: undefined,
            burnedOut: false,
            attached: true,
          },
        ]
      : stages.motors.map((m, i) => ({
          source: m.motor,
          stage: m.stage,
          label: m.name ?? `Motor ${String(i + 1)}`,
          burn: burnOf(m.motor),
          ignitedAt: undefined,
          burnedOut: false,
          attached: true,
        }));
  // The burn that the launch checks refer to: the one motor's, or the longest of those lit at launch.
  const motorBurn =
    stages === undefined
      ? burnOf(vehicle.motor)
      : stages.motors.reduce(
          (b, m, i) =>
            m.ignition.event === 'launch'
              ? Math.max(b, (motors[i]?.burn ?? 0) + (m.ignition.delay as number))
              : b,
          0,
        );
  // Issue #32, D-075: a device open while the motor still burns would need thrust and canopy drag together;
  // the descent model (DYN-14, Niskanen §4.2.5 pp. 67 to 68) has the canopy drag and gravity only, and the
  // flight would silently stay on the pad. Refused with a plain message instead.
  for (const d of vehicle.recovery) {
    if (d.deploy.event !== 'launch') continue;
    const at: number = d.deploy.delay;
    if (at < motorBurn) {
      throw new InvalidInputError(
        `"${d.name}" deployment time`,
        at,
        `the parachute would open ${at > 0 ? `${at.toFixed(2)} s after launch` : 'at launch'}, while the motor is still burning (burnout at ${motorBurn.toFixed(2)} s), and flight with a parachute open under thrust is not modelled. Set it to open at apogee, at the motor's ejection charge, at an altitude, or at least ${motorBurn.toFixed(2)} s after launch`,
      );
    }
  }
  const ctx: Context = {
    vehicle,
    options,
    atmosphere: atmosphereModel(options.atmosphere),
    railDirection: launch.railDirection,
    railLength: options.rail.length,
    config,
    motors,
    deployedArea: { area: 0 },
    wind: windField(options.wind, maxTime),
    largeAngleMethod: effectiveLargeAngleMethod(vehicle, options, notes),
  };
  // Plan 0064: the stage of each recovery device; the devices of a separated stage leave with it.
  const deviceStage = (i: number): number => stages?.recoveryStage?.[i] ?? 0;
  const activeRecovery = new Set<RecoveryDevice>(vehicle.recovery);
  const stageName = (k: number): string => stages?.names?.[k] ?? `stage ${String(k + 1)}`;

  // M-4: a device on the ejection charge needs a charge. A plugged motor (no delay) or the ideal motor of the
  // analytical cases has none, so the device can never open; say so before the flight, not only after it.
  const ejectionDevices = vehicle.recovery.filter((d) => d.deploy.event === 'ejection');
  const hasEjectionCharge =
    vehicle.motor.kind === 'definition' && vehicle.motor.ejectionDelay !== undefined;
  if (stages === undefined) {
    if (!hasEjectionCharge) {
      for (const d of ejectionDevices) {
        warnings.add(
          `"${d.name}" is set to open at the motor's ejection charge, but ${vehicle.motor.kind === 'ideal' ? 'this motor model has no ejection charge' : 'the motor is plugged (it has no ejection delay)'}, so it never opens and the rocket comes down without it. Set it to open at apogee or at an altitude (with an altimeter), or choose a motor with an ejection delay.`,
        );
      }
    }
  } else {
    vehicle.recovery.forEach((d, i) => {
      if (d.deploy.event !== 'ejection') return;
      const charged = motors.some(
        (m) =>
          m.stage === deviceStage(i) &&
          m.source.kind === 'definition' &&
          m.source.ejectionDelay !== undefined,
      );
      if (!charged) {
        warnings.add(
          `"${d.name}" is set to open at the ejection charge of its stage's motor, but no motor of ${stageName(deviceStage(i))} has an ejection charge, so it never opens and that stage comes down without it. Set it to open at apogee or at an altitude, or give the motor an ejection delay.`,
        );
      }
    });
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
  let ejectionCharge: FlightSummary['ejectionCharge'];
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
  const scheduleDeployments = (
    trigger: RecoveryDevice['deploy']['event'],
    at: number,
    stage?: number,
  ): void => {
    for (const [i, device] of vehicle.recovery.entries()) {
      if (device.deploy.event !== trigger || deployed.has(device)) continue;
      if (!activeRecovery.has(device)) continue;
      // Plan 0064: an ejection charge opens the devices of its own stage only.
      if (stage !== undefined && stages !== undefined && deviceStage(i) !== stage) continue;
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

  const thrustingNow = (): boolean =>
    motors.some((m) => m.attached && m.ignitedAt !== undefined && !m.burnedOut);
  // Plan 0064: the top stage's motor burnout, for the ejection-delay advice of issue #9.
  let topBurnout: number | undefined;
  const separated = new Set<number>();
  /** Separate stage k: it and every stage below it leave the vehicle (plan 0064, D-091). */
  const separate = (k: number, at: number, why: string): void => {
    if (stages === undefined || k <= 0 || separated.has(k)) return;
    for (let j = k; j < stages.separation.length; j++) separated.add(j);
    const before = rocketMass(ctx, at).mass;
    for (const m of motors) if (m.stage >= k) m.attached = false;
    // The burnouts and charges still due of the motors that left are no longer events of this flight.
    for (let i = timed.length - 1; i >= 0; i--) {
      const owner = timed[i]?.owner;
      if (owner !== undefined && !owner.attached) timed.splice(i, 1);
    }
    const keep = new Set<number>();
    stages.componentStage.forEach((st, i) => {
      if (st < k) keep.add(i);
    });
    Object.assign(ctx.config, configuration(keep));
    vehicle.recovery.forEach((d, i) => {
      if (deviceStage(i) < k || !activeRecovery.has(d)) return;
      activeRecovery.delete(d);
      if (deployed.has(d)) {
        ctx.deployedArea.area -= (d.dragCoefficient * Math.PI * (d.diameter as number) ** 2) / 4;
      }
    });
    if (phase === 'powered' && !thrustingNow()) phase = 'coast';
    const after = rocketMass(ctx, at).mass;
    events.push({
      kind: 'separation',
      time: seconds(at),
      detail: `${stageName(k)} separated (${why}); ${(before - after).toFixed(4)} kg left the vehicle, ${after.toFixed(4)} kg flies on`,
    });
  };
  /** Separate stage k after its delay from the event at `at`. */
  const scheduleSeparation = (k: number, sep: StageSeparation, at: number, why: string): void => {
    const when = at + (sep.delay as number);
    timed.push({
      time: when,
      kind: 'separation',
      detail: '',
      action: () => {
        separate(k, when, (sep.delay as number) > 0 ? `${String(sep.delay)} s after ${why}` : why);
      },
    });
  };
  const scheduleSeparations = (
    event: SeparationEvent,
    stage: number | undefined,
    at: number,
    why: string,
  ): void => {
    stages?.separation.forEach((sep, k) => {
      if (k === 0 || sep.event !== event || (stage !== undefined && k !== stage)) return;
      scheduleSeparation(k, sep, at, why);
    });
  };
  // Plan 0064 part 2: the stages whose separation altitude has been crossed.
  const altitudeTriggered = new Set<number>();
  /** Whether stage k waits for an altitude crossing now: climbing before apogee, descending after. */
  const altitudeSeparationDue = (sep: StageSeparation, k: number): boolean =>
    k > 0 &&
    !separated.has(k) &&
    !altitudeTriggered.has(k) &&
    sep.altitude !== undefined &&
    (sep.event === 'altitude-ascending'
      ? !apogeeReached
      : sep.event === 'altitude-descending' && apogeeReached);
  /** Ignite a motor and schedule its burnout and ejection charge (Niskanen Table 4.2 p. 69). */
  const ignite = (index: number, at: number, why: string): void => {
    const m = motors[index];
    if (m === undefined || !m.attached || m.ignitedAt !== undefined) return;
    m.ignitedAt = at;
    if (stages !== undefined) {
      events.push({ kind: 'ignition', time: seconds(at), detail: `${m.label} ignition (${why})` });
      if (phase === 'coast') phase = 'powered';
      // The stage below the igniting one, or its own stage, separates at this ignition when set to.
      scheduleSeparations('upper-ignition', m.stage + 1, at, `${m.label} ignition`);
      scheduleSeparations('ignition', m.stage, at, `${m.label} ignition`);
    }
    const tB = at + m.burn;
    if (m.stage === 0) topBurnout = tB;
    timed.push({
      owner: m,
      time: tB,
      kind: 'burnout',
      detail:
        stages === undefined
          ? `motor burnout at ${String(motorBurn)} s`
          : `${m.label} burnout at ${tB.toFixed(3)} s`,
      action: () => {
        if (!m.attached) return;
        m.burnedOut = true;
        if (phase === 'powered' && !thrustingNow()) phase = 'coast';
        stages?.motors.forEach((other, j) => {
          if (other.ignition.event === 'burnout' && other.ignition.of === index) {
            timed.push({
              time: tB + (other.ignition.delay as number),
              kind: 'ignition',
              detail: '',
              action: () => {
                ignite(j, tB + (other.ignition.delay as number), `${m.label} burnout`);
              },
            });
          }
        });
        scheduleSeparations('burnout', m.stage, tB, `${m.label} burnout`);
      },
    });
    const source = m.source;
    if (source.kind === 'definition' && source.ejectionDelay !== undefined) {
      const tE = tB + (source.ejectionDelay as number);
      timed.push({
        owner: m,
        time: tE,
        kind: 'ejection-charge',
        detail:
          stages === undefined
            ? `ejection charge at ${tE.toFixed(3)} s`
            : `${m.label} ejection charge at ${tE.toFixed(3)} s`,
        action: () => {
          if (!m.attached) return;
          const st = unpack(y);
          // With stages, the summary's charge is the top stage's: a lower stage's charge lights or
          // separates the stage above and is meant to fire while climbing (plan 0064).
          if (stages === undefined || m.stage === 0) {
            ejectionCharge = {
              time: tE,
              airspeed: norm(sub(st.velocity, ctx.wind(st.position.z, tE))),
              verticalVelocity: st.velocity.z,
            };
          }
          scheduleDeployments('ejection', tE, m.stage);
          stages?.motors.forEach((other, j) => {
            if (other.ignition.event === 'ejection' && other.ignition.of === index) {
              timed.push({
                time: tE + (other.ignition.delay as number),
                kind: 'ignition',
                detail: '',
                action: () => {
                  ignite(j, tE + (other.ignition.delay as number), `${m.label} ejection charge`);
                },
              });
            }
          });
          scheduleSeparations('ejection', m.stage, tE, `${m.label} ejection charge`);
        },
      });
    }
  };

  events.push({ kind: 'launch', time: seconds(0), detail: 'ignition at t = 0' });
  scheduleDeployments('launch', 0);
  if (stages === undefined) {
    ignite(0, 0, 'launch');
  } else {
    stages.motors.forEach((m, i) => {
      if (m.ignition.event !== 'launch') return;
      const at: number = m.ignition.delay;
      if (at <= 0) ignite(i, 0, 'launch');
      else
        timed.push({
          time: at,
          kind: 'ignition',
          detail: '',
          action: () => {
            ignite(i, at, `${String(at)} s after launch`);
          },
        });
    });
    scheduleSeparations('launch', undefined, 0, 'launch');
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
        ctx.config.components,
        f.mach,
        f.angleOfAttack,
        f.lateralAirflowAngle,
        {
          finRollReduction: options.finRollReduction,
          referenceDiameter: metres(ctx.config.referenceDiameter),
          largeAngleMethod: 'linear',
        },
      ).cp;
      if (linear < cp) {
        cp = linear;
        model = 'linear';
      }
    }
    // Plan 0030: the ascent only (rail exit to apogee). A rocket with no open recovery device stays in
    // 'coast' after apogee; its fall is not flight along the stability axis and must not count, or a
    // stable rocket falling tail first would be reported unstable (issue #17).
    if (
      (phase === 'powered' || phase === 'coast') &&
      !apogeeReached &&
      Number.isFinite(cp) &&
      (f === undefined || (f.angleOfAttack as number) <= AERO_MAX_ANGLE_OF_ATTACK)
    ) {
      const calibers = (cp - derived.cg) / ctx.config.referenceDiameter;
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
        // Plan 0064: the fins of a separated stage are no longer flying with the vehicle.
        if (!ctx.config.indices.has(index)) continue;
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
    // Issue #19: the regimes met, for one plain warning each at the end (every accepted ascent step).
    if (derived.flight !== undefined && (phase === 'powered' || phase === 'coast')) {
      const m: number = derived.flight.mach;
      if (m >= 0.8 && m <= 1.2) regimes.transonic = true;
      else if (m > 1.2 && m <= 2) regimes.supersonic = true;
      else if (m > 2) regimes.beyondValidated = true;
      if ((derived.flight.angleOfAttack as number) > Math.PI / 3) regimes.largeAngle = true;
      // Plan 0067 (D-103): which approximated parts of the large-angle model this flight used.
      for (const w of derived.warnings) {
        if (w === SUPERSONIC_REVERSE_FLOW_WARNING) used.supersonicReverseFlow = true;
        else if (isLargeAngleApproximationWarning(w)) used.approximatedFinBeyondStall = true;
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
      stabilityCalibers: Number.isNaN(cp)
        ? Number.NaN
        : (cp - derived.cg) / ctx.config.referenceDiameter,
    });
    for (const w of derived.warnings) notes.add(w);
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
  let endReason: FlightSummary['endReason'] = 'max-time';
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
      if (
        nextTimed.kind !== 'deployment' &&
        nextTimed.kind !== 'ignition' &&
        nextTimed.kind !== 'separation'
      )
        events.push({
          kind: nextTimed.kind,
          time: seconds(nextTimed.time),
          detail: nextTimed.detail,
        });
      if (nextTimed.kind === 'burnout') burnout = { t, v: norm(unpack(y).velocity) };
      record(true);
      continue;
    }
    // Plan 0064 part 2: on the pad with no motor lit and none due to light, nothing more can happen.
    if (
      stages !== undefined &&
      phase === 'on-rail' &&
      !motors.some((m) => m.ignitedAt !== undefined) &&
      !timed.some((x) => x.kind === 'ignition')
    ) {
      stopped = true;
      endReason = 'no-ignition';
      break;
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
        const betterStep = (
          (1.0 / derive(ctx, phase, t, y).derived.rates.pitchNatural) *
          0.9
        ).toPrecision(2);
        warnings.add(
          `RK4 step check: the time step is coarse for this rocket's pitch oscillation, so the calculation damps the wobble by about ${(check.pitchAmplitudeLoss * 100).toFixed(1)} % per step. Apogee and speeds are not affected; to see the oscillation, use a step below ${betterStep} s or the Dormand–Prince integrator.`,
        );
        notes.add(
          `RK4 step check: the pitch oscillation advances up to ${check.pitchStepAngle.toFixed(2)} rad per step, so RK4 damps its amplitude numerically by about ${(check.pitchAmplitudeLoss * 100).toFixed(1)} % per step (D-063); apogee and velocities are not affected on the reference rockets, the oscillation history is. Use a step below ${betterStep} s or the Dormand–Prince integrator for the oscillation.`,
        );
      }
    }
    // Plan 0065: with Dormand–Prince, a trial step so long that its stages leave the models' range
    // (a canopy opening on a fast rocket after a long smooth coast, a stiff decay) is a rejected
    // step, shrunk and retried like one whose error estimate is too large. Only when no step down
    // to the minimum works is the error the flight's.
    const tryStep = (hh: number): { yNext: number[]; errorNorm: number; error?: PhysicsError } => {
      if (options.integrator.kind === 'rk4') return stepOnce(hh);
      try {
        return stepOnce(hh);
      } catch (error) {
        if (error instanceof PhysicsError) return { yNext: y, errorNorm: Infinity, error };
        throw error;
      }
    };
    let attempt = tryStep(hTry);
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
        attempt = tryStep(hTry);
        tries++;
      }
      if (attempt.error !== undefined) throw attempt.error;
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

    // Plan 0064 part 2: separations at an altitude, climbing before apogee and descending after it.
    stages?.separation.forEach((sep, k) => {
      if (!altitudeSeparationDue(sep, k)) return;
      const alt = sep.altitude as number;
      candidates.push({
        kind: 'separation',
        g: (yy) => altitudeAbovePad(yy) - alt,
        direction: sep.event === 'altitude-ascending' ? 'up' : 'down',
      });
    });
    if (apogeeReached) {
      for (const device of vehicle.recovery) {
        if (
          device.deploy.event === 'altitude' &&
          activeRecovery.has(device) &&
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
    // D-070, D-103: the displayed mode's large-angle model continues through 180° at any Mach number;
    // the 90° limit remains in the OpenRocket-equivalent mode.
    if (
      fired === undefined &&
      (phase === 'powered' || phase === 'coast') &&
      options.degreesOfFreedom === 6 &&
      ctx.largeAngleMethod === 'linear'
    ) {
      const aoa = (yy: readonly number[]): number => {
        const f = sampleFlight(ctx, phase, t, yy);
        return f === undefined ? 0 : f.angleOfAttack;
      };
      const beyond = (yy: readonly number[]): boolean => {
        const f = sampleFlight(ctx, phase, t, yy);
        return f !== undefined && f.angleOfAttack > AERO_MAX_ANGLE_OF_ATTACK;
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
          phase =
            stages === undefined
              ? t < motorBurn
                ? 'powered'
                : 'coast'
              : thrustingNow()
                ? 'powered'
                : 'coast';
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
          scheduleSeparations('apogee', undefined, t, 'apogee');
          break;
        case 'altitude':
          for (const device of vehicle.recovery) {
            if (
              device.deploy.event === 'altitude' &&
              activeRecovery.has(device) &&
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
          events.push({
            kind: 'model-limit',
            time: seconds(t),
            detail: `angle of attack reached ${deg.toFixed(1)}°, the 90° limit of the aerodynamic model; the flight is not continued (D-046)`,
          });
          // Issue #19: the plain message is the design warning for endReason 'model-limit'.
          notes.add(
            `The flight ended at ${t.toFixed(3)} s because the angle of attack reached ${deg.toFixed(1)}°: the small-angle normal force model (Niskanen chapter 3, Barrowman fins as flat plates) is applied only up to 90° (D-046). The rocket was flying backwards or tumbling; a recovery device deploying at apogee avoids this.`,
          );
          break;
        }
        case 'burnout':
        case 'deployment':
        case 'ejection-charge':
        case 'separation':
          // Plan 0064 part 2: a stage set to separate when climbing or descending through an altitude.
          stages?.separation.forEach((sep, k) => {
            if (!altitudeSeparationDue(sep, k)) return;
            if (Math.abs(s.position.z - (sep.altitude as number)) >= 1e-6) return;
            altitudeTriggered.add(k);
            scheduleSeparation(
              k,
              sep,
              t,
              `${sep.event === 'altitude-ascending' ? 'climbing' : 'descending'} through ${String(sep.altitude)} m`,
            );
          });
          break;
        case 'launch':
        case 'liftoff':
        case 'max-time':
        case 'ignition':
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
  if (
    stages === undefined &&
    hasEjectionCharge &&
    !events.some((e) => e.kind === 'ejection-charge')
  ) {
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

  // Issue #32: a rocket that never left the rail has no rail-exit, burnout or apogee figures (NaN in the summary).
  if (endReason === 'no-ignition') {
    warnings.add(
      'No motor is set to ignite at launch, so the rocket never leaves the pad and there is no flight. Set a motor of the bottom stage to ignite at launch.',
    );
  } else if (railExit === undefined) {
    warnings.add(
      `The rocket never left the launch rail${phase === 'landed' ? ' (it slid back down)' : ''}: the motor's thrust did not carry it to the end of the rail, so there is no real flight. Use a more powerful motor or a lighter rocket; rail exit, apogee and burnout figures are not available.`,
    );
  }
  const apogeeZ = samples.reduce((m, s) => Math.max(m, s.altitude), 0);
  // Issue #17: a negative margin (CP ahead of the CG) during the ascent means the rocket is unstable; the
  // flight below is then not a prediction. Stated first, in place of the in-flight margin warning.
  const unstable = [lowest.powered, lowest.coast].reduce<StabilityPoint | undefined>(
    (worst, p) =>
      p !== undefined && p.calibers < 0 && (worst === undefined || p.calibers < worst.calibers)
        ? p
        : worst,
    undefined,
  );
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
    ejectionCharge,
    unstable,
    regimes: { ...regimes },
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
  // F-4: every apogee- or altitude-triggered device that did not open, with the reason, so that a ballistic
  // landing is never presented as a recovered one. (Ejection-charge devices: M-4.)
  const ended =
    endReason === 'landing'
      ? `the rocket landed at ${t.toFixed(2)} s`
      : endReason === 'max-time'
        ? `the simulation stopped at its time limit, ${t.toFixed(2)} s`
        : `the flight ended at ${t.toFixed(2)} s`;
  for (const d of vehicle.recovery) {
    // Plan 0064: a separated stage's devices left with it; their flight is not simulated.
    if (deployed.has(d) || !activeRecovery.has(d)) continue;
    const delay: number = d.deploy.delay;
    let reason: string | undefined;
    if (d.deploy.event === 'apogee') {
      reason =
        apogee === undefined
          ? `it opens at apogee, which was not reached before ${ended}`
          : `it opens ${delay.toFixed(2)} s after apogee (at ${(apogee.t + delay).toFixed(2)} s), but ${ended} first. Use a shorter delay`;
    } else if (d.deploy.event === 'altitude' && d.deploy.altitude !== undefined) {
      const alt: number = d.deploy.altitude;
      if (apogee === undefined) {
        reason = `it opens when descending through ${alt.toFixed(1)} m, which is only checked after apogee, and apogee was not reached before ${ended}`;
      } else if (alt >= apogee.z) {
        reason = `it is set to open at ${alt.toFixed(1)} m on the way down, but the apogee is only ${apogee.z.toFixed(1)} m. Set it below the apogee`;
      } else if (alt <= 0) {
        reason = `it is set to open at ${alt.toFixed(1)} m above the pad, which the rocket reaches only on landing. Set it above the ground`;
      } else {
        const crossing = events.find(
          (e) => e.kind === 'altitude' && e.detail.startsWith(`altitude ${alt.toFixed(3)} m`),
        );
        reason =
          crossing === undefined
            ? `it opens when descending through ${alt.toFixed(1)} m, but ${ended} before reaching that height`
            : `it opens ${delay.toFixed(2)} s after descending through ${alt.toFixed(1)} m (at ${((crossing.time as number) + delay).toFixed(2)} s), but ${ended} first. Use a shorter delay`;
      }
    }
    // Issue #33: 'never' is a choice, but when nothing else opened the rocket comes down unretarded.
    if (d.deploy.event === 'never' && deployed.size === 0) {
      reason = 'it is set to never open, and no other recovery device opened';
    }
    if (reason !== undefined) {
      warnings.add(
        `"${d.name}" never opened: ${reason}. The landing speed and drift shown are for a rocket coming down without it.`,
      );
    }
  }
  // Plan 0064: a device on its stage's ejection charge that did not open while still on the vehicle.
  if (stages !== undefined) {
    for (const d of vehicle.recovery) {
      if (d.deploy.event !== 'ejection' || deployed.has(d) || !activeRecovery.has(d)) continue;
      warnings.add(
        `"${d.name}" never opened: the ejection charge of its stage's motor did not fire before ${ended}. The landing speed and drift shown are for a rocket coming down without it.`,
      );
    }
    for (const w of stagingWarnings(stages, motors, separated, stageName, ended)) warnings.add(w);
  }
  for (const f of summary.flutter) {
    if (f.ratio === undefined) {
      if (f.reason.startsWith('no shear modulus'))
        warnings.add(
          `Fin flutter not checked for ${finName(f.finIndex)}: enter the fin material's shear modulus (its stiffness) to check whether the fins can flutter.`,
        );
    } else if (f.ratio < 1) {
      warnings.add(
        `Fin flutter: ${finName(f.finIndex)} reaches ${f.airspeed.toFixed(0)} m/s at t = ${f.time.toFixed(2)} s (Mach ${f.mach.toFixed(2)}), above the estimated flutter speed of ${f.flutterVelocity.toFixed(0)} m/s there, so the fins may flutter and break. Thicker fins, a stiffer material, a smaller span or a slower flight raise the margin.`,
      );
      notes.add(
        `Fin flutter speed of component ${String(f.finIndex)} from NACA TN 4197 eq. (12) at the local pressure and speed of sound (plan 0031).`,
      );
    }
  }
  for (const [name, p] of [
    ['powered flight', lowest.powered],
    ['coast', lowest.coast],
  ] as const) {
    if (p !== undefined && p.calibers < minimumMargin && !(p.calibers < 0)) {
      warnings.add(
        `In-flight stability margin fell to ${p.calibers.toFixed(2)} calibers during ${name} (at ${p.time.toFixed(2)} s, Mach ${p.mach.toFixed(2)}, angle of attack ${((p.angleOfAttack * 180) / Math.PI).toFixed(1)}°), below the ${minimumMargin.toFixed(2)} caliber minimum: the rocket may not fly straight there.`,
      );
      notes.add(
        `The in-flight margin uses the centre of pressure at the flight's Mach number and angle of attack, with the ${p.model === 'datcom' ? 'DATCOM large-angle' : 'small-angle'} normal force model (plan 0030, D-070).`,
      );
    }
  }
  // Issue #9: a charge that fires while the rocket still climbs. Without an altimeter the charge is the
  // deployment, so the recovery would open at this speed; the devices' own trigger does not change that.
  if (ejectionCharge !== undefined && ejectionCharge.verticalVelocity > 0) {
    const e = ejectionCharge;
    const toApogee =
      apogee === undefined
        ? ''
        : `, ${(apogee.t - e.time).toFixed(1)} s before apogee (a delay of about ${(apogee.t - (stages === undefined ? motorBurn : (topBurnout ?? motorBurn))).toFixed(1)} s after burnout would fire it near apogee)`;
    warnings.add(
      `The motor's ejection charge fires at ${e.time.toFixed(2)} s while the rocket is still climbing at ${e.airspeed.toFixed(1)} m/s${toApogee}. If the charge deploys the recovery (no altimeter), the parachute opens at that speed and may tear, strip or zipper the airframe; choose a longer delay. If an altimeter deploys the recovery and the charge is only a backup, this still fires the charge early.`,
    );
  }

  const unstableStatement =
    unstable === undefined
      ? []
      : [
          `This rocket is unstable: at ${unstable.time.toFixed(2)} s its centre of pressure is ${(-unstable.calibers).toFixed(2)} calibers ahead of its centre of mass, so it turns sideways or tumbles instead of flying straight. The apogee, speeds and landing point shown are not a prediction of its flight. Add or enlarge the fins, or add nose weight, until the margin is positive (1 to 2 calibers is the usual target).`,
        ];
  const approximations = [
    ...(vehicle.approximations ?? []),
    ...componentApproximations(
      vehicle.components.map((c, i) => ({
        ...(vehicle.componentNames?.[i] === undefined ? {} : { name: vehicle.componentNames[i] }),
        component: c.component,
        ...(c.approximations === undefined ? {} : { approximations: c.approximations }),
      })),
    ),
    ...largeAngleApproximations(vehicle, ctx.largeAngleMethod, used.approximatedFinBeyondStall),
    ...(used.supersonicReverseFlow ? [SUPERSONIC_REVERSE_FLOW_APPROXIMATION] : []),
    ...(stages === undefined
      ? vehicle.motor.kind === 'definition'
        ? clusterApproximations(vehicle.motor.cluster)
        : []
      : [
          ...stages.motors.flatMap((m) => clusterApproximations(m.motor.cluster)),
          ...stagingApproximations(stages.separation.length),
        ]),
  ];
  return {
    samples,
    events,
    summary,
    // When unstable, the statement is always the first warning (formats relies on this, issue #17).
    warnings: [...unstableStatement, ...warnings],
    notes: [...notes],
    approximations,
    confidence: confidenceOf(approximations),
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
