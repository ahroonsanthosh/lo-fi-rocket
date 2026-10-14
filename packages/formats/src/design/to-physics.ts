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
  combineRocketMotors,
  mach,
  motorMassAt,
  rocketMassProperties,
  withAsBuilt,
  ROUGHNESS_HEIGHTS,
  stabilityMargin,
  seconds,
  structuralMassParts,
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
  type StagedMotor,
  type StageSeparation,
  type VehicleStages,
  type Mach,
  type Metres,
  type WindModel,
} from '@lo-fi-rocket/physics';
import { DesignError } from './errors.js';
import type { DesignComponent, MotorMount, MotorSelection, RocketDesign } from './model.js';

export type PhysicsMode = 'displayed' | 'openrocket-equivalent';

/** The design's stability Mach number (docs/conventions.md: the design condition is 0.3). */
export const DESIGN_MACH: Mach = mach(0.3);

/** The design's parts for the physics, scaled and moved to the as-built mass and CG when given (D-089, GEO-17). */
export function designPlacedComponents(design: RocketDesign): PlacedComponent[] {
  const parts = design.components.map((c: DesignComponent) => ({
    component: c.component,
    position: c.position,
    ...(c.massOverride === undefined ? {} : { massOverride: c.massOverride }),
    ...(c.approximations === undefined ? {} : { approximations: c.approximations }),
  }));
  return design.asBuilt === undefined ? parts : withAsBuilt(parts, design.asBuilt);
}

/** A selected motor in its mount (plan 0064): the mount, the part holding it and its stage. */
export interface DesignMotor {
  readonly selection: MotorSelection;
  /** Where the motor's aft end sits, from the nose tip. */
  readonly aftEnd: Metres;
  readonly mount: MotorMount;
  readonly holder: DesignComponent;
  /** The stage of the mount's part; 0 is the top stage. */
  readonly stage: number;
}

/** Plan 0064: the number of stages, the design's list or one. */
export function designStageCount(design: RocketDesign): number {
  return design.stages?.length ?? 1;
}

/** Plan 0064: a stage's name for messages, its own or "stage n" counted from the top. */
export function designStageName(design: RocketDesign, stage: number): string {
  return design.stages?.[stage]?.name ?? `stage ${String(stage + 1)}`;
}

/** Every motor mount: `motorMount` first, then the additional ones (plan 0064). */
export function designMotorMounts(design: RocketDesign): MotorMount[] {
  return [
    ...(design.motorMount === undefined ? [] : [design.motorMount]),
    ...(design.additionalMotorMounts ?? []),
  ];
}

function mountMotor(design: RocketDesign, mount: MotorMount): DesignMotor | undefined {
  if (mount.motor === undefined) return undefined;
  const holder = design.components.find((c) => c.id === mount.componentId);
  if (holder === undefined) {
    throw new DesignError(`the motor mount refers to a missing component "${mount.componentId}"`);
  }
  const length: number =
    holder.component.kind === 'innerTube' || holder.component.kind === 'bodyTube'
      ? holder.component.length
      : 0;
  const aftEnd: number = holder.position + length + mount.overhang;
  return {
    selection: mount.motor,
    aftEnd: aftEnd as Metres,
    mount,
    holder,
    stage: holder.stage ?? 0,
  };
}

/** The motor of `motorMount` and where its aft end sits, or undefined when it has none. */
export function designMotor(design: RocketDesign): DesignMotor | undefined {
  return design.motorMount === undefined ? undefined : mountMotor(design, design.motorMount);
}

/** Plan 0064: every selected motor, in the order of designMotorMounts. */
export function designMotors(design: RocketDesign): DesignMotor[] {
  return designMotorMounts(design).flatMap((mount) => {
    const m = mountMotor(design, mount);
    return m === undefined ? [] : [m];
  });
}

/**
 * Plan 0064: each motor's ignition for the physics, as OpenRocket's events
 * (reference/rockets/staging-probe/values.txt): 'automatic' is launch in the bottom stage and the
 * ejection charge of the stage directly below otherwise; 'burnout' and 'ejection' are those of the
 * stage directly below (its first motor, in the order of designMotors). With no motor there, the
 * motor never ignites, and `problem` says so.
 */
export function designIgnitions(
  design: RocketDesign,
  motors: readonly DesignMotor[] = designMotors(design),
): { readonly ignition: StagedMotor['ignition']; readonly problem?: string }[] {
  const bottom = designStageCount(design) - 1;
  return motors.map((m) => {
    const given = m.mount.ignition ?? { event: 'automatic', delay: seconds(0) };
    const delay = given.delay;
    if (given.event === 'launch' || (given.event === 'automatic' && m.stage === bottom)) {
      return { ignition: { event: 'launch', delay } };
    }
    if (given.event === 'never') return { ignition: { event: 'never', delay } };
    const event = given.event === 'burnout' ? 'burnout' : 'ejection';
    const of = motors.findIndex((o) => o.stage === m.stage + 1);
    if (of >= 0) return { ignition: { event, of, delay } };
    const what = event === 'burnout' ? 'burnout' : 'ejection charge';
    return {
      ignition: { event: 'never', delay },
      problem: `The motor in "${m.holder.name}" never ignites: it is set to ignite at the ${what} of the motor in the stage below${given.event === 'automatic' ? ' (automatic ignition)' : ''}, but ${m.stage === bottom ? `${designStageName(design, m.stage)} is the bottom stage` : `${designStageName(design, m.stage + 1)} has no motor`}. Give that stage a motor, or set this motor to ignite at launch.`,
    };
  });
}

/**
 * Issue #36: whether the selected motor fits its mount tube. Returns one
 * plain sentence per problem, empty when it fits or no motor is selected.
 * Diameter: the motor against the tube's inside diameter 2 (r − t). Length:
 * the motor's forward end, aftEnd − length, against the tube's forward end.
 * Lengths are compared within 1 µm (as the component fit checks, D-074).
 */
export function designMotorFitProblems(design: RocketDesign): string[] {
  return designMotors(design).flatMap((m) => motorFitProblems(m));
}

function motorFitProblems(m: DesignMotor): string[] {
  const holder = m.holder;
  if (holder.component.kind !== 'innerTube' && holder.component.kind !== 'bodyTube') return [];
  const tube = holder.component;
  const def = m.selection.definition;
  const mm = (x: number): string => (x * 1000).toFixed(1);
  const out: string[] = [];
  const inside = 2 * ((tube.outerRadius as number) - (tube.wallThickness as number));
  const diameter: number = def.diameter;
  if (diameter > inside + 1e-6) {
    out.push(
      `The motor is ${mm(diameter)} mm wide but the mount tube "${holder.name}" is ${mm(inside)} mm inside, so it does not fit: the mass, CG, stability and flight shown are for a rocket that cannot be built. Choose a ${mm(inside)} mm motor or a wider mount tube.`,
    );
  }
  const motorFore = (m.aftEnd as number) - (def.length as number);
  const tubeFore: number = holder.position;
  if (motorFore < tubeFore - 1e-6) {
    out.push(
      `The motor is ${mm(def.length)} mm long and its front end sits ${mm(tubeFore - motorFore)} mm ahead of the front of the mount tube "${holder.name}", so it does not fit: lengthen the mount tube, let the motor overhang the back more, or choose a shorter motor.`,
    );
  }
  return out;
}

export type MassCondition = 'liftoff' | 'burnout' | 'no-motor';

/** Motor mass at liftoff or burnout, or undefined without a motor; a cluster's motors together (plan 0057). */
export function designMotorMass(design: RocketDesign, at: MassCondition): MotorMass | undefined {
  const m = designMotor(design);
  return m === undefined ? undefined : motorMassOf(m, at);
}

function motorMassOf(m: DesignMotor, at: MassCondition): MotorMass | undefined {
  if (at === 'no-motor') return undefined;
  const def = m.selection.definition;
  const one = motorMassAt(def, at === 'liftoff' ? seconds(0) : burnTime(def), m.aftEnd);
  const cluster = m.mount.cluster;
  return cluster === undefined ? one : { ...one, cluster };
}

/** Motors in the mount: one, or a cluster's count (plan 0057). */
export function designMotorCount(design: RocketDesign): number {
  return design.motorMount?.cluster?.length ?? 1;
}

/**
 * The design's mass properties with every motor loaded ('liftoff'), every motor spent ('burnout') or
 * none (plan 0064: a staged design's figures are those of the whole stack).
 */
export function designMassProperties(
  design: RocketDesign,
  at: MassCondition,
): RocketMassProperties {
  const parts = designPlacedComponents(design);
  const masses = designMotors(design).flatMap((m) => {
    const mass = motorMassOf(m, at);
    return mass === undefined ? [] : [mass];
  });
  return masses.length <= 1
    ? rocketMassProperties(parts, masses[0])
    : combineRocketMotors(structuralMassParts(parts), masses);
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
  const noMotor = designMotors(design).length === 0;
  const cp = centreOfPressure(components, {
    mach: machNumber,
    rollAngle: 'worst',
    finRollReduction: mode === 'displayed',
    ...(design.referenceDiameter === undefined
      ? {}
      : { referenceDiameter: design.referenceDiameter }),
  });
  // As rocketStability (BAR-9), but tolerating a design without a motor: both CGs are then the empty rocket's.
  const cgLiftoff = designMassProperties(design, noMotor ? 'no-motor' : 'liftoff').cg;
  const cgBurnout = designMassProperties(design, noMotor ? 'no-motor' : 'burnout').cg;
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
    noMotor,
    liftoff: assessMargin(result.marginLiftoff, design.stabilityThresholds),
    burnout: assessMargin(result.marginBurnout, design.stabilityThresholds),
  };
}

/** A motor as the physics' source: its definition, aft end, ejection delay and cluster. */
function motorSource(m: DesignMotor): StagedMotor['motor'] {
  return {
    kind: 'definition',
    definition: m.selection.definition,
    aftEnd: m.aftEnd,
    ...(m.selection.ejectionDelay === undefined
      ? {}
      : { ejectionDelay: m.selection.ejectionDelay }),
    ...(m.mount.cluster === undefined ? {} : { cluster: m.mount.cluster }),
  };
}

/**
 * Plan 0064: the stages for the physics, or undefined for a one-stage rocket with one motor lit at
 * launch (whose flight is then exactly the unstaged one).
 */
function designVehicleStages(
  design: RocketDesign,
  motors: readonly DesignMotor[],
): VehicleStages | undefined {
  const ignitions = designIgnitions(design, motors);
  const [first] = ignitions;
  if (
    design.stages === undefined &&
    motors.length === 1 &&
    first?.ignition.event === 'launch' &&
    (first.ignition.delay as number) === 0
  ) {
    return undefined;
  }
  const never: StageSeparation = { event: 'never', delay: seconds(0) };
  return {
    componentStage: design.components.map((c) => c.stage ?? 0),
    motors: motors.map((m, i) => ({
      motor: motorSource(m),
      stage: m.stage,
      ignition: ignitions[i]?.ignition ?? { event: 'never', delay: seconds(0) },
      name:
        design.stages === undefined
          ? m.selection.definition.designation
          : `${designStageName(design, m.stage)} ${m.selection.definition.designation}`,
    })),
    separation: Array.from({ length: designStageCount(design) }, (_, k) =>
      k === 0 ? never : (design.stages?.[k]?.separation ?? never),
    ),
    recoveryStage: design.recovery.map((d) => d.stage ?? 0),
    ...(design.stages === undefined ? {} : { names: design.stages.map((s) => s.name) }),
  };
}

/** The simulated vehicle. Throws DesignError when no motor is selected. */
export function designVehicle(design: RocketDesign): FlightVehicle {
  const motors = designMotors(design);
  const [m] = motors;
  if (m === undefined) {
    throw new DesignError(
      'no motor is selected: choose a motor in the motor mount before simulating',
    );
  }
  const stages = designVehicleStages(design, motors);
  return {
    components: designPlacedComponents(design),
    componentNames: design.components.map((c) => c.name),
    ...(design.approximations === undefined ? {} : { approximations: design.approximations }),
    motor: motorSource(m),
    ...(stages === undefined ? {} : { stages }),
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

/** The physics wind model of a design (ENV-1, ENV-3 to ENV-5). */
export function designWindModel(wind: RocketDesign['launch']['wind']): WindModel {
  const mean: WindModel =
    wind.profile === undefined
      ? { kind: 'constant', speed: wind.speed, from: wind.from }
      : {
          kind: 'profile',
          layers: wind.profile.map((l) => ({ altitude: l.altitude, speed: l.speed, from: l.from })),
        };
  if (wind.turbulence === undefined || wind.turbulence.intensity === 0) return mean;
  return {
    kind: 'turbulent',
    mean,
    intensity: wind.turbulence.intensity,
    seed: wind.turbulence.seed,
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
    wind: designWindModel(wind),
    gravity:
      mode === 'displayed'
        ? site.latitude === undefined
          ? STANDARD_GRAVITY_MODEL
          : { altitudeDependence: 'wgs84', latitude: site.latitude }
        : { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
    ...atmosphere,
    aerodynamics: 'niskanen',
    finRollReduction: mode === 'displayed',
    baseDragMotorRule: mode === 'displayed' ? 'while-thrusting' : 'always',
    // D-086: OpenRocket takes one motor's area off the base for a whole cluster.
    ...(mode === 'displayed' ? {} : { baseDragClusterMotors: 'one' as const }),
    baseDragMethod: mode === 'displayed' ? 'datcom' : 'niskanen',
    largeAngleMethod: mode === 'displayed' ? 'datcom' : 'linear',
    integrator: design.simulation.integrator,
    maxTime: design.simulation.maxTime,
    degreesOfFreedom: 6,
    recordInterval: design.simulation.recordInterval,
    // Plan 0030: the in-flight margin is checked against the design's own "unstable below" threshold.
    minimumStabilityMargin: design.stabilityThresholds.unstableBelow,
    ...(design.dragCurve === undefined ? {} : { dragCurve: design.dragCurve }),
  };
}

export interface DesignWarning {
  readonly code:
    | 'unstable'
    | 'motor-fit'
    | 'ignition'
    | 'rail-exit-velocity'
    | 'thrust-to-weight'
    | 'deployment-velocity'
    | 'ejection-velocity'
    | 'transonic'
    | 'supersonic'
    | 'no-recovery'
    | 'recovery-not-deployed'
    | 'max-time'
    | 'model-limit'
    | 'large-angle'
    | 'model';
  /** What happened and why it matters, in one or two sentences. */
  readonly message: string;
}

/**
 * Thrust-to-weight: the motor's average thrust (total impulse / burn time), times the motors in a
 * cluster (plan 0057), over the liftoff weight at standard gravity. Plan 0064: the motors lit at
 * launch together, over the whole stack's weight; 0 when none is.
 */
export function designThrustToWeight(design: RocketDesign): number | undefined {
  const motors = designMotors(design);
  if (motors.length === 0) return undefined;
  const ignitions = designIgnitions(design, motors);
  const average = motors.reduce((sum, m, i) => {
    if (ignitions[i]?.ignition.event !== 'launch') return sum;
    const def = m.selection.definition;
    const count = m.mount.cluster?.length ?? 1;
    return sum + (count * (totalImpulse(def) as number)) / (burnTime(def) as number);
  }, 0);
  const weight: number = designMassProperties(design, 'liftoff').mass * STANDARD_GRAVITY;
  return average / weight;
}

/** Warnings from a flight result against the design's thresholds (CLAUDE.md 9). */
export function designFlightWarnings(design: RocketDesign, result: FlightResult): DesignWarning[] {
  const out: DesignWarning[] = [];
  const t = design.warningThresholds;
  const s = result.summary;
  // Issue #17: an unstable rocket leads the list; the simulator's first warning is that statement.
  const unstable = s.unstable !== undefined;
  if (unstable) out.push({ code: 'unstable', message: result.warnings[0] ?? '' });
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
  // Issue #36: a motor that does not fit makes every figure that of a rocket that cannot be built.
  for (const message of designMotorFitProblems(design)) out.push({ code: 'motor-fit', message });
  // Plan 0064: a motor whose ignition event can never come.
  for (const { problem } of designIgnitions(design)) {
    if (problem !== undefined) out.push({ code: 'ignition', message: problem });
  }
  if (s.deploymentVelocity !== undefined && s.deploymentVelocity > t.maxDeploymentVelocity) {
    out.push({
      code: 'deployment-velocity',
      message: `Recovery deploys at ${s.deploymentVelocity.toFixed(1)} m/s, above ${String(t.maxDeploymentVelocity)} m/s: a fast deployment can tear the parachute or shock cord or zipper the airframe.`,
    });
  }
  // Issue #9: the motor's charge at a high airspeed (too short or too long a delay). Without an altimeter it
  // deploys the recovery; when a device already deploys at that instant the deployment warning covers it.
  const e = s.ejectionCharge;
  if (e !== undefined && e.airspeed > t.maxDeploymentVelocity && s.deploymentTime !== e.time) {
    out.push({
      code: 'ejection-velocity',
      message: `The motor's ejection charge fires at ${e.time.toFixed(2)} s at ${e.airspeed.toFixed(1)} m/s, above ${String(t.maxDeploymentVelocity)} m/s: if the charge deploys the recovery, it opens fast enough to tear the parachute or shock cord or zipper the airframe. Choose a delay that fires near apogee.`,
    });
  }
  if (s.maxMach > 2) {
    out.push({
      code: 'supersonic',
      message: `Maximum Mach ${s.maxMach.toFixed(2)} is supersonic and above 2.0, outside the validated range (Mach 0 to 2.0): the centre of pressure and drag have not been checked against measurements there, so treat apogee and speeds as rough.`,
    });
  } else if (s.maxMach > 1.2) {
    out.push({
      code: 'supersonic',
      message: `Maximum Mach ${s.maxMach.toFixed(2)} is supersonic: the centre of pressure is validated to Mach 2.0 against held-out wind tunnel data, but the supersonic drag is less certain than the subsonic, so apogee and velocities carry a larger error.`,
    });
  } else if (s.maxMach > 0.8) {
    out.push({
      code: 'transonic',
      message: `Maximum Mach ${s.maxMach.toFixed(2)} is in the transonic regime (0.8 to 1.2), where the drag rises steeply and the fin force is an interpolation, so apogee and velocities carry a larger error.`,
    });
  }
  if (design.recovery.length === 0) {
    out.push({
      code: 'no-recovery',
      message:
        'No recovery device: the rocket falls ballistically and lands at its terminal speed.',
    });
  }
  // Issue #33: devices exist but none opened. First in the list: the result looks like a normal flight.
  if (
    design.recovery.length > 0 &&
    !result.events.some((e) => e.kind === 'deployment') &&
    s.groundHitVelocity !== undefined
  ) {
    out.unshift({
      code: 'recovery-not-deployed',
      message: `No recovery device opened, so the rocket hits the ground at ${s.groundHitVelocity.toFixed(1)} m/s, fast enough to hurt someone and to damage the rocket. The reason for each device is given below.`,
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
      message: `The flight ended at ${s.flightTime.toFixed(2)} s, before landing, because the rocket turned past 90° angle of attack (flying backwards or tumbling), which the aerodynamic model does not cover. The apogee and the ascent are valid; a recovery device deploying at apogee lets the descent be simulated.`,
    });
  }
  if (s.regimes.largeAngle) {
    out.push({
      code: 'large-angle',
      message:
        'Part of the flight is at angles of attack above 60° (the rocket tumbling or flying backwards), where the aerodynamic model is approximate, so that part of the path is rough.',
    });
  }
  for (const w of unstable ? result.warnings.slice(1) : result.warnings)
    out.push({ code: 'model', message: w });
  return out;
}

/** The default finish: "regular paint", 60 µm (Niskanen Figure 3.10; also the reference setting). */
export const DEFAULT_ROUGHNESS_HEIGHT: Metres = ROUGHNESS_HEIGHTS.regularPaint60um as Metres;
