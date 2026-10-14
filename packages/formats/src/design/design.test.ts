/**
 * Design model, file format and physics adapter (plan 0011). The expected
 * physics figures are those of docs/reports/phase-1-acceptance.md and
 * phase-2-acceptance.md for R1 (not derived by running this code).
 */
import fc from 'fast-check';
import {
  componentMassProperties,
  kilograms,
  metres,
  metresPerSecond,
  radians,
  seconds,
  simulateFlight,
  type Component,
} from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { DesignError, DesignFileError } from './errors.js';
import { exampleDesign, newDesign } from './example.js';
import { applyMigrations, type Migration } from './migrate.js';
import { CURRENT_SCHEMA_VERSION, type RocketDesign } from './model.js';
import { parseDesign, serializeDesign } from './serialize.js';
import { validateDesign } from './validate.js';
import {
  designFlightWarnings,
  designMassProperties,
  designSimulationOptions,
  designStability,
  designThrustToWeight,
  designVehicle,
  designWindModel,
} from './to-physics.js';

const FAST_CHECK_SEED = 20261012;

describe('serialization round trip', () => {
  it('the example design survives serialize → parse unchanged, and the text is stable', () => {
    const d = exampleDesign();
    const text = serializeDesign(d);
    expect(parseDesign(text, 'example.lofi.json')).toEqual(d);
    expect(serializeDesign(parseDesign(text))).toBe(text);
    expect(text.startsWith('{\n  "components": [')).toBe(true);
  });
  it('random tube-and-fin designs round-trip with equal numbers', () => {
    const positive = fc.double({ min: 1e-4, max: 10, noNaN: true, noDefaultInfinity: true });
    fc.assert(
      fc.property(positive, positive, positive, fc.integer({ min: 1, max: 8 }), (l, r, w, n) => {
        const tube: Component = {
          kind: 'bodyTube',
          length: metres(l),
          outerRadius: metres(r),
          wallThickness: metres(w),
          density: 700 as Component extends { density: infer D } ? D : never,
        };
        const fins: Component = {
          kind: 'finSet',
          count: n,
          rootChord: metres(l / 4),
          tipChord: metres(l / 8),
          sweep: metres(l / 10),
          span: metres(r),
          thickness: metres(w),
          density: 600 as Component extends { density: infer D } ? D : never,
          bodyRadius: metres(r),
        };
        const d: RocketDesign = {
          ...newDesign('id', 'random'),
          components: [
            { id: 'a', name: 'tube', position: metres(0), component: tube },
            { id: 'b', name: 'fins', position: metres(l * 0.75), component: fins },
          ],
        };
        return JSON.stringify(parseDesign(serializeDesign(d))) === JSON.stringify(d);
      }),
      { seed: FAST_CHECK_SEED, numRuns: 100 },
    );
  });
});

describe('validation names the path and the problem', () => {
  const base = (): Record<string, unknown> =>
    JSON.parse(serializeDesign(exampleDesign())) as Record<string, unknown>;
  const expectFail = (mutate: (doc: Record<string, unknown>) => void, pattern: RegExp): void => {
    const doc = base();
    mutate(doc);
    expect(() => validateDesign(doc, 'r.lofi.json')).toThrow(DesignFileError);
    expect(() => validateDesign(doc, 'r.lofi.json')).toThrow(pattern);
  };
  const components = (doc: Record<string, unknown>): Record<string, unknown>[] =>
    doc['components'] as Record<string, unknown>[];
  it('missing field, wrong type, unknown key, unknown kind, bad id, duplicate id', () => {
    expectFail((d) => {
      delete d['recovery'];
    }, /r\.lofi\.json, \$: missing required field "recovery"/);
    expectFail((d) => {
      (components(d)[1]!['component'] as Record<string, unknown>)['length'] = '0.5';
    }, /\$\.components\[1\]\.component\.length: expected a finite number, received the string "0.5"/);
    expectFail((d) => {
      d['colour'] = 'red';
    }, /\$: unknown field "colour"/);
    expectFail((d) => {
      (components(d)[0]!['component'] as Record<string, unknown>)['kind'] = 'pod';
    }, /\$\.components\[0\]\.component\.kind: expected one of noseCone, .*received "pod"/);
    expectFail((d) => {
      components(d)[0]!['id'] = '';
    }, /\$\.components\[0\]\.id: must not be empty/);
    expectFail((d) => {
      components(d)[1]!['id'] = 'nose';
    }, /\$\.components\[1\]\.id: duplicate id "nose"/);
  });
  it('mass overrides (D-073): round trip, mass applied, bad values rejected', () => {
    const d = exampleDesign();
    const nose = d.components[0];
    if (nose === undefined) throw new Error('no nose');
    const withOverride: RocketDesign = {
      ...d,
      components: [
        { ...nose, massOverride: { mass: kilograms(0.05), cg: metres(0.03) } },
        ...d.components.slice(1),
      ],
    };
    const text = serializeDesign(withOverride);
    expect(parseDesign(text)).toEqual(withOverride);
    // The nose's computed mass is replaced by 0.05 kg, so the total grows by 0.05 − m_nose.
    const before = designMassProperties(d, 'liftoff').mass;
    const after = designMassProperties(withOverride, 'liftoff').mass;
    const noseMass = componentMassProperties(nose.component).mass;
    expect(after - before).toBeCloseTo(0.05 - noseMass, 12);
    expectFail((doc) => {
      components(doc)[0]!['massOverride'] = { mass: -1 };
    }, /\$\.components\[0\]\.massOverride\.mass: must be 0 kg or more/);
    expectFail((doc) => {
      components(doc)[0]!['massOverride'] = {};
    }, /\$\.components\[0\]\.massOverride: must give a mass, a CG or both/);
    expectFail((doc) => {
      components(doc)[0]!['massOverride'] = { weight: 1 };
    }, /unknown field "weight"/);
  });
  it('motor mount must point at a tube; altitude deployment needs an altitude; overrides come in pairs', () => {
    expectFail((d) => {
      (d['motorMount'] as Record<string, unknown>)['componentId'] = 'fins';
    }, /\$\.motorMount\.componentId: the motor mount must be an inner tube or a body tube, "Fins" is a finSet/);
    expectFail((d) => {
      (d['motorMount'] as Record<string, unknown>)['componentId'] = 'nowhere';
    }, /no component has the id "nowhere"/);
    expectFail((d) => {
      ((d['recovery'] as Record<string, unknown>[])[0]!['deploy'] as Record<string, unknown>)[
        'event'
      ] = 'altitude';
    }, /\$\.recovery\[0\]\.deploy: an altitude deployment needs "altitude"/);
    expectFail((d) => {
      ((d['launch'] as Record<string, unknown>)['site'] as Record<string, unknown>)['temperature'] =
        300;
    }, /\$\.launch\.site: temperature and pressure overrides must be given together/);
  });
  it('schema version: not JSON, no version, newer than the app, missing migration', () => {
    expect(() => parseDesign('{ not json', 'x.lofi.json')).toThrow(
      /x\.lofi\.json, \$: not valid JSON/,
    );
    expect(() => parseDesign('[]')).toThrow(/\$: expected a JSON object/);
    expect(() => parseDesign('{"schemaVersion":"1"}')).toThrow(
      /\$\.schemaVersion: expected a positive integer, received string/,
    );
    expect(() => parseDesign(`{"schemaVersion":${String(CURRENT_SCHEMA_VERSION + 1)}}`)).toThrow(
      new RegExp(
        `this file is version ${String(CURRENT_SCHEMA_VERSION + 1)} but this app reads up to version ${String(CURRENT_SCHEMA_VERSION)}; update the app`,
      ),
    );
    expect(() => applyMigrations({ schemaVersion: 1 }, [], 2)).toThrow(
      /no migration from version 1 to 2/,
    );
  });
  it('a migration chain upgrades step by step and stamps the version', () => {
    const steps: Migration[] = [
      (doc) => ({ ...doc, a: 1 }),
      (doc) => ({ ...doc, b: (doc['a'] as number) + 1 }),
    ];
    expect(applyMigrations({ schemaVersion: 1 }, steps, 3)).toEqual({
      schemaVersion: 3,
      a: 1,
      b: 2,
    });
    expect(applyMigrations({ schemaVersion: 2, a: 5 }, steps, 3)).toEqual({
      schemaVersion: 3,
      a: 5,
      b: 6,
    });
    expect(applyMigrations({ schemaVersion: 3, z: 0 }, steps, 3)).toEqual({
      schemaVersion: 3,
      z: 0,
    });
  });
});

describe('physics adapter on the example (R1 with the D12)', () => {
  const d = exampleDesign();
  it('mass and CG at liftoff and burnout match values.csv (0.190904 kg / 0.387022 m; 0.169804 / 0.364906)', () => {
    const lo = designMassProperties(d, 'liftoff');
    const bo = designMassProperties(d, 'burnout');
    expect(lo.mass).toBeCloseTo(0.190904, 6);
    expect(lo.cg).toBeCloseTo(0.387022, 6);
    expect(bo.mass).toBeCloseTo(0.169804, 6);
    expect(bo.cg).toBeCloseTo(0.364906, 5);
    expect(designMassProperties(d, 'no-motor').mass).toBeCloseTo(0.190904 - 0.0426, 6);
  });
  it('CP and margins: displayed 0.478890 m (1.8374 / 2.2797 calibers), OpenRocket-equivalent 0.487227 m (Phase 1 report)', () => {
    const shown = designStability(d);
    expect(shown.result.centreOfPressure.cp).toBeCloseTo(0.47889, 5);
    expect(shown.result.marginLiftoff).toBeCloseTo(1.8374, 3);
    expect(shown.result.marginBurnout).toBeCloseTo(2.2797, 3);
    expect(shown.noMotor).toBe(false);
    expect(shown.liftoff.level).toBe('typical');
    expect(shown.burnout.level).toBe('overstable');
    expect(shown.burnout.message).toMatch(/weathercock/);
    const or = designStability(d, 'openrocket-equivalent');
    expect(or.result.centreOfPressure.cp).toBeCloseTo(0.487227, 5);
    expect(or.result.marginLiftoff).toBeCloseTo(2.0041, 3);
  });
  it('without a motor the margins use the empty rocket and the vehicle cannot be built', () => {
    const noMotor: RocketDesign = {
      ...d,
      motorMount: { componentId: 'mount', overhang: metres(0) },
    };
    const s = designStability(noMotor);
    expect(s.noMotor).toBe(true);
    expect(s.result.cgLiftoff).toBe(s.result.cgBurnout);
    expect(s.result.cgLiftoff).toBeCloseTo(designMassProperties(d, 'no-motor').cg, 12);
    expect(() => designVehicle(noMotor)).toThrow(DesignError);
    expect(() => designVehicle(noMotor)).toThrow(/no motor is selected/);
    expect(designThrustToWeight(noMotor)).toBeUndefined();
  });
  it('thrust to weight: 16.839 N·s / 1.65 s = 10.205 N over 0.190904 × 9.80665 = 1.87213 N gives 5.451', () => {
    expect(designThrustToWeight(d)).toBeCloseTo(5.451, 3);
  });
  it('the displayed flight gives 172.94 m with the DATCOM base drag (167.33 m with Niskanen base drag before D-069) and the OpenRocket-equivalent 166.19 m (168.87 m before D-108; OpenRocket 167.045 m)', () => {
    const rk: RocketDesign = {
      ...d,
      simulation: {
        ...d.simulation,
        integrator: { kind: 'rk4', timeStep: seconds(0.002) },
        recordInterval: seconds(0.05),
      },
    };
    const shown = simulateFlight(designVehicle(rk), designSimulationOptions(rk));
    expect(shown.summary.apogee).toBeCloseTo(172.94, 2);
    expect(shown.modes.finRollReduction).toBe(true);
    expect(shown.modes.baseDragMotorRule).toBe('while-thrusting');
    expect(shown.modes.gravitySeaLevel).toBe(9.80665);
    const or = simulateFlight(
      designVehicle(rk),
      designSimulationOptions(rk, 'openrocket-equivalent'),
    );
    // D-108: OpenRocket's full base (no motor area removed) and its own rail button drag.
    expect(or.summary.apogee).toBeCloseTo(166.187, 2);
    expect(or.modes.baseDragMotorRule).toBe('never');
    expect(or.modes.railButtonDragMethod).toBe('openrocket');
    expect(designFlightWarnings(rk, shown)).toEqual([]);
    // Three full flights: the same allowance as the other full-flight tests.
  }, 30000);
  it('warnings fire on the thresholds and explain why', () => {
    const strict: RocketDesign = {
      ...d,
      recovery: [],
      simulation: { ...d.simulation, maxTime: seconds(3) },
      warningThresholds: {
        minRailExitVelocity: d.warningThresholds.minRailExitVelocity,
        minThrustToWeight: 6,
        maxDeploymentVelocity: d.warningThresholds.maxDeploymentVelocity,
      },
    };
    const r = simulateFlight(designVehicle(strict), designSimulationOptions(strict));
    const codes = designFlightWarnings(strict, r).map((w) => w.code);
    expect(codes).toEqual(['thrust-to-weight', 'no-recovery', 'max-time']);
    const tall: RocketDesign = {
      ...d,
      warningThresholds: { ...d.warningThresholds, minRailExitVelocity: 20 as never },
    };
    const w = designFlightWarnings(
      tall,
      simulateFlight(designVehicle(tall), designSimulationOptions(tall)),
    );
    expect(w[0]?.code).toBe('rail-exit-velocity');
    expect(w[0]?.message).toMatch(/below 20 m\/s: the fins may not have enough airflow/);
  });
});

describe('wind settings (plan 0016)', () => {
  it('a profile and turbulence round-trip through the file and map to the physics models', () => {
    const d = exampleDesign('wind');
    const windy: RocketDesign = {
      ...d,
      launch: {
        ...d.launch,
        wind: {
          speed: d.launch.wind.speed,
          from: d.launch.wind.from,
          profile: [
            { altitude: metres(0), speed: metresPerSecond(3), from: radians(0) },
            { altitude: metres(200), speed: metresPerSecond(8), from: radians(0.5) },
          ],
          turbulence: { intensity: 0.15, seed: 99 },
        },
      },
    };
    expect(parseDesign(serializeDesign(windy))).toEqual(windy);
    const model = designWindModel(windy.launch.wind);
    expect(model.kind).toBe('turbulent');
    if (model.kind === 'turbulent') {
      expect(model.seed).toBe(99);
      expect(model.mean.kind).toBe('profile');
    }
    expect(designWindModel(d.launch.wind)).toEqual({ kind: 'constant', speed: 0, from: 0 });
    const doc = JSON.parse(serializeDesign(windy)) as Record<string, unknown>;
    (doc['launch'] as { wind: Record<string, unknown> }).wind['turbulence'] = {
      intensity: 0.1,
      seed: 1.5,
    };
    expect(() => validateDesign(doc)).toThrow(
      /\$\.launch\.wind\.turbulence\.seed: expected an integer/,
    );
  });
});
