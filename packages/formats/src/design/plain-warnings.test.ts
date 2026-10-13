/**
 * Issue #19: the design warnings shown in the app are plain language: no
 * decision IDs, plan numbers or document paths, components by name.
 */
import { newtons, simulateFlight } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { exampleDesign } from './example.js';
import type { RocketDesign } from './model.js';
import { designFlightWarnings, designSimulationOptions, designVehicle } from './to-physics.js';

const JARGON =
  /\bD-\d{3}\b|\bplan \d{4}\b|\bfigure \d|\bDATCOM\b|docs\/|\bTN \d|\beq\. \(|\bBAR-\d/;

describe('design warnings in plain language (issue #19)', () => {
  it('the example without a fin shear modulus: the flutter note names the fin set; no jargon', () => {
    const base = exampleDesign();
    const d: RocketDesign = {
      ...base,
      components: base.components.map((c) => {
        if (c.component.kind !== 'finSet') return c;
        const fins = { ...c.component };
        delete fins.shearModulus;
        return { ...c, component: fins };
      }),
    };
    const r = simulateFlight(designVehicle(d), designSimulationOptions(d));
    const w = designFlightWarnings(d, r);
    const fins = d.components.find((c) => c.component.kind === 'finSet');
    expect(w.map((x) => x.message)).toContain(
      `Fin flutter not checked for "${fins?.name ?? ''}": enter the fin material's shear modulus (its stiffness) to check whether the fins can flutter.`,
    );
    for (const x of w) expect(x.message).not.toMatch(JARGON);
  });

  it('a supersonic variant (40 times the thrust): regime warnings in plain words', () => {
    const base = exampleDesign();
    const mount = base.motorMount;
    if (mount?.motor === undefined) throw new Error('the example has a motor');
    const fast: RocketDesign = {
      ...base,
      motorMount: {
        ...mount,
        motor: {
          ...mount.motor,
          definition: {
            ...mount.motor.definition,
            points: mount.motor.definition.points.map((p) => ({
              time: p.time,
              thrust: newtons(p.thrust * 40),
            })),
          },
        },
      },
    };
    const r = simulateFlight(designVehicle(fast), designSimulationOptions(fast));
    const w = designFlightWarnings(fast, r);
    expect(w.some((x) => x.code === 'supersonic')).toBe(true);
    for (const x of w) expect(x.message).not.toMatch(JARGON);
  });
});
