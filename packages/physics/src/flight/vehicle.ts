/**
 * The vehicle and the simulation options (plan 0010). Pure data; the
 * conventions are those of docs/conventions.md.
 */
import type { Approximation } from '../fidelity.js';
import type { AtmosphereBaseConditions } from '../atmosphere/ussa1976.js';
import type { LaunchRail, LaunchSite } from '../environment/launch.js';
import type { WindModel } from '../environment/wind.js';
import type { ClusterOffset, PlacedComponent } from '../geometry/assembly.js';
import type { MotorDefinition } from '../motor/motor.js';
import type { KilogramsPerSquareMetre, Metres, Newtons, Seconds } from '../units/si.js';
import type { BaseDragMethod, BaseDragMotorRule, RailButtonDragMethod } from '../drag/drag.js';
import type { StreamerDragMethod } from './recovery.js';
import type { LargeAngleMethod } from './aerodynamics.js';
import type { GravityModel } from './gravity.js';

/** When a recovery device deploys (Niskanen Table 4.2 p. 69; events with optional delays). */
interface RecoveryDeviceBase {
  readonly name: string;
  readonly deploy: {
    readonly event: 'apogee' | 'ejection' | 'altitude' | 'launch' | 'never';
    /** For 'altitude': deploy when descending through this altitude above the pad. */
    readonly altitude?: Metres;
    readonly delay: Seconds;
  };
}

/** A parachute: a canopy of `diameter`. */
export interface ParachuteDevice extends RecoveryDeviceBase {
  readonly kind?: 'parachute';
  readonly diameter: Metres;
  /** Parachute drag coefficient referred to the canopy area (0.8 by default in Niskanen p. 67; the user may give another). */
  readonly dragCoefficient: number;
}

/** Plan 0073 part 2: a streamer, a strip of `length` by `width` (Niskanen Appendix C). */
export interface StreamerDevice extends RecoveryDeviceBase {
  readonly kind: 'streamer';
  readonly length: Metres;
  readonly width: Metres;
  readonly surfaceDensity: KilogramsPerSquareMetre;
  /** Referred to the strip area; absent, eq. (C.6) (STREAM-1). */
  readonly dragCoefficient?: number;
}

export type RecoveryDevice = ParachuteDevice | StreamerDevice;

export type MotorSource =
  | {
      readonly kind: 'definition';
      readonly definition: MotorDefinition;
      /** Aft end of the motor from the nose tip. */
      readonly aftEnd: Metres;
      /** Ejection charge delay after burnout; undefined for a plugged motor. */
      readonly ejectionDelay?: Seconds;
      /** A cluster of identical motors igniting together, one per offset (plan 0057). */
      readonly cluster?: readonly ClusterOffset[];
    }
  | {
      /** Constant thrust with no mass or inertia, for the analytical test cases of CLAUDE.md 7.2 only. */
      readonly kind: 'ideal';
      readonly thrust: Newtons;
      readonly burnTime: Seconds;
    };

/**
 * Plan 0064 (D-091): a motor of a staged vehicle and the event that ignites it. Niskanen (2009)
 * §4.2.6 and Table 4.2 p. 69: a motor ignites at launch, at another motor's burnout or at another
 * motor's ejection charge, each with a delay.
 */
export interface StagedMotor {
  readonly motor: Extract<MotorSource, { kind: 'definition' }>;
  /** The stage the motor belongs to; 0 is the top stage. */
  readonly stage: number;
  readonly ignition: {
    /** 'never': the motor stays unlit, at its loaded mass, for the whole flight (plan 0064 part 2). */
    readonly event: 'launch' | 'burnout' | 'ejection' | 'never';
    /** For 'burnout' and 'ejection': the index, in `motors`, of the motor whose event it is. */
    readonly of?: number;
    readonly delay: Seconds;
  };
  /** A name for events and messages ("Booster H128W"). */
  readonly name?: string;
}

/**
 * When a stage separates (plan 0064): at the ignition of the stage above it, at the ignition,
 * burnout or ejection charge of its own motor, at launch, at apogee, when climbing or descending
 * through an altitude above the pad, or never; then a delay. The thesis has no separation event;
 * this set follows the owner's decision D-091 and OpenRocket's file format (its nine events).
 */
export type SeparationEvent =
  | 'upper-ignition'
  | 'ignition'
  | 'burnout'
  | 'ejection'
  | 'launch'
  | 'apogee'
  | 'altitude-ascending'
  | 'altitude-descending'
  | 'never';

/** A stage's separation event and delay (plan 0064). */
export interface StageSeparation {
  readonly event: SeparationEvent;
  readonly delay: Seconds;
  /** For 'altitude-ascending' and 'altitude-descending': the altitude above the pad. */
  readonly altitude?: Metres;
}

/**
 * The stages of a multi-stage vehicle (plan 0064). Stage 0 is the top stage; a separating stage
 * leaves the vehicle with every stage below it, its parts, motors and recovery devices.
 */
export interface VehicleStages {
  /** The stage of each entry of `components`. */
  readonly componentStage: readonly number[];
  /** Every motor of the vehicle; with `stages`, the vehicle's `motor` is not used. */
  readonly motors: readonly StagedMotor[];
  /** Index = stage number. Stage 0 never separates; its entry is not read. */
  readonly separation: readonly StageSeparation[];
  /** The stage of each entry of `recovery`; absent means every device is on the top stage. */
  readonly recoveryStage?: readonly number[];
  /** Stage names, index = stage number, for events and messages. */
  readonly names?: readonly string[];
}

export interface FlightVehicle {
  readonly components: readonly PlacedComponent[];
  /** The motor; for a vehicle with `stages`, the motors are there and this is not used. */
  readonly motor: MotorSource;
  /** Multi-stage vehicles only (plan 0064); absent for a one-stage rocket. */
  readonly stages?: VehicleStages;
  readonly recovery: readonly RecoveryDevice[];
  /** Surface roughness height for the skin friction (DRAG-2). */
  readonly roughnessHeight: Metres;
  readonly referenceDiameter?: Metres;
  /** Optional display names, one per entry of `components`, used in warnings (issue #19). */
  readonly componentNames?: readonly string[];
  /** Approximations of the design as a whole, not of one part (D-084); listed in the result. */
  readonly approximations?: readonly Approximation[];
}

export type IntegratorOptions =
  | { readonly kind: 'rk4'; readonly timeStep: Seconds }
  | {
      readonly kind: 'dormand-prince';
      readonly relativeTolerance: number;
      readonly absoluteTolerance: number;
      readonly initialStep: Seconds;
      readonly maxStep: Seconds;
    };

/**
 * An imported zero-angle-of-attack drag coefficient against Mach number
 * (CLAUDE.md 6.7 item 2), referred to the rocket's reference area. It
 * replaces the computed C_D0 (DRAG-13); the angle-of-attack scaling
 * (DRAG-14) still applies. Interpolated linearly; a Mach number outside
 * the table is an error, never clamped (D-047).
 */
export interface DragCurve {
  readonly label: string;
  /** Strictly increasing Mach numbers, C_D ≥ 0. */
  readonly points: readonly { readonly mach: number; readonly cd: number }[];
}

export interface SimulationOptions {
  readonly site: LaunchSite;
  /** Use this table instead of the drag model; results are labelled with it. */
  readonly dragCurve?: DragCurve;
  readonly rail: LaunchRail;
  readonly wind: WindModel;
  readonly gravity: GravityModel;
  readonly atmosphere?: AtmosphereBaseConditions;
  /** 'niskanen': the aerodynamics of chapters 3 and 4; 'none': no aerodynamic force at all (analytical cases). */
  readonly aerodynamics: 'niskanen' | 'none';
  /** Niskanen roll reduction on fins (displayed) or off (OpenRocket-equivalent, D-016). */
  readonly finRollReduction: boolean;
  /** Base drag motor area rule (D-035, D-108): 'never' in the OpenRocket-equivalent mode. */
  readonly baseDragMotorRule: BaseDragMotorRule;
  /** Rail button drag (D-108): Niskanen's (the default) or OpenRocket 24.12's (DRAG-23). */
  readonly railButtonDragMethod?: RailButtonDragMethod;
  /** A streamer's automatic drag coefficient (plan 0073): eq. (C.6) (the default) or OpenRocket's cap. */
  readonly streamerDragMethod?: StreamerDragMethod;
  /**
   * How many of a cluster's motors are taken off the base drag area (D-086): 'all', the thrusting
   * motors of N09 p. 51 (the default), or 'one' (D-086's reading of OpenRocket 24.12, which D-108
   * found wrong: OpenRocket removes none, the comparison mode's 'never' rule).
   */
  readonly baseDragClusterMotors?: 'all' | 'one';
  /** Body base drag method (D-069); defaults to the drag model's default. */
  readonly baseDragMethod?: BaseDragMethod;
  /**
   * Normal force at large angles of attack (D-070): 'datcom' continues a flight through 180° (HA-1 to HA-10);
   * 'linear' keeps the small-angle model and ends the flight at 90° (D-046). Defaults to 'datcom'.
   */
  readonly largeAngleMethod?: LargeAngleMethod;
  readonly integrator: IntegratorOptions;
  readonly maxTime: Seconds;
  /** 6: the main simulator; 3: the point-mass cross-check (velocity-aligned axis, zero angle of attack). */
  readonly degreesOfFreedom: 6 | 3;
  /** Record a sample at most this often (every accepted step when absent). */
  readonly recordInterval?: Seconds;
  /**
   * Stability margin below which the flight carries a warning, calibers
   * (plan 0030, D-067). Default `DEFAULT_MINIMUM_STABILITY_MARGIN`, the 1.0
   * caliber rule of thumb of CLAUDE.md section 9, not a guarantee.
   */
  readonly minimumStabilityMargin?: number;
}

/** CLAUDE.md section 9: below 1.0 caliber, "warning, likely unstable"; a rule of thumb. */
export const DEFAULT_MINIMUM_STABILITY_MARGIN = 1.0;
