import {
  InvalidInputError,
  kilograms,
  metres,
  propellantRemainingAt,
  seconds,
  thrustAt,
  totalImpulse,
} from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { CsvThrustCurveError, parseThrustCurveCsv } from './csv-thrust-curve.js';

const META = {
  designation: 'X10',
  manufacturer: 'Workshop',
  diameter: metres(0.029),
  length: metres(0.1),
  totalMass: kilograms(0.1),
  propellantMass: kilograms(0.04),
};

describe('custom thrust curve CSV (plan 0013, D-044)', () => {
  it('reads a two-column file with a header: impulse 0.5 × 10 × 1 + 10 × 1 + 0.5 × 10 × 1 = 20 N·s', () => {
    const m = parseThrustCurveCsv('time,thrust\n0,0\n1,10\n2,10\n3,0\n', META, 'x.csv');
    expect(m.sourceFormat).toBe('custom');
    expect(m.massRule).toBe('impulse-proportional');
    expect(totalImpulse(m)).toBeCloseTo(20, 12);
    expect(thrustAt(m, seconds(0.5))).toBe(5);
  });
  it('a third column gives a mass profile; separators may be semicolons, tabs or spaces', () => {
    const m = parseThrustCurveCsv('# t f m\n0;0;0.04\n1\t10\t0.03\n2 10 0.01\n3,0,0\n', META);
    expect(m.massRule).toBe('mass-profile');
    expect(propellantRemainingAt(m, seconds(1.5))).toBeCloseTo(0.02, 12);
  });
  it('rejects a curve not starting at 0 s, decreasing time, negative thrust, non-zero final thrust, ragged columns and words', () => {
    const bad = (text: string, pattern: RegExp): void => {
      expect(() => parseThrustCurveCsv(text, META, 'c.csv')).toThrow(CsvThrustCurveError);
      expect(() => parseThrustCurveCsv(text, META, 'c.csv')).toThrow(pattern);
    };
    bad('0.1,0\n1,0\n', /c\.csv, line 1: the first point must be at time 0 s/);
    bad('0,0\n2,5\n1,0\n', /line 3: time 1 s is not after the previous point/);
    bad('0,0\n1,-5\n2,0\n', /line 2: thrust -5 N is negative/);
    bad('0,0\n1,5\n', /line 2: the last point must have 0 N thrust/);
    bad('0,0\n1,5,0.01\n2,0\n', /line 2: expected 2 columns like the first data line, found 3/);
    bad('0,0\n1,five\n2,0\n', /line 2: expected numbers, found "1,five"/);
    bad('0,0\n', /at least two data lines/);
  });
  it('an increasing mass profile is rejected by the motor validation', () => {
    expect(() => parseThrustCurveCsv('0,0,0.01\n1,1,0.02\n2,0,0\n', META)).toThrow(
      InvalidInputError,
    );
  });
});

describe('four columns: the CG from the fore end (MOT-6, plan 0018)', () => {
  it('reads the CG column and rejects one outside the motor', () => {
    const m = parseThrustCurveCsv('t,f,m,cg\n0,0,0.04,0.06\n1,10,0.02,0.05\n2,0,0,0.04\n', META);
    expect(m.massRule).toBe('mass-profile');
    expect(m.massProfile?.[1]?.cgFromForeEnd).toBe(0.05);
    expect(() => parseThrustCurveCsv('0,0,0.04,0.2\n1,0,0,0.1\n', META, 'g.csv')).toThrow(
      /g\.csv, line 1: CG from the fore end 0\.2 m lies outside the motor \(0 to 0\.1 m\)/,
    );
  });
});
