/**
 * Plan 0065 (CLAUDE.md rule 3 and section 8): random but sensible designs, built as a builder
 * could build them (design/random-design.ts), every one carried through a file and flown. None
 * may crash, give a non-finite number, or be refused: a refusal of a sensible design is a gap in
 * the models to close, not an answer. The first runs found two float64 edge cases and an
 * adaptive-step failure, each now tested in packages/physics/src/flight/robustness.test.ts.
 */
import fc from 'fast-check';
import { simulateFlight } from '@lo-fi-rocket/physics';
import { describe, expect, it, vi } from 'vitest';
import { randomDesign } from './test-support/random-design.js';
import { parseDesign, serializeDesign } from './design/serialize.js';
import { designSimulationOptions, designStability, designVehicle } from './design/to-physics.js';

// Each flight is a full 6-degree-of-freedom simulation, up to a few seconds for the longest.
vi.setConfig({ testTimeout: 600_000 });

describe('random sensible designs (plan 0065)', () => {
  it('survive a file, give finite stability figures, and fly to a finite result', () => {
    fc.assert(
      fc.property(randomDesign, (d) => {
        const text = serializeDesign(d);
        expect(serializeDesign(parseDesign(text))).toBe(text);
        const s = designStability(d).result;
        for (const x of [s.centreOfPressure.cp, s.cgLiftoff, s.cgBurnout, s.marginLiftoff]) {
          expect(Number.isFinite(x)).toBe(true);
        }
        const r = simulateFlight(designVehicle(d), designSimulationOptions(d));
        expect(['landing', 'model-limit', 'max-time']).toContain(r.summary.endReason);
        expect(Number.isFinite(r.summary.apogee)).toBe(true);
        for (const sample of r.samples) {
          expect(Number.isFinite(sample.altitude) && Number.isFinite(sample.mass)).toBe(true);
        }
      }),
      { seed: 20261014, numRuns: 40 },
    );
  });
});
