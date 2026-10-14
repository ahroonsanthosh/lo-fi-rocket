/**
 * Random but sensible rocket designs for the robustness tests (plan 0065): what a builder could
 * make from tubes, a nose, fins, a motor that fits, rings, masses and a parachute, one or two
 * stages, flown from an ordinary pad. Test support only: every figure comes from a fast-check
 * arbitrary, nothing here is physics.
 */
import fc from 'fast-check';
import {
  kilograms,
  kilogramsPerCubicMetre,
  metres,
  metresPerSecond,
  radians,
  seconds,
  type MotorDefinition,
  type NoseShape,
} from '@lo-fi-rocket/physics';
import { parseEng } from '../eng.js';
import { motorFromEng } from '../motor-definition.js';
import { BUNDLED_MOTOR_FILES } from '../motors/bundled.js';
import { newDesign } from '../design/example.js';
import type {
  DesignComponent,
  DesignRecoveryDevice,
  MotorMount,
  RocketDesign,
} from '../design/model.js';

/** The bundled motors, each with its file name for the provenance. */
export const RANDOM_MOTORS: readonly {
  readonly file: string;
  readonly definition: MotorDefinition;
}[] = BUNDLED_MOTOR_FILES.map(({ file, text }) => {
  const [eng] = parseEng(text, file);
  if (eng === undefined) throw new Error(`no motor in ${file}`);
  return { file, definition: motorFromEng(eng) };
});

const SHAPES: readonly NoseShape[] = [
  'conical',
  'ogive',
  'elliptical',
  'parabolic',
  'power',
  'haack',
];

/** One stage's airframe: tubes, fins at the aft end, a motor tube and its motor. */
interface StageDraft {
  readonly tubes: readonly number[];
  readonly fins: {
    readonly count: number;
    readonly root: number;
    readonly tip: number;
    readonly sweep: number;
    readonly span: number;
    readonly thickness: number;
    readonly section: 'square' | 'rounded' | 'airfoil' | 'wedge' | 'double-wedge';
  };
  readonly motor: number;
  readonly delay: number | undefined;
  readonly overhang: number;
}

const stageDraft = fc.record({
  // At least 0.3 m, so that the longest bundled motor's tube (0.2 m) sits inside its stage's last tube.
  tubes: fc.array(fc.double({ min: 0.3, max: 1.2, noNaN: true }), { minLength: 1, maxLength: 3 }),
  fins: fc.record({
    count: fc.integer({ min: 2, max: 6 }),
    root: fc.double({ min: 1, max: 6, noNaN: true }),
    tip: fc.double({ min: 0, max: 1, noNaN: true }),
    sweep: fc.double({ min: 0, max: 1.5, noNaN: true }),
    span: fc.double({ min: 0.8, max: 4, noNaN: true }),
    thickness: fc.double({ min: 0.0015, max: 0.006, noNaN: true }),
    section: fc.constantFrom('square', 'rounded', 'airfoil', 'wedge', 'double-wedge' as const),
  }),
  motor: fc.integer({ min: 0, max: RANDOM_MOTORS.length - 1 }),
  delay: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
  overhang: fc.double({ min: 0, max: 0.02, noNaN: true }),
});

/** The design drawn: a nose, one or two stages, a payload mass, a parachute and the pad. */
export const randomDesign: fc.Arbitrary<RocketDesign> = fc
  .record({
    // The body radius in units of the largest motor's radius, so every motor fits a motor tube.
    radius: fc.double({ min: 0.012, max: 0.08, noNaN: true }),
    nose: fc.record({
      shape: fc.constantFrom(...SHAPES),
      length: fc.double({ min: 1.5, max: 8, noNaN: true }),
      wall: fc.option(fc.double({ min: 0.001, max: 0.004, noNaN: true }), { nil: undefined }),
    }),
    stages: fc.array(stageDraft, { minLength: 1, maxLength: 2 }),
    payload: fc.double({ min: 0, max: 0.5, noNaN: true }),
    chute: fc.record({
      diameter: fc.double({ min: 0.2, max: 2, noNaN: true }),
      event: fc.constantFrom('apogee', 'ejection', 'altitude' as const),
    }),
    rail: fc.record({
      length: fc.double({ min: 1, max: 3, noNaN: true }),
      angle: fc.double({ min: 0, max: 0.3, noNaN: true }),
      azimuth: fc.double({ min: 0, max: 6.28, noNaN: true }),
    }),
    wind: fc.record({
      speed: fc.double({ min: 0, max: 8, noNaN: true }),
      from: fc.double({ min: 0, max: 6.28, noNaN: true }),
    }),
  })
  .map((draw) => build(draw));

function build(draw: {
  radius: number;
  nose: { shape: NoseShape; length: number; wall: number | undefined };
  stages: readonly StageDraft[];
  payload: number;
  chute: { diameter: number; event: 'apogee' | 'ejection' | 'altitude' };
  rail: { length: number; angle: number; azimuth: number };
  wind: { speed: number; from: number };
}): RocketDesign {
  const paper = kilogramsPerCubicMetre(700);
  const ply = kilogramsPerCubicMetre(600);
  const staged = draw.stages.length > 1;
  // The body must hold the widest motor in a 1 mm motor tube with 2 mm to spare.
  const widest = Math.max(
    ...draw.stages.map((s) => (RANDOM_MOTORS[s.motor]?.definition.diameter as number) / 2),
  );
  const r = Math.max(draw.radius, widest + 0.003);
  const components: DesignComponent[] = [];
  const mounts: MotorMount[] = [];
  let x = 0;
  const add = (c: Omit<DesignComponent, 'id'>, stage: number): string => {
    const id = `p${String(components.length)}`;
    components.push({ id, ...c, ...(staged && stage > 0 ? { stage } : {}) });
    return id;
  };
  add(
    {
      name: 'Nose cone',
      position: metres(0),
      component: {
        kind: 'noseCone',
        shape: draw.nose.shape,
        length: metres(draw.nose.length * r),
        baseRadius: metres(r),
        density: kilogramsPerCubicMetre(draw.nose.wall === undefined ? 160 : 1050),
        ...(draw.nose.wall === undefined ? {} : { wallThickness: metres(draw.nose.wall) }),
      },
    },
    0,
  );
  x = draw.nose.length * r;
  draw.stages.forEach((s, k) => {
    let first = true;
    for (const length of s.tubes) {
      add(
        {
          name: `Body tube ${String(k + 1)}`,
          position: metres(x),
          component: {
            kind: 'bodyTube',
            length: metres(length),
            outerRadius: metres(r),
            wallThickness: metres(0.001),
            density: paper,
          },
        },
        k,
      );
      if (first && k === 0) {
        add(
          {
            name: 'Payload',
            position: metres(x + 0.01),
            component: {
              kind: 'massComponent',
              mass: kilograms(draw.payload),
              length: metres(0.02),
              radius: metres(r * 0.8),
            },
          },
          k,
        );
        add(
          {
            name: 'Parachute (packed)',
            position: metres(x + 0.04),
            component: {
              kind: 'parachute',
              mass: kilograms(0.02),
              length: metres(0.05),
              radius: metres(r * 0.7),
            },
          },
          k,
        );
      }
      first = false;
      x += length;
    }
    const f = s.fins;
    const root = Math.min(f.root * r, s.tubes[s.tubes.length - 1] ?? 0.1);
    add(
      {
        name: `Fins ${String(k + 1)}`,
        position: metres(x - root),
        component: {
          kind: 'finSet',
          crossSection: f.section,
          count: f.count,
          rootChord: metres(root),
          tipChord: metres(f.tip * root),
          sweep: metres(f.sweep * root),
          span: metres(f.span * r),
          thickness: metres(f.thickness),
          density: ply,
          bodyRadius: metres(r),
        },
      },
      k,
    );
    const motor = RANDOM_MOTORS[s.motor];
    if (motor === undefined) throw new Error('no motor');
    const length = (motor.definition.length as number) + 0.01;
    const tube = add(
      {
        name: `Motor tube ${String(k + 1)}`,
        position: metres(x - length),
        component: {
          kind: 'innerTube',
          length: metres(length),
          outerRadius: metres((motor.definition.diameter as number) / 2 + 0.001),
          wallThickness: metres(0.0009),
          density: paper,
        },
      },
      k,
    );
    mounts.push({
      componentId: tube,
      overhang: metres(s.overhang),
      motor: {
        definition: motor.definition,
        provenance: { kind: 'bundled', file: motor.file },
        ...(s.delay === undefined ? {} : { ejectionDelay: seconds(s.delay) }),
      },
    });
  });
  const recovery: DesignRecoveryDevice[] = [
    {
      id: 'chute',
      name: 'Parachute',
      diameter: metres(draw.chute.diameter),
      dragCoefficient: 0.8,
      deploy: {
        event: draw.chute.event,
        delay: seconds(0),
        ...(draw.chute.event === 'altitude' ? { altitude: metres(100) } : {}),
      },
    },
  ];
  const base = newDesign('random', 'Random design');
  const [first, ...rest] = mounts;
  return {
    ...base,
    components,
    ...(first === undefined ? {} : { motorMount: first }),
    ...(rest.length === 0 ? {} : { additionalMotorMounts: rest }),
    ...(staged
      ? {
          stages: draw.stages.map((_, k) =>
            k === 0
              ? { name: 'Sustainer' }
              : {
                  name: `Booster ${String(k)}`,
                  separation: { event: 'upper-ignition' as const, delay: seconds(0) },
                },
          ),
        }
      : {}),
    recovery,
    launch: {
      site: { altitude: metres(0) },
      rail: {
        length: metres(draw.rail.length),
        angleFromVertical: radians(draw.rail.angle),
        azimuth: radians(draw.rail.azimuth),
      },
      wind: { speed: metresPerSecond(draw.wind.speed), from: radians(draw.wind.from) },
    },
  };
}
