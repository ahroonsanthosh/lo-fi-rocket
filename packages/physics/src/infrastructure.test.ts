/**
 * Smoke tests for the test toolchain itself: Vitest runs, fast-check is wired
 * in, and property runs are reproducible from a seed (CLAUDE.md section 5:
 * determinism). These are not physics tests.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

describe('test infrastructure', () => {
  it('fast-check runs a property', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (x) => {
        expect(Number.isFinite(x)).toBe(true);
      }),
    );
  });

  it('fast-check sampling is reproducible from a seed', () => {
    const arb = fc.double({ noNaN: true });
    const a = fc.sample(arb, { seed: 20260101, numRuns: 20 });
    const b = fc.sample(arb, { seed: 20260101, numRuns: 20 });
    expect(a).toEqual(b);
  });
});
