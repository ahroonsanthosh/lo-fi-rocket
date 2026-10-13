import { exampleDesign } from '@lo-fi-rocket/formats';
import { describe, expect, it } from 'vitest';
import { metres, type Component, type FinShape } from '@lo-fi-rocket/physics';
import { fieldsOf, withPlanform } from './ComponentEditor.js';
import { componentShapes, extentOf } from './side-view-geometry.js';

describe('side view geometry (plan 0012)', () => {
  const shapes = componentShapes(exampleDesign().components);
  it('draws every component of R1: nose, body, fins, mass, lug, mount, two rings, packed chute', () => {
    expect(shapes.map((s) => s.kind)).toEqual([
      'noseCone',
      'bodyTube',
      'finSet',
      'massComponent',
      'launchLug',
      'innerTube',
      'centeringRing',
      'centeringRing',
      'parachute',
    ]);
    expect(shapes.filter((s) => s.external).length).toBe(2);
  });
  it('the conical nose outline runs from (0, 0) to (0.1, 0.025); the fin planform is the trapezoid at the body radius', () => {
    const nose = shapes[0]!;
    expect(nose.points[0]).toEqual([0, 0]);
    expect(nose.points[32]?.[0]).toBeCloseTo(0.1, 12);
    expect(nose.points[32]?.[1]).toBeCloseTo(0.025, 12);
    expect(nose.points[16]?.[1]).toBeCloseTo(0.0125, 12);
    const fins = shapes[2]!;
    const expected = [
      [0.5, 0.025],
      [0.55, 0.105],
      [0.6, 0.105],
      [0.6, 0.025],
    ];
    expected.forEach(([x, r], i) => {
      expect(fins.points[i]?.[0]).toBeCloseTo(x ?? 0, 12);
      expect(fins.points[i]?.[1]).toBeCloseTo(r ?? 0, 12);
    });
  });
  it('the extent covers the length and the fin span; an invalid component is skipped, not drawn wrongly', () => {
    const e = extentOf(shapes);
    expect(e.length).toBeCloseTo(0.6, 12);
    expect(e.radius).toBeCloseTo(0.105, 12);
    const broken = exampleDesign().components.map((c) =>
      c.id === 'nose' && c.component.kind === 'noseCone'
        ? { ...c, component: { ...c.component, length: 0 as never } }
        : c,
    );
    expect(componentShapes(broken).map((s) => s.kind)).not.toContain('noseCone');
  });
});

describe('shaped fins in the side view (plan 0059)', () => {
  it('an elliptical fin set is drawn as its half ellipse at the body radius, a freeform one as its points', () => {
    const design = exampleDesign();
    const withShape = (shape: FinShape) =>
      componentShapes(
        design.components.map((c) =>
          c.component.kind === 'finSet' ? { ...c, component: { ...c.component, shape } } : c,
        ),
      ).find((s) => s.kind === 'finSet');
    const ellipse = withShape({ kind: 'elliptical' });
    expect(ellipse?.points).toHaveLength(49);
    // R1's fins: root 0.1 m at x = 0.5 m, span 0.08 m, body radius 0.025 m; the top of the ellipse is
    // mid-root at the full span.
    expect(ellipse?.points[24]?.[0]).toBeCloseTo(0.55, 12);
    expect(ellipse?.points[24]?.[1]).toBeCloseTo(0.105, 12);
    const free = withShape({
      kind: 'freeform',
      points: [
        { x: metres(0), y: metres(0) },
        { x: metres(0.05), y: metres(0.08) },
        { x: metres(0.1), y: metres(0) },
      ],
    });
    [
      [0.5, 0.025],
      [0.55, 0.105],
      [0.6, 0.025],
    ].forEach(([x, r], i) => {
      expect(free?.points[i]?.[0]).toBeCloseTo(x ?? NaN, 12);
      expect(free?.points[i]?.[1]).toBeCloseTo(r ?? NaN, 12);
    });
    expect(free?.points).toHaveLength(3);
  });
});

describe('the fin shape control (plan 0059)', () => {
  const fins = exampleDesign().components.find((c) => c.component.kind === 'finSet')?.component;
  if (fins?.kind !== 'finSet') throw new Error('R1 has fins');
  it('elliptical keeps root and span; back to trapezoidal is the equivalent trapezoid', () => {
    const e = withPlanform(fins, 'elliptical');
    expect(e).toMatchObject({ rootChord: 0.1, span: 0.08, shape: { kind: 'elliptical' } });
    const t = withPlanform(e, 'trapezoidal');
    expect('shape' in t).toBe(false);
    // Tip chord 2A/s − c_r = (π/2 − 1) 0.1 m.
    expect(t.tipChord).toBeCloseTo((Math.PI / 2 - 1) * 0.1, 12);
    expect(withPlanform(fins, 'trapezoidal')).toBe(fins);
  });
  it('a shaped fin hides the sizes that describe nothing', () => {
    const keys = (c: Component) => fieldsOf(c).map((f) => f.key);
    expect(keys(fins)).toContain('tipChord');
    expect(keys(withPlanform(fins, 'elliptical'))).not.toContain('tipChord');
    expect(keys(withPlanform(fins, 'elliptical'))).toContain('rootChord');
    const free: Component = {
      ...fins,
      shape: { kind: 'freeform', points: [] },
    };
    expect(keys(free)).not.toContain('rootChord');
    expect(keys(free)).not.toContain('span');
  });
});
