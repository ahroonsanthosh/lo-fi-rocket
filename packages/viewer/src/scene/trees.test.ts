/** Tree placement (plan 3d-0002): outside the flat ground, deterministic, both species used. */
import { describe, expect, it } from 'vitest';
import { sceneryLayout } from './scenery.js';
import { placeTrees, TREE_SCALE, TREE_VARIANTS } from './trees.js';

describe('placeTrees', () => {
  const layout = sceneryLayout({ horizontal: 80, vertical: 400 }, -0.2);
  const trees = placeTrees(layout, TREE_VARIANTS, 1500);
  it('places every tree outside the flat radius, never on the flight ground', () => {
    expect(trees.length).toBeGreaterThan(1000);
    for (const t of trees) expect(Math.hypot(t.x, t.y)).toBeGreaterThan(layout.flatRadius);
  });
  it('is deterministic and uses both species within their scale ranges', () => {
    expect(placeTrees(layout, TREE_VARIANTS, 1500)).toEqual(trees);
    const species = new Set(trees.map((t) => TREE_VARIANTS[t.variant]!.species));
    expect(species).toEqual(new Set(['conifer', 'broadleaf']));
    for (const t of trees) {
      const [lo, hi] = TREE_SCALE[TREE_VARIANTS[t.variant]!.species];
      expect(t.scale).toBeGreaterThanOrEqual(lo);
      expect(t.scale).toBeLessThanOrEqual(hi);
    }
  });
});
