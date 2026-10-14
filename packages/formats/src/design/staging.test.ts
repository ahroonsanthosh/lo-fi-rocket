/**
 * Multi-stage designs (plan 0064 part 2, schema 2): the file's stages, the motors' ignition events
 * as OpenRocket's (reference/rockets/staging-probe/values.txt) and the vehicle the physics flies.
 */
import {
  burnTime,
  kilogramsPerCubicMetre,
  metres,
  seconds,
  simulateFlight,
  STANDARD_GRAVITY,
  totalImpulse,
} from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { withoutComponent } from './defaults.js';
import {
  stageMotorMount,
  stageRemovalProblem,
  withBottomStageRemoved,
  withComponentStage,
  withStageAdded,
  withStageMotorMount,
} from './stages.js';
import { ESTES_D12, exampleDesign } from './example.js';
import { CURRENT_SCHEMA_VERSION, type DesignComponent, type RocketDesign } from './model.js';
import { parseDesign, serializeDesign } from './serialize.js';
import {
  designFlightWarnings,
  designIgnitions,
  designMassProperties,
  designSimulationOptions,
  designStability,
  designStageStability,
  designThrustToWeight,
  designVehicle,
} from './to-physics.js';

const PAPER = kilogramsPerCubicMetre(700);

/**
 * The example rocket (R1, D12-5) as the sustainer, on a booster of our own: a 0.3 m body tube from
 * 0.6 m, three fins and a 75 mm motor tube at its aft end holding a D12-0. Every ignition automatic.
 */
function twoStage(): RocketDesign {
  const r1 = exampleDesign('two-stage');
  const booster = (
    id: string,
    name: string,
    position: number,
    component: DesignComponent['component'],
  ): DesignComponent => ({ id, name, position: metres(position), component, stage: 1 });
  return {
    ...r1,
    components: [
      ...r1.components,
      booster('b-body', 'Booster body', 0.6, {
        kind: 'bodyTube',
        length: metres(0.3),
        outerRadius: metres(0.025),
        wallThickness: metres(0.001),
        density: PAPER,
      }),
      booster('b-fins', 'Booster fins', 0.8, {
        kind: 'finSet',
        crossSection: 'square',
        count: 3,
        rootChord: metres(0.1),
        tipChord: metres(0.05),
        sweep: metres(0.05),
        span: metres(0.08),
        thickness: metres(0.003),
        density: kilogramsPerCubicMetre(600),
        bodyRadius: metres(0.025),
      }),
      booster('b-mount', 'Booster motor tube', 0.825, {
        kind: 'innerTube',
        length: metres(0.075),
        outerRadius: metres(0.0125),
        wallThickness: metres(0.0005),
        density: PAPER,
      }),
    ],
    additionalMotorMounts: [
      {
        componentId: 'b-mount',
        overhang: metres(0),
        motor: {
          definition: ESTES_D12,
          provenance: { kind: 'bundled', file: 'Estes_D12.eng' },
          ejectionDelay: seconds(0),
        },
      },
    ],
    stages: [
      { name: 'Sustainer' },
      { name: 'Booster', separation: { event: 'upper-ignition', delay: seconds(0) } },
    ],
  };
}

describe('schema 2', () => {
  it('reads a version-1 file as the same one-stage design', () => {
    const design = exampleDesign();
    const v1 = serializeDesign(design).replace(
      `"schemaVersion": ${String(CURRENT_SCHEMA_VERSION)}`,
      '"schemaVersion": 1',
    );
    expect(v1).toContain('"schemaVersion": 1');
    expect(parseDesign(v1)).toEqual(design);
  });

  it('carries a staged design through a file exactly', () => {
    const design = twoStage();
    expect(parseDesign(serializeDesign(design))).toEqual(design);
  });

  it('names the path and the problem in a staged file', () => {
    const json = (d: unknown): string => JSON.stringify(d);
    const base = JSON.parse(serializeDesign(twoStage())) as Record<string, unknown>;
    const oneStage = Object.fromEntries(
      Object.entries(base).filter(([k]) => k !== 'stages' && k !== 'additionalMotorMounts'),
    );
    expect(() => parseDesign(json(oneStage))).toThrow(
      /\$\.components\[9\]\.stage: stage 1 given, but the design lists no stages/,
    );
    expect(() =>
      parseDesign(
        json({
          ...base,
          stages: [
            { name: 'S', separation: { event: 'never', delay: 0 } },
            { name: 'B', separation: { event: 'burnout', delay: 0 } },
          ],
        }),
      ),
    ).toThrow(/\$\.stages\[0\]\.separation: the top stage never separates/);
    expect(() => parseDesign(json({ ...base, stages: [{ name: 'S' }, { name: 'B' }] }))).toThrow(
      /\$\.stages\[1\]: missing required field "separation"/,
    );
    expect(() =>
      parseDesign(
        json({
          ...base,
          stages: [
            { name: 'S' },
            { name: 'B', separation: { event: 'altitude-descending', delay: 0 } },
          ],
        }),
      ),
    ).toThrow(/a separation at an altitude needs "altitude"/);
    expect(() =>
      parseDesign(
        json({
          ...base,
          additionalMotorMounts: [{ componentId: 'mount', overhang: 0 }],
        }),
      ),
    ).toThrow(/additionalMotorMounts\[0\]\.componentId: "Motor mount" is already a motor mount/);
    expect(() =>
      parseDesign(
        json({
          ...base,
          motorMount: {
            ...(base['motorMount'] as object),
            ignition: { event: 'sometimes', delay: 0 },
          },
        }),
      ),
    ).toThrow(/\$\.motorMount\.ignition\.event: expected one of automatic, launch/);
  });

  it('removes a part’s additional motor mount with the part', () => {
    const d = withoutComponent(twoStage(), 'b-mount');
    expect(d.additionalMotorMounts).toBeUndefined();
    expect(d.motorMount?.componentId).toBe('mount');
  });
});

describe('a two-stage design', () => {
  it('flies as the physics’ staged vehicle, the booster lit at launch and the sustainer at its charge', () => {
    const v = designVehicle(twoStage());
    expect(v.stages?.componentStage).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1]);
    expect(v.stages?.motors.map((m) => [m.name, m.stage, m.ignition])).toEqual([
      ['Sustainer D12', 0, { event: 'ejection', of: 1, delay: 0 }],
      ['Booster D12', 1, { event: 'launch', delay: 0 }],
    ]);
    expect(v.stages?.separation.map((s) => s.event)).toEqual(['never', 'upper-ignition']);
    expect(v.stages?.recoveryStage).toEqual([0]);
    expect(v.stages?.names).toEqual(['Sustainer', 'Booster']);
    // Motor aft ends: the sustainer's tube ends at 0.525 + 0.075 = 0.6 m, the booster's at 0.9 m.
    const [top, low] = v.stages?.motors.map((m) => m.motor.aftEnd) ?? [];
    expect(top).toBeCloseTo(0.6, 12);
    expect(low).toBeCloseTo(0.9, 12);
  });

  it('weighs both motors: 2 × 42.6 g loaded, 2 × 21.5 g spent, at their mid-lengths', () => {
    const d = twoStage();
    const empty = designMassProperties(d, 'no-motor');
    const liftoff = designMassProperties(d, 'liftoff');
    const burnout = designMassProperties(d, 'burnout');
    expect(liftoff.mass - empty.mass).toBeCloseTo(2 * 0.0426, 12);
    expect(burnout.mass - empty.mass).toBeCloseTo(2 * (0.0426 - 0.0211), 12);
    // Moments about the nose tip: the motors' CGs at 0.6 − 0.035 = 0.565 m and 0.9 − 0.035 = 0.865 m.
    const cg = (empty.mass * empty.cg + 0.0426 * 0.565 + 0.0426 * 0.865) / liftoff.mass;
    expect(liftoff.cg).toBeCloseTo(cg, 10);
  });

  it('takes its thrust-to-weight from the motors lit at launch only', () => {
    const d = twoStage();
    // One D12 (I / t_b) over the whole stack's weight with both motors loaded.
    const expected =
      totalImpulse(ESTES_D12) /
      burnTime(ESTES_D12) /
      (designMassProperties(d, 'liftoff').mass * STANDARD_GRAVITY);
    expect(designThrustToWeight(d)).toBeCloseTo(expected, 12);
  });

  it('lights the sustainer at the booster’s burnout charge and drops the booster then', () => {
    const d = twoStage();
    const r = simulateFlight(designVehicle(d), designSimulationOptions(d));
    const events = r.events.map((e) => [e.kind, Number((e.time as number).toFixed(3))]);
    // D12: burn time 1.65 s (its last data point); the booster's 0 s charge lights the sustainer.
    expect(events.filter(([k]) => k === 'ignition')).toEqual([
      ['ignition', 0],
      ['ignition', 1.65],
    ]);
    expect(events.filter(([k]) => k === 'separation')).toEqual([['separation', 1.65]]);
    expect(events.filter(([k]) => k === 'burnout')).toEqual([
      ['burnout', 1.65],
      ['burnout', 3.3],
    ]);
    expect(r.summary.apogee).toBeGreaterThan(
      simulateFlight(designVehicle(exampleDesign()), designSimulationOptions(exampleDesign()))
        .summary.apogee,
    );
    expect(designFlightWarnings(d, r).filter((w) => w.code === 'ignition')).toEqual([]);
  });
});

describe('ignition events', () => {
  it('say when a motor can never light: a middle stage with no motor (OpenRocket: it never does)', () => {
    const d = twoStage();
    const gap: RocketDesign = {
      ...d,
      components: d.components.map((c) => (c.stage === 1 ? { ...c, stage: 2 } : c)),
      stages: [
        { name: 'Sustainer' },
        { name: 'Middle', separation: { event: 'upper-ignition', delay: seconds(0) } },
        { name: 'Booster', separation: { event: 'upper-ignition', delay: seconds(0) } },
      ],
    };
    const [sustainer, booster] = designIgnitions(gap);
    expect(booster?.ignition).toEqual({ event: 'launch', delay: 0 });
    expect(sustainer?.ignition).toEqual({ event: 'never', delay: 0 });
    expect(sustainer?.problem).toBe(
      'The motor in "Motor mount" never ignites: it is set to ignite at the ejection charge of the motor in the stage below (automatic ignition), but Middle has no motor. Give that stage a motor, or set this motor to ignite at launch.',
    );
    const r = simulateFlight(designVehicle(gap), designSimulationOptions(gap));
    expect(r.events.filter((e) => e.kind === 'ignition')).toHaveLength(1);
    expect(designFlightWarnings(gap, r).map((w) => w.code)).toContain('ignition');
  });

  it('fly a one-stage rocket lit 1 s after launch through the staged path', () => {
    const r1 = exampleDesign();
    const late: RocketDesign = {
      ...r1,
      motorMount: { ...r1.motorMount!, ignition: { event: 'launch', delay: seconds(1) } },
    };
    const v = designVehicle(late);
    expect(v.stages?.motors.map((m) => m.ignition)).toEqual([{ event: 'launch', delay: 1 }]);
    const r = simulateFlight(v, designSimulationOptions(late));
    expect(r.events.find((e) => e.kind === 'ignition')?.time).toBe(1);
    expect(r.summary.burnoutTime).toBeCloseTo(2.65, 9);
  });

  it('leave a plain one-stage rocket on the unstaged path', () => {
    expect(designVehicle(exampleDesign()).stages).toBeUndefined();
  });
});

describe('each configuration’s stability', () => {
  it('the sustainer alone has exactly the one-stage example’s CP, CGs and margins', () => {
    const [stack, sustainer] = designStageStability(twoStage());
    const alone = designStability(exampleDesign()).result;
    expect(sustainer?.stage).toBe(0);
    expect(sustainer?.centreOfPressure.cp).toBe(alone.centreOfPressure.cp);
    expect(sustainer?.cgLoaded).toBe(alone.cgLiftoff);
    expect(sustainer?.cgSpent).toBe(alone.cgBurnout);
    expect(sustainer?.marginLoaded).toBe(alone.marginLiftoff);
    expect(sustainer?.marginSpent).toBe(alone.marginBurnout);
    // The whole stack: loaded is the liftoff CG; spent takes the booster's 21.1 g of propellant out
    // at the booster motor's mid-length, 0.9 − 0.035 = 0.865 m, the sustainer's motor still loaded.
    const d = twoStage();
    const liftoff = designMassProperties(d, 'liftoff');
    expect(stack?.stage).toBe(1);
    expect(stack?.cgLoaded).toBeCloseTo(liftoff.cg, 12);
    expect(stack?.cgSpent).toBeCloseTo(
      (liftoff.mass * liftoff.cg - 0.0211 * 0.865) / (liftoff.mass - 0.0211),
      10,
    );
    // The booster's fins move the stack's CP aft of the sustainer's.
    expect(stack?.centreOfPressure.cp).toBeGreaterThan(sustainer?.centreOfPressure.cp ?? Infinity);
  });

  it('a one-stage design has one configuration, designStability’s', () => {
    const r1 = exampleDesign();
    const [only, ...none] = designStageStability(r1);
    expect(none).toEqual([]);
    expect(only?.marginLoaded).toBe(designStability(r1).result.marginLiftoff);
    expect(only?.marginSpent).toBe(designStability(r1).result.marginBurnout);
  });
});

describe('editing the stages', () => {
  it('adds a booster below a one-stage rocket, and removes it again once it is empty', () => {
    const r1 = exampleDesign();
    const two = withStageAdded(r1);
    expect(two.stages).toEqual([
      { name: 'Sustainer' },
      { name: 'Booster', separation: { event: 'upper-ignition', delay: 0 } },
    ]);
    expect(withStageAdded(two).stages?.[2]?.name).toBe('Booster 2');
    expect(parseDesign(serializeDesign(two))).toEqual(two);
    // Back to one stage: no stage fields at all, the file as before.
    expect(serializeDesign(withBottomStageRemoved(two))).toBe(serializeDesign(r1));
  });

  it('refuses to remove a stage that still holds parts, saying what is in it', () => {
    const d = twoStage();
    expect(stageRemovalProblem(d)).toBe(
      'Booster still holds 3 parts: remove them or move them to another stage first.',
    );
    expect(() => withBottomStageRemoved(d)).toThrow(/Booster still holds 3 parts/);
    let moved = d;
    for (const id of ['b-body', 'b-fins', 'b-mount']) moved = withComponentStage(moved, id, 0);
    expect(moved.components.every((c) => c.stage === undefined)).toBe(true);
    expect(stageRemovalProblem(moved)).toBeUndefined();
  });

  it('sets each stage’s motor mount, keeping the other stage’s', () => {
    const d = twoStage();
    expect(stageMotorMount(d, 1)?.componentId).toBe('b-mount');
    expect(stageMotorMount(d, 0)?.componentId).toBe('mount');
    const boosterMount = stageMotorMount(d, 1);
    if (boosterMount === undefined) throw new Error('the two-stage design has a booster mount');
    const plugged = withStageMotorMount(d, 1, { ...boosterMount, overhang: metres(0.01) });
    expect(plugged.motorMount).toEqual(d.motorMount);
    expect(plugged.additionalMotorMounts?.[0]?.overhang).toBe(0.01);
    const none = withStageMotorMount(d, 0, undefined);
    // The booster's mount becomes the first.
    expect(none.motorMount?.componentId).toBe('b-mount');
    expect(none.additionalMotorMounts).toBeUndefined();
    expect(parseDesign(serializeDesign(none))).toEqual(none);
  });
});
