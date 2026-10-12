/**
 * From a RocketDesign to the physics package's inputs and back to
 * user-facing assessments (plan 0011). Pure functions; every number is SI.
 *
 * Modes: 'displayed' is what the app shows (Niskanen's roll-angle reduction
 * D-016, the source base-drag rule D-035, standard gravity D-030);
 * 'openrocket-equivalent' exists for the reference comparisons only.
 */
import {
  burnTime,
  centreOfPressure,
  mach,
  motorMassAt,
  rocketMassProperties,
  ROUGHNESS_HEIGHTS,
  stabilityMargin,
  seconds,
  STANDARD_GRAVITY,
  STANDARD_GRAVITY_MODEL,
  totalImpulse,
  OPENROCKET_REFERENCE_GRAVITY_45N,
  type FlightResult,
  type FlightVehicle,
  type MotorMass,
  type PlacedComponent,
  type RocketMassProperties,
  type SimulationOptions,
  type StabilityResult,
  type Mach,
  type Metres,
} from '@lo-fi-rocket/physics';
import { DesignError } from './errors.js';
import type { DesignComponent, MotorSelection, RocketDesign } from './model.js';

export type PhysicsMode = 'displayed' | 'openrocket-equivalent';

/** The design's stability Mach number (docs/conventions.md: the design condition is 0.3). */
export const DESIGN_MACH: Mach = mach(0.3);

export function designPlacedComponents(design: RocketDesign): PlacedComponent[] {
  return design.components.map((c: DesignComponent) => ({
    component: c.component,
    position: c.position,
  }));
}

/** The motor and where its aft end sits, or undefined when no motor is selected. */
export function designMotor(
  design: RocketDesign,
): { readonly selection: MotorSelection; readonly aftEnd: Metres } | undefined {
  const mount = design.motorMount;
  if (mount?.motor === undefined) return undefined;
  const holder = design.components.find((c) => c.id === mount.componentId);
  if (holder === undefined) {
    throw new DesignError(`the motor mount refers to a missing component "${mount.componentId}"`);
  }
  const length: number =
    holder.component.kind === 'innerTube' || holder.component.kind === 'bodyTube'
      ? holder.component.length
      : 0;
  const aftEnd: number = holder.position + length + mount.overhang;
  return { selection: mount.motor, aftEnd: aftEnd as Metres };
}

export type MassCondition = 'liftoff' | 'burnout' | 'no-motor';

/** Motor mass at liftoff or burnout, or undefined without a motor. */
export function designMotorMass(design: RocketDesign, at: MassCondition): MotorMass | undefined {
  const m = designMotor(design);
  if (m === undefined || at === 'no-motor') return undefined;
  const def = m.selection.definition;
  return motorMassAt(def, at === 'liftoff' ? seconds(0) : burnTime(def), m.aftEnd);
}

export function designMassProperties(
  design: RocketDesign,
  at: MassCondition,
): RocketMassProperties {
  return rocketMassProperties(designPlacedComponents(design), designMotorMass(design, at));
}

export type StabilityAssessment =
  | { readonly level: 'unstable'; readonly message: string }
  | { readonly level: 'typical'; readonly message: string }
  | { readonly level: 'overstable'; readonly message: string };

export interface DesignStability {
  readonly result: StabilityResult;
  readonly mode: PhysicsMode;
  /** True when the margins were computed without a motor (liftoff and burnout equal the empty rocket). */
  readonly noMotor: boolean;
  readonly liftoff: StabilityAssessment;
  readonly burnout: StabilityAssessment;
}

/** Plain-language reading of a margin against the design's thresholds (CLAUDE.md 9: rules of thumb). */
export function assessMargin(
  calibers: number,
  thresholds: RocketDesign['stabilityThresholds'],
): StabilityAssessment {
  const c = calibers.toFixed(2);
  if (calibers < thresholds.unstableBelow) {
    return {
      level: 'unstable',
      message: `${c} calibers is below ${String(thresholds.unstableBelow)}: the rocket is likely unstable, because the centre of pressure is too close to or ahead of the centre of gravity for the fins to correct a disturbance.`,
    };
  }
  if (calibers > thresholds.overstableAbove) {
    return {
      level: 'overstable',
      message: `${c} calibers is above ${String(thresholds.overstableAbove)}: the rocket may be overstable and weathercock into the wind, which lowers the apogee and moves the landing point upwind.`,
    };
  }
  return {
    level: 'typical',
    message: `${c} calibers is in the typical target range of ${String(thresholds.unstableBelow)} to ${String(thresholds.overstableAbove)} (a rule of thumb, not a guarantee).`,
  };
}

/** CP, CG and margins at liftoff and burnout at the design Mach number. */
export function designStability(
  design: RocketDesign,
  mode: PhysicsMode = 'displayed',
  machNumber: Mach = DESIGN_MACH,
): DesignStability {
  const components = designPlacedComponents(design);
  const m = designMotor(design);
  const cp = centreOfPressure(components, {
    mach: machNumber,
    rollAngle: 'worst',
    finRollReduction: mode === 'displayed',
    ...(design.referenceDiameter === undefined
      ? {}
      : { referenceDiameter: design.referenceDiameter }),
  });
  // As rocketStability (BAR-9), but tolerating a design without a motor: both CGs are then the empty rocket's.
  const cgLiftoff = designMassProperties(design, m === undefined ? 'no-motor' : 'liftoff').cg;
  const cgBurnout = designMassProperties(design, m === undefined ? 'no-motor' : 'burnout').cg;
  const result: StabilityResult = {
    centreOfPressure: cp,
    cgLiftoff,
    cgBurnout,
    marginLiftoff: stabilityMargin(cp.cp, cgLiftoff, cp.referenceDiameter),
    marginBurnout: stabilityMargin(cp.cp, cgBurnout, cp.referenceDiameter),
  };
  return {
    result,
    mode,
    noMotor: m === undefined,
    liftoff: assessMargin(result.marginLiftoff, design.stabilityThresholds),
    burnout: assessMargin(result.marginBurnout, design.stabilityThresholds),
  };
}

/** The simulated vehicle. Throws DesignError when no motor is selected. */
export function designVehicle(design: RocketDesign): FlightVehicle {
  const m = designMotor(design);
  if (m === undefined) {
    throw new DesignError(
      'no motor is selected: choose a motor in the motor mount before simulating',
    );
  }
  return {
    components: designPlacedComponents(design),
    motor: {
      kind: 'definition',
      definition: m.selection.definition,
      aftEnd: m.aftEnd,
      ...(m.selection.ejectionDelay === undefined
        ? {}
        : { ejectionDelay: m.selection.ejectionDelay }),
    },
    recovery: design.recovery.map((d) => ({
      name: d.name,
      diameter: d.diameter,
      dragCoefficient: d.dragCoefficient,
      deploy: {
        event: d.deploy.event,
        delay: d.deploy.delay,
        ...(d.deploy.altitude === undefined ? {} : { altitude: d.deploy.altitude }),
      },
    })),
    roughnessHeight: design.finish.roughnessHeight,
    ...(design.referenceDiameter === undefined
      ? {}
      : { referenceDiameter: design.referenceDiameter }),
  };
}

export function designSimulationOptions(
  design: RocketDesign,
  mode: PhysicsMode = 'displayed',
): SimulationOptions {
  const { site, rail, wind } = design.launch;
  const atmosphere =
    site.temperature !== undefined && site.pressure !== undefined
      ? {
          atmosphere: {
            at: { altitude: site.altitude },
            temperature: site.temperature,
            pressure: site.pressure,
          },
        }
      : {};
  return {
    site: {
      altitude: site.altitude,
      ...(site.latitude === undefined ? {} : { latitude: site.latitude }),
    },
    rail,
    wind: { kind: 'constant', speed: wind.speed, from: wind.from },
    gravity:
      mode === 'displayed'
        ? STANDARD_GRAVITY_MODEL
        : { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
    ...atmosphere,
    aerodynamics: 'niskanen',
    finRollReduction: mode === 'displayed',
    baseDragMotorRule: mode === 'displayed' ? 'while-thrusting' : 'always',
    integrator: design.simulation.integrator,
    maxTime: design.simulation.maxTime,
    degreesOfFreedom: 6,
    recordInterval: design.simulation.recordInterval,
  };
}

export interface DesignWarning {
  readonly code:
    | 'rail-exit-velocity'
    | 'thrust-to-weight'
    | 'deployment-velocity'
    | 'transonic'
    | 'no-recovery'
    | 'max-time'
    | 'model-limit'
    | 'model';
  /** What happened and why it matters, in one or two sentences. */
  readonly message: string;
}

/** Thrust-to-weight: the motor's average thrust (total impulse / burn time) over the liftoff weight at standard gravity. */
export function designThrustToWeight(design: RocketDesign): number | undefined {
  const m = designMotor(design);
  if (m === undefined) return undefined;
  const def = m.selection.definition;
  const average: number = totalImpulse(def) / burnTime(def);
  const weight: number = designMassProperties(design, 'liftoff').mass * STANDARD_GRAVITY;
  return average / weight;
}

/** Warnings from a flight result against the design's thresholds (CLAUDE.md 9). */
export function designFlightWarnings(design: RocketDesign, result: FlightResult): DesignWarning[] {
  const out: DesignWarning[] = [];
  const t = design.warningThresholds;
  const s = result.summary;
  if (s.railExitVelocity < t.minRailExitVelocity) {
    out.push({
      code: 'rail-exit-velocity',
      message: `Rail exit velocity ${s.railExitVelocity.toFixed(1)} m/s is below ${String(t.minRailExitVelocity)} m/s: the fins may not have enough airflow to keep the rocket pointed along the rail direction when it leaves the rail.`,
    });
  }
  const twr = designThrustToWeight(design);
  if (twr !== undefined && twr < t.minThrustToWeight) {
    out.push({
      code: 'thrust-to-weight',
      message: `Average thrust to liftoff weight is ${twr.toFixed(1)}:1, below ${String(t.minThrustToWeight)}:1: the rocket accelerates slowly off the pad and is sensitive to wind at rail exit.`,
    });
  }
  if (s.deploymentVelocity !== undefined && s.deploymentVelocity > t.maxDeploymentVelocity) {
    out.push({
      code: 'deployment-velocity',
      message: `Recovery deploys at ${s.deploymentVelocity.toFixed(1)} m/s, above ${String(t.maxDeploymentVelocity)} m/s: a fast deployment can tear the parachute or shock cord or zipper the airframe.`,
    });
  }
  if (s.maxMach > 0.8) {
    out.push({
      code: 'transonic',
      message: `Maximum Mach ${s.maxMach.toFixed(2)} is in the transonic regime: the drag model is less accurate between Mach 0.8 and 1.2 (docs/known-limitations.md).`,
    });
  }
  if (design.recovery.length === 0) {
    out.push({
      code: 'no-recovery',
      message:
        'No recovery device: the rocket falls ballistically and lands at its terminal speed.',
    });
  }
  if (s.endReason === 'max-time') {
    out.push({
      code: 'max-time',
      message: `The simulation stopped at the maximum time of ${String(design.simulation.maxTime)} s before landing: increase the maximum time to see the full descent.`,
    });
  }
  if (s.endReason === 'model-limit') {
    out.push({
      code: 'model-limit',
      message: `The flight ended at ${s.flightTime.toFixed(2)} s, before landing, because the rocket turned past 90° angle of attack (flying backwards or tumbling), which the aerodynamic model does not cover (D-046). The apogee and the ascent are valid; a recovery device deploying at apogee lets the descent be simulated.`,
    });
  }
  for (const w of result.warnings) out.push({ code: 'model', message: w });
  return out;
}

/** The default finish: "regular paint", 60 µm (Niskanen Figure 3.10; also the reference setting). */
export const DEFAULT_ROUGHNESS_HEIGHT: Metres = ROUGHNESS_HEIGHTS.regularPaint60um as Metres;
