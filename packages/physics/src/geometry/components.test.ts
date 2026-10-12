/**
 * Component and assembly tests. Hand values from reference/rockets/hand-checks.md;
 * OpenRocket component masses (black-box reference) from reference/rockets/components/*.csv.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { kilograms, kilogramsPerCubicMetre, metres } from '../units/si.js';
import { rocketMassProperties } from './assembly.js';
import { componentMassProperties, type Component } from './components.js';
import {
  R1_COMPONENTS,
  R2_COMPONENTS,
  R3_COMPONENTS,
  R4_COMPONENTS,
  R5_COMPONENTS,
  REFERENCE_MOTORS,
} from './reference-rockets.js';

const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);

describe('R1 components by hand (hand-checks.md)', () => {
  const byKind = (
    kind: Component['kind'],
    index = 0,
  ): ReturnType<typeof componentMassProperties> => {
    const matches = R1_COMPONENTS.filter((pc) => pc.component.kind === kind);
    const pc = matches[index];
    if (pc === undefined) throw new Error(`no ${kind} #${String(index)}`);
    return componentMassProperties(pc.component);
  };
  it('solid balsa cone: 0.010472 kg, CG 0.075 m', () => {
    const p = byKind('noseCone');
    expect(p.mass).toBeCloseTo(0.010472, 6);
    expect(p.cgX).toBeCloseTo(0.075, 10);
  });
  it('body tube: 0.053878 kg at mid-length', () => {
    const p = byKind('bodyTube');
    expect(p.mass).toBeCloseTo(0.053878, 6);
    expect(p.cgX).toBeCloseTo(0.25, 12);
  });
  it('three fins: 0.032400 kg, centroid 0.061111 m aft of the root leading edge', () => {
    const p = byKind('finSet');
    expect(p.mass).toBeCloseTo(0.0324, 6);
    expect(p.cgX).toBeCloseTo(0.061111, 6);
  });
  it('launch lug 0.000302 kg, mount tube 0.002020 kg, rings 0.004615 kg', () => {
    expect(byKind('launchLug').mass).toBeCloseTo(0.000302, 6);
    expect(byKind('innerTube').mass).toBeCloseTo(0.00202, 6);
    expect(byKind('centeringRing').mass).toBeCloseTo(0.004615, 6);
    expect(byKind('centeringRing', 1).mass).toBeCloseTo(0.004615, 6);
  });
  it('mass items keep their given mass and sit at mid-length', () => {
    expect(byKind('massComponent').mass).toBe(0.03);
    expect(byKind('massComponent').cgX).toBe(0.01);
    expect(byKind('parachute').mass).toBe(0.01);
    expect(byKind('parachute').cgX).toBe(0.025);
  });
});

describe('R1 assembly (hand-checks.md and values.csv)', () => {
  it('structure: 0.148304 kg, CG 0.335898 m', () => {
    const r = rocketMassProperties(R1_COMPONENTS);
    expect(r.mass).toBeCloseTo(0.148304, 6);
    expect(r.cg).toBeCloseTo(0.335898, 6);
  });
  it('liftoff with the D12: 0.190904 kg, CG 0.387022 m; burnout 0.169804 kg, CG 0.364906 m', () => {
    const mo = REFERENCE_MOTORS.r1;
    const liftoff = rocketMassProperties(R1_COMPONENTS, {
      mass: kilograms(mo.totalMass),
      length: metres(mo.length),
      diameter: metres(mo.diameter),
      aftEnd: metres(mo.aftEnd),
    });
    expect(liftoff.mass).toBeCloseTo(0.190904, 6);
    expect(liftoff.cg).toBeCloseTo(0.387022, 6);
    const burnout = rocketMassProperties(R1_COMPONENTS, {
      mass: kilograms(mo.totalMass - mo.propellantMass),
      length: metres(mo.length),
      diameter: metres(mo.diameter),
      aftEnd: metres(mo.aftEnd),
    });
    expect(burnout.mass).toBeCloseTo(0.169804, 6);
    expect(burnout.cg).toBeCloseTo(0.364906, 5);
  });
});

describe('hollow components against OpenRocket component masses (black-box reference, components/*.csv)', () => {
  const first = (
    list: readonly { component: Component }[],
    kind: Component['kind'],
  ): ReturnType<typeof componentMassProperties> => {
    const pc = list.find((p) => p.component.kind === kind);
    if (pc === undefined) throw new Error(`no ${kind}`);
    return componentMassProperties(pc.component);
  };
  it('R2 tangent-ogive shell with shoulder: 0.047206 kg, CG 0.114915 m (within 0.05 %)', () => {
    const p = first(R2_COMPONENTS, 'noseCone');
    expect(rel(p.mass, 0.047206)).toBeLessThan(5e-4);
    expect(rel(p.cgX, 0.114915)).toBeLessThan(5e-4);
  });
  it('R2 conical boat tail shell: 0.010929 kg, CG 0.023275 m', () => {
    const p = first(R2_COMPONENTS, 'transition');
    expect(rel(p.mass, 0.010929)).toBeLessThan(5e-4);
    expect(rel(p.cgX, 0.023275)).toBeLessThan(5e-4);
  });
  it('R3 Von Kármán shell with shoulder: 0.022737 kg, CG 0.076408 m', () => {
    const p = first(R3_COMPONENTS, 'noseCone');
    expect(rel(p.mass, 0.022737)).toBeLessThan(5e-4);
    expect(rel(p.cgX, 0.076408)).toBeLessThan(5e-4);
  });
  it('R4 ogive shell: 0.111639 kg, CG 0.151871 m; R5 Von Kármán shell: 0.035815 kg, CG 0.094665 m', () => {
    const p4 = first(R4_COMPONENTS, 'noseCone');
    expect(rel(p4.mass, 0.111639)).toBeLessThan(5e-4);
    expect(rel(p4.cgX, 0.151871)).toBeLessThan(5e-4);
    const p5 = first(R5_COMPONENTS, 'noseCone');
    expect(rel(p5.mass, 0.035815)).toBeLessThan(5e-4);
    expect(rel(p5.cgX, 0.094665)).toBeLessThan(5e-4);
  });
  it('rail buttons: R2 pair 0.001113 kg, R3 pair 0.000491 kg; fins R2 0.030240, R4 0.080640', () => {
    expect(first(R2_COMPONENTS, 'railButton').mass).toBeCloseTo(0.001113, 6);
    expect(first(R3_COMPONENTS, 'railButton').mass).toBeCloseTo(0.000491, 6);
    expect(first(R2_COMPONENTS, 'finSet').mass).toBeCloseTo(0.03024, 6);
    expect(first(R4_COMPONENTS, 'finSet').mass).toBeCloseTo(0.08064, 6);
    // Fin centroids (components CSV, relative to the root leading edge)
    expect(first(R2_COMPONENTS, 'finSet').cgX).toBeCloseTo(0.076667, 6);
    expect(first(R4_COMPONENTS, 'finSet').cgX).toBeCloseTo(0.094286, 6);
  });
});

describe('reference rockets at liftoff and burnout against values.csv (CG acceptance 1 %, mass 0.1 %)', () => {
  const cases = [
    {
      name: 'R1',
      components: R1_COMPONENTS,
      motor: REFERENCE_MOTORS.r1,
      mass: 0.190904,
      cg: 0.387022,
      burnoutMass: 0.169804,
      burnoutCg: 0.364906,
    },
    {
      name: 'R2',
      components: R2_COMPONENTS,
      motor: REFERENCE_MOTORS.r2,
      mass: 0.414484,
      cg: 0.484548,
      burnoutMass: 0.345484,
      burnoutCg: 0.443897,
    },
    {
      name: 'R3',
      components: R3_COMPONENTS,
      motor: REFERENCE_MOTORS.r3,
      mass: 0.171873,
      cg: 0.356248,
      burnoutMass: 0.149173,
      burnoutCg: 0.332091,
    },
    {
      name: 'R4',
      components: R4_COMPONENTS,
      motor: REFERENCE_MOTORS.r4,
      mass: 1.365936,
      cg: 0.625038,
      burnoutMass: 1.2396,
      burnoutCg: 0.594671,
    },
    {
      name: 'R5',
      components: R5_COMPONENTS,
      motor: REFERENCE_MOTORS.r5,
      mass: 0.450135,
      cg: 0.43553,
      burnoutMass: 0.369495,
      burnoutCg: 0.403346,
    },
  ];
  for (const c of cases) {
    it(`${c.name}: liftoff and burnout`, () => {
      const motor = (mass: number): Parameters<typeof rocketMassProperties>[1] => ({
        mass: kilograms(mass),
        length: metres(c.motor.length),
        diameter: metres(c.motor.diameter),
        aftEnd: metres(c.motor.aftEnd),
      });
      const lo = rocketMassProperties(c.components, motor(c.motor.totalMass));
      expect(rel(lo.mass, c.mass), 'liftoff mass').toBeLessThan(1e-3);
      expect(rel(lo.cg, c.cg), 'liftoff CG').toBeLessThan(1e-2);
      const bo = rocketMassProperties(
        c.components,
        motor(c.motor.totalMass - c.motor.propellantMass),
      );
      expect(rel(bo.mass, c.burnoutMass), 'burnout mass').toBeLessThan(1e-3);
      expect(rel(bo.cg, c.burnoutCg), 'burnout CG').toBeLessThan(1e-2);
    });
  }
});

describe('validation and properties', () => {
  it('rejects impossible geometry with InvalidInputError', () => {
    expect(() =>
      componentMassProperties({
        kind: 'bodyTube',
        length: metres(0.1),
        outerRadius: metres(0.01),
        wallThickness: metres(0.02),
        density: kilogramsPerCubicMetre(700),
      }),
    ).toThrow(InvalidInputError);
    expect(() =>
      componentMassProperties({
        kind: 'centeringRing',
        length: metres(0.005),
        outerRadius: metres(0.01),
        innerRadius: metres(0.02),
        density: kilogramsPerCubicMetre(700),
      }),
    ).toThrow(InvalidInputError);
    expect(() =>
      componentMassProperties({
        kind: 'finSet',
        count: 2.5,
        rootChord: metres(0.1),
        tipChord: metres(0.05),
        sweep: metres(0.05),
        span: metres(0.08),
        thickness: metres(0.003),
        density: kilogramsPerCubicMetre(600),
        bodyRadius: metres(0.025),
      }),
    ).toThrow(InvalidInputError);
    expect(() =>
      componentMassProperties({
        kind: 'railButton',
        count: 1,
        outerDiameter: metres(0.01),
        innerDiameter: metres(0.006),
        totalHeight: metres(0.003),
        baseHeight: metres(0.002),
        flangeHeight: metres(0.002),
        density: kilogramsPerCubicMetre(1150),
        bodyRadius: metres(0.02),
      }),
    ).toThrow(InvalidInputError);
    expect(() => rocketMassProperties([])).toThrow(InvalidInputError);
  });

  it('mass scales linearly with density and as the cube of a uniform scale factor (hollow ogive nose)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 2, noNaN: true }),
        fc.double({ min: 100, max: 3000, noNaN: true }),
        (k, rho) => {
          const base = componentMassProperties({
            kind: 'noseCone',
            shape: 'ogive',
            length: metres(0.15),
            baseRadius: metres(0.027),
            wallThickness: metres(0.002),
            density: kilogramsPerCubicMetre(1000),
          });
          const scaled = componentMassProperties({
            kind: 'noseCone',
            shape: 'ogive',
            length: metres(0.15 * k),
            baseRadius: metres(0.027 * k),
            wallThickness: metres(0.002 * k),
            density: kilogramsPerCubicMetre(rho),
          });
          return (
            rel(scaled.mass, (base.mass * rho * k ** 3) / 1000) < 1e-6 &&
            rel(scaled.cgX, base.cgX * k) < 1e-6
          );
        },
      ),
      { seed: 20260003 },
    );
  });

  it('every reference component has positive mass, CG within its length and non-negative inertia', () => {
    for (const list of [
      R1_COMPONENTS,
      R2_COMPONENTS,
      R3_COMPONENTS,
      R4_COMPONENTS,
      R5_COMPONENTS,
    ]) {
      for (const { component } of list) {
        const p = componentMassProperties(component);
        expect(p.mass).toBeGreaterThan(0);
        expect(p.inertiaRotational).toBeGreaterThanOrEqual(0);
        expect(p.inertiaLongitudinal).toBeGreaterThanOrEqual(0);
        if (component.kind !== 'railButton' && component.kind !== 'finSet') {
          const total =
            component.kind === 'noseCone' && component.aftShoulder !== undefined
              ? component.length + component.aftShoulder.length
              : component.length;
          expect(p.cgX).toBeGreaterThanOrEqual(0);
          expect(p.cgX).toBeLessThanOrEqual(total);
        }
      }
    }
  });
});

describe('nose cone shoulder wall (review finding G-1)', () => {
  const nose = (shoulderRadius: number, wall: number): Component => ({
    kind: 'noseCone',
    shape: 'conical',
    length: metres(0.1),
    baseRadius: metres(0.025),
    wallThickness: metres(0.002),
    density: kilogramsPerCubicMetre(1000),
    aftShoulder: {
      length: metres(0.03),
      radius: metres(shoulderRadius),
      wallThickness: metres(wall),
    },
  });

  it('a 15 mm wall on a 20 mm shoulder adds the hollow cylinder of 0.035343 kg', () => {
    // By hand: π (0.020² − 0.005²) × 0.030 × 1000 = π × 0.000375 × 30 = 0.0353429 kg.
    const full = nose(0.02, 0.015);
    if (full.kind !== 'noseCone') throw new Error('expected a nose cone');
    const bare: Component = {
      kind: 'noseCone',
      shape: full.shape,
      length: full.length,
      baseRadius: full.baseRadius,
      density: full.density,
      ...(full.wallThickness === undefined ? {} : { wallThickness: full.wallThickness }),
    };
    const withShoulder = componentMassProperties(nose(0.02, 0.015));
    const without = componentMassProperties(bare);
    expect(withShoulder.mass - without.mass).toBeCloseTo(0.0353429, 7);
  });

  it('rejects a shoulder wall equal to or thicker than the shoulder radius', () => {
    // The review's cases: 30 mm gave less than a solid shoulder, 50 mm gave −0.0322 kg.
    for (const wall of [0.02, 0.03, 0.05]) {
      expect(() => componentMassProperties(nose(0.02, wall))).toThrow(
        /shoulder wall thickness.*less than the shoulder radius/,
      );
    }
  });

  it('rejects a shoulder wider than the nose base', () => {
    expect(() => componentMassProperties(nose(0.026, 0.001))).toThrow(
      /shoulder radius.*nose cone base radius/,
    );
    // Equal to the base radius is accepted.
    expect(componentMassProperties(nose(0.025, 0.001)).mass).toBeGreaterThan(0);
  });

  it('property: any accepted nose with a shoulder has positive mass and inertia, more than without it', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 1, noNaN: true }),
        fc.double({ min: 0.001, max: 1, noNaN: true }),
        fc.double({ min: 0.001, max: 0.999, noNaN: true }),
        (radiusFraction, lengthMetres, wallFraction) => {
          const radius = 0.025 * radiusFraction;
          const n = {
            kind: 'noseCone',
            shape: 'conical',
            length: metres(0.1),
            baseRadius: metres(0.025),
            density: kilogramsPerCubicMetre(1000),
            aftShoulder: {
              length: metres(lengthMetres),
              radius: metres(radius),
              wallThickness: metres(radius * wallFraction),
            },
          } as const;
          const bare: Component = {
            kind: n.kind,
            shape: n.shape,
            length: n.length,
            baseRadius: n.baseRadius,
            density: n.density,
          };
          const p = componentMassProperties(n);
          const solidNose = componentMassProperties(bare);
          return (
            p.mass > solidNose.mass &&
            p.inertiaRotational > 0 &&
            p.inertiaLongitudinal > 0 &&
            p.cgX > 0
          );
        },
      ),
      { seed: 20261012 },
    );
  });
});
