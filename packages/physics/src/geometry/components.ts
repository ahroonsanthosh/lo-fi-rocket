/**
 * Component definitions and their mass properties.
 *
 * Every component is described by plain geometry in SI (branded types) and a
 * bulk density or an explicit mass. `componentMassProperties` returns volume,
 * mass, CG along the component's own x axis (from its forward end), and the
 * rotational and longitudinal moments of inertia about the component's CG,
 * per Niskanen (2009) section 4.2.3, p. 64 (GEO-10 fins, GEO-11 cylinders, GEO-12 combination in docs/equations.md), computed from the definitions
 * listed in docs/plans/0003-geometry-and-mass.md.
 *
 * Conventions (docs/conventions.md): x along the axis, positive aft; the
 * longitudinal inertia is the mean of the two transverse moments, which is
 * exact for axisymmetric parts and for symmetric fin sets.
 */
import { InvalidInputError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';
import type { Kilograms, KilogramsPerCubicMetre, Metres, Pascals } from '../units/si.js';
import { noseProfile, transitionProfile, type NoseShape } from './profiles.js';
import { finPlanform, type FinShape } from './fin-planform.js';
import { integrate, revolutionMassProperties, type MassProperties } from './revolution.js';

export interface Shoulder {
  readonly length: Metres;
  readonly radius: Metres;
  readonly wallThickness: Metres;
}

export interface NoseConeComponent {
  readonly kind: 'noseCone';
  readonly shape: NoseShape;
  readonly length: Metres;
  readonly baseRadius: Metres;
  readonly shapeParameter?: number;
  /** undefined = solid ("filled"); otherwise a shell of this uniform wall thickness. */
  readonly wallThickness?: Metres;
  readonly density: KilogramsPerCubicMetre;
  /** Optional aft shoulder, a tube starting at the nose base. */
  readonly aftShoulder?: Shoulder;
}

export interface TransitionComponent {
  readonly kind: 'transition';
  readonly shape: NoseShape;
  readonly length: Metres;
  readonly foreRadius: Metres;
  readonly aftRadius: Metres;
  readonly shapeParameter?: number;
  readonly wallThickness?: Metres;
  readonly density: KilogramsPerCubicMetre;
}

/** Body tubes, inner tubes (motor mounts) and launch lugs: hollow cylinders. */
export interface TubeComponent {
  readonly kind: 'bodyTube' | 'innerTube' | 'launchLug';
  readonly length: Metres;
  readonly outerRadius: Metres;
  readonly wallThickness: Metres;
  readonly density: KilogramsPerCubicMetre;
  /** Radial distance from the rocket axis to the tube's own axis (launch lugs sit on the body); 0 for coaxial tubes. */
  readonly radialOffset?: Metres;
}

/** Centering rings and bulkheads: cylinders with explicit inner and outer radii (inner 0 for a bulkhead). */
export interface RingComponent {
  readonly kind: 'centeringRing' | 'bulkhead';
  readonly length: Metres;
  readonly outerRadius: Metres;
  readonly innerRadius: Metres;
  readonly density: KilogramsPerCubicMetre;
}

/** Mass components and packed recovery devices: a solid cylinder of the given mass. */
export interface MassItemComponent {
  readonly kind: 'massComponent' | 'parachute';
  readonly mass: Kilograms;
  readonly length: Metres;
  readonly radius: Metres;
}

/**
 * Fin profile shapes: Niskanen §3.4.4 p. 49 (square = rectangular, rounded
 * edges, airfoil), 'wedge', a single wedge with a sharp leading edge and a
 * blunt trailing edge of the full thickness, and 'double-wedge', sharp at
 * both edges with the ridge at mid-chord (plan 0029, D-066).
 */
export type FinCrossSection = 'square' | 'rounded' | 'airfoil' | 'wedge' | 'double-wedge';

export interface TrapezoidFinSetComponent {
  readonly kind: 'finSet';
  readonly count: number;
  readonly rootChord: Metres;
  readonly tipChord: Metres;
  /** Leading-edge sweep length: axial distance from the root leading edge to the tip leading edge. */
  readonly sweep: Metres;
  /** Span of one fin from root to tip. */
  readonly span: Metres;
  readonly thickness: Metres;
  readonly density: KilogramsPerCubicMetre;
  /** Radius of the body at the fin root. */
  readonly bodyRadius: Metres;
  /** Profile shape, used by the drag model (plan 0009) and the supersonic fin force (D-065, D-066). */
  readonly crossSection?: FinCrossSection;
  /**
   * A planform other than the trapezoid (D-087): elliptical, or a freeform outline. The root chord
   * and span must agree with it; the tip chord and sweep then describe nothing and are not read.
   */
  readonly shape?: FinShape;
  /**
   * A fin tab (GEO-14, D-081): a rectangular extension of each fin's root into the body,
   * `height` inward from the body surface and `length` along x, its forward edge `foreOffset`
   * aft of the root leading edge. Mass only; it adds no aerodynamic force.
   */
  readonly tab?: FinTab;
  /**
   * Plan 0073 (GEO-19): a fillet along each side of each fin's root, of radius `radius` and its
   * own material. Mass only: it adds no aerodynamic force, as in OpenRocket 24.12
   * (reference/rockets/fillet-probe/values.txt: the drag and CP are unchanged).
   */
  readonly fillet?: FinFillet;
  /**
   * Effective shear modulus G_E of the fin, Pa (NACA TN 4197 eq. 12: the
   * material's G for a solid fin). Used only for the flutter speed (plan
   * 0031); when absent, flutter is not evaluated and the flight says so.
   */
  readonly shearModulus?: Pascals;
}

export interface FinTab {
  readonly height: Metres;
  readonly length: Metres;
  readonly foreOffset: Metres;
}

export interface FinFillet {
  readonly radius: Metres;
  readonly density: KilogramsPerCubicMetre;
}

/** Rail buttons: base cylinder, shaft and flange stacked radially on the body surface. */
export interface RailButtonComponent {
  readonly kind: 'railButton';
  readonly count: number;
  readonly outerDiameter: Metres;
  readonly innerDiameter: Metres;
  readonly totalHeight: Metres;
  readonly baseHeight: Metres;
  readonly flangeHeight: Metres;
  readonly density: KilogramsPerCubicMetre;
  readonly bodyRadius: Metres;
  /** Axial separation between successive buttons (count > 1). */
  readonly separation?: Metres;
}

export type Component =
  | NoseConeComponent
  | TransitionComponent
  | TubeComponent
  | RingComponent
  | MassItemComponent
  | TrapezoidFinSetComponent
  | RailButtonComponent;

function requirePositive(name: string, value: number): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new InvalidInputError(name, value, 'must be greater than 0');
  }
}
function requireNonNegative(name: string, value: number): void {
  if (!(value >= 0) || !Number.isFinite(value)) {
    throw new InvalidInputError(name, value, 'must be 0 or greater');
  }
}

/** Mass properties of a hollow cylinder with explicit radii (closed form from the definitions). */
function hollowCylinder(
  outer: number,
  inner: number,
  length: number,
  density: number,
): MassProperties {
  const volume = Math.PI * (outer * outer - inner * inner) * length;
  const mass = density * volume;
  return {
    volume,
    mass,
    cgX: length / 2,
    inertiaRotational: 0.5 * mass * (outer * outer + inner * inner),
    inertiaLongitudinal: (mass * (3 * (outer * outer + inner * inner) + length * length)) / 12,
  };
}

/** Combine parts given along a common x axis (each part's cgX in that axis). */
export function combine(parts: readonly MassProperties[]): MassProperties {
  const mass = parts.reduce((m, p) => m + p.mass, 0);
  const volume = parts.reduce((v, p) => v + p.volume, 0);
  const cgX = mass > 0 ? parts.reduce((s, p) => s + p.mass * p.cgX, 0) / mass : 0;
  const inertiaRotational = parts.reduce((s, p) => s + p.inertiaRotational, 0);
  const inertiaLongitudinal = parts.reduce(
    (s, p) => s + p.inertiaLongitudinal + p.mass * (p.cgX - cgX) ** 2,
    0,
  );
  return { volume, mass, cgX, inertiaRotational, inertiaLongitudinal };
}

/** Shift a part's CG along x (for sub-parts placed behind a parent's origin). */
function shifted(p: MassProperties, dx: number): MassProperties {
  return { ...p, cgX: p.cgX + dx };
}

/**
 * Parallel-axis contribution of a part whose own axis is at radial distance d
 * from the rocket axis: rotational inertia gains m d²; the mean transverse
 * inertia gains m d²/2 (the mean over the two transverse axes).
 */
function offsetRadially(p: MassProperties, d: number): MassProperties {
  return {
    ...p,
    inertiaRotational: p.inertiaRotational + p.mass * d * d,
    inertiaLongitudinal: p.inertiaLongitudinal + (p.mass * d * d) / 2,
  };
}

export function componentMassProperties(c: Component): MassProperties {
  switch (c.kind) {
    case 'noseCone': {
      const density: number = c.density;
      requirePositive('density', density);
      const profile = noseProfile(c.shape, c.length, c.baseRadius, c.shapeParameter);
      if (c.wallThickness !== undefined)
        requirePositive('nose cone wall thickness', c.wallThickness);
      const body = revolutionMassProperties(profile, density, c.wallThickness);
      if (c.aftShoulder === undefined) return body;
      const s = c.aftShoulder;
      requirePositive('shoulder length', s.length);
      requirePositive('shoulder radius', s.radius);
      requirePositive('shoulder wall thickness', s.wallThickness);
      // G-1: the shoulder is a hollow cylinder inside the body tube, so its
      // inner radius r − t must be positive (as for tubes) and it cannot be
      // wider than the nose base it hangs from.
      if (!(s.wallThickness < s.radius)) {
        throw new InvalidInputError(
          'shoulder wall thickness',
          s.wallThickness,
          `must be less than the shoulder radius (${String(s.radius)} m)`,
        );
      }
      if (!(s.radius <= c.baseRadius)) {
        throw new InvalidInputError(
          'shoulder radius',
          s.radius,
          `must not be larger than the nose cone base radius (${String(c.baseRadius)} m)`,
        );
      }
      const shoulder = shifted(
        hollowCylinder(s.radius, s.radius - s.wallThickness, s.length, density),
        profile.length,
      );
      return combine([body, shoulder]);
    }
    case 'transition': {
      const density: number = c.density;
      requirePositive('density', density);
      const profile = transitionProfile(
        c.shape,
        c.length,
        c.foreRadius,
        c.aftRadius,
        c.shapeParameter,
      );
      if (c.wallThickness !== undefined)
        requirePositive('transition wall thickness', c.wallThickness);
      return revolutionMassProperties(profile, density, c.wallThickness);
    }
    case 'bodyTube':
    case 'innerTube':
    case 'launchLug': {
      requirePositive('tube length', c.length);
      requirePositive('tube outer radius', c.outerRadius);
      requirePositive('tube wall thickness', c.wallThickness);
      requirePositive('density', c.density);
      if (!(c.wallThickness < c.outerRadius)) {
        throw new InvalidInputError(
          'tube wall thickness',
          c.wallThickness,
          'must be less than the outer radius',
        );
      }
      const p = hollowCylinder(c.outerRadius, c.outerRadius - c.wallThickness, c.length, c.density);
      return offsetRadially(p, c.radialOffset ?? 0);
    }
    case 'centeringRing':
    case 'bulkhead': {
      requirePositive('ring length', c.length);
      requirePositive('ring outer radius', c.outerRadius);
      requireNonNegative('ring inner radius', c.innerRadius);
      requirePositive('density', c.density);
      if (!(c.innerRadius < c.outerRadius)) {
        throw new InvalidInputError(
          'ring inner radius',
          c.innerRadius,
          'must be less than the outer radius',
        );
      }
      return hollowCylinder(c.outerRadius, c.innerRadius, c.length, c.density);
    }
    case 'massComponent':
    case 'parachute': {
      // Plan 0065: 0 kg is a placeholder part that adds nothing (as a 0 kg override, GEO-12).
      requireNonNegative('mass', c.mass);
      requirePositive('length', c.length);
      requirePositive('radius', c.radius);
      const volume = Math.PI * c.radius * c.radius * c.length;
      const density = c.mass / volume;
      return hollowCylinder(c.radius, 0, c.length, density);
    }
    case 'finSet':
      return finSetMassProperties(c);
    case 'railButton':
      return railButtonMassProperties(c);
  }
}

/**
 * Trapezoidal fin set: N flat plates of planform area A = (c_r + c_t) s / 2 and
 * thickness t. Integrated numerically over the planform (y from root to tip):
 * chord c(y) = c_r + (c_t − c_r) y/s, leading edge x_LE(y) = x_t y/s.
 *   m = N ρ t A; x̄ = ∫(x_LE + c/2) c dy / A (from the root leading edge);
 *   I_rot = N ρ t ∫ (r_b + y)² c dy  (distance from the rocket axis);
 *   I_long = N ρ t ∫ [ ∫(x − x̄)² dx over the chord + ½ (r_b + y)² c ] dy,
 * the ½ being the mean over the two transverse axes for N ≥ 2 equally spaced fins.
 * The plate thickness is neglected in the inertia (thin plate).
 */
function finSetMassProperties(c: TrapezoidFinSetComponent): MassProperties {
  requirePositive('fin count', c.count);
  requirePositive('fin root chord', c.rootChord);
  requireNonNegative('fin tip chord', c.tipChord);
  requireNonNegative('fin sweep', Math.abs(c.sweep));
  requirePositive('fin span', c.span);
  requirePositive('fin thickness', c.thickness);
  requirePositive('density', c.density);
  requireNonNegative('body radius at the fins', c.bodyRadius);
  if (!Number.isInteger(c.count)) {
    throw new InvalidInputError('fin count', c.count, 'must be a whole number');
  }
  if (c.shape !== undefined) {
    const fin = shapedFinMassProperties(c);
    return withFillet(c.tab === undefined ? fin : combineFinTab(fin, c.tab, c), c);
  }
  const {
    rootChord: cr,
    tipChord: ct,
    sweep: xt,
    span: s,
    thickness: t,
    density,
    bodyRadius: rb,
    count: n,
  } = c;
  const chord = (y: number): number => cr + ((ct - cr) * y) / s;
  const xLE = (y: number): number => (xt * y) / s;
  const panels = 256;
  const area = integrate(chord, s, panels);
  const xBar = integrate((y) => (xLE(y) + chord(y) / 2) * chord(y), s, panels) / area;
  const mass = finiteResult('fin set mass', n * density * t * area);
  const inertiaRotational = finiteResult(
    'fin set rotational inertia',
    n * density * t * integrate((y) => (rb + y) ** 2 * chord(y), s, panels),
  );
  // ∫ over the chord of (x − x̄)² dx = [ (x₂ − x̄)³ − (x₁ − x̄)³ ] / 3 with x₁ = x_LE, x₂ = x_LE + c.
  const chordSecondMoment = (y: number): number => {
    const x1 = xLE(y) - xBar;
    const x2 = x1 + chord(y);
    return (x2 ** 3 - x1 ** 3) / 3;
  };
  const inertiaLongitudinal = finiteResult(
    'fin set longitudinal inertia',
    n *
      density *
      t *
      integrate((y) => chordSecondMoment(y) + 0.5 * (rb + y) ** 2 * chord(y), s, panels),
  );
  const fin: MassProperties = {
    volume: n * t * area,
    mass,
    cgX: xBar,
    inertiaRotational,
    inertiaLongitudinal,
  };
  return withFillet(c.tab === undefined ? fin : combineFinTab(fin, c.tab, c), c);
}

/**
 * GEO-19 (plan 0073): the cross-section of one fillet, in a plane across the rocket's axis. The
 * fin is the plane through the axis (its thickness is not subtracted, as OpenRocket 24.12
 * measures it, reference/rockets/fillet-probe/values.txt), the body a circle of radius R about
 * the axis O, and the fillet the region between them and an arc of radius r tangent to both, with
 * centre C = (r, y_c), y_c = √((R + r)² − r²). By plane geometry (definitions) it is the triangle
 * O A C, A = (0, y_c), less the body's sector of angle φ = asin(r/(R + r)) and the arc's sector
 * of angle θ = acos(r/(R + r)) about C:
 *   A = ½ r y_c − ½ R² φ − ½ r² θ;
 *   J = ∫∫ρ² dA about the axis = (r y_c/12)(2 y_c² + (R + r)²) − R⁴ φ/4
 *       − [r⁴ θ/4 + 2 (½ r² θ) d (C·u) + (R + r)² (½ r² θ)],
 * the triangle's polar moment about its vertex O, the body sector's, and the arc sector's moved
 * from C (its centroid at d = 2 r sin(θ/2)/(3 θ/2) along the bisector u of CA and CO).
 */
export function filletCrossSection(
  bodyRadius: number,
  radius: number,
): { readonly area: number; readonly polarMoment: number } {
  requireNonNegative('body radius at the fins', bodyRadius);
  requireNonNegative('fin fillet radius', radius);
  const R = bodyRadius;
  const r = radius;
  if (r === 0) return { area: 0, polarMoment: 0 };
  const yc = Math.sqrt(R * R + 2 * R * r);
  const phi = Math.asin(r / (R + r));
  const theta = Math.acos(r / (R + r));
  const sector = 0.5 * r * r * theta;
  // u: the unit bisector of the directions from C to A, (−1, 0), and from C to O, −C/|C|.
  const bx = -1 - r / (R + r);
  const by = -yc / (R + r);
  const bl = Math.hypot(bx, by);
  const d = theta === 0 ? 0 : (2 * r * Math.sin(theta / 2)) / (1.5 * theta);
  const cDotU = (r * bx + yc * by) / bl;
  const area = 0.5 * r * yc - 0.5 * R * R * phi - sector;
  const polarMoment =
    ((r * yc) / 12) * (2 * yc * yc + (R + r) ** 2) -
    (R ** 4 * phi) / 4 -
    ((r ** 4 * theta) / 4 + 2 * sector * d * cDotU + (R + r) ** 2 * sector);
  return {
    area: finiteResult('fin fillet cross-section', area),
    polarMoment: finiteResult('fin fillet polar moment', polarMoment),
  };
}

/**
 * GEO-19: n fins' fillets, two per fin, each the cross-section of `filletCrossSection` along the
 * root chord c_r from the root leading edge: m = 2 n ρ_f A c_r, x̄ = c_r/2,
 * I_x = 2 n ρ_f c_r J, I_y about its CG = 2 n ρ_f (A c_r³/12 + ½ c_r J), the ½ from the fins'
 * spacing round the body as in GEO-10. Combined with the fins by GEO-12.
 */
function withFillet(fin: MassProperties, c: TrapezoidFinSetComponent): MassProperties {
  const f = c.fillet;
  if (f === undefined || f.radius === 0) return fin;
  requirePositive('fin fillet density', f.density);
  const { area, polarMoment } = filletCrossSection(c.bodyRadius, f.radius);
  const k = 2 * c.count * (f.density as number);
  const cr: number = c.rootChord;
  const filletMass = k * area * cr;
  const filletX = cr / 2;
  const mass = fin.mass + filletMass;
  const cgX = (fin.mass * fin.cgX + filletMass * filletX) / mass;
  return {
    volume: fin.volume + 2 * c.count * area * cr,
    mass: finiteResult('fin set mass with fillets', mass),
    cgX: finiteResult('fin set CG with fillets', cgX),
    inertiaRotational: finiteResult(
      'fin set rotational inertia with fillets',
      fin.inertiaRotational + k * cr * polarMoment,
    ),
    inertiaLongitudinal: finiteResult(
      'fin set longitudinal inertia with fillets',
      fin.inertiaLongitudinal +
        fin.mass * (fin.cgX - cgX) ** 2 +
        k * ((area * cr ** 3) / 12 + 0.5 * cr * polarMoment) +
        filletMass * (filletX - cgX) ** 2,
    ),
  };
}

/**
 * GEO-16: a fin set of elliptical or freeform planform (D-087) as the thin plates of GEO-10, from
 * the planform's area A and moments ∫∫x dA, ∫∫y dA, ∫∫x² dA, ∫∫y² dA (exact for a polygon by
 * Green's theorem, closed forms for the ellipse): m = N ρ t A, x̄ = ∫∫x dA / A,
 * I_rot = N ρ t ∫∫(r_b + y)² dA = N ρ t (r_b² A + 2 r_b ∫∫y dA + ∫∫y² dA),
 * I_long = N ρ t [∫∫x² dA − A x̄² + ½ ∫∫(r_b + y)² dA].
 */
function shapedFinMassProperties(c: TrapezoidFinSetComponent): MassProperties {
  const p = finPlanform(c);
  const n = c.count;
  const k = n * (c.density as number) * (c.thickness as number);
  const rb: number = c.bodyRadius;
  const { area } = p;
  const xBar = p.moments.x / area;
  const aroundAxis = rb * rb * area + 2 * rb * p.moments.y + p.moments.yy;
  return {
    volume: n * (c.thickness as number) * area,
    mass: finiteResult('fin set mass', k * area),
    cgX: finiteResult('fin set CG', xBar),
    inertiaRotational: finiteResult('fin set rotational inertia', k * aroundAxis),
    inertiaLongitudinal: finiteResult(
      'fin set longitudinal inertia',
      k * (p.moments.xx - area * xBar * xBar + 0.5 * aroundAxis),
    ),
  };
}

/**
 * GEO-14: n fin tabs, each a thin rectangular plate of thickness t from radius r_b − h to r_b and
 * from x = a to a + l (a from the root leading edge), with the thin-plate moments of GEO-10:
 * m = n ρ t h l; x̄ = a + l/2; I_x = n ρ t l (r_b³ − (r_b − h)³)/3;
 * I_y about its CG = n ρ t (h l³/12 + ½ l (r_b³ − (r_b − h)³)/3), the ½ from the fins' spacing
 * round the body as in GEO-10. Combined with the fins by GEO-12 (parallel axis theorem).
 */
function combineFinTab(
  fin: MassProperties,
  tab: FinTab,
  c: TrapezoidFinSetComponent,
): MassProperties {
  const { height: h, length: l, foreOffset: a } = tab;
  requirePositive('fin tab height', h);
  requirePositive('fin tab length', l);
  requireNonNegative('fin tab position from the root leading edge', a);
  const rb: number = c.bodyRadius;
  if (h > rb) {
    throw new InvalidInputError(
      'fin tab height',
      h,
      `must be at most the body radius ${String(rb)} m`,
    );
  }
  const n = c.count;
  const k = n * (c.density as number) * (c.thickness as number);
  const r3 = (rb ** 3 - (rb - h) ** 3) / 3;
  const tabMass = k * h * l;
  const tabX = a + l / 2;
  const tabIx = k * l * r3;
  const tabIy = k * ((h * l ** 3) / 12 + 0.5 * l * r3);
  const mass = fin.mass + tabMass;
  const cgX = (fin.mass * fin.cgX + tabMass * tabX) / mass;
  return {
    volume: fin.volume + n * (c.thickness as number) * h * l,
    mass: finiteResult('fin set mass with tabs', mass),
    cgX: finiteResult('fin set CG with tabs', cgX),
    inertiaRotational: finiteResult(
      'fin set rotational inertia with tabs',
      fin.inertiaRotational + tabIx,
    ),
    inertiaLongitudinal: finiteResult(
      'fin set longitudinal inertia with tabs',
      fin.inertiaLongitudinal +
        fin.mass * (fin.cgX - cgX) ** 2 +
        tabIy +
        tabMass * (tabX - cgX) ** 2,
    ),
  };
}

/**
 * Rail buttons: each is a base cylinder (outer diameter, base height), a shaft
 * (inner diameter, the remaining height) and a flange (outer diameter, flange
 * height), stacked radially from the body surface. Treated as point masses at
 * their centroid's radial distance for inertia. For count > 1 the buttons are
 * spaced `separation` apart along x, starting at x = 0.
 */
function railButtonMassProperties(c: RailButtonComponent): MassProperties {
  requirePositive('rail button count', c.count);
  requirePositive('rail button outer diameter', c.outerDiameter);
  requirePositive('rail button inner diameter', c.innerDiameter);
  requirePositive('rail button total height', c.totalHeight);
  requireNonNegative('rail button base height', c.baseHeight);
  requireNonNegative('rail button flange height', c.flangeHeight);
  requirePositive('density', c.density);
  requireNonNegative('body radius at the rail buttons', c.bodyRadius);
  const shaftHeight = c.totalHeight - c.baseHeight - c.flangeHeight;
  if (!(shaftHeight >= 0)) {
    throw new InvalidInputError(
      'rail button total height',
      c.totalHeight,
      'must be at least the base height plus the flange height',
    );
  }
  const ro = c.outerDiameter / 2;
  const ri = c.innerDiameter / 2;
  const vBase = Math.PI * ro * ro * c.baseHeight;
  const vShaft = Math.PI * ri * ri * shaftHeight;
  const vFlange = Math.PI * ro * ro * c.flangeHeight;
  const volumeOne = vBase + vShaft + vFlange;
  const massOne = c.density * volumeOne;
  // Radial centroid measured from the body surface.
  const hCentroid =
    (vBase * (c.baseHeight / 2) +
      vShaft * (c.baseHeight + shaftHeight / 2) +
      vFlange * (c.totalHeight - c.flangeHeight / 2)) /
    volumeOne;
  const d = c.bodyRadius + hCentroid;
  const sep = c.separation ?? 0;
  const parts: MassProperties[] = [];
  for (let i = 0; i < c.count; i++) {
    parts.push({
      volume: volumeOne,
      mass: massOne,
      cgX: i * sep,
      inertiaRotational: massOne * d * d,
      inertiaLongitudinal: (massOne * d * d) / 2,
    });
  }
  return combine(parts);
}
