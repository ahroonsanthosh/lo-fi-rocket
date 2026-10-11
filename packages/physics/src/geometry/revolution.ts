/**
 * Mass properties of solids of revolution by numerical integration of the
 * defining integrals (docs/plans/0003-geometry-and-mass.md, "Definitions"):
 *   V  = π ∫ (r_o² − r_i²) dx
 *   x̄  = (π/V) ∫ x (r_o² − r_i²) dx
 *   I_x (about the axis of symmetry) = ½ π ρ ∫ (r_o⁴ − r_i⁴) dx
 *   I_y (about a transverse axis through x = 0) = π ρ ∫ [(r_o² − r_i²) x² + (r_o⁴ − r_i⁴)/4] dx,
 *   then I_y,cg = I_y − m x̄² (parallel axis theorem).
 * Approach per Niskanen (2009) section 4.2.3, p. 64: mass from volume and
 * density; only the rotational and longitudinal moments are kept.
 *
 * Quadrature: composite 5-point Gauss–Legendre on `panels` equal panels.
 * For smooth profiles doubling the panels changes the results by less than
 * 1e-10 relative; for profiles with a vertical tip (√ behaviour) the error
 * is about 1e-6 relative at the default 512 panels (see revolution.test.ts).
 */
import { finiteResult } from '../numerics/finite.js';
import type { Profile } from './profiles.js';

export interface MassProperties {
  /** Volume of material, m³. */
  readonly volume: number;
  /** Mass, kg. */
  readonly mass: number;
  /** CG position along the component's own x axis, from its forward end, m. */
  readonly cgX: number;
  /** Moment of inertia about the axis of symmetry, kg·m². */
  readonly inertiaRotational: number;
  /** Moment of inertia about a transverse axis through the CG, kg·m². */
  readonly inertiaLongitudinal: number;
}

/** 5-point Gauss–Legendre nodes and weights on [−1, 1]. */
const GL_NODES = [
  -0.906179845938664, -0.5384693101056831, 0, 0.5384693101056831, 0.906179845938664,
] as const;
const GL_WEIGHTS = [
  0.23692688505618908, 0.47862867049936647, 0.5688888888888889, 0.47862867049936647,
  0.23692688505618908,
] as const;

/** ∫₀ᴸ f(x) dx by composite Gauss–Legendre. */
export function integrate(f: (x: number) => number, length: number, panels: number): number {
  const h = length / panels;
  let sum = 0;
  for (let p = 0; p < panels; p++) {
    const mid = (p + 0.5) * h;
    for (let k = 0; k < GL_NODES.length; k++) {
      const node = GL_NODES[k];
      const weight = GL_WEIGHTS[k];
      if (node === undefined || weight === undefined) {
        throw new Error('Gauss-Legendre table is malformed');
      }
      sum += weight * f(mid + (h / 2) * node);
    }
  }
  return (sum * h) / 2;
}

/**
 * The inner profile of a shell of uniform wall thickness t measured normal to
 * the outer surface, to first order: r_i(x) = max(0, r(x) − t √(1 + r′(x)²)).
 * Where the slope is infinite (a vertical tip) the inner radius is 0.
 * Documented in docs/conventions.md; agrees with OpenRocket's masses to
 * 0.01 % (docs/plans/0003-geometry-and-mass.md).
 */
export function innerRadius(profile: Profile, thickness: number, x: number): number {
  const slope = profile.slope(x);
  if (!Number.isFinite(slope)) return 0;
  return Math.max(0, profile.radius(x) - thickness * Math.sqrt(1 + slope * slope));
}

export const DEFAULT_PANELS = 512;

/**
 * Mass properties of a solid or hollow body of revolution with the given
 * outer profile. `wallThickness` undefined means solid.
 */
export function revolutionMassProperties(
  profile: Profile,
  density: number,
  wallThickness?: number,
  panels: number = DEFAULT_PANELS,
): MassProperties {
  const L = profile.length;
  const ro = (x: number): number => profile.radius(x);
  const ri = (x: number): number =>
    wallThickness === undefined ? 0 : innerRadius(profile, wallThickness, x);
  const r2 = (x: number): number => ro(x) ** 2 - ri(x) ** 2;
  const r4 = (x: number): number => ro(x) ** 4 - ri(x) ** 4;

  const volume = finiteResult('volume', Math.PI * integrate(r2, L, panels));
  const mass = finiteResult('mass', density * volume);
  const cgX = finiteResult('cg', (Math.PI * integrate((x) => x * r2(x), L, panels)) / volume);
  const inertiaRotational = finiteResult(
    'rotational inertia',
    0.5 * Math.PI * density * integrate(r4, L, panels),
  );
  const iyAboutOrigin = Math.PI * density * integrate((x) => r2(x) * x * x + r4(x) / 4, L, panels);
  const inertiaLongitudinal = finiteResult(
    'longitudinal inertia',
    Math.max(0, iyAboutOrigin - mass * cgX * cgX),
  );
  return { volume, mass, cgX, inertiaRotational, inertiaLongitudinal };
}
