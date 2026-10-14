/**
 * Component fit checks (review finding B-1, D-074). The Barrowman sum of
 * Niskanen eq. (3.29) p. 25 assumes one continuous body: each body
 * component's terms (eqs. 3.19 to 3.22) start where the previous one ends
 * and at its radius, and the fin-body interference factor of eq. (3.56) p. 34
 * uses r_t, "the body radius at the fin position". None of these is checked
 * by the formulas themselves, so a design whose parts do not fit together
 * gives a centre of pressure with no error. This module rejects such
 * designs with a message naming the parts; it computes nothing.
 */
import { InvalidInputError } from '../errors.js';
import type { PlacedComponent } from './assembly.js';

/**
 * Two lengths are taken as equal within 1 µm: well below any build
 * tolerance, well above the rounding of a millimetre value converted to
 * metres (about 1e-18 m).
 */
export const FIT_TOLERANCE = 1e-6;

interface BodySegment {
  readonly index: number;
  readonly kind: 'noseCone' | 'bodyTube' | 'transition';
  readonly fore: number;
  readonly aft: number;
  readonly foreRadius: number;
  readonly aftRadius: number;
}

const NAMES: Record<BodySegment['kind'], string> = {
  noseCone: 'nose cone',
  bodyTube: 'body tube',
  transition: 'transition',
};

const mm = (x: number): string => `${(x * 1000).toFixed(3)} mm`;
const label = (s: BodySegment): string => `${NAMES[s.kind]} (component ${String(s.index)})`;

/**
 * Plan 0070: which body a part belongs to. The main body, or a pod set's own body: its parts share
 * a count and a radial offset, so a pod's fins are checked against the pod's tube.
 */
function bodyKey(p: PlacedComponent): string {
  return p.instances === undefined
    ? 'main'
    : `${String(p.instances.count)}@${String(p.instances.radialOffset)}`;
}

function bodySegments(components: readonly PlacedComponent[], key: string): BodySegment[] {
  const out: BodySegment[] = [];
  components.forEach((p, index) => {
    if (bodyKey(p) !== key) return;
    const { component: c, position } = p;
    const fore: number = position;
    if (c.kind === 'noseCone') {
      out.push({
        index,
        kind: c.kind,
        fore,
        aft: fore + c.length,
        foreRadius: 0,
        aftRadius: c.baseRadius,
      });
    } else if (c.kind === 'bodyTube') {
      out.push({
        index,
        kind: c.kind,
        fore,
        aft: fore + c.length,
        foreRadius: c.outerRadius,
        aftRadius: c.outerRadius,
      });
    } else if (c.kind === 'transition') {
      out.push({
        index,
        kind: c.kind,
        fore,
        aft: fore + c.length,
        foreRadius: c.foreRadius,
        aftRadius: c.aftRadius,
      });
    }
  });
  return out.sort((a, b) => a.fore - b.fore);
}

/**
 * Reject a design whose parts do not fit together (D-074):
 * - the external body (nose cones, body tubes, transitions) must start at
 *   the nose tip, x = 0 (docs/conventions.md), and run without gaps or
 *   overlaps, each part starting at the radius the previous one ends at;
 * - a nose cone may only be the first part;
 * - every fin set's root leading edge and every rail button must be on the
 *   body, and the `bodyRadius` must lie within the body radii under the root
 *   chord (or at the button). The chord may cross a joint or run past the
 *   base, as on the ARCAS and NACA RM-10 wind tunnel models.
 * A list with no external body part (a fin set tested on its own) has no
 * body to check against and is accepted.
 */
export function validateComponentFit(components: readonly PlacedComponent[]): void {
  // Plan 0070: the main body, then each pod set's body, which need not start at the nose tip.
  for (const key of new Set(['main', ...components.map(bodyKey)])) {
    validateBody(components, key);
  }
}

function validateBody(components: readonly PlacedComponent[], key: string): void {
  const body = bodySegments(components, key);
  if (body.length === 0) return;
  const first = body[0];
  if (first === undefined) return;
  if (key === 'main' && Math.abs(first.fore) > FIT_TOLERANCE) {
    throw new InvalidInputError(
      `${label(first)} position`,
      first.fore,
      'the first body part must start at the nose tip, x = 0 m (docs/conventions.md)',
    );
  }
  for (let i = 1; i < body.length; i++) {
    const prev = body[i - 1];
    const next = body[i];
    if (prev === undefined || next === undefined) continue;
    if (next.kind === 'noseCone') {
      throw new InvalidInputError(
        `${label(next)} position`,
        next.fore,
        `a nose cone must be the first body part, but ${label(prev)} is ahead of it`,
      );
    }
    const gap = next.fore - prev.aft;
    if (Math.abs(gap) > FIT_TOLERANCE) {
      throw new InvalidInputError(
        `${label(next)} position`,
        next.fore,
        `must start where the ${label(prev)} ends, at ${prev.aft.toFixed(6)} m; there is ${gap > 0 ? `a gap of ${mm(gap)}` : `an overlap of ${mm(-gap)}`}. The centre of pressure assumes one continuous body (Niskanen eq. 3.29)`,
      );
    }
    const step = next.foreRadius - prev.aftRadius;
    if (Math.abs(step) > FIT_TOLERANCE) {
      throw new InvalidInputError(
        `${label(next)} fore radius`,
        next.foreRadius,
        `must equal the aft radius of the ${label(prev)}, ${mm(prev.aftRadius)}; a step of ${mm(step)} is not modelled. Add a transition between them (the Barrowman body terms assume a continuous body, Niskanen eqs. 3.19 to 3.22)`,
      );
    }
  }
  const bodyEnd = Math.max(...body.map((b) => b.aft));
  // The body radii met over [fore, aft]: every profile of Niskanen Appendix A
  // is monotonic between its end radii, so the extremes of each overlapping
  // part's end radii bound the radius there.
  const radiusRange = (fore: number, aft: number): [number, number] | undefined => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const b of body) {
      if (b.aft < fore - FIT_TOLERANCE || b.fore > aft + FIT_TOLERANCE) continue;
      lo = Math.min(lo, b.foreRadius, b.aftRadius);
      hi = Math.max(hi, b.foreRadius, b.aftRadius);
    }
    return lo <= hi ? [lo, hi] : undefined;
  };

  const bodyStart = Math.min(...body.map((b) => b.fore));
  components.forEach((p, index) => {
    const { component: c, position } = p;
    if (bodyKey(p) !== key) return;
    if (c.kind !== 'finSet' && c.kind !== 'railButton') return;
    const name =
      c.kind === 'finSet'
        ? `fin set (component ${String(index)})`
        : `rail buttons (component ${String(index)})`;
    const x: number = position;
    // Fins: the root leading edge must be on the body; the root chord may run
    // past the base (as on the NACA RM-10 model). Rail buttons: every button on the body.
    const spans: [number, number][] =
      c.kind === 'finSet'
        ? [[x, Math.min(x + (c.rootChord as number), bodyEnd)]]
        : Array.from({ length: Math.max(1, c.count) }, (_, i) => {
            const xi = x + i * ((c.separation as number | undefined) ?? 0);
            return [xi, xi] as [number, number];
          });
    for (const [fore, aft] of spans) {
      const range =
        fore >= bodyStart - FIT_TOLERANCE && fore <= bodyEnd + FIT_TOLERANCE
          ? radiusRange(fore, aft)
          : undefined;
      if (range === undefined || fore > bodyEnd - FIT_TOLERANCE) {
        const what = key === 'main' ? 'the rocket body' : 'its pod';
        const start = key === 'main' ? '0' : bodyStart.toFixed(6);
        throw new InvalidInputError(
          `${name} position`,
          fore,
          c.kind === 'finSet'
            ? `the root leading edge must be on ${what}, between ${start} and ${bodyEnd.toFixed(6)} m`
            : `each button must sit on ${what}, between ${start} and ${bodyEnd.toFixed(6)} m; one is at ${fore.toFixed(6)} m`,
        );
      }
      const r: number = c.bodyRadius;
      const [lo, hi] = range;
      if (r < lo - FIT_TOLERANCE || r > hi + FIT_TOLERANCE) {
        throw new InvalidInputError(
          `${name} body radius`,
          r,
          `must match the body it sits on, whose radius there is ${lo === hi ? mm(lo) : `${mm(lo)} to ${mm(hi)}`}${c.kind === 'finSet' ? ' (Niskanen eq. 3.56 uses the body radius at the fins)' : ''}`,
        );
      }
    }
  });
}
