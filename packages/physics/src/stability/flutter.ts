/**
 * Fin flutter speed from NACA TN 4197 (Martin 1958), appendix, eqs. (12) to
 * (18), pp. 12 to 14 (plan 0031, FLUT-1, FLUT-2, D-068).
 *
 * The criterion is Theodorsen and Garrick's flutter formula (eq. 1) evaluated
 * at the three-quarter span (eq. 3), with Coleman's taper correction
 * (eqs. 7, 8, 13, 14, and 1/(f₁² f₂²) ≈ (λ + 1)/2, p. 14), the aspect-ratio
 * correction A/(A + 2) (p. 13), ρa² = γp (eq. 17), γ = 1.4 and ε = 0.25:
 *
 *   (V_f/a)² = G_E / [ (24ε/π) γ p · A³/((t/c)³ (A + 2)) · (λ + 1)/2 ]   (eq. 16 with 17)
 *
 * which with p = p₀(p/p₀), p₀ = 14.7 psi is eq. (18)'s 39.3 A³/((t/c)³(A + 2)) ·
 * ((λ + 1)/2)(p/p₀) in psi ((24 × 0.25/π) × 1.4 × 14.696 = 39.30). A is the
 * aspect ratio of one exposed panel, L/c₀.₅₀ (p. 13), t/c the streamwise
 * thickness ratio, λ the taper ratio and G_E the effective shear modulus
 * (eq. 12, G_E = 6 JG/(c t³); for a solid section the material's G).
 *
 * Validity (pp. 5 to 7): bending-torsion flutter of thin solid or
 * equivalent-solid panels; "admittedly stretching the basic formula" for low
 * aspect ratio, swept and tapered panels, adjusted to the data of figure 3;
 * the boundary between safe and unsafe wings in figure 3 is a shaded band,
 * not a line, so a flutter speed near the flight speed is uncertain either
 * way. Constant thickness ratio is assumed; for a fin of constant thickness
 * the thickness ratio at the mid-span chord c₀.₅₀ is used (D-068).
 */
import { InvalidInputError } from '../errors.js';
import type { TrapezoidFinSetComponent } from '../geometry/components.js';
import { finiteResult } from '../numerics/finite.js';

/** 1 psi = 4.4482216152605 N / (0.0254 m)² (NIST SP 811 B.8, exact factors; printed 6.894 757 E+03). */
const PA_PER_PSI = 4.4482216152605 / 0.0254 ** 2;

/** γ for air and ε, the section CG behind the quarter chord in semichords, as TN 4197 assumes (p. 14). */
export const TN4197_GAMMA = 1.4;
export const TN4197_EPSILON = 0.25;

export interface FlutterMaterial {
  readonly name: string;
  /** Shear modulus G_E used, Pa. */
  readonly shearModulus: number;
  /** Where the value comes from. */
  readonly source: string;
}

/**
 * The materials marked on the shear-modulus axis of TN 4197 figure 3 (p. 19),
 * digitised from the 220 dpi render (axis 196 px per decade, 10⁶ psi at
 * x = 861): magnesium 2.52, aluminium 4.05 and titanium 6.03 × 10⁶ psi are
 * single marks; wood (0.071 to 0.121) and steel (9.0 to 11.3) are ranges,
 * and their lower ends are used, the lower modulus giving the lower flutter
 * speed (D-068). By-eye pass: 0.07 to 0.12, 2.5, 4, 6, 9 to 11.
 */
export const TN4197_MATERIALS: readonly FlutterMaterial[] = Object.freeze([
  {
    name: 'wood (solid)',
    shearModulus: 0.0707e6 * PA_PER_PSI,
    source: 'NACA TN 4197 figure 3, lower end of the wood range',
  },
  {
    name: 'magnesium',
    shearModulus: 2.515e6 * PA_PER_PSI,
    source: 'NACA TN 4197 figure 3',
  },
  {
    name: 'aluminium',
    shearModulus: 4.05e6 * PA_PER_PSI,
    source: 'NACA TN 4197 figure 3',
  },
  {
    name: 'titanium',
    shearModulus: 6.03e6 * PA_PER_PSI,
    source: 'NACA TN 4197 figure 3',
  },
  {
    name: 'steel',
    shearModulus: 9.0e6 * PA_PER_PSI,
    source: 'NACA TN 4197 figure 3, lower end of the steel range',
  },
]);

export interface FlutterGeometry {
  /** A = L/c₀.₅₀ of one exposed panel. */
  readonly panelAspectRatio: number;
  /** t/c₀.₅₀. */
  readonly thicknessRatio: number;
  readonly taperRatio: number;
}

/** FLUT-1. The TN 4197 geometry of one trapezoidal fin: c₀.₅₀ = (c_r + c_t)/2 at mid-span. */
export function flutterGeometry(fin: TrapezoidFinSetComponent): FlutterGeometry {
  const cr: number = fin.rootChord;
  const ct: number = fin.tipChord;
  const s: number = fin.span;
  const t: number = fin.thickness;
  if (!(cr > 0)) throw new InvalidInputError('fin root chord', cr, 'must be greater than 0 m');
  if (!(ct >= 0)) throw new InvalidInputError('fin tip chord', ct, 'must be 0 m or greater');
  if (!(s > 0)) throw new InvalidInputError('fin span', s, 'must be greater than 0 m');
  if (!(t > 0))
    throw new InvalidInputError(
      'fin thickness',
      t,
      'must be greater than 0 m for the flutter speed',
    );
  const mid = (cr + ct) / 2;
  return { panelAspectRatio: s / mid, thicknessRatio: t / mid, taperRatio: ct / cr };
}

/**
 * FLUT-2. TN 4197 eq. (16) with eq. (17): the flutter speed V_f, m/s, at
 * ambient pressure `pressure` (Pa) and speed of sound `speedOfSound` (m/s)
 * for an effective shear modulus `shearModulus` (Pa).
 */
export function flutterVelocity(
  geometry: FlutterGeometry,
  shearModulus: number,
  pressure: number,
  speedOfSound: number,
): number {
  if (!(shearModulus > 0))
    throw new InvalidInputError('fin shear modulus', shearModulus, 'must be greater than 0 Pa');
  if (!(pressure > 0))
    throw new InvalidInputError('pressure', pressure, 'must be greater than 0 Pa');
  if (!(speedOfSound > 0))
    throw new InvalidInputError('speed of sound', speedOfSound, 'must be greater than 0 m/s');
  const A = geometry.panelAspectRatio;
  const tc = geometry.thicknessRatio;
  const lambda = geometry.taperRatio;
  const denominator =
    ((24 * TN4197_EPSILON) / Math.PI) *
    TN4197_GAMMA *
    pressure *
    (A ** 3 / (tc ** 3 * (A + 2))) *
    ((lambda + 1) / 2);
  return finiteResult('flutter velocity', speedOfSound * Math.sqrt(shearModulus / denominator));
}
