/**
 * Fin planforms (plan 0058, D-087). A freeform outline of a trapezoid must give the trapezoid's
 * closed forms; the ellipse's closed forms are worked by hand; a fine polygon round an ellipse
 * converges to them; a jagged outline keeps its true area for the normal force (Niskanen p. 28).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { dragCoefficient } from '../drag/drag.js';
import { InvalidInputError } from '../errors.js';
import { componentApproximations } from '../fidelity.js';
import { finSetTerm, centreOfPressure } from '../stability/barrowman.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from '../flight/gravity.js';
import { simulateFlight } from '../flight/simulate.js';
import type { SimulationOptions } from '../flight/vehicle.js';
import { D12 } from '../motor/motor.test.js';
import {
  kilogramsPerCubicMetre,
  mach,
  metres,
  radians,
  seconds,
  squareMetres,
} from '../units/si.js';
import type { PlacedComponent } from './assembly.js';
import { componentMassProperties, type TrapezoidFinSetComponent } from './components.js';
import { finPlanform, trapezoidOf, type FinPoint, type FinShape } from './fin-planform.js';
import { R1_COMPONENTS } from './reference-rockets.js';

const at = (x: number, y: number): FinPoint => ({ x: metres(x), y: metres(y) });

// The tab-probe fins: root 0.1, tip 0.05, sweep 0.05, span 0.08 m, three 3 mm plywood fins on a 25 mm body.
const TRAPEZOID: TrapezoidFinSetComponent = {
  kind: 'finSet',
  count: 3,
  rootChord: metres(0.1),
  tipChord: metres(0.05),
  sweep: metres(0.05),
  span: metres(0.08),
  thickness: metres(0.003),
  density: kilogramsPerCubicMetre(600),
  bodyRadius: metres(0.025),
  crossSection: 'square',
};
const shaped = (shape: FinShape, over: Partial<TrapezoidFinSetComponent> = {}) => ({
  ...TRAPEZOID,
  tipChord: metres(0),
  sweep: metres(0),
  shape,
  ...over,
});
const AS_POLYGON = shaped({
  kind: 'freeform',
  points: [at(0, 0), at(0.05, 0.08), at(0.1, 0.08), at(0.1, 0)],
});

const close = (a: number, b: number, relative = 1e-12): void => {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(relative * Math.max(1, Math.abs(b)) + 1e-300);
};

describe('a freeform outline of a trapezoid is the trapezoid', () => {
  const t = finPlanform(TRAPEZOID);
  const p = finPlanform(AS_POLYGON);

  it('planform quantities', () => {
    // Trapezoid by hand: A = 0.075 × 0.08 = 0.006 m²; c̄ = (2/3)(0.01 + 0.005 + 0.0025)/0.15
    // = 0.0777778 m; x_MAC,LE = (0.05/3)(0.2/0.15) = 0.0222222 m; quarter-MAC 0.0416667 m.
    close(t.area, 0.006);
    close(t.mac, 0.0175 / 0.225);
    close(t.quarterChord, (0.05 / 3) * (0.2 / 0.15) + 0.0175 / 0.225 / 4);
    for (const key of [
      'area',
      'mac',
      'macSpanwise',
      'macLeadingEdge',
      'quarterChord',
      'midchordSweep',
      'leadingEdgeSweep',
    ] as const) {
      close(p[key], t[key]);
    }
    for (const n of [2, 3, 4]) close(p.stripIntegral(n, 0.025), t.stripIntegral(n, 0.025));
    for (const key of ['x', 'y', 'xx', 'yy'] as const) close(p.moments[key], t.moments[key]);
    close(p.equivalentTrapezoid.tipChord, 0.05);
    close(p.equivalentTrapezoid.sweep, 0.05);
  });

  it('mass, fin force, CP and drag', () => {
    const a = componentMassProperties(TRAPEZOID);
    const b = componentMassProperties(AS_POLYGON);
    for (const key of ['mass', 'cgX', 'inertiaRotational', 'inertiaLongitudinal'] as const) {
      close(b[key], a[key], 1e-11);
    }
    const aRef = squareMetres(Math.PI * 0.025 ** 2);
    for (const m of [0.3, 0.9, 1.5, 2.5]) {
      const x = finSetTerm(TRAPEZOID, aRef, mach(m), 'worst', false);
      const y = finSetTerm(AS_POLYGON, aRef, mach(m), 'worst', false);
      close(y.cnAlpha, x.cnAlpha, 1e-11);
      close(y.cpX, x.cpX, 1e-11);
    }
    const rocket = (fin: TrapezoidFinSetComponent): PlacedComponent[] =>
      R1_COMPONENTS.map((c) => (c.component.kind === 'finSet' ? { ...c, component: fin } : c));
    const drag = (fin: TrapezoidFinSetComponent): number =>
      dragCoefficient({
        components: rocket(fin),
        mach: mach(0.3),
        reynolds: 3e6,
        roughnessHeight: metres(60e-6),
        baseDragMotorRule: 'while-thrusting',
      }).cd0;
    close(drag(AS_POLYGON), drag(TRAPEZOID), 1e-11);
  });
});

describe('the elliptical fin', () => {
  const e = finPlanform(shaped({ kind: 'elliptical' }));

  it('closed forms by hand (c_r = 0.1, s = 0.08 m)', () => {
    // A = π 0.1 × 0.08/4 = 6.2831853e-3 m²; c̄ = 0.8/(3π) = 0.0848826 m; y_MAC = 0.32/(3π) = 0.0339531 m;
    // x_MAC,LE = 0.05 − c̄/2 = 0.0075587 m; quarter-MAC 0.05 − c̄/4 = 0.0287794 m; Γ_c = 0.
    close(e.area, (Math.PI * 0.008) / 4);
    close(e.mac, 0.8 / (3 * Math.PI));
    close(e.macSpanwise, 0.32 / (3 * Math.PI));
    close(e.macLeadingEdge, 0.05 - 0.4 / (3 * Math.PI));
    close(e.quarterChord, 0.05 - 0.2 / (3 * Math.PI));
    expect(e.midchordSweep).toBe(0);
    // Γ_L = ∫₀¹ atan(0.625 u/√(1 − u²)) du = 0.42342712785 rad, by an independent Simpson sum of 2e6
    // intervals in θ (u = sin θ).
    close(e.leadingEdgeSweep, 0.4234271278455209, 1e-10);
    // I₂ = c_r s [r_t² π/4 + 2 r_t s/3 + s² π/16] = 2.4646754e-5 m⁴ (r_t = 0.025 m).
    close(e.stripIntegral(2, 0.025), 2.4646753975141247e-5, 1e-12);
  });

  it('a polygon of 2000 points round the ellipse converges to it', () => {
    const n = 1000;
    const points: FinPoint[] = [];
    for (let i = 0; i <= n; i++) {
      const th = Math.PI - (Math.PI * i) / n;
      points.push(at(0.05 + 0.05 * Math.cos(th), 0.08 * Math.sin(th)));
    }
    points[0] = at(0, 0);
    points[n] = at(0.1, 0);
    const p = finPlanform(shaped({ kind: 'freeform', points }));
    close(p.area, e.area, 1e-5);
    close(p.quarterChord, e.quarterChord, 1e-5);
    close(p.mac, e.mac, 1e-5);
    expect(Math.abs(p.midchordSweep)).toBeLessThan(1e-9);
    close(p.leadingEdgeSweep, e.leadingEdgeSweep, 1e-3);
    close(p.stripIntegral(3, 0.025), e.stripIntegral(3, 0.025), 1e-5);
    for (const key of ['x', 'y', 'xx', 'yy'] as const) close(p.moments[key], e.moments[key], 1e-5);
  });

  it('its equivalent trapezoid has the same span, root chord, area and CP', () => {
    const fin = shaped({ kind: 'elliptical' });
    const t = finPlanform(trapezoidOf(fin));
    expect(trapezoidOf(fin)).toBe(trapezoidOf(fin));
    expect('shape' in trapezoidOf(fin)).toBe(false);
    close(t.area, e.area);
    close(t.quarterChord, e.quarterChord);
    // tip chord 2A/s − c_r = (π/2 − 1) c_r = 0.0570796 m
    close(e.equivalentTrapezoid.tipChord, (Math.PI / 2 - 1) * 0.1);
  });
});

describe('a jagged freeform fin (Niskanen pp. 27 to 28)', () => {
  // Two lobes joined at the root: the chord is filled across the notch between them for the MAC
  // and CP, the true area is kept for the normal force and the mass.
  const jagged = shaped(
    {
      kind: 'freeform',
      points: [
        at(0, 0),
        at(0, 0.06),
        at(0.03, 0.06),
        at(0.04, 0.02),
        at(0.06, 0.02),
        at(0.07, 0.06),
        at(0.1, 0.06),
        at(0.1, 0),
      ],
      // span 0.06 m
    },
    { span: metres(0.06) },
  );
  const p = finPlanform(jagged);

  it('true area by hand, filled chord for the MAC', () => {
    // 0.1 × 0.06 = 6e-3 less the notch, a trapezoid 0.04 wide at the top, 0.02 at the bottom and
    // 0.04 high: 1.2e-3; true area 4.8e-3 m². The filled chord is 0.1 m at every height, so the
    // MAC is the 0.1 m rectangle's: c̄ = 0.1, x_MAC,LE = 0, quarter-MAC 0.025 m.
    close(p.area, 4.8e-3);
    close(p.mac, 0.1);
    close(p.macLeadingEdge, 0);
    close(p.quarterChord, 0.025);
  });
});

describe('outlines that do not describe a fin are reported', () => {
  const bad =
    (points: readonly FinPoint[], over: Partial<TrapezoidFinSetComponent> = {}) =>
    () =>
      finPlanform(shaped({ kind: 'freeform', points }, over));
  it('start, root, span, height and point count', () => {
    expect(bad([at(0.01, 0), at(0.05, 0.08), at(0.1, 0)])).toThrow(/root leading edge/);
    expect(bad([at(0, 0), at(0.05, 0.08), at(0.09, 0)])).toThrow(/root chord/);
    expect(bad([at(0, 0), at(0.05, 0.07), at(0.1, 0)])).toThrow(/span/);
    expect(bad([at(0, 0), at(0.05, -0.01), at(0.1, 0)])).toThrow(InvalidInputError);
    expect(bad([at(0, 0), at(0.1, 0)])).toThrow(/at least 3/);
  });
});

describe('shaped fin sets list the equivalent trapezoid (minor)', () => {
  it('elliptical and freeform, not the trapezoid', () => {
    expect(componentApproximations([{ name: 'Fins', component: TRAPEZOID }])).toEqual([]);
    for (const fin of [shaped({ kind: 'elliptical' }), AS_POLYGON]) {
      const [a, ...rest] = componentApproximations([{ name: 'Fins', component: fin }]);
      expect(rest).toEqual([]);
      expect(a?.impact).toBe('minor');
      expect(a?.what).toMatch(/planform in the methods written for trapezoids/);
    }
  });
});

describe('property: adding a freeform fin set aft of the CP never moves the CP forward', () => {
  const OR_MODE = { mach: mach(0.3), rollAngle: 'worst' as const, finRollReduction: false };
  const base = R1_COMPONENTS.filter((p) => p.component.kind !== 'finSet');
  it('random y-monotone outlines', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.03, max: 0.2, noNaN: true }),
        fc.double({ min: 0.02, max: 0.15, noNaN: true }),
        fc.array(
          fc.record({
            le: fc.double({ min: -0.05, max: 0.15, noNaN: true }),
            width: fc.double({ min: 0.005, max: 0.15, noNaN: true }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        fc.double({ min: 0.3, max: 0.5, noNaN: true }),
        (cr, s, levels, position) => {
          // Leading edge up, trailing edge down: a simple polygon at every height.
          const ys = levels.map((_, i) => (s * (i + 1)) / levels.length);
          const points = [
            at(0, 0),
            ...levels.map((l, i) => at(l.le, ys[i] ?? s)),
            ...[...levels].map((l, i) => at(l.le + l.width, ys[i] ?? s)).reverse(),
            at(cr, 0),
          ];
          const fin = shaped(
            { kind: 'freeform', points },
            { rootChord: metres(cr), span: metres(s) },
          );
          const before = centreOfPressure(base, OR_MODE);
          const term = finSetTerm(fin, before.referenceArea, OR_MODE.mach, 'worst', false);
          fc.pre(term.cnAlpha > 0 && position + term.cpX >= before.cp);
          const after = centreOfPressure(
            [...base, { component: fin, position: metres(position) }],
            OR_MODE,
          );
          return after.cp >= before.cp - 1e-12;
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('flights with shaped fins', () => {
  const options: SimulationOptions = {
    site: { altitude: metres(0) },
    rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
    wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
    gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
    aerodynamics: 'niskanen',
    finRollReduction: false,
    baseDragMotorRule: 'always',
    integrator: { kind: 'rk4', timeStep: seconds(0.005) },
    maxTime: seconds(120),
    degreesOfFreedom: 6,
    recordInterval: seconds(0.05),
  };
  const fly = (fins: (fin: TrapezoidFinSetComponent) => TrapezoidFinSetComponent) =>
    simulateFlight(
      {
        components: R1_COMPONENTS.map((c) =>
          c.component.kind === 'finSet' ? { ...c, component: fins(c.component) } : c,
        ),
        motor: {
          kind: 'definition',
          definition: D12,
          aftEnd: metres(0.6),
          ejectionDelay: seconds(5),
        },
        recovery: [],
        roughnessHeight: metres(60e-6),
      },
      options,
    );

  it('R1 with its fins drawn as a freeform outline flies as R1', () => {
    const plain = fly((f) => f);
    const outline = fly((f) => ({
      ...f,
      shape: {
        kind: 'freeform',
        points: [
          at(0, 0),
          at(f.sweep, f.span),
          at((f.sweep as number) + (f.tipChord as number), f.span),
          at(f.rootChord, 0),
        ],
      },
    }));
    expect(Math.abs(outline.summary.apogee / plain.summary.apogee - 1)).toBeLessThan(1e-9);
    expect(outline.approximations.map((a) => a.impact)).toEqual(['minor']);
    expect(outline.confidence.level).toBe('high');
  }, 60000);

  it('R1 with elliptical fins of the same root and span flies, stable', () => {
    const r = fly((f) => ({
      ...f,
      tipChord: metres(0),
      sweep: metres(0),
      shape: { kind: 'elliptical' },
    }));
    expect(r.summary.apogee).toBeGreaterThan(0);
    expect(r.summary.unstable).toBeUndefined();
  }, 60000);
});
