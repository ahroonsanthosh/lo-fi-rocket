/**
 * The five reference rockets of reference/rockets/README.md, written out in
 * plain numbers for tests (the .ork reader of plan 0005 must reproduce them).
 * Positions are the forward end of each component from the nose tip. The order
 * is the depth-first order of the .ork files (external parts with their
 * children in between), which the .ork reader tests rely on.
 */
import { kilograms, kilogramsPerCubicMetre, metres } from '../units/si.js';
import type { PlacedComponent } from './assembly.js';
import type { Component } from './components.js';

const PAPER = kilogramsPerCubicMetre(700);
const BALSA = kilogramsPerCubicMetre(160);
const PLYWOOD = kilogramsPerCubicMetre(600);
const PLASTIC = kilogramsPerCubicMetre(1050);
const FIBERGLASS = kilogramsPerCubicMetre(1850);
const NYLON = kilogramsPerCubicMetre(1150);

const m = metres;
const put = (position: number, component: Component): PlacedComponent => ({
  component,
  position: m(position),
});

export const R1_COMPONENTS: readonly PlacedComponent[] = [
  put(0, {
    kind: 'noseCone',
    shape: 'conical',
    length: m(0.1),
    baseRadius: m(0.025),
    density: BALSA,
  }),
  put(0.1, {
    kind: 'bodyTube',
    length: m(0.5),
    outerRadius: m(0.025),
    wallThickness: m(0.001),
    density: PAPER,
  }),
  put(0.5, {
    kind: 'finSet',
    count: 3,
    rootChord: m(0.1),
    tipChord: m(0.05),
    sweep: m(0.05),
    span: m(0.08),
    thickness: m(0.003),
    density: PLYWOOD,
    bodyRadius: m(0.025),
  }),
  put(0.1, { kind: 'massComponent', mass: kilograms(0.03), length: m(0.02), radius: m(0.02) }),
  put(0.35, {
    kind: 'launchLug',
    length: m(0.05),
    outerRadius: m(0.003),
    wallThickness: m(0.0005),
    density: PAPER,
    radialOffset: m(0.028),
  }),
  put(0.525, {
    kind: 'innerTube',
    length: m(0.075),
    outerRadius: m(0.0125),
    wallThickness: m(0.0005),
    density: PAPER,
  }),
  put(0.53, {
    kind: 'centeringRing',
    length: m(0.005),
    outerRadius: m(0.024),
    innerRadius: m(0.0125),
    density: PAPER,
  }),
  put(0.59, {
    kind: 'centeringRing',
    length: m(0.005),
    outerRadius: m(0.024),
    innerRadius: m(0.0125),
    density: PAPER,
  }),
  put(0.2, { kind: 'parachute', mass: kilograms(0.01), length: m(0.05), radius: m(0.02) }),
];

export const R2_COMPONENTS: readonly PlacedComponent[] = [
  put(0, {
    kind: 'noseCone',
    shape: 'ogive',
    shapeParameter: 1,
    length: m(0.15),
    baseRadius: m(0.027),
    wallThickness: m(0.002),
    density: PLASTIC,
    aftShoulder: { length: m(0.04), radius: m(0.0255), wallThickness: m(0.002) },
  }),
  put(0.15, {
    kind: 'bodyTube',
    length: m(0.6),
    outerRadius: m(0.027),
    wallThickness: m(0.0015),
    density: PAPER,
  }),
  put(0.63, {
    kind: 'finSet',
    count: 3,
    rootChord: m(0.12),
    tipChord: m(0.04),
    sweep: m(0.08),
    span: m(0.07),
    thickness: m(0.003),
    density: PLYWOOD,
    bodyRadius: m(0.027),
  }),
  put(0.45, {
    kind: 'railButton',
    count: 2,
    separation: m(0.25),
    outerDiameter: m(0.01),
    innerDiameter: m(0.006),
    totalHeight: m(0.01),
    baseHeight: m(0.002),
    flangeHeight: m(0.002),
    density: NYLON,
    bodyRadius: m(0.027),
  }),
  put(0.62, {
    kind: 'innerTube',
    length: m(0.13),
    outerRadius: m(0.0155),
    wallThickness: m(0.0005),
    density: PAPER,
  }),
  put(0.625, {
    kind: 'centeringRing',
    length: m(0.005),
    outerRadius: m(0.0255),
    innerRadius: m(0.0155),
    density: PLYWOOD,
  }),
  put(0.74, {
    kind: 'centeringRing',
    length: m(0.005),
    outerRadius: m(0.0255),
    innerRadius: m(0.0155),
    density: PLYWOOD,
  }),
  put(0.3, { kind: 'parachute', mass: kilograms(0.03), length: m(0.06), radius: m(0.022) }),
  put(0.2, { kind: 'massComponent', mass: kilograms(0.05), length: m(0.05), radius: m(0.02) }),
  put(0.75, {
    kind: 'transition',
    shape: 'conical',
    length: m(0.05),
    foreRadius: m(0.027),
    aftRadius: m(0.018),
    wallThickness: m(0.0015),
    density: PLASTIC,
  }),
];

export const R3_COMPONENTS: readonly PlacedComponent[] = [
  put(0, {
    kind: 'noseCone',
    shape: 'haack',
    shapeParameter: 0,
    length: m(0.1),
    baseRadius: m(0.0127),
    wallThickness: m(0.002),
    density: FIBERGLASS,
    aftShoulder: { length: m(0.03), radius: m(0.0117), wallThickness: m(0.0015) },
  }),
  put(0.1, {
    kind: 'bodyTube',
    length: m(0.45),
    outerRadius: m(0.0127),
    wallThickness: m(0.0007),
    density: FIBERGLASS,
  }),
  put(0.48, {
    kind: 'finSet',
    count: 3,
    rootChord: m(0.07),
    tipChord: m(0.03),
    sweep: m(0.045),
    span: m(0.035),
    thickness: m(0.002),
    density: FIBERGLASS,
    bodyRadius: m(0.0127),
  }),
  put(0.3, {
    kind: 'railButton',
    count: 2,
    separation: m(0.2),
    outerDiameter: m(0.008),
    innerDiameter: m(0.004),
    totalHeight: m(0.008),
    baseHeight: m(0.0015),
    flangeHeight: m(0.0015),
    density: NYLON,
    bodyRadius: m(0.0127),
  }),
  put(0.1, { kind: 'massComponent', mass: kilograms(0.01), length: m(0.03), radius: m(0.01) }),
  put(0.15, { kind: 'parachute', mass: kilograms(0.015), length: m(0.08), radius: m(0.011) }),
];

export const R4_COMPONENTS: readonly PlacedComponent[] = [
  put(0, {
    kind: 'noseCone',
    shape: 'ogive',
    shapeParameter: 1,
    length: m(0.2),
    baseRadius: m(0.033),
    wallThickness: m(0.003),
    density: PLASTIC,
    aftShoulder: { length: m(0.05), radius: m(0.031), wallThickness: m(0.003) },
  }),
  put(0.2, {
    kind: 'bodyTube',
    length: m(0.8),
    outerRadius: m(0.033),
    wallThickness: m(0.002),
    density: FIBERGLASS,
  }),
  put(0.3, { kind: 'massComponent', mass: kilograms(0.15), length: m(0.1), radius: m(0.025) }),
  put(0.45, {
    kind: 'bulkhead',
    length: m(0.006),
    outerRadius: m(0.031),
    innerRadius: m(0),
    density: PLYWOOD,
  }),
  put(0.48, { kind: 'parachute', mass: kilograms(0.1), length: m(0.12), radius: m(0.03) }),
  put(0.8, {
    kind: 'innerTube',
    length: m(0.2),
    outerRadius: m(0.0195),
    wallThickness: m(0.0015),
    density: PAPER,
  }),
  put(0.81, {
    kind: 'centeringRing',
    length: m(0.006),
    outerRadius: m(0.031),
    innerRadius: m(0.0195),
    density: PLYWOOD,
  }),
  put(0.984, {
    kind: 'centeringRing',
    length: m(0.006),
    outerRadius: m(0.031),
    innerRadius: m(0.0195),
    density: PLYWOOD,
  }),
  put(0.85, {
    kind: 'finSet',
    count: 4,
    rootChord: m(0.15),
    tipChord: m(0.06),
    sweep: m(0.09),
    span: m(0.08),
    thickness: m(0.004),
    density: PLYWOOD,
    bodyRadius: m(0.033),
  }),
  put(0.6, {
    kind: 'railButton',
    count: 2,
    separation: m(0.35),
    outerDiameter: m(0.01),
    innerDiameter: m(0.006),
    totalHeight: m(0.01),
    baseHeight: m(0.002),
    flangeHeight: m(0.002),
    density: NYLON,
    bodyRadius: m(0.033),
  }),
];

export const R5_COMPONENTS: readonly PlacedComponent[] = [
  put(0, {
    kind: 'noseCone',
    shape: 'haack',
    shapeParameter: 0,
    length: m(0.13),
    baseRadius: m(0.016),
    wallThickness: m(0.002),
    density: FIBERGLASS,
    aftShoulder: { length: m(0.03), radius: m(0.0145), wallThickness: m(0.0015) },
  }),
  put(0.13, {
    kind: 'bodyTube',
    length: m(0.55),
    outerRadius: m(0.016),
    wallThickness: m(0.0015),
    density: FIBERGLASS,
  }),
  put(0.605, {
    kind: 'finSet',
    count: 3,
    rootChord: m(0.075),
    tipChord: m(0.025),
    sweep: m(0.05),
    span: m(0.035),
    thickness: m(0.002),
    density: FIBERGLASS,
    bodyRadius: m(0.016),
  }),
  put(0.38, {
    kind: 'railButton',
    count: 2,
    separation: m(0.25),
    outerDiameter: m(0.008),
    innerDiameter: m(0.004),
    totalHeight: m(0.008),
    baseHeight: m(0.0015),
    flangeHeight: m(0.0015),
    density: NYLON,
    bodyRadius: m(0.016),
  }),
  put(0.13, { kind: 'massComponent', mass: kilograms(0.04), length: m(0.04), radius: m(0.012) }),
  put(0.19, { kind: 'parachute', mass: kilograms(0.02), length: m(0.1), radius: m(0.014) }),
];

/** Motors as cylinders: mass at liftoff and at burnout from the RASP headers in reference/motors. */
export const REFERENCE_MOTORS = {
  r1: {
    designation: 'D12',
    diameter: 0.024,
    length: 0.07,
    totalMass: 0.0426,
    propellantMass: 0.0211,
    aftEnd: 0.6,
  },
  r2: {
    designation: 'G80NBT',
    diameter: 0.029,
    length: 0.123825,
    totalMass: 0.129,
    propellantMass: 0.069,
    aftEnd: 0.75,
  },
  r3: {
    designation: 'F39T',
    diameter: 0.024,
    length: 0.07,
    totalMass: 0.059,
    propellantMass: 0.0227,
    aftEnd: 0.55,
  },
  r4: {
    designation: 'H123W',
    diameter: 0.038,
    length: 0.154,
    totalMass: 0.278656,
    propellantMass: 0.126336,
    aftEnd: 1.0,
  },
  r5: {
    designation: 'H238T',
    diameter: 0.029,
    length: 0.194,
    totalMass: 0.18816,
    propellantMass: 0.08064,
    aftEnd: 0.68,
  },
} as const;
