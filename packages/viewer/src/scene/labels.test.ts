/** Label merging for issue #29, by hand and as a property. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { labelShown, mergeLabels } from './labels.js';

describe('mergeLabels', () => {
  it('folds the stacked pad labels into the first and keeps a distant one', () => {
    const into = mergeLabels(
      [
        { x: 300, y: 400 }, // Launch
        { x: 302, y: 404 }, // Liftoff: merged into Launch
        { x: 300, y: 200 }, // Apogee: kept
        undefined, // behind the camera
        { x: 380, y: 410 }, // the pad: 80 px across, 10 px down, merged
        { x: 400, y: 400 }, // 100 px across: kept
      ],
      90,
      18,
    );
    expect(into).toEqual([0, 0, 2, -1, 0, 5]);
  });
  it('never keeps two labels closer than the box (property)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.double({ min: 0, max: 800, noNaN: true }),
            y: fc.double({ min: 0, max: 600, noNaN: true }),
          }),
          { maxLength: 40 },
        ),
        (points) => {
          const into = mergeLabels(points, 90, 18);
          const kept = points.filter((_, i) => into[i] === i);
          for (let a = 0; a < kept.length; a++) {
            for (let b = a + 1; b < kept.length; b++) {
              const p = kept[a]!;
              const q = kept[b]!;
              expect(Math.abs(p.x - q.x) < 90 && Math.abs(p.y - q.y) < 18).toBe(false);
            }
          }
          // Every merged label points at a kept label before it.
          into.forEach((k, i) => {
            if (k !== i) {
              expect(k).toBeLessThan(i);
              expect(into[k]).toBe(k);
            }
          });
        },
      ),
    );
  });
});

describe('labelShown', () => {
  it('shows an event label from its event on, and other labels always', () => {
    expect(labelShown(29.874, 0)).toBe(false);
    expect(labelShown(29.874, 29.874)).toBe(true);
    // The stored event step's float64 time sum: within 1e-9 s counts as reached.
    expect(labelShown(1.65, 1.65 - 5e-10)).toBe(true);
    expect(labelShown(undefined, 0)).toBe(true);
  });
});
