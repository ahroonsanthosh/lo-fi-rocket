/**
 * The 3D model's dimensions match the design geometry (plan 0034).
 */
import { metres, noseProfile, R1_COMPONENTS } from '@lo-fi-rocket/physics';
import { Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { REFERENCE_ROCKETS, referenceComponents } from '../test-support/reference-flights.js';
import {
  buildRocketObject,
  finGeometry,
  PROFILE_SAMPLES,
  REVOLUTION_SEGMENTS,
  revolveOutline,
  rocketModelExtent,
  rocketModelParts,
  type FinPart,
  type RevolvedPart,
} from './rocket-model.js';

describe('rocketModelParts (R1 by hand, reference/rockets/README.md)', () => {
  const parts = rocketModelParts(R1_COMPONENTS);

  it('draws the nose cone as the conical profile from 0 to 0.100 m with base radius 0.025 m', () => {
    const nose = parts.find(
      (p): p is RevolvedPart => p.kind === 'revolved' && p.component === 'noseCone',
    );
    expect(nose).toBeDefined();
    const o = nose!.outline;
    // Tip at (0, 0), base at (0.1, 0.025), closed at (0.1, 0): PROFILE_SAMPLES + 2 points.
    expect(o).toHaveLength(PROFILE_SAMPLES + 2);
    expect(o[0]).toEqual([0, 0]);
    expect(o[PROFILE_SAMPLES]).toEqual([0.1, 0.025]);
    expect(o[PROFILE_SAMPLES + 1]).toEqual([0.1, 0]);
    // Conical: r = (x / L) R (GEO-1). At x = 0.05: r = 0.0125.
    const mid = o[PROFILE_SAMPLES / 2]!;
    expect(mid[0]).toBeCloseTo(0.05, 15);
    expect(mid[1]).toBeCloseTo(0.0125, 15);
    // Every outline point lies on the physics profile.
    const p = noseProfile('conical', metres(0.1), metres(0.025));
    for (const [x, r] of o.slice(0, PROFILE_SAMPLES + 1)) {
      expect(r).toBe(p.radius(x));
    }
  });

  it('draws the body tube from 0.100 to 0.600 m at radius 0.025 m', () => {
    const tube = parts.find(
      (p): p is RevolvedPart => p.kind === 'revolved' && p.component === 'bodyTube',
    );
    expect(tube!.outline).toEqual([
      [0.1, 0],
      [0.1, 0.025],
      [0.6, 0.025],
      [0.6, 0],
    ]);
  });

  it('draws three fins with the planform corners (0.5, 0.025), (0.55, 0.105), (0.6, 0.105), (0.6, 0.025), 120° apart, fin 1 at +y', () => {
    const fins = parts.filter((p): p is FinPart => p.kind === 'fin');
    expect(fins).toHaveLength(3);
    for (const f of fins) {
      expect(f.corners[0]).toEqual([0.5, 0.025]);
      expect(f.corners[1][0]).toBeCloseTo(0.55, 15);
      expect(f.corners[1][1]).toBeCloseTo(0.105, 15);
      expect(f.corners[2][0]).toBeCloseTo(0.6, 15);
      expect(f.corners[2][1]).toBeCloseTo(0.105, 15);
      expect(f.corners[3]).toEqual([0.6, 0.025]);
      expect(f.thickness).toBe(0.003);
    }
    expect(fins.map((f) => f.angle)).toEqual([0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]);
  });

  it('draws the launch lug (0.350 to 0.400 m, radius 0.003 m) offset to the body surface and no internal part', () => {
    const lug = parts.find(
      (p): p is RevolvedPart => p.kind === 'revolved' && p.component === 'launchLug',
    );
    expect(lug!.outline).toEqual([
      [0.35, 0],
      [0.35, 0.003],
      [0.35 + 0.05, 0.003],
      [0.35 + 0.05, 0],
    ]);
    expect(lug!.offset?.distance).toBeCloseTo(0.028, 12);
    const kinds = new Set(parts.map((p) => (p.kind === 'revolved' ? p.component : p.kind)));
    expect(kinds.has('innerTube')).toBe(false);
    expect(kinds.has('centeringRing')).toBe(false);
    expect(kinds.has('massComponent')).toBe(false);
    expect(kinds.has('parachute')).toBe(false);
  });

  it('has the overall length 0.600 m and the maximum radius 0.105 m (fin tip)', () => {
    const e = rocketModelExtent(parts);
    expect(e.length).toBeCloseTo(0.6, 15);
    expect(e.maxRadius).toBeCloseTo(0.105, 15);
  });
});

describe('rocketModelParts (all five reference rockets)', () => {
  for (const rocket of REFERENCE_ROCKETS) {
    it(`${rocket.id}: the model's length is the aft end of the last external component and its radius the largest outline`, () => {
      const components = referenceComponents(rocket);
      const parts = rocketModelParts(components);
      const extent = rocketModelExtent(parts);
      let length = 0;
      let radius = 0;
      for (const pc of components) {
        const c = pc.component;
        if (c.kind === 'noseCone' || c.kind === 'bodyTube' || c.kind === 'transition') {
          const l: number =
            c.kind === 'noseCone' && c.aftShoulder !== undefined
              ? c.length + c.aftShoulder.length
              : c.length;
          length = Math.max(length, (pc.position as number) + l);
        }
        if (c.kind === 'noseCone') radius = Math.max(radius, c.baseRadius);
        if (c.kind === 'bodyTube') radius = Math.max(radius, c.outerRadius);
        if (c.kind === 'transition') radius = Math.max(radius, c.foreRadius, c.aftRadius);
        if (c.kind === 'finSet') {
          radius = Math.max(radius, (c.bodyRadius as number) + (c.span as number));
          // A swept fin's tip trailing edge may lie aft of the root trailing edge (R3).
          length = Math.max(
            length,
            (pc.position as number) +
              Math.max(c.rootChord, (c.sweep as number) + (c.tipChord as number)),
          );
        }
        if (c.kind === 'railButton') {
          radius = Math.max(radius, (c.bodyRadius as number) + (c.totalHeight as number));
          // Buttons are drawn centred on their positions, so the aft one may extend past the body.
          length = Math.max(
            length,
            (pc.position as number) +
              (c.count - 1) * ((c.separation ?? 0) as number) +
              (c.outerDiameter as number) / 2,
          );
        }
        if (c.kind === 'launchLug')
          radius = Math.max(radius, (c.radialOffset ?? 0) + (c.outerRadius as number));
      }
      expect(extent.length).toBeCloseTo(length, 12);
      expect(extent.maxRadius).toBeCloseTo(radius, 12);
      // Every curved outline point lies on the physics profile of its component.
      for (const pc of components) {
        const c = pc.component;
        if (c.kind !== 'noseCone') continue;
        const profile = noseProfile(c.shape, c.length, c.baseRadius, c.shapeParameter);
        const part = parts.find(
          (p): p is RevolvedPart => p.kind === 'revolved' && p.component === 'noseCone',
        );
        for (const [x, r] of part!.outline.slice(0, PROFILE_SAMPLES + 1)) {
          expect(r).toBe(profile.radius(x - (pc.position as number)));
        }
      }
      // The fin count of every fin set is drawn.
      const finCount = components.reduce(
        (n, pc) => n + (pc.component.kind === 'finSet' ? pc.component.count : 0),
        0,
      );
      expect(parts.filter((p) => p.kind === 'fin')).toHaveLength(finCount);
    });
  }
});

describe('three.js geometry', () => {
  it('revolveOutline places every ring at its (x, r) with the stated number of facets', () => {
    const g = revolveOutline(
      [
        [0.1, 0],
        [0.1, 0.025],
        [0.6, 0.025],
        [0.6, 0],
      ],
      REVOLUTION_SEGMENTS,
    );
    const pos = g.getAttribute('position');
    expect(pos.count).toBe(4 * (REVOLUTION_SEGMENTS + 1));
    // Ring 1 (x = 0.1, r = 0.025): vertex j at angle 2πj/N; vertex N/4 is at (0.1, 0, 0.025) (float32).
    const j = REVOLUTION_SEGMENTS / 4;
    const i = 1 * (REVOLUTION_SEGMENTS + 1) + j;
    expect(pos.getX(i)).toBeCloseTo(0.1, 6);
    expect(pos.getY(i)).toBeCloseTo(0, 6);
    expect(pos.getZ(i)).toBeCloseTo(0.025, 6);
    expect(g.index!.count).toBe(3 * 6 * REVOLUTION_SEGMENTS);
  });

  it('finGeometry puts the planform corners of fin 1 in the +y half-plane, ±thickness/2 in z', () => {
    const g = finGeometry({
      kind: 'fin',
      name: 'f',
      finIndex: 0,
      corners: [
        [0.5, 0.025],
        [0.55, 0.105],
        [0.6, 0.105],
        [0.6, 0.025],
      ],
      thickness: 0.003,
      angle: 0,
    });
    const pos = g.getAttribute('position');
    expect(pos.count).toBe(8);
    // Vertex 1 (tip leading edge, +side): (0.55, 0.105, +0.0015).
    expect(pos.getX(1)).toBeCloseTo(0.55, 6);
    expect(pos.getY(1)).toBeCloseTo(0.105, 6);
    expect(pos.getZ(1)).toBeCloseTo(0.0015, 6);
    // Vertex 5 (the same corner, −side): z = −0.0015.
    expect(pos.getZ(5)).toBeCloseTo(-0.0015, 6);
  });

  it('buildRocketObject makes one mesh per part, origin at the nose tip, and reports the extent', () => {
    const parts = rocketModelParts(R1_COMPONENTS);
    const o = buildRocketObject(parts);
    expect(o.group.children).toHaveLength(parts.length);
    expect(o.group.children.every((c) => c instanceof Mesh)).toBe(true);
    expect(o.group.position.toArray()).toEqual([0, 0, 0]);
    expect(o.extent.length).toBeCloseTo(0.6, 15);
  });
});
