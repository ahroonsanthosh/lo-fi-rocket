/**
 * The number patterns of the readers run in linear time (CodeQL js/polynomial-redos, plan 0062):
 * a long run of digits that fails to match at its end is rejected at once, where the former
 * pattern `\d+\.?\d*` tried every split of the digits (quadratic in their number).
 */
import { describe, expect, it } from 'vitest';
import { parseEng } from './eng.js';
import { parseThrustCurveCsv } from './motors/csv-thrust-curve.js';
import { parseDragCurveCsv } from './motors/drag-curve.js';
import { parseFlightDataCsv } from './motors/flight-data.js';
import { NUMBER } from './xml.js';
import { kilograms, metres } from '@lo-fi-rocket/physics';

// 50 000 digits and a letter: about 1.25 × 10^9 steps for the quadratic pattern, microseconds now.
const hostile = `${'9'.repeat(50_000)}x`;

function quick(f: () => unknown): number {
  const start = performance.now();
  try {
    f();
  } catch {
    // Rejected, as it should be; only the time matters here.
  }
  return performance.now() - start;
}

describe('number patterns', () => {
  it('still accept the forms the files use and reject the rest', () => {
    for (const ok of ['29.', '5.0E-4', '.0108', '-3', '+2.5e3', '12', '0.5'])
      expect(NUMBER.test(ok)).toBe(true);
    for (const bad of ['', '.', 'e5', '1e', '1.2.3', '--1', '1,5', hostile])
      expect(NUMBER.test(bad)).toBe(false);
  });

  it('reject a hostile digit run in well under a second in every reader', () => {
    const meta = {
      designation: 'X',
      manufacturer: 'Y',
      diameter: metres(0.029),
      length: metres(0.1),
      totalMass: kilograms(0.1),
      propellantMass: kilograms(0.05),
    };
    const times = [
      quick(() => NUMBER.test(hostile)),
      quick(() => parseEng(`X 24 70 0 ${hostile} 0.04 Estes\n0.1 1\n0.2 0\n;`)),
      quick(() => parseThrustCurveCsv(`0 ${hostile}\n1 0\n`, meta)),
      quick(() => parseDragCurveCsv(`mach,cd\n${hostile},0.5\n`, 'd')),
      quick(() => parseFlightDataCsv(`time,altitude\n${hostile},1\n`, 'f', 'm')),
    ];
    for (const t of times) expect(t).toBeLessThan(500);
  });
});
