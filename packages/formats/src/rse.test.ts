/**
 * RockSim .rse reader and motor-definition tests (plan 0007). The seven
 * files in reference/motors are ThrustCurve's RockSim versions of the
 * reference motors; their RASP versions are the cross-check.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  impulseTo,
  motorStateAt,
  propellantRemainingAt,
  seconds,
  thrustAt,
  totalImpulse,
} from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { parseEng } from './eng.js';
import { RseParseError, RseUnsupportedError } from './errors.js';
import { motorFromEng, motorFromRse } from './motor-definition.js';
import { parseRse, STANDARD_GRAVITY_GN } from './rse.js';

const MOTORS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'motors',
);
const load = (name: string): string => readFileSync(join(MOTORS, name), 'utf8');
const NAMES = [
  'Estes_C6',
  'Estes_D12',
  'Estes_E16',
  'AeroTech_F39T',
  'AeroTech_G80T',
  'AeroTech_H128W',
  'AeroTech_H238T',
] as const;

describe('the seven ThrustCurve .rse files against their RASP headers', () => {
  for (const name of NAMES) {
    it(`${name}: grams detected by Isp, masses and dimensions agree, m is propellant remaining, cg constant`, () => {
      const [rse] = parseRse(load(`${name}.rse`), {}, `${name}.rse`);
      const [eng] = parseEng(load(`${name}.eng`));
      if (rse === undefined || eng === undefined) throw new Error('missing motor');
      expect(rse.massUnit).toBe('g');
      expect(rse.massUnitSource).toBe('specific-impulse');
      expect(rse.diameter).toBeCloseTo(eng.diameter, 9);
      // H128W: the .rse says 195 mm where the RASP header says 194 (D-029 note).
      expect(Math.abs(rse.length - eng.length)).toBeLessThanOrEqual(0.0011);
      // The two formats come from different data files: F39T 60 g against .059 kg, H238T 196 g
      // against 0.18816 kg, H128W 214.5 g against 0.2016 kg (6.4 %). This check only confirms the
      // unit (a factor of 1000 would fail); the thrust curves of those files differ as well.
      expect(Math.abs(rse.totalMass - eng.totalMass) / eng.totalMass).toBeLessThan(0.1);
      expect(Math.abs(rse.propellantMass - eng.propellantMass) / eng.propellantMass).toBeLessThan(
        0.1,
      );
      expect(rse.massColumn).toBe('propellant-remaining');
      expect(rse.cgColumn).toBeDefined();
      expect(rse.points[0]?.time).toBe(0);
      expect(rse.points[0]?.propellantRemaining).toBeCloseTo(rse.propellantMass, 12);
      expect(rse.points[rse.points.length - 1]?.propellantRemaining).toBe(0);
      expect(rse.delays.length).toBeGreaterThan(0);
      expect(rse.autoCalcMass).toBe(true);
      // Itot attribute against the trapezoid of the file's own points (H128W differs by 0.02 %).
      const def = motorFromRse(rse);
      if (rse.totalImpulseAttribute !== undefined) {
        expect(
          Math.abs(totalImpulse(def) - rse.totalImpulseAttribute) / rse.totalImpulseAttribute,
        ).toBeLessThan(1e-3);
      }
      // The m column equals the impulse-proportional rule within 0.02 g (evidence for D-028).
      const { massProfile, ...rest } = def;
      expect(massProfile?.length).toBe(rse.points.length);
      const asRasp = { ...rest, massRule: 'impulse-proportional' as const };
      for (const p of rse.points) {
        const fromRule = propellantRemainingAt(asRasp, p.time);
        expect(Math.abs(fromRule - (p.propellantRemaining ?? Number.NaN))).toBeLessThan(2e-5);
      }
    });
  }

  it('D12: header values, m at the sixth point 16.4837 g, cg 35 mm, delays 0,3,5,7', () => {
    const [rse] = parseRse(load('Estes_D12.rse'));
    if (rse === undefined) throw new Error('missing');
    expect(rse.designation).toBe('D12');
    expect(rse.manufacturer).toBe('Estes');
    expect(rse.type).toBe('single-use');
    expect(rse.diameter).toBe(0.024);
    expect(rse.length).toBe(0.07);
    expect(rse.totalMass).toBeCloseTo(0.0426, 12);
    expect(rse.propellantMass).toBeCloseTo(0.0211, 12);
    expect(rse.delays).toEqual([0, 3, 5, 7]);
    expect(rse.burnTimeAttribute).toBe(1.65);
    expect(rse.totalImpulseAttribute).toBe(16.839);
    expect(rse.specificImpulseAttribute).toBe(81.38);
    expect(rse.points[5]?.propellantRemaining).toBeCloseTo(0.0164837, 9);
    expect(rse.points[5]?.thrust).toBe(29.73);
    expect(rse.cgColumn).toBe(0.035);
    expect(rse.comments).toContain('NAR published data');
    // The specific impulse definition: I_total / (m_p g_n) = 16.839 / (0.0211 × 9.80665) = 81.38 s.
    expect(16.839 / (0.0211 * STANDARD_GRAVITY_GN)).toBeCloseTo(81.38, 2);
  });

  it('D12 from .eng and from .rse give the same thrust and the same mass history', () => {
    const eng = motorFromEng(parseEng(load('Estes_D12.eng'))[0] as never);
    const rse = motorFromRse(parseRse(load('Estes_D12.rse'))[0] as never);
    expect(eng.massRule).toBe('impulse-proportional');
    expect(rse.massRule).toBe('mass-profile');
    // The two files hold the same 21 points. At the data points both rules agree within 0.02 g;
    // between them the profile is linear in time while the RASP rule follows the impulse
    // (quadratic between points), so they differ by up to 0.05 g (0.2 % of the propellant).
    for (const t of [0, 0.2, 0.282, 0.5, 1, 1.5, 1.65]) {
      expect(thrustAt(rse, seconds(t))).toBeCloseTo(thrustAt(eng, seconds(t)), 9);
      expect(impulseTo(rse, seconds(t))).toBeCloseTo(impulseTo(eng, seconds(t)), 9);
      const atPoint = rse.points.some((p) => (p.time as number) === t);
      expect(
        Math.abs(motorStateAt(rse, seconds(t)).mass - motorStateAt(eng, seconds(t)).mass),
      ).toBeLessThan(atPoint ? 2e-5 : 1e-4);
    }
  });
});

describe('the format guide example (masses in kilograms, no m column)', () => {
  const GUIDE = `<engine-database><engine-list>
<engine code="E9-6" mfg="Estes" dia="24" len="70" initWt="0.063" propWt="0.015" burn-time="1.8" Itot="15" avgThrust="10" peakThrust="14" delays="4,6,8" auto-calc-mass="1" auto-calc-cg="1">
<data><point t="0.0" f="0.0"/><point t="0.2" f="8.5"/><point t="0.4" f="10.2"/><point t="1.8" f="0.0"/></data>
</engine></engine-list></engine-database>`;
  // The guide writes <point>; the files write <eng-data>. The reader accepts the documented element name of the files.
  const guide = GUIDE.replaceAll('<point ', '<eng-data ');

  it('without Isp the unit must be given; with it the kilogram file is read and the linear-in-time rule applies', () => {
    expect(() => parseRse(guide)).toThrow(/pass massUnit/);
    const [rse] = parseRse(guide, { massUnit: 'kg' });
    if (rse === undefined) throw new Error('missing');
    expect(rse.massUnit).toBe('kg');
    expect(rse.massUnitSource).toBe('option');
    expect(rse.totalMass).toBe(0.063);
    expect(rse.massColumn).toBe('none');
    expect(rse.cgColumn).toBeUndefined();
    const def = motorFromRse(rse);
    expect(def.massRule).toBe('linear-in-time');
    // m(0.9) = 0.063 − (0.015/1.8) × 0.9 = 0.0555 kg; propellant remaining 0.0075 kg.
    expect(motorStateAt(def, seconds(0.9)).mass).toBeCloseTo(0.0555, 12);
    expect(propellantRemainingAt(def, seconds(0.9))).toBeCloseTo(0.0075, 12);
  });

  it('an Isp consistent with kilograms is detected; a wrong option is refused', () => {
    // Trapezoid impulse of the example: 0.85 + 1.87 + 7.14 = 9.86 N·s; Isp = 9.86/(0.015 × 9.80665) = 67.03 s.
    const withIsp = guide.replace('delays="4,6,8"', 'delays="4,6,8" Isp="67.03"');
    const [rse] = parseRse(withIsp);
    expect(rse?.massUnit).toBe('kg');
    expect(rse?.massUnitSource).toBe('specific-impulse');
    expect(() => parseRse(withIsp, { massUnit: 'g' })).toThrow(/disagrees with the file/);
    expect(() => parseRse(guide.replace('delays="4,6,8"', 'delays="4,6,8" Isp="5"'))).toThrow(
      /neither unit fits/,
    );
  });

  it('neither m nor auto-calc-mass is rejected when converting', () => {
    const [rse] = parseRse(guide.replace('auto-calc-mass="1"', 'auto-calc-mass="0"'), {
      massUnit: 'kg',
    });
    expect(() => motorFromRse(rse as never)).toThrow(/cannot be simulated correctly/);
  });
});

describe('rejected inputs', () => {
  const d12 = load('Estes_D12.rse');
  const edit = (from: string, to: string): string => {
    if (!d12.includes(from)) throw new Error(`edit target not found: ${from}`);
    return d12.replace(from, to);
  };
  it('malformed XML, wrong root, missing attributes, bad numbers', () => {
    expect(() => parseRse('<engine-database><engine-list>')).toThrow(RseParseError);
    expect(() => parseRse('<foo/>')).toThrow(/root element/);
    expect(() => parseRse(edit('propWt="21.1"', ''))).toThrow(/missing attribute propWt/);
    expect(() => parseRse(edit('dia="24."', 'dia="big"'))).toThrow(/dia is not a number/);
    expect(() => parseRse(edit('initWt="42.6"', 'initWt="20"'))).toThrow(
      /initWt .* must be greater than propWt/,
    );
    expect(() => parseRse(edit('delays="0,3,5,7"', 'delays="0-3"'))).toThrow(
      /delays must be numbers/,
    );
  });
  it('data rules: first point at t=0, time order, non-negative thrust, consistent columns', () => {
    expect(() => parseRse(edit('t="0."/>', 't="0.01"/>'))).toThrow(
      /first data point must be at t=0/,
    );
    expect(() => parseRse(edit('t="0.116"', 't="0.03"'))).toThrow(/before the previous point/);
    expect(() => parseRse(edit('f="9.369"', 'f="-9.369"'))).toThrow(/0 N or greater/);
    expect(() => parseRse(edit('m="21.1" t="0."', 'm="30" t="0."'))).toThrow(
      /neither propellant remaining/,
    );
    expect(() => parseRse(edit('m="20.52" ', ''))).toThrow(
      /m column is present on some points only/,
    );
    expect(() => parseRse(edit('cg="35." f="29.73"', 'cg="40." f="29.73"'))).toThrow(
      RseUnsupportedError,
    );
    expect(() => parseRse(d12.replaceAll('cg="35."', 'cg="30."'))).toThrow(
      /away from the engine centre/,
    );
    expect(() => parseRse(edit('<data>', '<extra/><data>'))).toThrow(RseUnsupportedError);
  });
  it('a total-mass m column is recognised and converted', () => {
    // Shift every m by the casing mass (42.6 − 21.1 = 21.5 g) so the column runs 42.6 → 21.5.
    const shifted = d12.replaceAll(
      /m="([0-9.]+)"/g,
      (_m, v: string) => `m="${String(Number(v) + 21.5)}"`,
    );
    const [rse] = parseRse(shifted);
    expect(rse?.massColumn).toBe('total-mass');
    expect(rse?.points[5]?.propellantRemaining).toBeCloseTo(0.0164837, 9);
    expect(rse?.points[rse.points.length - 1]?.propellantRemaining).toBe(0);
  });
  it('two engines in one file parse to two motors', () => {
    const two = d12.replace(
      '</engine-list>',
      d12.slice(d12.indexOf('<engine '), d12.indexOf('</engine>') + 9) + '</engine-list>',
    );
    expect(parseRse(two).length).toBe(2);
  });
});
