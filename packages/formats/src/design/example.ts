/**
 * Design templates (plan 0011): an empty design with the default settings
 * and the R1 reference rocket with its Estes D12, used as the first-run
 * example and by the tests (its figures are in docs/reports/).
 */
import {
  kilograms,
  kilogramsPerCubicMetre,
  metres,
  metresPerSecond,
  newtons,
  radians,
  seconds,
  type MotorDefinition,
} from '@lo-fi-rocket/physics';
import {
  CURRENT_SCHEMA_VERSION,
  type DesignComponent,
  type RocketDesign,
  type SimulationSettings,
  type StabilityThresholds,
  type WarningThresholds,
} from './model.js';
import { DEFAULT_ROUGHNESS_HEIGHT } from './to-physics.js';

/** CLAUDE.md 9: rules of thumb, labelled as such in the UI. */
export const DEFAULT_STABILITY_THRESHOLDS: StabilityThresholds = {
  unstableBelow: 1.0,
  overstableAbove: 2.0,
};

/**
 * CLAUDE.md 9: 15 m/s rail exit and 5:1 thrust-to-weight are the stated
 * defaults. The deployment speed limit has no stated default and no source;
 * 20 m/s is a rule of thumb the user can change (D-042, D-053). None of these
 * thresholds enters any physics calculation; they only decide warnings.
 */
export const DEFAULT_WARNING_THRESHOLDS: WarningThresholds = {
  minRailExitVelocity: metresPerSecond(15),
  minThrustToWeight: 5,
  maxDeploymentVelocity: metresPerSecond(20),
};

/** Dormand–Prince at 1e-8 reproduces RK4 at 0.001 s within 0.001 m on R1 with 2 % of the steps (Phase 2 report). */
export const DEFAULT_SIMULATION_SETTINGS: SimulationSettings = {
  integrator: {
    kind: 'dormand-prince',
    relativeTolerance: 1e-8,
    absoluteTolerance: 1e-10,
    initialStep: seconds(0.001),
    maxStep: seconds(0.05),
  },
  maxTime: seconds(600),
  recordInterval: seconds(0.02),
};

export function newDesign(id: string, name: string): RocketDesign {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    name,
    components: [],
    recovery: [],
    finish: { roughnessHeight: DEFAULT_ROUGHNESS_HEIGHT },
    launch: {
      site: { altitude: metres(0) },
      rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
      wind: { speed: metresPerSecond(0), from: radians(0) },
    },
    simulation: DEFAULT_SIMULATION_SETTINGS,
    stabilityThresholds: DEFAULT_STABILITY_THRESHOLDS,
    warningThresholds: DEFAULT_WARNING_THRESHOLDS,
  };
}

/** Estes D12 from reference/motors/Estes_D12.eng (header: D12 24 70 0-3-5-7 0.0211 0.0426 Estes). */
export const ESTES_D12: MotorDefinition = {
  designation: 'D12',
  manufacturer: 'Estes',
  diameter: metres(0.024),
  length: metres(0.07),
  totalMass: kilograms(0.0426),
  propellantMass: kilograms(0.0211),
  points: (
    [
      [0, 0],
      [0.049, 2.569],
      [0.116, 9.369],
      [0.184, 17.275],
      [0.237, 24.258],
      [0.282, 29.73],
      [0.297, 27.01],
      [0.311, 22.589],
      [0.322, 17.99],
      [0.348, 14.126],
      [0.386, 12.099],
      [0.442, 10.808],
      [0.546, 9.876],
      [0.718, 9.306],
      [0.879, 9.105],
      [1.066, 8.901],
      [1.257, 8.698],
      [1.436, 8.31],
      [1.59, 8.294],
      [1.612, 4.613],
      [1.65, 0],
    ] as const
  ).map(([t, f]) => ({ time: seconds(t), thrust: newtons(f) })),
  massRule: 'impulse-proportional',
  sourceFormat: 'RASP',
};

const PAPER = kilogramsPerCubicMetre(700);
const BALSA = kilogramsPerCubicMetre(160);
const PLYWOOD = kilogramsPerCubicMetre(600);

/** R1 of reference/rockets/README.md (three-fin conical, 50 mm body, Estes D12, ejection delay 5 s). */
export function exampleDesign(id = 'example-r1'): RocketDesign {
  const m = metres;
  const c = (
    id: string,
    name: string,
    position: number,
    component: DesignComponent['component'],
  ): DesignComponent => ({ id, name, position: m(position), component });
  const base = newDesign(id, 'Example: three-fin sport rocket (R1)');
  return {
    ...base,
    components: [
      c('nose', 'Nose cone', 0, {
        kind: 'noseCone',
        shape: 'conical',
        length: m(0.1),
        baseRadius: m(0.025),
        density: BALSA,
      }),
      c('body', 'Body tube', 0.1, {
        kind: 'bodyTube',
        length: m(0.5),
        outerRadius: m(0.025),
        wallThickness: m(0.001),
        density: PAPER,
      }),
      c('fins', 'Fins', 0.5, {
        kind: 'finSet',
        crossSection: 'square',
        count: 3,
        rootChord: m(0.1),
        tipChord: m(0.05),
        sweep: m(0.05),
        span: m(0.08),
        thickness: m(0.003),
        density: PLYWOOD,
        bodyRadius: m(0.025),
      }),
      c('nose-weight', 'Nose weight', 0.1, {
        kind: 'massComponent',
        mass: kilograms(0.03),
        length: m(0.02),
        radius: m(0.02),
      }),
      c('lug', 'Launch lug', 0.35, {
        kind: 'launchLug',
        length: m(0.05),
        outerRadius: m(0.003),
        wallThickness: m(0.0005),
        density: PAPER,
        radialOffset: m(0.028),
      }),
      c('mount', 'Motor mount', 0.525, {
        kind: 'innerTube',
        length: m(0.075),
        outerRadius: m(0.0125),
        wallThickness: m(0.0005),
        density: PAPER,
      }),
      c('ring-fore', 'Centering ring', 0.53, {
        kind: 'centeringRing',
        length: m(0.005),
        outerRadius: m(0.024),
        innerRadius: m(0.0125),
        density: PAPER,
      }),
      c('ring-aft', 'Centering ring', 0.59, {
        kind: 'centeringRing',
        length: m(0.005),
        outerRadius: m(0.024),
        innerRadius: m(0.0125),
        density: PAPER,
      }),
      c('chute-pack', 'Parachute (packed)', 0.2, {
        kind: 'parachute',
        mass: kilograms(0.01),
        length: m(0.05),
        radius: m(0.02),
      }),
    ],
    motorMount: {
      componentId: 'mount',
      overhang: m(0),
      motor: {
        definition: ESTES_D12,
        provenance: { kind: 'bundled', file: 'Estes_D12.eng' },
        ejectionDelay: seconds(5),
      },
    },
    recovery: [
      {
        id: 'chute',
        name: 'Parachute',
        diameter: m(0.3),
        dragCoefficient: 0.8,
        deploy: { event: 'apogee', delay: seconds(0) },
      },
    ],
  };
}
