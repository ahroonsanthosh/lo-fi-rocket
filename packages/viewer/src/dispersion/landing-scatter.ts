/**
 * Monte Carlo landing points (plan 0034). The points and the 95 %
 * containment circle are the stored values of the dispersion result
 * (`DispersionRun.landingEast`, `landingNorth`; `DispersionSummary.meanLanding`,
 * `containmentRadius95`, D-051). The covariance ellipse is descriptive
 * statistics computed here from the stored points: the sample covariance
 * and its principal axes (the eigen-decomposition of a symmetric 2 × 2
 * matrix). It assumes no distribution and claims no containment; the UI
 * labels it as computed by the viewer. No physics.
 */
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from 'three';

/** The fields of a dispersion run the viewer reads (structural, so the viewer does not depend on the formats package). */
export interface LandingRunLike {
  readonly index: number;
  readonly landingEast: number | undefined;
  readonly landingNorth: number | undefined;
  readonly error: string | undefined;
}

export interface LandingSummaryLike {
  readonly meanLanding: { readonly east: number; readonly north: number } | undefined;
  readonly containmentRadius95: number | undefined;
}

export interface LandingResultLike {
  readonly runs: readonly LandingRunLike[];
  readonly summary: LandingSummaryLike;
}

export interface LandingPoint {
  readonly index: number;
  readonly east: number;
  readonly north: number;
}

/** The runs that landed without error, with their stored landing coordinates. */
export function landingPoints(result: LandingResultLike): LandingPoint[] {
  const out: LandingPoint[] = [];
  for (const r of result.runs) {
    if (r.error !== undefined || r.landingEast === undefined || r.landingNorth === undefined) {
      continue;
    }
    out.push({ index: r.index, east: r.landingEast, north: r.landingNorth });
  }
  return out;
}

export interface CovarianceEllipse {
  readonly centreEast: number;
  readonly centreNorth: number;
  /** √λ₁ of the sample covariance: the standard deviation along the major axis, metres. */
  readonly semiMajor: number;
  /** √λ₂: the standard deviation along the minor axis, metres. */
  readonly semiMinor: number;
  /** Direction of the major axis from east towards north, radians, in (−π/2, π/2]. */
  readonly angle: number;
  readonly count: number;
}

/**
 * Sample covariance of the points and its principal axes. With s_ee, s_nn
 * and s_en the sample (co)variances (divisor n − 1):
 * λ = (s_ee + s_nn)/2 ± √(((s_ee − s_nn)/2)² + s_en²), θ = ½ atan2(2 s_en, s_ee − s_nn).
 * Needs at least two points; undefined otherwise. Tolerance: a few ulp of
 * the sums, far below the metre.
 */
export function covarianceEllipse(points: readonly LandingPoint[]): CovarianceEllipse | undefined {
  const n = points.length;
  if (n < 2) return undefined;
  let se = 0;
  let sn = 0;
  for (const p of points) {
    se += p.east;
    sn += p.north;
  }
  const me = se / n;
  const mn = sn / n;
  let see = 0;
  let snn = 0;
  let sen = 0;
  for (const p of points) {
    const de = p.east - me;
    const dn = p.north - mn;
    see += de * de;
    snn += dn * dn;
    sen += de * dn;
  }
  see /= n - 1;
  snn /= n - 1;
  sen /= n - 1;
  const half = (see + snn) / 2;
  const diff = (see - snn) / 2;
  const root = Math.sqrt(diff * diff + sen * sen);
  const l1 = half + root;
  const l2 = Math.max(0, half - root);
  let angle = 0.5 * Math.atan2(2 * sen, see - snn);
  if (angle <= -Math.PI / 2) angle += Math.PI;
  if (angle > Math.PI / 2) angle -= Math.PI;
  return {
    centreEast: me,
    centreNorth: mn,
    semiMajor: Math.sqrt(l1),
    semiMinor: Math.sqrt(l2),
    angle,
    count: n,
  };
}

/** Points (east, north, 0) around the ellipse scaled by `k` standard deviations. */
export function ellipseOutline(
  e: CovarianceEllipse,
  k: number,
  segments = 96,
): { readonly x: number; readonly y: number; readonly z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  const c = Math.cos(e.angle);
  const s = Math.sin(e.angle);
  for (let i = 0; i < segments; i++) {
    const phi = (2 * Math.PI * i) / segments;
    const u = k * e.semiMajor * Math.cos(phi);
    const v = k * e.semiMinor * Math.sin(phi);
    out.push({ x: e.centreEast + u * c - v * s, y: e.centreNorth + u * s + v * c, z: 0 });
  }
  return out;
}

export function circleOutline(
  east: number,
  north: number,
  radius: number,
  segments = 96,
): { readonly x: number; readonly y: number; readonly z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const phi = (2 * Math.PI * i) / segments;
    out.push({ x: east + radius * Math.cos(phi), y: north + radius * Math.sin(phi), z: 0 });
  }
  return out;
}

function loop(
  pts: readonly { readonly x: number; readonly y: number; readonly z: number }[],
  colour: number,
  name: string,
): Line {
  const g = new BufferGeometry();
  const arr = new Float32Array(pts.length * 3);
  pts.forEach((p, i) => {
    arr[3 * i] = p.x;
    arr[3 * i + 1] = p.y;
    arr[3 * i + 2] = p.z;
  });
  g.setAttribute('position', new Float32BufferAttribute(arr, 3));
  const line = new LineLoop(g, new LineBasicMaterial({ color: colour }));
  line.name = name;
  return line;
}

export interface LandingObjects {
  readonly group: Group;
  readonly points: readonly LandingPoint[];
  readonly ellipse: CovarianceEllipse | undefined;
  /** The stored 95 % containment circle, when the summary has one. */
  readonly containment:
    { readonly east: number; readonly north: number; readonly radius: number } | undefined;
}

/**
 * Scene objects of the landing points, at their stored coordinates on the
 * ground plane (z = 0): a small sphere per run (the selected run larger and
 * highlighted), the stored containment circle, and the 1σ and 2σ
 * covariance ellipses.
 */
export function buildLandingObjects(
  result: LandingResultLike,
  markerRadius: number,
  selectedRun?: number,
): LandingObjects {
  const group = new Group();
  group.name = 'landing-points';
  const points = landingPoints(result);
  const geometry = new SphereGeometry(markerRadius, 12, 8);
  const plain = new MeshBasicMaterial({ color: new Color(0x1f5fbf) });
  const chosen = new MeshBasicMaterial({ color: new Color(0xd9534f) });
  for (const p of points) {
    const selected = p.index === selectedRun;
    const m = new Mesh(geometry, selected ? chosen : plain);
    m.position.set(p.east, p.north, 0);
    if (selected) m.scale.setScalar(1.8);
    m.name = `landing-${String(p.index)}`;
    m.userData = { run: p.index };
    group.add(m);
  }
  const s = result.summary;
  const containment =
    s.meanLanding === undefined || s.containmentRadius95 === undefined
      ? undefined
      : { east: s.meanLanding.east, north: s.meanLanding.north, radius: s.containmentRadius95 };
  if (containment !== undefined) {
    group.add(
      loop(
        circleOutline(containment.east, containment.north, containment.radius),
        0x1b7f3b,
        'containment-95',
      ),
    );
  }
  const ellipse = covarianceEllipse(points);
  if (ellipse !== undefined && ellipse.semiMajor > 0) {
    group.add(loop(ellipseOutline(ellipse, 1), 0xb26a00, 'ellipse-1sigma'));
    group.add(loop(ellipseOutline(ellipse, 2), 0xb26a00, 'ellipse-2sigma'));
  }
  return { group, points, ellipse, containment };
}
