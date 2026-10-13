/**
 * Fin planforms (plan 0058, D-087): the trapezoid, the half ellipse and the freeform polygon, with
 * every planform quantity the aerodynamics and mass models read, so that a fin of any shape uses
 * the same equations.
 *
 * Niskanen (2009) §3.2.2 pp. 25 to 30: the mean aerodynamic chord c̄, its spanwise position y_MAC
 * and leading edge x_MAC,LE (eqs. 3.30 to 3.32) for any thin planform, the subsonic CP at the
 * quarter of the MAC (p. 26), the chord c(y) taken from the leading to the trailing edge across a
 * jagged edge while the normal force keeps the true area (pp. 27 to 28), and the mid-chord sweep
 * Γ_c as the average of the angles between the mid-points of consecutive chords (p. 29); the
 * leading-edge angle Γ_L averaged the same way (§3.4.4 p. 50); the strip sums of the roll damping
 * (§3.3.2 eq. 3.69). The trapezoid's quantities are its closed forms (eqs. 3.33, 3.34), written
 * exactly as before this module so that its results are unchanged.
 *
 * Coordinates: x aft from the root leading edge, y outward from the root (docs/conventions.md).
 */
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';
import type { Metres } from '../units/si.js';
import { integrate } from './revolution.js';

/** A point of a freeform fin outline: x aft from the root leading edge, y outward from the root. */
export interface FinPoint {
  readonly x: Metres;
  readonly y: Metres;
}

/**
 * A fin planform other than the trapezoid (D-087). 'elliptical': a half ellipse of the root chord
 * and span, centred on the root's mid-chord. 'freeform': the polygon through `points`, from the
 * root leading edge (0, 0) round to the root trailing edge (c_r, 0), the root closing it.
 */
export type FinShape =
  | { readonly kind: 'elliptical' }
  | { readonly kind: 'freeform'; readonly points: readonly FinPoint[] };

/** The planform geometry of one fin (one side). */
export interface FinPlanform {
  readonly rootChord: number;
  readonly span: number;
  /** The true one-sided area A_fin: the normal force (p. 28) and the mass use it. */
  readonly area: number;
  /** c̄, eq. (3.30). */
  readonly mac: number;
  /** y_MAC, eq. (3.31). */
  readonly macSpanwise: number;
  /** x_MAC,LE, eq. (3.32). */
  readonly macLeadingEdge: number;
  /** The subsonic CP from the root leading edge, x_MAC,LE + c̄/4 (p. 26; eq. 3.34 for the trapezoid). */
  readonly quarterChord: number;
  /** Γ_c (p. 29). */
  readonly midchordSweep: number;
  /** Γ_L (p. 50). */
  readonly leadingEdgeSweep: number;
  /** I_n = ∫₀ˢ c(y)(r_t + y)ⁿ dy, the strip sums of eq. (3.69) and their supersonic forms. */
  readonly stripIntegral: (n: number, bodyRadius: number) => number;
  /**
   * The trapezoid with the same span, root chord and area (tip chord 2A/s − c_r, at least 0), swept
   * so that its quarter-MAC point is this planform's: for the methods written for trapezoids only
   * (D-087). The trapezoid itself for a trapezoid.
   */
  readonly equivalentTrapezoid: { readonly tipChord: number; readonly sweep: number };
  /** ∫∫ x dA, ∫∫ y dA, ∫∫ x² dA, ∫∫ y² dA over the true area, for the mass (GEO-16). */
  readonly moments: {
    readonly x: number;
    readonly y: number;
    readonly xx: number;
    readonly yy: number;
  };
}

/** The fields of a fin set the planform reads. */
export interface FinPlanformInput {
  readonly rootChord: Metres;
  readonly tipChord: Metres;
  readonly sweep: Metres;
  readonly span: Metres;
  readonly shape?: FinShape;
}

const PLANFORMS = new WeakMap<object, FinPlanform>();

/** The planform of a fin set, computed once per component object. */
export function finPlanform(fin: FinPlanformInput): FinPlanform {
  const cached = PLANFORMS.get(fin);
  if (cached !== undefined) return cached;
  const p =
    fin.shape === undefined
      ? trapezoid(fin.rootChord, fin.tipChord, fin.sweep, fin.span)
      : fin.shape.kind === 'elliptical'
        ? elliptical(fin.rootChord, fin.span)
        : freeform(fin.shape.points, fin.rootChord, fin.span);
  PLANFORMS.set(fin, p);
  return p;
}

function requireDimensions(cr: number, s: number): void {
  if (!(cr > 0)) throw new InvalidInputError('fin root chord', cr, 'must be greater than 0 m');
  if (!(s > 0)) throw new InvalidInputError('fin span', s, 'must be greater than 0 m');
}

/** AERO-6 helper for the trapezoid, unchanged: Σ_k C(n,k) r_t^(n−k) [c_r s^(k+1)/(k+1) + (c_t − c_r) s^(k+1)/(k+2)]. */
function trapezoidStripIntegral(n: number, cr: number, ct: number, rt: number, s: number): number {
  let total = 0;
  let binomial = 1;
  for (let k = 0; k <= n; k += 1) {
    total +=
      binomial *
      rt ** (n - k) *
      ((cr * s ** (k + 1)) / (k + 1) + ((ct - cr) * s ** (k + 1)) / (k + 2));
    binomial = (binomial * (n - k)) / (k + 1);
  }
  return total;
}

/** The trapezoid with the planform's span, root chord, area and quarter-MAC point (D-087). */
function equivalentTrapezoid(
  cr: number,
  s: number,
  area: number,
  quarterChord: number,
): { tipChord: number; sweep: number } {
  const ct = Math.max(0, (2 * area) / s - cr);
  // eq. (3.34) solved for x_t: X_f = x_t (c_r + 2c_t)/(3(c_r + c_t)) + (c_r² + c_t² + c_r c_t)/(6(c_r + c_t)).
  const fixed = (cr * cr + ct * ct + cr * ct) / (6 * (cr + ct));
  const sweep = ((quarterChord - fixed) * 3 * (cr + ct)) / (cr + 2 * ct);
  return { tipChord: ct, sweep };
}

/** The trapezoid: eqs. (3.30), (3.33), (3.34) in closed form, as BAR-5 to BAR-8 and the drag model had them. */
function trapezoid(crM: Metres, ctM: Metres, xtM: Metres, sM: Metres): FinPlanform {
  const cr: number = crM;
  const ct: number = ctM;
  const xt: number = xtM;
  const s: number = sM;
  const area = ((cr + ct) / 2) * s;
  const mac = ((2 / 3) * (cr * cr + cr * ct + ct * ct)) / (cr + ct);
  const quarterChord =
    ((xt / 3) * (cr + 2 * ct)) / (cr + ct) + (cr * cr + ct * ct + cr * ct) / (6 * (cr + ct));
  const macLeadingEdge = ((xt / 3) * (cr + 2 * ct)) / (cr + ct);
  // Mass moments of the trapezoid (GEO-10's planform), from c(y) and x_LE(y) linear in y.
  const chord = (y: number): number => cr + ((ct - cr) * y) / s;
  const xLE = (y: number): number => (xt * y) / s;
  const moments = {
    x: integrate((y) => (xLE(y) + chord(y) / 2) * chord(y), s, 1),
    y: integrate((y) => y * chord(y), s, 1),
    xx: integrate((y) => ((xLE(y) + chord(y)) ** 3 - xLE(y) ** 3) / 3, s, 1),
    yy: integrate((y) => y * y * chord(y), s, 1),
  };
  return {
    rootChord: cr,
    span: s,
    area,
    mac,
    macSpanwise: (s / 3) * ((cr + 2 * ct) / (cr + ct)),
    macLeadingEdge,
    quarterChord,
    midchordSweep: Math.atan((xt + ct / 2 - cr / 2) / s),
    leadingEdgeSweep: Math.atan(xt / s),
    stripIntegral: (n, rt) => trapezoidStripIntegral(n, cr, ct, rt, s),
    equivalentTrapezoid: { tipChord: ct, sweep: xt },
    moments,
  };
}

/**
 * The half ellipse c(y) = c_r √(1 − u²), u = y/s, its leading edge x_LE = (c_r − c)/2. Closed forms:
 * A = π c_r s/4; ∫c² dy = (2/3) c_r² s, so c̄ = 8 c_r/(3π); ∫ y c dy = c_r s²/3, so y_MAC = 4s/(3π);
 * x_MAC,LE = (1/A) ∫ (c_r − c) c/2 dy = c_r/2 − c̄/2; the mid-chord line is x = c_r/2, so Γ_c = 0;
 * ∫∫ x dA = A c_r/2; ∫∫ y² dA = ∫ y² c dy = π c_r s³/16; ∫∫ x² dA = A c_r²/4 + ∫ c³/12 dy
 * = A c_r²/4 + π c_r³ s/64. Γ_L = ∫₀¹ atan(k u/√(1 − u²)) du with k = c_r/(2s), and the strip sums
 * ∫₀^{π/2} c_r s cos²θ (r_t + s sin θ)ⁿ dθ, by quadrature in θ (y = s sin θ), where they are smooth.
 */
function elliptical(crM: Metres, sM: Metres): FinPlanform {
  const cr: number = crM;
  const s: number = sM;
  requireDimensions(cr, s);
  const area = (Math.PI * cr * s) / 4;
  const mac = (8 * cr) / (3 * Math.PI);
  const macLeadingEdge = cr / 2 - mac / 2;
  const quarterChord = macLeadingEdge + mac / 4;
  const k = cr / (2 * s);
  const half = Math.PI / 2;
  const leadingEdgeSweep = integrate(
    (theta) => Math.atan(k * Math.tan(theta)) * Math.cos(theta),
    half,
    ELLIPSE_PANELS,
  );
  return {
    rootChord: cr,
    span: s,
    area,
    mac,
    macSpanwise: (4 * s) / (3 * Math.PI),
    macLeadingEdge,
    quarterChord,
    midchordSweep: 0,
    leadingEdgeSweep: finiteResult('elliptical fin leading-edge angle', leadingEdgeSweep),
    stripIntegral: (n, rt) =>
      integrate(
        (theta) => cr * s * Math.cos(theta) ** 2 * (rt + s * Math.sin(theta)) ** n,
        half,
        ELLIPSE_PANELS,
      ),
    equivalentTrapezoid: equivalentTrapezoid(cr, s, area, quarterChord),
    moments: {
      x: (area * cr) / 2,
      y: (cr * s * s) / 3,
      xx: (area * cr * cr) / 4 + (Math.PI * cr ** 3 * s) / 64,
      yy: (Math.PI * cr * s ** 3) / 16,
    },
  };
}

/** Panels of five-point Gauss–Legendre on [0, π/2] for the ellipse's smooth θ integrands. */
const ELLIPSE_PANELS = 64;

/** A span segment of a polygon on which the leading and trailing edges are straight. */
interface Segment {
  readonly y0: number;
  readonly y1: number;
  /** x of the leading and trailing edges at y0 and y1. */
  readonly le0: number;
  readonly le1: number;
  readonly te0: number;
  readonly te1: number;
}

/** The x where the edge (a, b) crosses height y, or undefined when it does not span y. */
function crossing(ax: number, ay: number, bx: number, by: number, y: number): number | undefined {
  if (ay === by) return undefined;
  const lo = Math.min(ay, by);
  const hi = Math.max(ay, by);
  if (y < lo || y > hi) return undefined;
  return ax + ((bx - ax) * (y - ay)) / (by - ay);
}

/**
 * The freeform polygon. Its true area and moments by Green's theorem (exact for a polygon); its
 * chord c(y) from the most forward to the most aft edge at each height (p. 27), straight on each
 * span segment between vertex heights, where the integrands of eqs. (3.30) to (3.32), (3.69) are
 * polynomials of degree 5 at most and five-point Gauss–Legendre integrates them exactly.
 */
function freeform(points: readonly FinPoint[], crM: Metres, sM: Metres): FinPlanform {
  const cr: number = crM;
  const s: number = sM;
  requireDimensions(cr, s);
  if (points.length < 3) {
    throw new InvalidInputError('freeform fin points', points.length, 'must be at least 3 points');
  }
  const xs = points.map((p) => p.x as number);
  const ys = points.map((p) => p.y as number);
  for (let i = 0; i < points.length; i++) {
    const x = xs[i] ?? Number.NaN;
    const y = ys[i] ?? Number.NaN;
    if (!(Number.isFinite(x) && Number.isFinite(y))) {
      throw new InvalidInputError(
        `freeform fin point ${String(i + 1)}`,
        Number.isFinite(x) ? y : x,
        'must be finite',
      );
    }
    if (y < 0) {
      throw new InvalidInputError(
        `freeform fin point ${String(i + 1)} height`,
        y,
        'must be 0 m or more (the fin is outside the body)',
      );
    }
  }
  const tolerance = 1e-9 * Math.max(cr, s);
  const first = 0;
  const last = points.length - 1;
  if (
    Math.abs(xs[first] ?? Number.NaN) > tolerance ||
    Math.abs(ys[first] ?? Number.NaN) > tolerance ||
    Math.abs(ys[last] ?? Number.NaN) > tolerance
  ) {
    throw new InvalidInputError(
      'freeform fin outline',
      xs[first] ?? Number.NaN,
      'must start at the root leading edge (0, 0) and end on the root (y = 0)',
    );
  }
  const root = xs[last] ?? Number.NaN;
  if (Math.abs(root - cr) > tolerance) {
    throw new InvalidInputError(
      'fin root chord',
      cr,
      `must equal the freeform outline's root, ${String(root)} m`,
    );
  }
  const top = Math.max(...ys);
  if (Math.abs(top - s) > tolerance) {
    throw new InvalidInputError(
      'fin span',
      s,
      `must equal the freeform outline's height, ${String(top)} m`,
    );
  }
  // Green's theorem over the closed polygon (the root closes it): signed area and moments.
  let a2 = 0;
  let mx = 0;
  let my = 0;
  let mxx = 0;
  let myy = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const x0 = xs[i] ?? 0;
    const y0 = ys[i] ?? 0;
    const x1 = xs[j] ?? 0;
    const y1 = ys[j] ?? 0;
    const cross = x0 * y1 - x1 * y0;
    a2 += cross;
    mx += (x0 + x1) * cross;
    my += (y0 + y1) * cross;
    mxx += (x0 * x0 + x0 * x1 + x1 * x1) * cross;
    myy += (y0 * y0 + y0 * y1 + y1 * y1) * cross;
  }
  const sign = a2 < 0 ? -1 : 1;
  const area = (sign * a2) / 2;
  if (!(area > 0)) {
    throw new InvalidInputError('freeform fin area', area, 'must be greater than 0 m²');
  }
  const moments = {
    x: (sign * mx) / 6,
    y: (sign * my) / 6,
    xx: (sign * mxx) / 12,
    yy: (sign * myy) / 12,
  };
  // The span segments and their straight leading and trailing edges.
  const heights = [...new Set(ys)].sort((p, q) => p - q);
  const segments: Segment[] = [];
  const edgesAt = (y: number): { le: number; te: number } => {
    let le = Number.POSITIVE_INFINITY;
    let te = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      const x = crossing(xs[i] ?? 0, ys[i] ?? 0, xs[j] ?? 0, ys[j] ?? 0, y);
      if (x === undefined) continue;
      le = Math.min(le, x);
      te = Math.max(te, x);
    }
    return { le, te };
  };
  for (let k = 0; k + 1 < heights.length; k++) {
    const y0 = heights[k] ?? 0;
    const y1 = heights[k + 1] ?? 0;
    // Sample just inside the segment: at a vertex height a horizontal edge would widen the chord.
    const d = (y1 - y0) * 1e-9;
    const lo = edgesAt(y0 + d);
    const hi = edgesAt(y1 - d);
    // Extend the straight edges to the segment's ends.
    const slope = (a: number, b: number): number => (b - a) / (y1 - y0 - 2 * d);
    const le0 = lo.le - slope(lo.le, hi.le) * d;
    const te0 = lo.te - slope(lo.te, hi.te) * d;
    segments.push({
      y0,
      y1,
      le0,
      le1: le0 + slope(lo.le, hi.le) * (y1 - y0),
      te0,
      te1: te0 + slope(lo.te, hi.te) * (y1 - y0),
    });
  }
  const overSpan = (f: (y: number, le: number, c: number) => number): number => {
    let total = 0;
    for (const g of segments) {
      const h = g.y1 - g.y0;
      total += integrate(
        (t) => {
          const u = t / h;
          const le = g.le0 + (g.le1 - g.le0) * u;
          const te = g.te0 + (g.te1 - g.te0) * u;
          return f(g.y0 + t, le, te - le);
        },
        h,
        1,
      );
    }
    return total;
  };
  const chordArea = overSpan((_y, _le, c) => c);
  const mac = overSpan((_y, _le, c) => c * c) / chordArea;
  const macSpanwise = overSpan((y, _le, c) => y * c) / chordArea;
  const macLeadingEdge = overSpan((_y, le, c) => le * c) / chordArea;
  const quarterChord = macLeadingEdge + mac / 4;
  // Γ_c and Γ_L: the angle of each straight piece weighted by its height, the limit of the average
  // over many equally spaced chords (pp. 29, 50).
  let midchordSum = 0;
  let leadingSum = 0;
  for (const g of segments) {
    const h = g.y1 - g.y0;
    const mid0 = (g.le0 + g.te0) / 2;
    const mid1 = (g.le1 + g.te1) / 2;
    midchordSum += Math.atan((mid1 - mid0) / h) * h;
    leadingSum += Math.atan((g.le1 - g.le0) / h) * h;
  }
  return {
    rootChord: cr,
    span: s,
    area,
    mac: finiteResult('freeform fin MAC', mac),
    macSpanwise: finiteResult('freeform fin MAC position', macSpanwise),
    macLeadingEdge: finiteResult('freeform fin MAC leading edge', macLeadingEdge),
    quarterChord: finiteResult('freeform fin CP', quarterChord),
    midchordSweep: midchordSum / s,
    leadingEdgeSweep: leadingSum / s,
    stripIntegral: (n, rt) => overSpan((y, _le, c) => c * (rt + y) ** n),
    equivalentTrapezoid: equivalentTrapezoid(cr, s, area, quarterChord),
    moments,
  };
}

const EQUIVALENT = new WeakMap<object, object>();

/**
 * The fin set itself for a trapezoid, else the fin set with its equivalent trapezoid in place of
 * its shape (D-087), for the methods written for trapezoids only. One object per fin set, so
 * caches keyed on the component keep working.
 */
export function trapezoidOf<T extends FinPlanformInput>(fin: T): T {
  if (fin.shape === undefined) return fin;
  const cached = EQUIVALENT.get(fin);
  if (cached !== undefined) return cached as T;
  const { tipChord, sweep } = finPlanform(fin).equivalentTrapezoid;
  // A copy without the shape: the trapezoid fields describe the planform from here on.
  const t = Object.fromEntries(
    Object.entries({ ...fin, tipChord, sweep }).filter(([key]) => key !== 'shape'),
  ) as unknown as T;
  EQUIVALENT.set(fin, t);
  return t;
}

/**
 * The outline of one fin for drawing (plan 0059), (x, y) from the root leading edge, round from
 * (0, 0) to (c_r, 0): the trapezoid's four corners, the freeform points, or `segments` + 1 points
 * on the half ellipse. Drawing only: the models read `finPlanform`.
 */
export function finOutline(
  fin: FinPlanformInput,
  segments = 48,
): readonly (readonly [number, number])[] {
  const cr: number = fin.rootChord;
  const s: number = fin.span;
  if (fin.shape === undefined) {
    const xt: number = fin.sweep;
    const ct: number = fin.tipChord;
    return [
      [0, 0],
      [xt, s],
      [xt + ct, s],
      [cr, 0],
    ];
  }
  if (fin.shape.kind === 'freeform') return fin.shape.points.map((p) => [p.x, p.y] as const);
  const out: (readonly [number, number])[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = Math.PI - (Math.PI * i) / segments;
    out.push([(cr / 2) * (1 + Math.cos(theta)), s * Math.sin(theta)]);
  }
  out[0] = [0, 0];
  out[segments] = [cr, 0];
  return out;
}
