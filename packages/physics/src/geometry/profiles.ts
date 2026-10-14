/**
 * Radius profiles of axially symmetric components.
 *
 * Source: Niskanen, S. (2009), *Development of an Open Source model rocket
 * simulation software*, Appendix A "Nose cone and transition geometries",
 * printed pp. 100 to 104 (reference/docs/niskanen-2009-openrocket-thesis.pdf,
 * PDF page = printed + 10). Equation numbers below are Niskanen's.
 *
 * A profile gives the outer radius r(x) and slope dr/dx for 0 ≤ x ≤ L, with
 * x measured from the component's forward end (docs/conventions.md). Plain
 * numbers are used inside; the public constructors validate their inputs.
 */
import { InvalidInputError, NotImplementedError } from '../errors.js';
import { type Metres } from '../units/si.js';

export type NoseShape = 'conical' | 'ogive' | 'elliptical' | 'parabolic' | 'power' | 'haack';

export interface Profile {
  /** Length L in metres. */
  readonly length: number;
  /** Outer radius at x ∈ [0, L], metres. */
  radius(x: number): number;
  /**
   * dr/dx at x ∈ [0, L]. May be +Infinity at a tip where the profile is
   * vertical (elliptical, power-series and Haack tips) and is then handled by
   * the caller (an infinite slope means a zero inner radius for a shell).
   */
  slope(x: number): number;
}

function requirePositive(name: string, value: number): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new InvalidInputError(name, value, 'must be greater than 0 m');
  }
}

/**
 * Nose cone profile for the given shape.
 *
 * @param shape one of the Appendix A shapes
 * @param length L
 * @param baseRadius R
 * @param shapeParameter κ: ogive 0 < κ ≤ 1 (1 = tangent ogive, p. 101); parabolic
 *   0 ≤ κ ≤ 1 (p. 102); power 0 < κ ≤ 1 (p. 102); Haack 0 ≤ κ ≤ 1/3 (p. 103).
 *   Ignored for conical and elliptical.
 */
export function noseProfile(
  shape: NoseShape,
  length: Metres,
  baseRadius: Metres,
  shapeParameter?: number,
): Profile {
  const L: number = length;
  const R: number = baseRadius;
  requirePositive('nose cone length', L);
  requirePositive('nose cone base radius', R);
  switch (shape) {
    case 'conical':
      return conical(L, R);
    case 'ogive':
      return ogive(L, R, shapeParameter ?? 1);
    case 'elliptical':
      return elliptical(L, R);
    case 'parabolic':
      return parabolic(L, R, shapeParameter ?? 1);
    case 'power':
      return power(L, R, shapeParameter ?? 0.5);
    case 'haack':
      return haack(L, R, shapeParameter ?? 0);
  }
}

/** GEO-1. Eq. (A.1), p. 100: r(x) = (x/L) R. */
function conical(L: number, R: number): Profile {
  return {
    length: L,
    radius: (x) => (x / L) * R,
    slope: () => R / L,
  };
}

/**
 * GEO-2. Eqs. (A.2) to (A.5), p. 101. The nose is an arc of a circle of radius ρ
 * whose centre lies at axial position L/κ (the base of the full tangent
 * ogive of which this is the forward part) and at distance c below the axis:
 *   r(x) = √(ρ² − (L/κ − x)²) − √(ρ² − (L/κ)²)                      (A.5)
 * with κ = ρ_t/ρ (A.3), ρ_t = (R² + L²)/(2R) (A.2). Requiring r(L) = R gives
 * c = √(ρ² − (L/κ)²) = (L²(2 − κ)/κ − R²)/(2R) and hence
 *   ρ² = c² + (L/κ)²,
 * which is eq. (A.4); κ = 1 reduces to ρ = ρ_t (tangent ogive) and κ → 0 to
 * the cone. Validity: 0 < κ ≤ 1.
 */
function ogive(L: number, R: number, kappa: number): Profile {
  if (!(kappa > 0 && kappa <= 1)) {
    throw new InvalidInputError(
      'ogive shape parameter',
      kappa,
      'must be greater than 0 and at most 1 (1 is a tangent ogive)',
    );
  }
  const a = L / kappa;
  const c = ((L * L * (2 - kappa)) / kappa - R * R) / (2 * R);
  const rho2 = c * c + a * a;
  return {
    length: L,
    radius: (x) => Math.sqrt(Math.max(rho2 - (a - x) * (a - x), 0)) - c,
    slope: (x) => (a - x) / Math.sqrt(Math.max(rho2 - (a - x) * (a - x), 0)),
  };
}

/** GEO-3. Eq. (A.6), p. 101: r(x) = R √(1 − (1 − x/L)²). Vertical at the tip. */
function elliptical(L: number, R: number): Profile {
  return {
    length: L,
    radius: (x) => {
      const u = 1 - x / L;
      return R * Math.sqrt(Math.max(1 - u * u, 0));
    },
    slope: (x) => {
      const u = 1 - x / L;
      const root = Math.sqrt(Math.max(1 - u * u, 0));
      return root === 0 ? Number.POSITIVE_INFINITY : (R * u) / (L * root);
    },
  };
}

/** GEO-4. Eq. (A.7), p. 102: r(x) = R (x/L)(2 − κ x/L)/(2 − κ), 0 ≤ κ ≤ 1 (κ = 0 cone, κ = 1 full parabola). */
function parabolic(L: number, R: number, kappa: number): Profile {
  if (!(kappa >= 0 && kappa <= 1)) {
    throw new InvalidInputError('parabolic shape parameter', kappa, 'must be between 0 and 1');
  }
  return {
    length: L,
    radius: (x) => {
      const u = x / L;
      return (R * u * (2 - kappa * u)) / (2 - kappa);
    },
    slope: (x) => {
      const u = x / L;
      return (R * (2 - 2 * kappa * u)) / (L * (2 - kappa));
    },
  };
}

/** GEO-5. Eq. (A.8), p. 102: r(x) = R (x/L)^κ, 0 < κ ≤ 1 (κ = 1 cone, 0.5 ellipsoid-like). Vertical at the tip for κ < 1. */
function power(L: number, R: number, kappa: number): Profile {
  if (!(kappa > 0 && kappa <= 1)) {
    throw new InvalidInputError(
      'power series shape parameter',
      kappa,
      'must be greater than 0 and at most 1',
    );
  }
  return {
    length: L,
    radius: (x) => R * (x / L) ** kappa,
    slope: (x) => {
      if (kappa === 1) return R / L;
      if (x <= 0) return Number.POSITIVE_INFINITY;
      return (R * kappa * (x / L) ** (kappa - 1)) / L;
    },
  };
}

/**
 * GEO-6. Eqs. (A.9) and (A.10), p. 103:
 *   r(x) = (R/√π) √(θ − sin(2θ)/2 + κ sin³θ),  θ = arccos(1 − 2x/L),
 * κ = 0 LD-Haack (Von Kármán), κ = 1/3 LV-Haack; the software limits κ to
 * 0 ≤ κ ≤ 1/3 (p. 103). The slope follows by differentiation:
 *   dr/dx = (R/√π) · sin θ (2 + 3κ cos θ) / (L √(θ − sin(2θ)/2 + κ sin³θ)).
 */
function haack(L: number, R: number, kappa: number): Profile {
  if (!(kappa >= 0 && kappa <= 1 / 3)) {
    throw new InvalidInputError(
      'Haack series shape parameter',
      kappa,
      'must be between 0 and 1/3 (0 is the Von Kármán shape)',
    );
  }
  const theta = (x: number): number => Math.acos(Math.min(1, Math.max(-1, 1 - (2 * x) / L)));
  const g = (t: number): number => Math.max(t - Math.sin(2 * t) / 2 + kappa * Math.sin(t) ** 3, 0);
  return {
    length: L,
    radius: (x) => (R / Math.sqrt(Math.PI)) * Math.sqrt(g(theta(x))),
    slope: (x) => {
      const t = theta(x);
      const root = Math.sqrt(g(t));
      if (root === 0) return Number.POSITIVE_INFINITY;
      return ((R / Math.sqrt(Math.PI)) * Math.sin(t) * (2 + 3 * kappa * Math.cos(t))) / (L * root);
    },
  };
}

/**
 * Transition profile between a fore radius R₁ and an aft radius R₂ over
 * length L (GEO-7, Appendix A.7, pp. 103 to 104). Conical transitions are linear.
 * The other shapes are the "non-clipped" adaptation: the profile is a nose
 * cone of base radius |R₂ − R₁| and length L added to the smaller radius,
 * oriented so the radius grows from the narrower end. The "clipped"
 * adaptation is not implemented. The aft radius may be 0 (plan 0068): a tail
 * cone, the nose profile reversed, which is what OpenRocket's flipped nose
 * cone is (reference/rockets/flipped-nose-probe/values.txt); for it the
 * clipped and non-clipped adaptations coincide, as for a nose cone.
 */
export function transitionProfile(
  shape: NoseShape,
  length: Metres,
  foreRadius: Metres,
  aftRadius: Metres,
  shapeParameter?: number,
  clipped = false,
): Profile {
  const L: number = length;
  const r1: number = foreRadius;
  const r2: number = aftRadius;
  requirePositive('transition length', L);
  requirePositive('transition fore radius', r1);
  if (!(r2 >= 0) || !Number.isFinite(r2)) {
    throw new InvalidInputError('transition aft radius', r2, 'must be 0 m or greater');
  }
  if (clipped) {
    throw new NotImplementedError('clipped transition shapes (Niskanen Appendix A.7)');
  }
  if (shape === 'conical' || r1 === r2) {
    return {
      length: L,
      radius: (x) => r1 + ((r2 - r1) * x) / L,
      slope: () => (r2 - r1) / L,
    };
  }
  const small = Math.min(r1, r2);
  const nose = noseProfile(shape, length, Math.abs(r2 - r1) as Metres, shapeParameter);
  if (r2 > r1) {
    // Widening aft: the nose tip is at the fore end.
    return { length: L, radius: (x) => small + nose.radius(x), slope: (x) => nose.slope(x) };
  }
  // Narrowing aft (boat tail): the nose tip is at the aft end.
  return { length: L, radius: (x) => small + nose.radius(L - x), slope: (x) => -nose.slope(L - x) };
}
