/**
 * The rocket design: the app's own data model and the content of a
 * `.lofi.json` file (plan 0011, D-041). Pure data in SI with the branded
 * quantities of docs/conventions.md; the file carries the same numbers as
 * plain JSON numbers. Nothing here computes physics; see to-physics.ts.
 */
import type {
  Approximation,
  AsBuilt,
  ClusterOffset,
  Component,
  DragCurve,
  IntegratorOptions,
  Kelvin,
  MassOverride,
  Metres,
  MetresPerSecond,
  MotorDefinition,
  Pascals,
  Radians,
  Seconds,
} from '@lo-fi-rocket/physics';

/** Bumped whenever the file layout changes; migrate.ts carries one step per bump. */
export const CURRENT_SCHEMA_VERSION = 1;

export interface DesignComponent {
  readonly id: string;
  readonly name: string;
  /** x of the component's forward end from the nose tip (docs/conventions.md). */
  readonly position: Metres;
  readonly component: Component;
  /** Optional mass and CG override (D-073); the CG is from the component's forward end. */
  readonly massOverride?: MassOverride;
  /** What this part's entry does not represent exactly, e.g. from an import (D-084). */
  readonly approximations?: readonly Approximation[];
}

/** Where a motor's data came from, for display and for refreshing from the source. */
export type MotorProvenance =
  | { readonly kind: 'bundled'; readonly file: string }
  | { readonly kind: 'thrustcurve'; readonly motorId: string; readonly simfileId: string }
  | { readonly kind: 'file'; readonly fileName: string }
  | { readonly kind: 'custom' };

export interface MotorSelection {
  /** Embedded so that a design file simulates offline (D-041). */
  readonly definition: MotorDefinition;
  readonly provenance: MotorProvenance;
  /** Ejection charge delay after burnout; undefined = plugged (no ejection event). */
  readonly ejectionDelay?: Seconds;
}

export interface MotorMount {
  /** Id of the inner tube or body tube that holds the motor. */
  readonly componentId: string;
  /** How far the motor's aft end sits past the mount's aft end (positive aft). */
  readonly overhang: Metres;
  readonly motor?: MotorSelection;
  /**
   * A cluster of identical motors (plan 0057): each motor's axis offset from the rocket's axis.
   * Absent for one motor on the axis.
   */
  readonly cluster?: readonly ClusterOffset[];
}

export type DeployEvent = 'apogee' | 'ejection' | 'altitude' | 'launch' | 'never';

export interface DesignRecoveryDevice {
  readonly id: string;
  readonly name: string;
  /** Canopy diameter. */
  readonly diameter: Metres;
  /** Referred to the canopy area (Niskanen p. 67 gives 0.8 for a parachute). */
  readonly dragCoefficient: number;
  readonly deploy: {
    readonly event: DeployEvent;
    /** For 'altitude': deploy when descending through this altitude above the pad. */
    readonly altitude?: Metres;
    readonly delay: Seconds;
  };
}

export interface LaunchSiteSettings {
  /** Pad altitude above mean sea level. */
  readonly altitude: Metres;
  /** Kept for a latitude-dependent gravity model once one is approved (D-030). */
  readonly latitude?: Radians;
  /** Overrides of the standard atmosphere at the pad (ATM-11); both or neither. */
  readonly temperature?: Kelvin;
  readonly pressure?: Pascals;
}

export interface LaunchRailSettings {
  readonly length: Metres;
  readonly angleFromVertical: Radians;
  /** Compass azimuth the rail leans towards, clockwise from north. */
  readonly azimuth: Radians;
}

export interface WindLayerSettings {
  /** Altitude above the pad; the first row is 0. */
  readonly altitude: Metres;
  readonly speed: MetresPerSecond;
  readonly from: Radians;
}

export interface WindSettings {
  /** Mean wind at the pad (used alone when no profile is given). */
  readonly speed: MetresPerSecond;
  /** Meteorological direction the wind blows from, clockwise from north. */
  readonly from: Radians;
  /** Mean wind by altitude (ENV-3); when present it replaces speed and from. */
  readonly profile?: readonly WindLayerSettings[];
  /** Niskanen's turbulence (ENV-4, ENV-5): intensity I_u = σ_u/U and the generator seed. */
  readonly turbulence?: { readonly intensity: number; readonly seed: number };
}

export interface LaunchConditions {
  readonly site: LaunchSiteSettings;
  readonly rail: LaunchRailSettings;
  readonly wind: WindSettings;
}

export interface SimulationSettings {
  readonly integrator: IntegratorOptions;
  readonly maxTime: Seconds;
  /** Sampling interval of the recorded time series. */
  readonly recordInterval: Seconds;
}

/** Calibers. Rules of thumb, not guarantees (CLAUDE.md 9); the user may change them. */
export interface StabilityThresholds {
  readonly unstableBelow: number;
  readonly overstableAbove: number;
}

export interface WarningThresholds {
  readonly minRailExitVelocity: MetresPerSecond;
  /** Average thrust over liftoff weight. */
  readonly minThrustToWeight: number;
  readonly maxDeploymentVelocity: MetresPerSecond;
}

/** A recorded flight (altimeter data) kept with the design for the comparison view (CLAUDE.md 7.5). */
export interface RecordedFlight {
  readonly label: string;
  /** Time from launch and altitude above the pad, SI. */
  readonly points: readonly { readonly time: Seconds; readonly altitude: Metres }[];
}

/** Monte Carlo settings kept with the design (plan 0017); the variations are standard deviations. */
export interface DispersionSettingsRecord {
  readonly runs: number;
  readonly seed: number;
  readonly variations: {
    readonly windSpeed: number;
    readonly windDirection: number;
    readonly railAngle: number;
    readonly railAzimuth: number;
    readonly motorImpulseScale: number;
    readonly structuralMassScale: number;
  };
}

export interface RocketDesign {
  readonly schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  readonly id: string;
  readonly name: string;
  readonly components: readonly DesignComponent[];
  readonly motorMount?: MotorMount;
  readonly recovery: readonly DesignRecoveryDevice[];
  /** Surface roughness height for the skin friction (DRAG-2, Niskanen Figure 3.10). */
  readonly finish: { readonly roughnessHeight: Metres };
  /** Overrides the maximum body diameter as the stability reference (BAR-9). */
  readonly referenceDiameter?: Metres;
  readonly launch: LaunchConditions;
  readonly simulation: SimulationSettings;
  readonly stabilityThresholds: StabilityThresholds;
  readonly warningThresholds: WarningThresholds;
  /** An imported C_D versus Mach table used in place of the drag model (CLAUDE.md 6.7 item 2, D-047). */
  readonly dragCurve?: DragCurve;
  readonly recordedFlight?: RecordedFlight;
  readonly dispersion?: DispersionSettingsRecord;
  /** Approximations of the design as a whole, e.g. from an import (D-084). */
  readonly approximations?: readonly Approximation[];
  /**
   * The empty rocket as weighed, motor excluded (D-089): every part is scaled and moved to this
   * mass and CG (GEO-17).
   */
  readonly asBuilt?: AsBuilt;
}

/** A fresh random id (RFC 4122 version 4) for designs, components and devices. */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}
