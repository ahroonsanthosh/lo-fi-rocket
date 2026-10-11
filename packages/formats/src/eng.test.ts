import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseEng } from './eng.js';
import { EngParseError } from './errors.js';

const MOTORS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'motors',
);
const load = (name: string): string => readFileSync(join(MOTORS, name), 'utf8');

describe('reference motors (reference/motors, headers read from the files)', () => {
  const cases = [
    {
      file: 'Estes_C6.eng',
      designation: 'C6',
      mfr: 'E',
      dMm: 18,
      lMm: 70,
      delays: [0, 3, 5, 7],
      prop: 0.0108,
      total: 0.0231,
      points: 24,
    },
    {
      file: 'Estes_D12.eng',
      designation: 'D12',
      mfr: 'Estes',
      dMm: 24,
      lMm: 70,
      delays: [0, 3, 5, 7],
      prop: 0.0211,
      total: 0.0426,
      points: 20,
    },
    {
      file: 'Estes_E16.eng',
      designation: 'E16',
      mfr: 'E',
      dMm: 29,
      lMm: 114,
      delays: [0, 4, 6, 8],
      prop: 0.04,
      total: 0.082,
      points: 29,
    },
    {
      file: 'AeroTech_F39T.eng',
      designation: 'F39T',
      mfr: 'AT',
      dMm: 24,
      lMm: 70,
      delays: [3, 6, 9],
      prop: 0.0227,
      total: 0.059,
      points: 31,
    },
    {
      file: 'AeroTech_G80T.eng',
      designation: 'G80NBT',
      mfr: 'AT',
      dMm: 29,
      lMm: 123.825,
      delays: [4, 7, 10],
      prop: 0.069,
      total: 0.129,
      points: 34,
    },
    {
      file: 'AeroTech_H128W.eng',
      designation: 'H128W',
      mfr: 'AT',
      dMm: 29,
      lMm: 194,
      delays: [14],
      prop: 0.09408,
      total: 0.2016,
      points: 26,
    },
    {
      file: 'AeroTech_H238T.eng',
      designation: 'H238T',
      mfr: 'AT',
      dMm: 29,
      lMm: 194,
      delays: [6],
      prop: 0.08064,
      total: 0.18816,
      points: 26,
    },
    {
      file: 'AeroTech_H123W.eng',
      designation: 'H123W',
      mfr: 'AT',
      dMm: 38,
      lMm: 154,
      delays: [0],
      prop: 0.126336,
      total: 0.278656,
      points: 26,
    },
  ];
  for (const c of cases) {
    it(`${c.file}: ${c.designation}`, () => {
      const motors = parseEng(load(c.file), c.file);
      expect(motors).toHaveLength(1);
      const m = motors[0]!;
      expect(m.designation).toBe(c.designation);
      expect(m.manufacturer).toBe(c.mfr);
      expect(m.diameter).toBeCloseTo(c.dMm / 1000, 12);
      expect(m.length).toBeCloseTo(c.lMm / 1000, 12);
      expect(m.delays).toEqual(c.delays);
      expect(m.pluggedOption).toBe(false);
      expect(m.propellantMass).toBe(c.prop);
      expect(m.totalMass).toBe(c.total);
      // implicit origin + explicit points
      expect(m.points).toHaveLength(c.points + 1);
      expect(m.points[0]).toEqual({ time: 0, thrust: 0 });
      expect(m.points[m.points.length - 1]!.thrust).toBe(0);
      expect(m.burnTime).toBe(m.points[m.points.length - 1]!.time);
      for (let i = 1; i < m.points.length - 1; i++) {
        expect(m.points[i]!.thrust).toBeGreaterThan(0);
        expect(m.points[i]!.time).toBeGreaterThanOrEqual(m.points[i - 1]!.time);
      }
    });
  }

  it('D12 total impulse by hand: first trapezoids 0.049×2.569/2 + (2.569+9.369)/2×0.067 + (9.369+17.275)/2×0.068 = 0.0629 + 0.3999 + 0.9059', () => {
    const m = parseEng(load('Estes_D12.eng'))[0]!;
    // Full trapezoidal integral: certified class D is 10.01 to 20 N·s; the D12 is about 17 N·s.
    expect(m.totalImpulse).toBeGreaterThan(16);
    expect(m.totalImpulse).toBeLessThan(18);
    const p = m.points;
    const partial =
      ((p[0]!.thrust + p[1]!.thrust) / 2) * (p[1]!.time - p[0]!.time) +
      ((p[1]!.thrust + p[2]!.thrust) / 2) * (p[2]!.time - p[1]!.time) +
      ((p[2]!.thrust + p[3]!.thrust) / 2) * (p[3]!.time - p[2]!.time);
    expect(partial).toBeCloseTo(0.0629 + 0.3999 + 0.9059, 3);
  });

  it('burn times: C6 1.86 s, H238T 1.036 s (last data point)', () => {
    expect(parseEng(load('Estes_C6.eng'))[0]!.burnTime).toBe(1.86);
    expect(parseEng(load('AeroTech_H238T.eng'))[0]!.burnTime).toBe(1.036);
  });

  it('keeps the comment lines that precede the header', () => {
    const m = parseEng(load('AeroTech_H128W.eng'))[0]!;
    expect(m.comments[0]).toBe('AeroTech H128W');
  });
});

describe('malformed files are rejected with the line and the rule', () => {
  const good = 'X1 18 70 0-3 0.01 0.02 XY\n0.1 5\n0.5 5\n1.0 0\n';
  it('parses the good example', () => {
    const m = parseEng(good)[0]!;
    expect(m.burnTime).toBe(1);
    expect(m.totalImpulse).toBeCloseTo(0.25 + 2 + 1.25, 12);
  });
  it('header with six fields', () => {
    expect(() => parseEng('X1 18 70 0-3 0.01 XY\n0.1 5\n1 0\n')).toThrow(/exactly 7/);
  });
  it('non-numeric mass', () => {
    expect(() => parseEng('X1 18 70 0-3 heavy 0.02 XY\n0.1 5\n1 0\n')).toThrow(
      /propellant mass.*number/,
    );
  });
  it('total mass not greater than propellant', () => {
    expect(() => parseEng('X1 18 70 0-3 0.02 0.02 XY\n0.1 5\n1 0\n')).toThrow(
      /greater than the propellant/,
    );
  });
  it('zero thrust before the end', () => {
    expect(() => parseEng('X1 18 70 0-3 0.01 0.02 XY\n0.1 5\n0.5 0\n1.0 5\n1.2 0\n')).toThrow(
      /after the final data point/,
    );
  });
  it('last thrust not zero', () => {
    expect(() => parseEng('X1 18 70 0-3 0.01 0.02 XY\n0.1 5\n1.0 5\n')).toThrow(
      /no final data point with zero thrust/,
    );
  });
  it('decreasing time', () => {
    expect(() => parseEng('X1 18 70 0-3 0.01 0.02 XY\n0.5 5\n0.4 5\n1 0\n')).toThrow(
      /before the previous point/,
    );
  });
  it('negative first time and explicit origin', () => {
    expect(() => parseEng('X1 18 70 0-3 0.01 0.02 XY\n-0.1 5\n1 0\n')).toThrow(/negative time/);
    expect(() => parseEng('X1 18 70 0-3 0.01 0.02 XY\n0 0\n0.5 5\n1 0\n')).toThrow(/implicit/);
  });
  it('bad delay list and plugged motors', () => {
    expect(() => parseEng('X1 18 70 7,10 0.01 0.02 XY\n0.1 5\n1 0\n')).toThrow(/delays/);
    expect(parseEng('X1 18 70 P 0.01 0.02 XY\n0.1 5\n1 0\n')[0]!.delays).toBe('plugged');
    const withOption = parseEng('X1 18 70 4-6-P 0.01 0.02 XY\n0.1 5\n1 0\n')[0]!;
    expect(withOption.delays).toEqual([4, 6]);
    expect(withOption.pluggedOption).toBe(true);
  });
  it('empty input', () => {
    expect(() => parseEng('')).toThrow(EngParseError);
    expect(() => parseEng('; only a comment\n')).toThrow(/no motor entry/);
  });
  it('two entries separated by a comment line', () => {
    const two = good + ';\n' + 'X2 24 70 0 0.02 0.04 XY\n0.2 10\n2.0 0\n';
    const motors = parseEng(two);
    expect(motors.map((m) => m.designation)).toEqual(['X1', 'X2']);
  });
});
