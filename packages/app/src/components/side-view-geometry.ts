/**
 * Geometry of the 2D side view (plan 0012): the outline of each component
 * in the body frame (x aft from the nose tip, r radial), in metres. Pure,
 * so the tests can check it without rendering. Nose and transition
 * outlines come from the physics profiles (GEO-1, GEO-2).
 */
import { finOutline, noseProfile, transitionProfile, type Component } from '@lo-fi-rocket/physics';
import type { DesignComponent } from '@lo-fi-rocket/formats';

export interface Shape {
  readonly id: string;
  readonly kind: Component['kind'];
  /** Polygon points (x, r) with r ≥ 0; the view mirrors it about the axis when `mirror` is true. */
  readonly points: readonly (readonly [number, number])[];
  readonly external: boolean;
  readonly mirror: boolean;
}

const SAMPLES = 32;

function sampled(
  id: string,
  kind: Component['kind'],
  x0: number,
  length: number,
  radius: (x: number) => number,
): Shape {
  const pts: [number, number][] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = (length * i) / SAMPLES;
    pts.push([x0 + x, radius(x)]);
  }
  pts.push([x0 + length, 0]);
  pts.push([x0, 0]);
  return { id, kind, points: pts, external: true, mirror: true };
}

function rect(
  id: string,
  kind: Component['kind'],
  x0: number,
  length: number,
  rInner: number,
  rOuter: number,
  external: boolean,
): Shape {
  return {
    id,
    kind,
    points: [
      [x0, rInner],
      [x0, rOuter],
      [x0 + length, rOuter],
      [x0 + length, rInner],
    ],
    external,
    mirror: true,
  };
}

/** Outline shapes of every component; a component the physics rejects is skipped (the editor reports it). */
export function componentShapes(components: readonly DesignComponent[]): Shape[] {
  const out: Shape[] = [];
  for (const d of components) {
    const c = d.component;
    const x0: number = d.position;
    try {
      switch (c.kind) {
        case 'noseCone': {
          const p = noseProfile(c.shape, c.length, c.baseRadius, c.shapeParameter);
          out.push(sampled(d.id, c.kind, x0, p.length, (x) => p.radius(x)));
          if (c.aftShoulder !== undefined) {
            out.push(
              rect(
                `${d.id}-shoulder`,
                c.kind,
                x0 + c.length,
                c.aftShoulder.length,
                0,
                c.aftShoulder.radius,
                false,
              ),
            );
          }
          break;
        }
        case 'transition': {
          const p = transitionProfile(
            c.shape,
            c.length,
            c.foreRadius,
            c.aftRadius,
            c.shapeParameter,
          );
          out.push(sampled(d.id, c.kind, x0, p.length, (x) => p.radius(x)));
          break;
        }
        case 'bodyTube':
          out.push(rect(d.id, c.kind, x0, c.length, 0, c.outerRadius, true));
          break;
        case 'innerTube':
        case 'launchLug': {
          const off = c.radialOffset ?? 0;
          out.push(
            rect(d.id, c.kind, x0, c.length, off - c.outerRadius, off + c.outerRadius, false),
          );
          break;
        }
        case 'centeringRing':
        case 'bulkhead':
          out.push(rect(d.id, c.kind, x0, c.length, c.innerRadius, c.outerRadius, false));
          break;
        case 'massComponent':
        case 'parachute':
          out.push(rect(d.id, c.kind, x0, c.length, 0, c.radius, false));
          break;
        case 'finSet': {
          // Plan 0059: the trapezoid's corners, or the elliptical or freeform outline.
          const r: number = c.bodyRadius;
          out.push({
            id: d.id,
            kind: c.kind,
            points: finOutline(c).map(([x, y]) => [x0 + x, r + y] as [number, number]),
            external: false,
            mirror: true,
          });
          break;
        }
        case 'railButton': {
          const n = Math.max(1, Math.round(c.count));
          const sep = c.separation ?? 0;
          for (let i = 0; i < n; i++) {
            const x = x0 + i * sep;
            out.push(
              rect(
                `${d.id}-${String(i)}`,
                c.kind,
                x - c.outerDiameter / 2,
                c.outerDiameter,
                c.bodyRadius,
                c.bodyRadius + c.totalHeight,
                false,
              ),
            );
          }
          break;
        }
      }
    } catch {
      // Invalid geometry while editing: the editor and the stability panel report it.
    }
  }
  return out;
}

export interface Extent {
  readonly length: number;
  readonly radius: number;
}

export function extentOf(shapes: readonly Shape[]): Extent {
  let length = 0;
  let radius = 0;
  for (const s of shapes) {
    for (const [x, r] of s.points) {
      if (x > length) length = x;
      if (Math.abs(r) > radius) radius = Math.abs(r);
    }
  }
  return { length: Math.max(length, 0.1), radius: Math.max(radius, 0.01) };
}
