/**
 * The vehicle and the simulation options (plan 0010). Pure data; the
 * conventions are those of docs/conventions.md.
 */
import type { AtmosphereBaseConditions } from '../atmosphere/ussa1976.js';
import type { LaunchRail, LaunchSite } from '../environment/launch.js';
import type { WindModel } from '../environment/wind.js';
import type { PlacedComponent } from '../geometry/assembly.js';
import type { MotorDefinition } from '../motor/motor.js';
import type { Metres, Newtons, Seconds } from '../units/si.js';
import type { BaseDragMethod } from '../drag/drag.js';
import type { LargeAngleMethod } from './aerodynamics.js';
import type { GravityModel } from './gravity.js';

/** A recovery device and when it deploys (Niskanen Table 4.2 p. 69; events with optional delays). */
export interface RecoveryDevice {
  readonly name: string;
  readonly diameter: Metres;
  /** Parachute drag coefficient referred to the canopy area (0.8 by default in Niskanen p. 67; the user may give another). */
  readonly dragCoefficient: number;
  readonly deploy: {
    readonly event: 'apogee' | 'ejection' | 'altitude' | 'launch' | 'never';
    /** For 'altitude': deploy when descending through this altitude above the pad. */
    readonly altitude?: Metres;
    readonly delay: Seconds;
  };
}

export type MotorSource =
  | {
      readonly kind: 'definition';
      readonly definition: MotorDefinition;
      /** Aft end of the motor from the nose tip. */
      readonly aftEnd: Metres;
      /** Ejection charge delay after burnout; undefined for a plugged motor. */
      readonly ejectionDelay?: Seconds;
    }
  | {
      /** Constant thrust with no mass or inertia, for the analytical test cases of CLAUDE.md 7.2 only. */
      readonly kind: 'ideal';
      readonly thrust: Newtons;
      readonly burnTime: Seconds;
    };

export interface FlightVehicle {
  readonly components: readonly PlacedComponent[];
  readonly motor: MotorSource;
  readonly recovery: readonly RecoveryDevice[];
  /** Surface roughness height for the skin friction (DRAG-2). */
  readonly roughnessHeight: Metres;
  readonly referenceDiameter?: Metres;
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
  /** Base drag motor area rule (D-035). */
  readonly baseDragMotorRule: 'while-thrusting' | 'always';
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
