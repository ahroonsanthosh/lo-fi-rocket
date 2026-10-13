import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  editText,
  FIGURE_DISPLAY,
  formatFigure,
  formatFixed,
  formatQuantity,
  parseNumber,
  UNIT_DISPLAY,
  type QuantityKind,
} from './display-rules.js';

const appSrc = join(dirname(fileURLToPath(import.meta.url)), '../../../app/src');

/** Labels and decimals as written in the app's units/display.ts, read from its text. */
function appUnitTable(): Record<
  'metric' | 'imperial',
  Map<string, { unit: string; decimals: number }>
> {
  const text = readFileSync(join(appSrc, 'units/display.ts'), 'utf8');
  const metricStart = text.indexOf('const METRIC');
  const imperialStart = text.indexOf('const IMPERIAL');
  const end = text.indexOf('export function unitFor');
  const parse = (block: string): Map<string, { unit: string; decimals: number }> => {
    const out = new Map<string, { unit: string; decimals: number }>();
    for (const m of block.matchAll(/^ {2}(\w+): linear\('([^']*)', [^,]+, (\d+)\),$/gm)) {
      out.set(m[1]!, { unit: m[2]!, decimals: Number(m[3]) });
    }
    for (const m of block.matchAll(
      /^ {2}(\w+): \{\n\s+label: '([^']*)',[\s\S]*?decimals: (\d+),\n {2}\},$/gm,
    )) {
      out.set(m[1]!, { unit: m[2]!, decimals: Number(m[3]) });
    }
    return out;
  };
  const metric = parse(text.slice(metricStart, imperialStart));
  const imperial = parse(text.slice(imperialStart, end));
  // IMPERIAL reuses METRIC for these kinds (`angle: METRIC.angle`).
  for (const m of text.slice(imperialStart, end).matchAll(/^ {2}(\w+): METRIC\.(\w+),$/gm)) {
    const same = metric.get(m[2]!);
    if (same !== undefined) imperial.set(m[1]!, same);
  }
  return { metric, imperial };
}

describe('UNIT_DISPLAY matches the app (parity until the app adopts this module)', () => {
  const app = appUnitTable();
  for (const system of ['metric', 'imperial'] as const) {
    it(`${system}: every kind has the app's label and decimals`, () => {
      const kinds = Object.keys(UNIT_DISPLAY[system]) as QuantityKind[];
      expect(app[system].size).toBe(kinds.length);
      for (const kind of kinds) {
        expect(app[system].get(kind), `${system} ${kind}`).toEqual(UNIT_DISPLAY[system][kind]);
      }
    });
  }
});

describe('FIGURE_DISPLAY matches the rounding on the line it marks', () => {
  const packages = join(appSrc, '../..');
  for (const [kind, rule] of Object.entries(FIGURE_DISPLAY)) {
    it(kind, () => {
      const lines = readFileSync(join(packages, rule.from), 'utf8')
        .split('\n')
        .filter((l) => l.includes(rule.marker));
      // The marker names one line, so the check cannot pass on an unrelated one.
      expect(lines, `${rule.from}: "${rule.marker}"`).toHaveLength(1);
      const source = lines[0] ?? '';
      // Either the literal rounding, or the app reading this very rule from the library.
      const literal = source.includes(`toFixed(${String(rule.decimals)})`);
      const reads = source.includes(`.${kind}.decimals`);
      expect(literal || reads, `${rule.from}: ${source.trim()}`).toBe(true);
    });
  }
});

describe('formatFixed is toFixed and never hides a non-finite value', () => {
  it('formats like toFixed (hand values)', () => {
    // 167.3301 to 2 decimals is 167.33; 62.34 to 1 is 62.3; 1.84 stays 1.84.
    expect(formatFixed(167.3301, 2)).toBe('167.33');
    expect(formatFixed(62.34, 1)).toBe('62.3');
    expect(formatFixed(1.84, 2)).toBe('1.84');
    // 1.005 is 1.00499999999999989... in binary, so toFixed(2) gives 1.00, as the app shows today.
    expect(formatFixed(1.005, 2)).toBe('1.00');
    expect(formatFixed(-5.7, 2)).toBe('-5.70');
  });
  it('writes NaN and infinities out', () => {
    expect(formatFixed(Number.NaN, 2)).toBe('NaN');
    expect(formatFixed(Number.POSITIVE_INFINITY, 1)).toBe('Infinity');
    expect(formatFixed(Number.NEGATIVE_INFINITY, 1)).toBe('-Infinity');
  });
  it('formatQuantity and formatFigure lay out value and unit as the app does', () => {
    expect(formatQuantity(387, 'mm', 'metric')).toBe('387.0 mm');
    expect(formatQuantity(15.237, 'mm', 'imperial')).toBe('15.237 in');
    expect(formatQuantity(1.84, 'ratio', 'metric')).toBe('1.84');
    expect(formatFigure(0.1834, 'maxMach')).toBe('0.183');
    expect(formatFigure(1.84, 'stabilityMargin')).toBe('1.84 calibers');
  });
});

describe('editText', () => {
  it('keeps the app rule where it states the value', () => {
    expect(editText(70, 1)).toBe('70');
    expect(editText(12.5, 1)).toBe('12.5');
    // 1.5 m in feet is 4.92125984...; 4.921 is 0.005 % away, within 0.1 %.
    expect(editText(1.5 / 0.3048, 1)).toBe('4.921');
  });
  it('never shows a non-zero value as 0 (the 1e-8 tolerance of the review)', () => {
    expect(editText(1e-8, 2)).toBe('1e-8');
    expect(editText(0.0004, 3)).toBe('0.0004');
    expect(editText(0, 2)).toBe('0');
  });
  it('switches to six significant digits when the fixed text is more than 0.1 % off', () => {
    // 0.0015 with 3 decimals is 0.002 (toFixed rounds the binary value up): 33 % off.
    expect(editText(0.0015, 3)).toBe('0.0015');
  });
  it('writes a non-finite value out', () => {
    expect(editText(Number.NaN, 1)).toBe('NaN');
  });
});

describe('parseNumber', () => {
  it('accepts the app grammar', () => {
    expect(parseNumber(' 12.5 ')).toBe(12.5);
    expect(parseNumber('-3')).toBe(-3);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('1e-8')).toBe(1e-8);
    expect(parseNumber('5.')).toBe(5);
  });
  it('rejects anything else', () => {
    for (const bad of ['', ' ', 'abc', '1,5', '1.2.3', '0x10', 'Infinity', 'NaN', '1e400']) {
      expect(parseNumber(bad), bad).toBeUndefined();
    }
  });
});
