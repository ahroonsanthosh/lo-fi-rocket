/**
 * Issue #17: the design warnings of an unstable rocket begin with the
 * simulator's statement, coded 'unstable', and do not repeat it.
 */
import { simulateFlight } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { exampleDesign } from './example.js';
import type { RocketDesign } from './model.js';
import { designFlightWarnings, designSimulationOptions, designVehicle } from './to-physics.js';

describe('unstable design warning (issue #17)', () => {
  it('the example without its fins leads with the unstable statement, once', () => {
    const d = exampleDesign();
    const noFins: RocketDesign = {
      ...d,
      components: d.components.filter((c) => c.component.kind !== 'finSet'),
    };
    const r = simulateFlight(designVehicle(noFins), designSimulationOptions(noFins));
    const w = designFlightWarnings(noFins, r);
    expect(w[0]?.code).toBe('unstable');
    expect(w[0]?.message).toMatch(/^This rocket is unstable: .* not a prediction of its flight\./);
    expect(w.filter((x) => x.message === w[0]?.message)).toHaveLength(1);
  });

  it('the example as shipped has no unstable warning', () => {
    const d = exampleDesign();
    const r = simulateFlight(designVehicle(d), designSimulationOptions(d));
    expect(designFlightWarnings(d, r).some((x) => x.code === 'unstable')).toBe(false);
  });
});
