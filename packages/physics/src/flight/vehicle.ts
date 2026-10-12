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

export interface SimulationOptions {
  readonly site: LaunchSite;
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
  readonly integrator: IntegratorOptions;
  readonly maxTime: Seconds;
  /** 6: the main simulator; 3: the point-mass cross-check (velocity-aligned axis, zero angle of attack). */
  readonly degreesOfFreedom: 6 | 3;
  /** Record a sample at most this often (every accepted step when absent). */
  readonly recordInterval?: Seconds;
}
