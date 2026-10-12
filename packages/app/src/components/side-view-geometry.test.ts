import { exampleDesign } from '@lo-fi-rocket/formats';
import { describe, expect, it } from 'vitest';
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
