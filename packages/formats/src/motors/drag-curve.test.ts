import { InvalidInputError } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { DragCurveCsvError, parseDragCurveCsv } from './drag-curve.js';
import { FlightDataCsvError, parseFlightDataCsv } from './flight-data.js';

describe('drag curve CSV (D-047)', () => {
  it('reads named columns in any order and a RASAero-style header', () => {
    const c = parseDragCurveCsv(
      'Alpha,Mach,CD Power Off,CD Power On\n0,0.1,0.52,0.40\n0,0.5,0.48,0.38\n',
      'rasaero',
    );
    expect(c.points).toEqual([
      { mach: 0.1, cd: 0.52 },
      { mach: 0.5, cd: 0.48 },
    ]);
    const plain = parseDragCurveCsv('0.1;0.5\n0.9;0.6\n', 'plain');
    expect(plain.points[1]).toEqual({ mach: 0.9, cd: 0.6 });
  });
  it('rejects decreasing Mach, negative C_D, words and single rows', () => {
    expect(() => parseDragCurveCsv('mach,cd\n0.5,0.4\n0.2,0.4\n', 'x', 'd.csv')).toThrow(
      DragCurveCsvError,
    );
    expect(() => parseDragCurveCsv('mach,cd\n0.5,0.4\n0.2,0.4\n', 'x', 'd.csv')).toThrow(
      /d\.csv, line 3: Mach 0\.2 is not greater/,
    );
    expect(() => parseDragCurveCsv('0,-1\n1,1\n', 'x')).toThrow(/line 1: C_D -1 is negative/);
    expect(() => parseDragCurveCsv('0,0.5\n1,abc\n', 'x')).toThrow(/line 2: expected numbers/);
    expect(() => parseDragCurveCsv('0,0.5\n', 'x')).toThrow(/at least two data rows/);
    expect(() => parseDragCurveCsv('mach,cd\n0,0.5\n0,0.5\n', 'x')).toThrow(DragCurveCsvError);
    expect(InvalidInputError).toBeDefined();
  });
});

describe('flight data CSV (CLAUDE.md 7.5)', () => {
  it('reads named columns, converts feet (UNIT-6) and keeps the order', () => {
    const f = parseFlightDataCsv(
      'Time (s),Altitude (ft),Temp\n0,0,20\n0.5,100,20\n1,250,20\n',
      'alt',
      'ft',
    );
    expect(f.points.map((p) => p.altitude)).toEqual([0, 30.48, 76.2]);
    expect(f.points[2]?.time).toBe(1);
    const plain = parseFlightDataCsv('0\t0\n1\t12.5\n', 'p', 'm');
    expect(plain.points[1]).toEqual({ time: 1, altitude: 12.5 });
  });
  it('rejects a time that does not increase and non-numeric rows', () => {
    expect(() => parseFlightDataCsv('0,0\n2,5\n1,6\n', 'x', 'm', 'f.csv')).toThrow(
      FlightDataCsvError,
    );
    expect(() => parseFlightDataCsv('0,0\n2,5\n1,6\n', 'x', 'm', 'f.csv')).toThrow(
      /f\.csv, line 3: time 1 s is not after/,
    );
    expect(() => parseFlightDataCsv('time,alt\n0,zero\n', 'x', 'm')).toThrow(
      /line 2: expected numbers/,
    );
  });
});
