/**
 * Motor model tests (plan 0007). The D12 data are the twenty points of
 * reference/motors/Estes_D12.eng (header: D12 24 70 0-3-5-7 0.0211 0.0426 Estes),
 * written out here because the physics package cannot read files.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { rocketMassProperties } from '../geometry/assembly.js';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import { kilograms, metres, newtons, seconds } from '../units/si.js';
import {
  burnTime,
  impulseTo,
  motorCgAt,
  motorMassAt,
  motorStateAt,
  propellantRemainingAt,
  thrustAt,
  totalImpulse,
  validateMotor,
  type MotorDefinition,
} from './motor.js';

const D12_POINTS: readonly (readonly [number, number])[] = [
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
];

export const D12: MotorDefinition = {
  designation: 'D12',
  manufacturer: 'Estes',
  diameter: metres(0.024),
  length: metres(0.07),
  totalMass: kilograms(0.0426),
  propellantMass: kilograms(0.0211),
  points: D12_POINTS.map(([t, f]) => ({ time: seconds(t), thrust: newtons(f) })),
  massRule: 'impulse-proportional',
  sourceFormat: 'RASP',
};

/** validateMotor returns void; this wrapper gives the expectations a value. */
const ok = (def: MotorDefinition): boolean => {
  validateMotor(def);
  return true;
};

describe('MOT-1 thrust interpolation (D12)', () => {
  it('t = 0.2 s: between (0.184, 17.275) and (0.237, 24.258): 17.275 + 6.983 × 0.016/0.053 = 19.3831 N', () => {
    expect(ok(D12)).toBe(true);
    expect(thrustAt(D12, seconds(0.2))).toBeCloseTo(19.3831, 4);
  });
  it('exact at data points, zero at ignition, burnout and outside the burn', () => {
    expect(thrustAt(D12, seconds(0.282))).toBe(29.73);
    expect(thrustAt(D12, seconds(0))).toBe(0);
    expect(thrustAt(D12, seconds(1.65))).toBe(0);
    expect(thrustAt(D12, seconds(2))).toBe(0);
    expect(thrustAt(D12, seconds(-0.1))).toBe(0);
    expect(burnTime(D12)).toBe(1.65);
  });
});

describe('MOT-2 impulse delivered (D12)', () => {
  it('to 0.282 s: five trapezoids 0.062941 + 0.399923 + 0.905896 + 1.100625 + 1.214730 = 3.684115 N·s', () => {
    // (0 + 2.569)/2 × 0.049 = 0.0629405; (2.569 + 9.369)/2 × 0.067 = 0.399923;
    // (9.369 + 17.275)/2 × 0.068 = 0.905896; (17.275 + 24.258)/2 × 0.053 = 1.1006245;
    // (24.258 + 29.73)/2 × 0.045 = 1.21473. Sum = 3.6841140.
    expect(impulseTo(D12, seconds(0.282))).toBeCloseTo(3.684114, 6);
  });
  it('to 0.2 s adds the partial trapezoid (17.275 + 19.3831)/2 × 0.016 = 0.293265 to 1.368760', () => {
    expect(impulseTo(D12, seconds(0.2))).toBeCloseTo(1.36876 + 0.293265, 5);
  });
  it('total 16.839 N·s (the Itot of the RockSim file for the same data) and clamping', () => {
    expect(totalImpulse(D12)).toBeCloseTo(16.839, 3);
    expect(impulseTo(D12, seconds(5))).toBe(totalImpulse(D12));
    expect(impulseTo(D12, seconds(0))).toBe(0);
    expect(impulseTo(D12, seconds(-1))).toBe(0);
  });
});

describe('MOT-3 impulse-proportional mass (D12)', () => {
  it('propellant at 0.282 s = 0.0211 × (1 − 3.684114/16.839) = 0.016484 kg (the RockSim m column: 16.4837 g)', () => {
    // 3.684114/16.839 = 0.218784; 1 − 0.218784 = 0.781216; × 0.0211 = 0.0164837 kg.
    expect(propellantRemainingAt(D12, seconds(0.282))).toBeCloseTo(0.0164837, 6);
  });
  it('mass runs from the loaded mass to the casing mass, CG at mid-length', () => {
    const start = motorStateAt(D12, seconds(0));
    const end = motorStateAt(D12, seconds(1.65));
    expect(start.mass).toBeCloseTo(0.0426, 12);
    expect(start.propellantRemaining).toBe(0.0211);
    expect(end.mass).toBeCloseTo(0.0215, 12);
    expect(end.propellantRemaining).toBeCloseTo(0, 12);
    expect(end.cgFromForeEnd).toBe(0.035);
    expect(start.burning).toBe(true);
    expect(end.burning).toBe(false);
    expect(start.massRule).toBe('impulse-proportional');
    expect(motorStateAt(D12, seconds(3)).mass).toBeCloseTo(0.0215, 12);
  });
  it('motorMassAt feeds rocketMassProperties: R1 liftoff 0.190904 kg / 0.387022 m, burnout 0.169804 / 0.364906 (values.csv)', () => {
    const lo = rocketMassProperties(R1_COMPONENTS, motorMassAt(D12, seconds(0), metres(0.6)));
    const bo = rocketMassProperties(R1_COMPONENTS, motorMassAt(D12, seconds(1.65), metres(0.6)));
    expect(lo.mass).toBeCloseTo(0.190904, 6);
    expect(lo.cg).toBeCloseTo(0.387022, 6);
    expect(bo.mass).toBeCloseTo(0.169804, 6);
    expect(bo.cg).toBeCloseTo(0.364906, 5);
  });
});

describe('MOT-4 linear-in-time and explicit profiles', () => {
  const linear: MotorDefinition = { ...D12, massRule: 'linear-in-time', sourceFormat: 'RockSim' };
  it('linear in time: at half the burn (0.825 s) half the propellant remains, 0.01055 kg', () => {
    expect(propellantRemainingAt(linear, seconds(0.825))).toBeCloseTo(0.01055, 12);
    expect(propellantRemainingAt(linear, seconds(0))).toBe(0.0211);
    expect(propellantRemainingAt(linear, seconds(1.65))).toBe(0);
    expect(propellantRemainingAt(linear, seconds(9))).toBe(0);
  });
  it('explicit profile: interpolated, held constant outside its range', () => {
    const prof: MotorDefinition = {
      ...D12,
      massRule: 'mass-profile',
      sourceFormat: 'custom',
      massProfile: [
        { time: seconds(0), propellantRemaining: kilograms(0.0211) },
        { time: seconds(1), propellantRemaining: kilograms(0.0111) },
        { time: seconds(1.65), propellantRemaining: kilograms(0.0001) },
      ],
    };
    expect(ok(prof)).toBe(true);
    // 0.0211 − 0.01 × 0.5 = 0.0161 at 0.5 s
    expect(propellantRemainingAt(prof, seconds(0.5))).toBeCloseTo(0.0161, 12);
    expect(propellantRemainingAt(prof, seconds(1))).toBe(0.0111);
    expect(propellantRemainingAt(prof, seconds(3))).toBe(0.0001);
    expect(motorStateAt(prof, seconds(3)).mass).toBeCloseTo(0.0216, 12);
  });
  it('an increasing profile, a profile above the propellant mass, or a profile with another rule are rejected', () => {
    const bad = (
      massProfile: MotorDefinition['massProfile'],
      massRule: MotorDefinition['massRule'] = 'mass-profile',
    ): void => {
      const def: MotorDefinition = {
        ...D12,
        massRule,
        ...(massProfile === undefined ? {} : { massProfile }),
      };
      expect(() => ok(def)).toThrow(InvalidInputError);
    };
    bad([
      { time: seconds(0), propellantRemaining: kilograms(0.02) },
      { time: seconds(1), propellantRemaining: kilograms(0.021) },
    ]);
    bad([{ time: seconds(0), propellantRemaining: kilograms(0.03) }]);
    bad([{ time: seconds(0.5), propellantRemaining: kilograms(0.02) }]);
    bad(undefined);
    bad([{ time: seconds(0), propellantRemaining: kilograms(0.0211) }], 'impulse-proportional');
  });
});

describe('validation', () => {
  it('rejects a first point not at t = 0, decreasing time, negative thrust, bad masses, one point, zero impulse', () => {
    const withPoints = (pts: readonly (readonly [number, number])[]): MotorDefinition => ({
      ...D12,
      points: pts.map(([t, f]) => ({ time: seconds(t), thrust: newtons(f) })),
    });
    expect(() =>
      ok(
        withPoints([
          [0.1, 0],
          [1, 0],
        ]),
      ),
    ).toThrow(/must be 0 s/);
    expect(() =>
      ok(
        withPoints([
          [0, 0],
          [1, 5],
          [0.5, 0],
        ]),
      ),
    ).toThrow(/not before the previous/);
    expect(() =>
      ok(
        withPoints([
          [0, 0],
          [1, -5],
          [2, 0],
        ]),
      ),
    ).toThrow(/0 N or greater/);
    expect(() => ok(withPoints([[0, 0]]))).toThrow(/at least two/);
    expect(() =>
      ok(
        withPoints([
          [0, 0],
          [1, 0],
        ]),
      ),
    ).toThrow(/total impulse/);
    expect(() => ok({ ...D12, totalMass: kilograms(0.02) })).toThrow(/greater than the propellant/);
    expect(() => ok({ ...D12, diameter: metres(0) })).toThrow(InvalidInputError);
    expect(() => thrustAt(D12, seconds(Number.NaN))).toThrow(InvalidInputError);
  });
});

describe('properties (CLAUDE.md 7.3: mass never negative, never increases during the burn)', () => {
  const rules: MotorDefinition['massRule'][] = ['impulse-proportional', 'linear-in-time'];
  it('propellant remaining is non-increasing in time and within [0, m_p]; impulse is non-decreasing; thrust ≥ 0', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...rules),
        fc.double({ min: -0.5, max: 2.5, noNaN: true }),
        fc.double({ min: -0.5, max: 2.5, noNaN: true }),
        (rule, t1, t2) => {
          const def: MotorDefinition = { ...D12, massRule: rule };
          const [a, b] = t1 <= t2 ? [t1, t2] : [t2, t1];
          const ma = propellantRemainingAt(def, seconds(a));
          const mb = propellantRemainingAt(def, seconds(b));
          return (
            mb <= ma + 1e-15 &&
            ma >= 0 &&
            ma <= 0.0211 + 1e-15 &&
            impulseTo(def, seconds(b)) >= impulseTo(def, seconds(a)) &&
            thrustAt(def, seconds(a)) >= 0
          );
        },
      ),
      { numRuns: 300 },
    );
  });
  it('is deterministic', () => {
    expect(motorStateAt(D12, seconds(0.4))).toEqual(motorStateAt(D12, seconds(0.4)));
  });
});

describe('MOT-6 propellant CG profile (plan 0018)', () => {
  const tank: MotorDefinition = {
    ...D12,
    length: metres(0.1),
    massRule: 'mass-profile',
    sourceFormat: 'custom',
    massProfile: [
      { time: seconds(0), propellantRemaining: kilograms(0.0211), cgFromForeEnd: metres(0.05) },
      { time: seconds(2), propellantRemaining: kilograms(0), cgFromForeEnd: metres(0.03) },
    ],
  };
  it('interpolates the CG: 0.05 at 0 s, 0.04 at 1 s, 0.03 at 2 s and beyond; mid-length without a profile CG', () => {
    expect(ok(tank)).toBe(true);
    expect(motorCgAt(tank, seconds(0))).toBe(0.05);
    expect(motorCgAt(tank, seconds(1))).toBeCloseTo(0.04, 12);
    expect(motorCgAt(tank, seconds(2))).toBe(0.03);
    expect(motorCgAt(tank, seconds(5))).toBe(0.03);
    expect(motorStateAt(tank, seconds(1)).cgFromForeEnd).toBeCloseTo(0.04, 12);
    expect(motorCgAt(D12, seconds(1))).toBe(0.035);
  });
  it('the rocket CG follows it: with the motor aft end at 0.6 m, the motor CG is at 0.55 m at ignition and 0.53 m at burnout', () => {
    const lo = motorMassAt(tank, seconds(0), metres(0.6));
    const bo = motorMassAt(tank, seconds(2), metres(0.6));
    expect(lo.cgFromForeEnd).toBe(0.05);
    expect(bo.cgFromForeEnd).toBe(0.03);
    // Structure 0.148304 kg at 0.34...: moving the 0.0215 kg casing 20 mm forward moves the rocket CG forward by 0.0215 × 0.02 / 0.169804 = 0.00253 m
    const structureOnly = rocketMassProperties(R1_COMPONENTS);
    const withMid = rocketMassProperties(R1_COMPONENTS, { ...bo, cgFromForeEnd: metres(0.05) });
    const withProfile = rocketMassProperties(R1_COMPONENTS, bo);
    expect(withMid.cg - withProfile.cg).toBeCloseTo((0.0215 * 0.02) / 0.169804, 6);
    expect(structureOnly.mass).toBeCloseTo(0.169804 - 0.0215, 6);
  });
  it('rejects a CG outside the motor, a CG on only some points, and a CG with another rule', () => {
    expect(() =>
      ok({
        ...tank,
        massProfile: [
          { ...tank.massProfile![0]!, cgFromForeEnd: metres(0.2) },
          tank.massProfile![1]!,
        ],
      }),
    ).toThrow(/CG from the fore end.*between 0 and the motor length/);
    expect(() =>
      ok({
        ...tank,
        massProfile: [
          tank.massProfile![0]!,
          { time: seconds(2), propellantRemaining: kilograms(0) },
        ],
      }),
    ).toThrow(/must be given on every point or on none/);
    expect(() => ok({ ...tank, massRule: 'linear-in-time' })).toThrow(
      /is not used by the linear-in-time rule/,
    );
  });
});
