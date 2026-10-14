/**
 * Mass and CG overrides (D-073, review finding G-8). Expected values are
 * OpenRocket 24.12's own whole-structure mass, CG and inertias for the probe
 * rocket of tools/openrocket-harness/src/OverrideProbe.java, recorded in
 * reference/rockets/override-probe/values.txt (black-box reference, CLAUDE.md 3).
 * The probe places the body tube and the nose cone both at x = 0 (OpenRocket
 * had not re-stacked them); the test uses the same positions, so the
 * comparison is like for like.
 */
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { kilograms, kilogramsPerCubicMetre, metres } from '../units/si.js';
import {
  combineRocket,
  combineRocketMotors,
  overriddenMassProperties,
  rocketMassProperties,
  structuralMassParts,
  type MotorMass,
  type PlacedComponent,
} from './assembly.js';
import { componentMassProperties } from './components.js';

const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);

const nose = {
  kind: 'noseCone',
  shape: 'conical',
  length: metres(0.1),
  baseRadius: metres(0.025),
  density: kilogramsPerCubicMetre(160),
} as const;
const tube = {
  kind: 'bodyTube',
  length: metres(0.5),
  outerRadius: metres(0.025),
  wallThickness: metres(0.001),
  density: kilogramsPerCubicMetre(700),
} as const;
const weight = {
  kind: 'massComponent',
  mass: kilograms(0.03),
  length: metres(0.02),
  radius: metres(0.02),
} as const;

function probe(noseOverride?: PlacedComponent['massOverride']): PlacedComponent[] {
  return [
    {
      component: nose,
      position: metres(0),
      ...(noseOverride === undefined ? {} : { massOverride: noseOverride }),
    },
    { component: tube, position: metres(0) },
    { component: weight, position: metres(0.1) },
  ];
}

// OpenRocket's values (override-probe.txt, cases 0 to 3): mass kg, CG m, I_rot and I_long kg·m².
const OPENROCKET = {
  none: [0.09435029, 0.186061714, 4.031742297e-5, 1.670541047e-3],
  mass: [0.133878314, 0.153270364, 4.772892756e-5, 2.032680782e-3],
  cg: [0.09435029, 0.181067147, 4.031742297e-5, 1.794066336e-3],
  both: [0.133878314, 0.136464062, 4.772892756e-5, 2.448333161e-3],
} as const;

describe('mass and CG overrides against OpenRocket (D-073)', () => {
  const cases = [
    ['no override', undefined, OPENROCKET.none],
    ['nose mass 0.05 kg', { mass: kilograms(0.05) }, OPENROCKET.mass],
    ['nose CG 0.03 m from its tip', { cg: metres(0.03) }, OPENROCKET.cg],
    ['both', { mass: kilograms(0.05), cg: metres(0.03) }, OPENROCKET.both],
  ] as const;
  for (const [label, override, [m, cg, iRot, iLong]] of cases) {
    it(`${label}: mass, CG and both inertias within 1e-6 of OpenRocket`, () => {
      const r = rocketMassProperties(probe(override));
      expect(rel(r.mass, m)).toBeLessThan(1e-6);
      expect(rel(r.cg, cg)).toBeLessThan(1e-6);
      expect(rel(r.inertiaRotational, iRot)).toBeLessThan(1e-6);
      expect(rel(r.inertiaLongitudinal, iLong)).toBeLessThan(1e-6);
    });
  }

  it('mass override by hand: CG = Σ m x / Σ m', () => {
    // Nose 0.05 kg at 0.075 m (3/4 of 0.1 m), tube π(0.025² − 0.024²)(0.5)(700) = 0.0538783 kg at 0.25 m,
    // weight 0.03 kg at 0.1 + 0.01 = 0.11 m:
    // (0.05·0.075 + 0.0538783·0.25 + 0.03·0.11)/(0.05 + 0.0538783 + 0.03) = 0.0205196/0.1338783 = 0.153270 m.
    const r = rocketMassProperties(probe({ mass: kilograms(0.05) }));
    expect(r.cg).toBeCloseTo(0.15327, 5);
  });

  it('a mass override scales the own inertias by the mass ratio; a CG override keeps them', () => {
    const own = componentMassProperties(nose);
    const heavier = overriddenMassProperties(own, { mass: kilograms(2 * own.mass) });
    expect(heavier.inertiaRotational).toBeCloseTo(2 * own.inertiaRotational, 15);
    expect(heavier.inertiaLongitudinal).toBeCloseTo(2 * own.inertiaLongitudinal, 15);
    expect(heavier.cgX).toBe(own.cgX);
    const moved = overriddenMassProperties(own, { cg: metres(0.01) });
    expect(moved.cgX).toBe(0.01);
    expect(moved.mass).toBe(own.mass);
    expect(moved.inertiaLongitudinal).toBe(own.inertiaLongitudinal);
  });

  it('rejects a negative or non-finite override', () => {
    const own = componentMassProperties(nose);
    expect(() => overriddenMassProperties(own, { mass: kilograms(-0.01) })).toThrow(
      InvalidInputError,
    );
    expect(() => overriddenMassProperties(own, { mass: kilograms(Number.NaN) })).toThrow(
      InvalidInputError,
    );
    expect(() => overriddenMassProperties(own, { cg: metres(Number.POSITIVE_INFINITY) })).toThrow(
      InvalidInputError,
    );
  });

  it('a 0 kg mass item adds nothing: mass, CG and inertia as without it (plan 0065)', () => {
    const item = {
      position: metres(0.3),
      component: {
        kind: 'massComponent' as const,
        mass: kilograms(0),
        length: metres(0.02),
        radius: metres(0.01),
      },
    };
    const without = rocketMassProperties(probe());
    const withItem = rocketMassProperties([...probe(), item]);
    expect(withItem.mass).toBe(without.mass);
    expect(withItem.cg).toBe(without.cg);
    expect(withItem.inertiaLongitudinal).toBe(without.inertiaLongitudinal);
    expect(() =>
      rocketMassProperties([
        ...probe(),
        { ...item, component: { ...item.component, mass: kilograms(-0.01) } },
      ]),
    ).toThrow(/mass is invalid: received -0.01; must be 0 or greater/);
  });

  it('a zero mass override removes the component from the total', () => {
    const r = rocketMassProperties(probe({ mass: kilograms(0) }));
    expect(r.mass).toBeCloseTo(
      rocketMassProperties(probe()).mass - componentMassProperties(nose).mass,
      15,
    );
  });
});

describe('combineRocketMotors (GEO-12, plan 0064)', () => {
  const tube = structuralMassParts([
    {
      position: metres(0),
      component: {
        kind: 'bodyTube',
        length: metres(1),
        outerRadius: metres(0.025),
        wallThickness: metres(0.001),
        density: kilogramsPerCubicMetre(700),
      },
    },
  ]);
  const motor = (mass: number, aftEnd: number): MotorMass => ({
    mass: kilograms(mass),
    length: metres(0.1),
    diameter: metres(0.024),
    aftEnd: metres(aftEnd),
  });
  it('is combineRocket exactly for one motor', () => {
    expect(combineRocketMotors(tube, [motor(0.1, 1)])).toEqual(combineRocket(tube, motor(0.1, 1)));
    expect(combineRocketMotors(tube, [])).toEqual(combineRocket(tube));
  });
  it('sums two motors by hand', () => {
    // Tube: π (0.025² − 0.024²) × 1 × 700 = 0.107757 kg at x = 0.5 m. Motors of 0.1 kg at x = 0.95 m
    // (aft end 1.0, mid-length) and 0.05 kg at x = 0.45 m (aft end 0.5): m = 0.257757 kg,
    // x̄ = (0.107757 × 0.5 + 0.1 × 0.95 + 0.05 × 0.45)/0.257757 = 0.171378/0.257757 = 0.664884 m
    // (checked in an independent script).
    const r = combineRocketMotors(tube, [motor(0.1, 1), motor(0.05, 0.5)]);
    expect(r.mass).toBeCloseTo(0.257757, 6);
    expect(r.cg).toBeCloseTo(0.664884, 5);
  });
});
