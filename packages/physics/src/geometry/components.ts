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
import type { Kilograms, KilogramsPerCubicMetre, Metres } from '../units/si.js';
import { noseProfile, transitionProfile, type NoseShape } from './profiles.js';
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
      requirePositive('mass', c.mass);
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
  return { volume: n * t * area, mass, cgX: xBar, inertiaRotational, inertiaLongitudinal };
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
