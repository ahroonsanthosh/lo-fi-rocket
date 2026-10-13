/**
 * GEO-17, the as-built mass and CG (plan 0060, D-089). Expected values by hand from the rule:
 * scaling every part's mass by M/M₀ gives the mass M at the same CG with both inertias times
 * M/M₀; moving every part by the same Δ gives the CG X̄₀ + Δ and leaves the inertias about the CG
 * as they were (a rigid shift).
 */
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { kilograms, metres } from '../units/si.js';
import { rocketMassProperties, withAsBuilt, type PlacedComponent } from './assembly.js';
import { R1_COMPONENTS } from './reference-rockets.js';

const base = rocketMassProperties(R1_COMPONENTS);

describe('GEO-17: the parts scaled and moved to the as-built mass and CG', () => {
  it('a mass alone: exactly that mass, the same CG, the inertias times M/M₀', () => {
    const m = 0.2;
    const r = rocketMassProperties(withAsBuilt(R1_COMPONENTS, { mass: kilograms(m) }));
    const ratio = m / base.mass;
    expect(r.mass).toBeCloseTo(m, 14);
    expect(r.cg).toBeCloseTo(base.cg, 14);
    expect(r.inertiaRotational / base.inertiaRotational).toBeCloseTo(ratio, 12);
    expect(r.inertiaLongitudinal / base.inertiaLongitudinal).toBeCloseTo(ratio, 12);
  });

  it('a CG alone: exactly that CG, the same mass and inertias (a rigid shift)', () => {
    const r = rocketMassProperties(withAsBuilt(R1_COMPONENTS, { cg: metres(0.35) }));
    expect(r.cg).toBeCloseTo(0.35, 14);
    expect(r.mass).toBeCloseTo(base.mass, 14);
    expect(r.inertiaRotational).toBeCloseTo(base.inertiaRotational, 14);
    expect(r.inertiaLongitudinal / base.inertiaLongitudinal).toBeCloseTo(1, 12);
  });

  it('both, and a part with its own override is scaled from its own figures', () => {
    const own: PlacedComponent[] = R1_COMPONENTS.map((c, i) =>
      i === 0 ? { ...c, massOverride: { mass: kilograms(0.05) } } : c,
    );
    const r = rocketMassProperties(withAsBuilt(own, { mass: kilograms(0.25), cg: metres(0.3) }));
    expect(r.mass).toBeCloseTo(0.25, 14);
    expect(r.cg).toBeCloseTo(0.3, 14);
    // The nose's share of the total is its own 0.05 kg over the overridden total.
    const ownTotal = rocketMassProperties(own).mass;
    const nose = withAsBuilt(own, { mass: kilograms(0.25) })[0]?.massOverride?.mass;
    expect(nose).toBeCloseTo((0.05 * 0.25) / ownTotal, 14);
  });

  it('nothing to apply returns the parts; no mass to scale or a bad figure is reported', () => {
    expect(withAsBuilt(R1_COMPONENTS, undefined)).toEqual(R1_COMPONENTS);
    expect(withAsBuilt(R1_COMPONENTS, {})).toEqual(R1_COMPONENTS);
    expect(() => withAsBuilt([], { mass: kilograms(0.1) })).toThrow(InvalidInputError);
    expect(() => withAsBuilt(R1_COMPONENTS, { mass: 0 as never })).toThrow(/as-built mass/);
  });
});
