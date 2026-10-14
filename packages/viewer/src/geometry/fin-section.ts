/**
 * Fins drawn with the design's cross-section (plan 3d-0002): the planform
 * outline is the physics one (`finOutline`, as before) and the thickness
 * across the chord follows the section the drag model uses
 * (`FinCrossSection`, Niskanen §3.4.4 p. 49 and D-066). The shapes below are
 * drawing shapes for each named section, not aerodynamic data:
 *
 * - square: the full thickness from edge to edge;
 * - rounded: the full thickness with semicircular leading and trailing edges;
 * - airfoil: the NACA four-digit symmetric thickness form scaled so its
 *   maximum (at 30 % chord) is the fin's thickness;
 * - wedge: from a sharp leading edge to the full thickness at the trailing edge;
 * - double-wedge: sharp edges, the full thickness at mid-chord.
 */
import type { FinCrossSection } from '@lo-fi-rocket/physics';
import { BufferAttribute, BufferGeometry } from 'three';
import type { FinPart, OutlinePoint } from './rocket-model.js';

/**
 * Half-thickness as a fraction of the fin's half-thickness at chord fraction
 * s (0 at the leading edge, 1 at the trailing edge), for a section whose
 * chord is `chord` and thickness `thickness` (both metres; the rounded
 * edges' radius is half the thickness, so they depend on the ratio).
 */
export function sectionHalfThickness(
  section: FinCrossSection,
  s: number,
  chord: number,
  thickness: number,
): number {
  const x = Math.min(1, Math.max(0, s));
  switch (section) {
    case 'square':
      return 1;
    case 'rounded': {
      // Semicircles of radius t/2 at both edges: in chord fractions the radius is a = t/(2c).
      const a = chord > 0 ? Math.min(0.5, thickness / (2 * chord)) : 0.5;
      if (a <= 0) return 1;
      const d = x < a ? a - x : x > 1 - a ? x - (1 - a) : 0;
      return Math.sqrt(Math.max(0, 1 - (d / a) ** 2));
    }
    case 'airfoil': {
      // NACA 00xx: y_t = 5t(0.2969√x − 0.1260x − 0.3516x² + 0.2843x³ − 0.1015x⁴), maximum 0.5t at x ≈ 0.3.
      const yt =
        5 *
        (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1015 * x ** 4);
      return Math.max(0, yt / NACA_MAX);
    }
    case 'wedge':
      return x;
    case 'double-wedge':
      return 1 - Math.abs(2 * x - 1);
  }
}

/** The NACA form's maximum half-thickness per unit thickness (at x = 0.3), for normalising. */
const NACA_MAX =
  5 * (0.2969 * Math.sqrt(0.3) - 0.126 * 0.3 - 0.3516 * 0.09 + 0.2843 * 0.027 - 0.1015 * 0.0081);

/**
 * The leading and trailing edge x of the planform at radius r, from the
 * outline polygon (root leading edge round to the root trailing edge); the
 * outermost crossings, or undefined above the tip.
 */
export function chordAt(
  outline: readonly OutlinePoint[],
  r: number,
): readonly [number, number] | undefined {
  const xs: number[] = [];
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    if (a === undefined || b === undefined) continue;
    const [x0, r0] = a;
    const [x1, r1] = b;
    if ((r0 <= r && r <= r1) || (r1 <= r && r <= r0)) {
      if (r1 === r0) {
        xs.push(x0, x1);
      } else {
        xs.push(x0 + ((r - r0) / (r1 - r0)) * (x1 - x0));
      }
    }
  }
  if (xs.length < 2) return undefined;
  return [Math.min(...xs), Math.max(...xs)];
}

/** Spanwise and chordwise samples of a lofted fin (a drawing budget). */
export const FIN_SPAN_SAMPLES = 16;
export const FIN_CHORD_SAMPLES = 28;

/**
 * A fin with its cross-section: the two faces lofted over the planform at
 * FIN_SPAN_SAMPLES radii, each face's thickness offset by the section's
 * shape, closed at the tip. Body frame, the fin's half-plane at `fin.angle`.
 */
export function finSectionGeometry(fin: FinPart, section: FinCrossSection): BufferGeometry {
  const rs = fin.corners.map(([, r]) => r);
  const rRoot = Math.min(...rs);
  const rTip = Math.max(...rs);
  const u = [0, Math.cos(fin.angle), Math.sin(fin.angle)] as const; // radial direction
  const nrm = [0, -Math.sin(fin.angle), Math.cos(fin.angle)] as const; // plate normal
  const h = fin.thickness / 2;
  const rows: { x0: number; x1: number; r: number }[] = [];
  for (let i = 0; i <= FIN_SPAN_SAMPLES; i++) {
    // Slightly inside the tip, where the outline still has a chord.
    const f = i / FIN_SPAN_SAMPLES;
    const r = rRoot + (rTip - rRoot) * Math.min(f, 0.999);
    const c = chordAt(fin.corners, r);
    if (c !== undefined && c[1] > c[0]) rows.push({ x0: c[0], x1: c[1], r });
  }
  const cols = FIN_CHORD_SAMPLES + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const side of [1, -1] as const) {
    for (const row of rows) {
      const chord = row.x1 - row.x0;
      for (let j = 0; j < cols; j++) {
        // Cosine spacing: more samples at the edges, where the section curves.
        const s = 0.5 - 0.5 * Math.cos((Math.PI * j) / (cols - 1));
        const x = row.x0 + s * chord;
        const off = side * h * sectionHalfThickness(section, s, chord, fin.thickness);
        positions.push(x, row.r * u[1] + off * nrm[1], row.r * u[2] + off * nrm[2]);
        uvs.push(x, row.r);
      }
    }
  }
  const nRows = rows.length;
  const face = nRows * cols;
  const indices: number[] = [];
  for (let i = 0; i < nRows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + cols;
      // Side +1 faces +normal; side −1 is wound the other way.
      indices.push(a, a + 1, b, a + 1, b + 1, b);
      indices.push(face + a, face + b, face + a + 1, face + a + 1, face + b, face + b + 1);
    }
  }
  // Close the tip, the leading and trailing edges (for square and blunt sections) and the root.
  const last = (nRows - 1) * cols;
  for (let j = 0; j < cols - 1; j++) {
    indices.push(
      last + j,
      face + last + j,
      last + j + 1,
      last + j + 1,
      face + last + j,
      face + last + j + 1,
    );
    indices.push(j, j + 1, face + j, j + 1, face + j + 1, face + j);
  }
  for (let i = 0; i < nRows - 1; i++) {
    const le = i * cols;
    const te = le + cols - 1;
    indices.push(le, face + le, le + cols, le + cols, face + le, face + le + cols);
    indices.push(te, te + cols, face + te, te + cols, face + te + cols, face + te);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
