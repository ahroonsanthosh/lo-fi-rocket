/** Editing a part keeps what the edit does not name (plan 0070, plan 0073). */
import { exampleDesign, type RocketDesign } from '@lo-fi-rocket/formats';
import { metres } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { updatePart } from './edit.js';

describe('update_part', () => {
  it('keeps the part’s pod set and its own surface finish', () => {
    const base = exampleDesign();
    const tube = base.components.find((c) => c.component.kind === 'bodyTube');
    if (tube === undefined) throw new Error('the example has a body tube');
    // A second tube as a two-pod set, rough, beside the example's own.
    const design: RocketDesign = {
      ...base,
      components: [
        ...base.components,
        {
          ...tube,
          id: 'pod-tube',
          name: 'Pod',
          pod: { count: 2, radialOffset: metres(0.06) },
          roughnessHeight: metres(500e-6),
        },
      ],
    };
    const { part } = updatePart(design, 'pod-tube', { name: 'Renamed' });
    expect(part?.name).toBe('Renamed');
    expect(part?.pod).toEqual({ count: 2, radialOffset: 0.06 });
    expect(part?.roughnessHeight).toBe(500e-6);
  });
});
