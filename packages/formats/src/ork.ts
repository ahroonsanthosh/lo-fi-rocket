/**
 * Minimal reader for OpenRocket `.ork` design files (plan 0005).
 *
 * Scope: exactly the components and settings used by the reference rockets
 * in reference/rockets, mapped onto the physics package's component records.
 * The format has no published specification and OpenRocket's source may not
 * be read (CLAUDE.md section 3); the structure, position methods and element
 * meanings are taken from the files OpenRocket 24.12 wrote (format version
 * 1.10) and fixed by the per-component positions and masses it reports for
 * them (reference/rockets/components/*.csv). See docs/plans/0005-ork-reader.md
 * for the mapping, the rejected inputs and the list of ignored elements.
 *
 * Every element is either read, on a documented ignore list, or rejected with
 * an error naming it. Nothing is defaulted.
 */
import { strFromU8, unzipSync } from 'fflate';
import {
  kilograms,
  kilogramsPerCubicMetre,
  metres,
  noseProfile,
  rocketMassProperties,
  seconds,
  type Approximation,
  type AsBuilt,
  type ClusterOffset,
  type Component,
  type FinShape,
  type FinTab,
  type KilogramsPerCubicMetre,
  type MassOverride,
  type Metres,
  type NoseShape,
  type PlacedComponent,
  type Seconds,
  type Shoulder,
} from '@lo-fi-rocket/physics';
import { OrkParseError, OrkUnsupportedError, OrkUnsupportedFeaturesError } from './errors.js';
import { NUMBER, parseXmlRoots, XmlSyntaxError, type XmlNode } from './xml.js';

// ---------------------------------------------------------------------------
// Output types

export interface OrkPlacedComponent extends PlacedComponent {
  /** The component's name in the file (a label only). */
  readonly name: string;
  /** The element name in the file, e.g. "trapezoidfinset". */
  readonly element: string;
}

export interface OrkMotorMount {
  readonly designation: string;
  readonly manufacturer: string;
  readonly diameter: Metres;
  readonly length: Metres;
  /** Ejection delay as written in the file; undefined for a plugged motor (written "none"). */
  readonly delay: Seconds | undefined;
  /** Aft end of the motor from the nose tip: the mount's aft end plus the overhang. */
  readonly aftEnd: Metres;
  /** Index into `components` of the tube that is the mount (the first tube of a cluster). */
  readonly mountComponent: number;
  /** The motors' offsets from the axis for a cluster (plan 0057); absent for one motor. */
  readonly cluster?: readonly ClusterOffset[];
}

/** OpenRocket deployment events (DeploymentConfiguration.DeployEvent, from the jar's public signature). */
export type OrkDeployEvent = 'launch' | 'ejection' | 'apogee' | 'altitude' | 'never';

export interface OrkRecoveryDevice {
  readonly name: string;
  /** Index into `components` of the packed parachute. */
  readonly component: number;
  readonly diameter: Metres;
  readonly dragCoefficient: number;
  readonly deployEvent: OrkDeployEvent;
  readonly deployAltitude: Metres;
  readonly deployDelay: Seconds;
}

export interface OrkRocket {
  readonly name: string;
  /** The `version` attribute of the `<openrocket>` element, e.g. "1.10". */
  readonly formatVersion: string;
  readonly creator: string | undefined;
  /** Components in file order; positions are forward ends from the nose tip. */
  readonly components: readonly OrkPlacedComponent[];
  /** Overall length: the aft end of the last external component. */
  readonly length: Metres;
  /** Largest external radius; the reference length is twice this (`referencetype` maximum). */
  readonly maxBodyRadius: Metres;
  readonly motorMount: OrkMotorMount | undefined;
  readonly recoveryDevices: readonly OrkRecoveryDevice[];
  /**
   * Approximations of the design as a whole (D-084), e.g. a stage-level override that is not
   * applied. Approximations of one part are on that part (`components[i].approximations`).
   */
  readonly approximations: readonly Approximation[];
  /** The stage's mass or CG override as the design's as-built mass and CG (D-089). */
  readonly asBuilt?: AsBuilt;
  /**
   * What the reader chose or approximated, in plain words: the motor
   * configuration used when the file has several (D-077), and differences
   * from OpenRocket the user should know about.
   */
  readonly notices: readonly string[];
}

// ---------------------------------------------------------------------------
// Container and document

const ZIP_ENTRY = 'rocket.ork';

function parseXml(xml: string, file: string | undefined): XmlNode {
  let roots: XmlNode[];
  try {
    roots = parseXmlRoots(xml);
  } catch (error) {
    if (error instanceof XmlSyntaxError) {
      throw new OrkParseError(
        file,
        error.line === undefined ? 'document' : `line ${String(error.line)}`,
        error.message,
        { cause: error },
      );
    }
    throw error;
  }
  const root = roots.find((n) => n.name === 'openrocket');
  if (root === undefined) {
    throw new OrkParseError(file, 'document', 'root element is not <openrocket>');
  }
  return root;
}

/** Unwrap the zip container if present; otherwise treat the bytes as UTF-8 XML. */
function toXmlText(data: Uint8Array | string, file: string | undefined): string {
  if (typeof data === 'string') return data;
  if (data.length >= 2 && data[0] === 0x50 && data[1] === 0x4b) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(data);
    } catch (error) {
      throw new OrkParseError(file, 'zip container', 'cannot be read as a zip archive', {
        cause: error,
      });
    }
    const entry = entries[ZIP_ENTRY];
    if (entry === undefined) {
      throw new OrkParseError(
        file,
        'zip container',
        `has no "${ZIP_ENTRY}" entry (entries: ${Object.keys(entries).join(', ') || 'none'})`,
      );
    }
    return strFromU8(entry);
  }
  return strFromU8(data);
}

// ---------------------------------------------------------------------------
// Element access with use tracking

class Element {
  private readonly used = new Set<string>();

  constructor(
    readonly node: XmlNode,
    readonly path: string,
    readonly file: string | undefined,
  ) {}

  parseError(problem: string): OrkParseError {
    return new OrkParseError(this.file, this.path, problem);
  }
  unsupported(feature: string): OrkUnsupportedError {
    return new OrkUnsupportedError(this.file, this.path, feature);
  }

  attribute(name: string): string | undefined {
    return this.node.attributes[name];
  }

  all(name: string): XmlNode[] {
    this.used.add(name);
    return this.node.children.filter((c) => c.name === name);
  }

  optional(name: string): XmlNode | undefined {
    const found = this.all(name);
    if (found.length > 1) throw this.parseError(`<${name}> appears ${String(found.length)} times`);
    return found[0];
  }

  one(name: string): XmlNode {
    const found = this.optional(name);
    if (found === undefined) throw this.parseError(`missing <${name}>`);
    return found;
  }

  has(name: string): boolean {
    return this.node.children.some((c) => c.name === name);
  }

  text(name: string): string {
    const n = this.one(name);
    if (n.text === '') throw this.parseError(`<${name}> is empty`);
    return n.text;
  }

  optionalText(name: string): string | undefined {
    return this.optional(name)?.text;
  }

  private toNumber(name: string, text: string): number {
    if (!NUMBER.test(text)) throw this.parseError(`<${name}> is not a number: "${text}"`);
    const value = Number(text);
    if (!Number.isFinite(value)) throw this.parseError(`<${name}> is not finite: "${text}"`);
    return value;
  }

  /** A number; OpenRocket's "auto <value>" for an automatic value gives the value (see `length`). */
  number(name: string): number {
    return this.length(name);
  }

  optionalNumber(name: string): number | undefined {
    return this.has(name) ? this.number(name) : undefined;
  }

  /**
   * A length that may be automatic in OpenRocket. OpenRocket writes an automatic length as
   * "auto" followed by the value it resolved (D-078, reference/rockets/shoulder-probe/values.txt
   * case 4: "auto 0.031" for a radius matched to a 0.031 m tube), and that value is used.
   * A bare "auto" carries no value and is refused.
   */
  length(name: string): number {
    const t = this.text(name);
    if (t === 'auto') throw this.unsupported(`<${name}> "auto" without a resolved value`);
    return this.toNumber(name, t.startsWith('auto ') ? t.slice(5) : t);
  }

  /**
   * A radius that may be a bare "auto" (D-080): `resolve` gives OpenRocket's value for it, or
   * undefined where the rule is not known, which is refused.
   */
  radiusOrAuto(name: string, resolve: () => number | undefined): number {
    if (this.text(name) !== 'auto') return this.length(name);
    const value = resolve();
    if (value === undefined) throw this.unsupported(`<${name}> "auto" here`);
    return value;
  }

  /** A wall thickness that may be "filled". */
  thickness(name: string): number | 'filled' {
    const t = this.text(name);
    return t === 'filled' ? 'filled' : this.toNumber(name, t);
  }

  integer(name: string): number {
    const v = this.number(name);
    if (!Number.isInteger(v)) throw this.parseError(`<${name}> is not an integer: ${String(v)}`);
    return v;
  }

  boolean(name: string): boolean {
    const t = this.text(name);
    if (t === 'true') return true;
    if (t === 'false') return false;
    throw this.parseError(`<${name}> is not true or false: "${t}"`);
  }

  /** Require an optional element, if present, to hold exactly `value`. */
  requireValue(name: string, value: string, feature: string): void {
    const t = this.optionalText(name);
    if (t !== undefined && t !== value) throw this.unsupported(feature);
  }

  /** Require an optional numeric element, if present, to be exactly zero. */
  requireZero(name: string, feature: string): void {
    const v = this.optionalNumber(name);
    if (v !== undefined && v !== 0) throw this.unsupported(feature);
  }

  child(name: string): Element {
    return this.wrap(this.one(name));
  }

  optionalChild(name: string): Element | undefined {
    const n = this.optional(name);
    return n === undefined ? undefined : this.wrap(n);
  }

  wrap(n: XmlNode): Element {
    const label = n.children.find((c) => c.name === 'name')?.text;
    return new Element(
      n,
      `${this.path} > ${n.name}${label === undefined ? '' : ` "${label}"`}`,
      this.file,
    );
  }

  /** Bulk material density from `<material type="bulk" density="...">`. */
  bulkDensity(): KilogramsPerCubicMetre {
    const m = this.one('material');
    const type = m.attributes['type'];
    if (type !== 'bulk') throw this.unsupported(`material type "${type ?? ''}"`);
    const text = m.attributes['density'];
    if (text === undefined) throw this.parseError('<material> has no density attribute');
    const density = this.toNumber('material density', text);
    if (!(density > 0))
      throw this.parseError(`material density must be greater than 0 kg/m³, got ${text}`);
    return kilogramsPerCubicMetre(density);
  }

  /**
   * Density of a surface (kg/m²) or line (kg/m) material, from its `type` and `density` attributes
   * (D-079: a parachute canopy, its lines, a shock cord).
   */
  materialDensity(element: string, type: 'surface' | 'line'): number {
    const m = this.one(element);
    const found = m.attributes['type'];
    if (found !== type)
      throw this.unsupported(`<${element}> of type "${found ?? ''}" where "${type}" is expected`);
    const text = m.attributes['density'];
    if (text === undefined) throw this.parseError(`<${element}> has no density attribute`);
    const density = this.toNumber(`${element} density`, text);
    if (!(density >= 0)) throw this.parseError(`${element} density must be 0 or more, got ${text}`);
    return density;
  }

  /**
   * Every child must have been read or be on the ignore list; anything else is rejected by name,
   * or handed to `unknown` when given (D-084). Override elements get a specific message.
   */
  finish(ignored: readonly string[], unknown?: (name: string) => void): void {
    for (const c of this.node.children) {
      if (this.used.has(c.name) || ignored.includes(c.name)) continue;
      if (unknown !== undefined) {
        unknown(c.name);
        continue;
      }
      if (c.name.startsWith('override')) {
        throw this.unsupported(`mass or CG override (<${c.name}>)`);
      }
      throw this.unsupported(`element <${c.name}>`);
    }
  }
}

/** Cosmetic or bookkeeping elements that carry no geometry or mass. */
const IGNORED_COMMON = [
  'name',
  'id',
  'comment',
  'preset',
  'finish',
  'appearance',
  'insideappearance',
  'color',
  'linestyle',
];
/** Angular placement and radial direction: irrelevant to axisymmetric mass properties. */
const IGNORED_ANGULAR = ['angleoffset', 'rotation', 'radialdirection', 'radiusoffset'];

// ---------------------------------------------------------------------------
// Positions

interface Parent {
  readonly position: number;
  readonly length: number;
  readonly radius: number;
  /**
   * The radius an automatic outer radius takes for a part spanning [fore, aft] (absolute), or
   * undefined where OpenRocket's rule is not known (D-080).
   */
  readonly autoOuterRadius?: (fore: number, aft: number) => number | undefined;
  /** The inner tubes among the children, for automatic centering ring inner radii (D-080). */
  readonly innerTubes?: readonly { fore: number; aft: number; outerRadius: number }[];
}

/**
 * The inner tubes among a parent's children, read ahead of the other children so that a centering
 * ring with an automatic inner radius can fit the tube it surrounds whatever the file order. Reads
 * through a separate wrapper, so the children's own reading and checks are unaffected.
 */
function innerTubeSpans(
  subcomponents: Element,
  parent: Parent,
): { fore: number; aft: number; outerRadius: number }[] {
  return subcomponents.node.children
    .filter((n) => n.name === 'innertube')
    .map((n) => {
      const el = subcomponents.wrap(n);
      const length = el.number('length');
      const fore = axialPosition(el, parent, length);
      return { fore, aft: fore + length, outerRadius: el.length('outerradius') };
    });
}

/**
 * Forward end of a child from its `<axialoffset method="...">` relative to the
 * parent tube. Methods as fixed by reference/rockets/components/*.csv:
 * top = parent forward end + v; bottom = parent aft end + v − own length;
 * middle = parent centre + v − own length / 2; absolute = v from the nose tip.
 */
function axialPosition(el: Element, parent: Parent, ownLength: number): number {
  const node = el.one('axialoffset');
  const method = node.attributes['method'] ?? '';
  const vText = node.text;
  if (!NUMBER.test(vText)) throw el.parseError(`<axialoffset> is not a number: "${vText}"`);
  const v = Number(vText);
  // Legacy duplicate written by OpenRocket; it must agree.
  const legacy = el.optional('position');
  if (legacy !== undefined) {
    const t = legacy.attributes['type'];
    if (t !== method || !NUMBER.test(legacy.text) || Number(legacy.text) !== v) {
      throw el.parseError(
        `<position type="${t ?? ''}">${legacy.text} disagrees with <axialoffset method="${method}">${vText}`,
      );
    }
  }
  switch (method) {
    case 'top':
      return parent.position + v;
    case 'bottom':
      return parent.position + parent.length + v - ownLength;
    case 'middle':
      return parent.position + (parent.length - ownLength) / 2 + v;
    case 'absolute':
      return v;
    default:
      throw el.unsupported(`axial offset method "${method}"`);
  }
}

// ---------------------------------------------------------------------------
// Components

const SHAPES: Readonly<Record<string, NoseShape>> = {
  conical: 'conical',
  ogive: 'ogive',
  ellipsoid: 'elliptical',
  power: 'power',
  parabolic: 'parabolic',
  haack: 'haack',
};

function readShape(el: Element): { shape: NoseShape; shapeParameter: number | undefined } {
  const name = el.text('shape');
  const shape = SHAPES[name];
  if (shape === undefined) throw el.unsupported(`shape "${name}"`);
  const shapeParameter = el.optionalNumber('shapeparameter');
  if (shapeParameter === undefined && shape !== 'conical' && shape !== 'elliptical') {
    throw el.parseError(`shape "${name}" needs a <shapeparameter>`);
  }
  return { shape, shapeParameter };
}

/**
 * A shoulder, and whether it is capped (D-078). OpenRocket gives a shoulder of zero wall
 * thickness no mass, capped or not (reference/rockets/shoulder-probe/values.txt cases 2 and 3),
 * so it is read as no shoulder. A cap is a disc of the shoulder's wall thickness and inner
 * radius at its far end (cases 0 and 1), returned for the caller to place.
 */
function readShoulder(
  el: Element,
  prefix: 'fore' | 'aft',
): { shoulder: Shoulder | undefined; capped: boolean } {
  const radius = el.number(`${prefix}shoulderradius`);
  const length = el.number(`${prefix}shoulderlength`);
  const thickness = el.number(`${prefix}shoulderthickness`);
  const capped = el.boolean(`${prefix}shouldercapped`);
  if ((radius === 0 && length === 0) || (thickness === 0 && radius > 0 && length > 0)) {
    return { shoulder: undefined, capped: false };
  }
  if (!(radius > 0 && length > 0 && thickness > 0)) {
    throw el.parseError(
      `${prefix} shoulder needs positive radius, length and thickness (got ${String(radius)}, ${String(length)}, ${String(thickness)})`,
    );
  }
  return {
    shoulder: { radius: metres(radius), length: metres(length), wallThickness: metres(thickness) },
    capped,
  };
}

/**
 * A fin tab (D-081, GEO-14). OpenRocket writes the tab's offset twice, under its old and new
 * names for the reference (front/top, center/middle, end/bottom), and they agree. The forward
 * edge from the root leading edge is the offset from the root's front, from the root's middle
 * less half the tab, or from the root's end less the tab (reference/rockets/tab-probe/values.txt:
 * 0.01, 0.03 and 0.05 m for an offset of 0.01 m, a 0.1 m root and a 0.06 m tab).
 */
/**
 * The planform of a trapezoidal, elliptical or freeform fin set (plan 0059, D-087). An elliptical
 * set is `<rootchord>` and `<height>`; a freeform set is its `<finpoints>`, `<point x= y=>` from the
 * root leading edge (0, 0) round to the root trailing edge, x aft and y outward
 * (reference/rockets/fin-shape-probe: OpenRocket writes the points it was given). The tip chord and
 * sweep of a shaped set describe nothing and are written as 0.
 */
function readFinPlanform(el: Element): {
  rootChord: number;
  tipChord: number;
  sweep: number;
  span: number;
  shape?: FinShape;
} {
  switch (el.node.name) {
    case 'ellipticalfinset':
      return {
        rootChord: el.number('rootchord'),
        tipChord: 0,
        sweep: 0,
        span: el.number('height'),
        shape: { kind: 'elliptical' },
      };
    case 'freeformfinset': {
      const list = el.child('finpoints');
      const points = list.all('point').map((p, i) => {
        const read = (axis: 'x' | 'y'): number => {
          const text = p.attributes[axis];
          if (text === undefined || !NUMBER.test(text)) {
            throw list.parseError(
              `<point> ${String(i + 1)} has no number in its ${axis} attribute`,
            );
          }
          return Number(text);
        };
        return { x: metres(read('x')), y: metres(read('y')) };
      });
      list.finish([]);
      const last = points.at(-1);
      if (points.length < 3 || last === undefined) {
        throw el.parseError(
          `<finpoints> has ${String(points.length)} points, at least 3 are needed`,
        );
      }
      return {
        rootChord: last.x,
        tipChord: 0,
        sweep: 0,
        span: Math.max(...points.map((p) => p.y as number)),
        shape: { kind: 'freeform', points },
      };
    }
    default:
      return {
        rootChord: el.number('rootchord'),
        tipChord: el.number('tipchord'),
        sweep: el.number('sweeplength'),
        span: el.number('height'),
      };
  }
}

function readFinTab(el: Element, rootChord: number): FinTab | undefined {
  const height = el.optionalNumber('tabheight') ?? 0;
  const length = el.optionalNumber('tablength') ?? 0;
  const positions = el.all('tabposition');
  if (height === 0 || length === 0) return undefined;
  const offsets = new Map<string, number>();
  for (const p of positions) {
    const ref = p.attributes['relativeto'] ?? '';
    const key =
      ({ top: 'front', middle: 'center', bottom: 'end' } as Record<string, string>)[ref] ?? ref;
    if (!NUMBER.test(p.text)) throw el.parseError(`<tabposition> is not a number: "${p.text}"`);
    offsets.set(key, Number(p.text));
  }
  if (offsets.size !== 1) {
    throw el.parseError(
      `<tabposition> must give one reference, got ${offsets.size === 0 ? 'none' : [...offsets.keys()].join(', ')}`,
    );
  }
  const [[ref, offset]] = [...offsets.entries()] as [[string, number]];
  const fore =
    ref === 'front'
      ? offset
      : ref === 'center'
        ? (rootChord - length) / 2 + offset
        : ref === 'end'
          ? rootChord - length + offset
          : undefined;
  if (fore === undefined) throw el.unsupported(`fin tab position relative to "${ref}"`);
  if (fore < 0) throw el.unsupported('a fin tab that starts ahead of the fin root');
  return { height: metres(height), length: metres(length), foreOffset: metres(fore) };
}

/**
 * Mass and CG overrides (D-073). `<overridemass>` is the total mass of the
 * component over all its instances and `<overridecg>` its CG from the
 * component's forward end, as OpenRocket 24.12 computes them
 * (reference/rockets/override-probe/values.txt). An override that also covers the
 * subcomponents is rejected when there are subcomponents: OpenRocket then
 * reports a mass without the children but inertias with them (probe cases 5,
 * 7 and 8), so there is no consistent reading to reproduce. A drag
 * coefficient override is not supported. For a parachute `<overridemass>` is
 * its mass itself and is read by the parachute reader.
 */
function readMassOverride(
  el: Element,
  massIsComponentMass: boolean,
  note: (a: Omit<Approximation, 'subject'>) => void,
): MassOverride | undefined {
  // D-084: a drag coefficient override is not applied; the computed drag is used and listed.
  const cd = el.optionalNumber('overridecd');
  const cdOfChildren = el.has('overridesubcomponentscd') && el.boolean('overridesubcomponentscd');
  if (cd !== undefined) {
    note({
      what: `the drag coefficient override in the file (${String(cd)}${cdOfChildren ? ', including its subcomponents' : ''})`,
      method: 'the drag computed from the part’s shape (Niskanen chapter 3)',
      effect: 'the drag differs from what the file’s author set by hand, which moves the apogee',
      impact: 'moderate',
    });
  }
  const children = el.node.children.find((c) => c.name === 'subcomponents')?.children ?? [];
  const coversChildren = [
    'overridesubcomponents',
    'overridesubcomponentsmass',
    'overridesubcomponentscg',
  ].some((flag) => el.has(flag) && el.boolean(flag));
  if (coversChildren && children.length > 0) {
    // D-084 (was refused, D-073): OpenRocket's reading of such an override is not a consistent
    // rigid body, so the parts' own masses are used and the override is listed as not applied.
    for (const name of ['overridemass', 'overridecg']) el.optional(name);
    note({
      what: 'a mass or CG override that covers this part and everything inside it',
      method: 'the computed masses of the part and its contents, without the override',
      effect:
        'the mass and CG differ from the file’s override; check them against the built rocket',
      impact: 'moderate',
    });
    return undefined;
  }
  const mass = massIsComponentMass ? undefined : el.optionalNumber('overridemass');
  const cg = el.optionalNumber('overridecg');
  if (mass !== undefined && !(mass >= 0)) {
    throw el.parseError(`<overridemass> must be 0 kg or more, got ${String(mass)}`);
  }
  if (mass === undefined && cg === undefined) return undefined;
  return {
    ...(mass === undefined ? {} : { mass: kilograms(mass) }),
    ...(cg === undefined ? {} : { cg: metres(cg) }),
  };
}

/**
 * A mass override of a part of `count` instances, spread over `count` parts of `length` placed
 * `separation` apart (D-084, reference/rockets/lug-probe/values.txt case 5): OpenRocket's override
 * is the instances' total, at the override CG from the first instance's front or else at the set's
 * own CG. The first part carries it and the others weigh nothing; a CG override alone moves every
 * part's CG to the same point.
 */
function instanceOverride(
  override: MassOverride | undefined,
  count: number,
  i: number,
  separation: number,
  length: number,
): MassOverride | undefined {
  if (count === 1 || override === undefined) return override;
  if (override.mass === undefined) {
    return override.cg === undefined ? undefined : { cg: metres(override.cg - i * separation) };
  }
  const setCg = length / 2 + ((count - 1) * separation) / 2;
  return i === 0
    ? { mass: override.mass, cg: override.cg ?? metres(setCg) }
    : { mass: kilograms(0) };
}

/**
 * OpenRocket 24.12's motor cluster layouts (plan 0057): unit points (y, z) in tube outer diameters,
 * as `ClusterConfiguration.getPoints()` gives them (reference/rockets/cluster-probe/values.txt).
 */
const CLUSTER_LAYOUTS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  single: [[0, 0]],
  double: [
    [-0.5, 0],
    [0.5, 0],
  ],
  '3-row': [
    [-1, 0],
    [0, 0],
    [1, 0],
  ],
  '4-row': [
    [-1.5, 0],
    [-0.5, 0],
    [0.5, 0],
    [1.5, 0],
  ],
  '3-ring': [
    [-0.5, -0.2886751345948129],
    [0.5, -0.2886751345948129],
    [0, 0.5773502691896258],
  ],
  '4-ring': [
    [-0.5, 0.5],
    [0.5, 0.5],
    [0.5, -0.5],
    [-0.5, -0.5],
  ],
  '5-ring': [
    [0, 0.8506508083520399],
    [0.8090169943749473, 0.2628655560595668],
    [0.5000000000000001, -0.6881909602355867],
    [-0.4999999999999999, -0.6881909602355868],
    [-0.8090169943749475, 0.26286555605956663],
  ],
  '6-ring': [
    [0, 1],
    [0.8660254037844386, 0.5],
    [0.8660254037844386, -0.5],
    [0, -1],
    [-0.8660254037844386, -0.5],
    [-0.8660254037844386, 0.5],
  ],
  '3-star': [
    [0, 0],
    [0, 1],
    [0.8660254037844386, -0.5],
    [-0.8660254037844386, -0.5],
  ],
  '4-star': [
    [0, 0],
    [-0.7071067811865475, 0.7071067811865475],
    [0.7071067811865475, 0.7071067811865475],
    [0.7071067811865475, -0.7071067811865475],
    [-0.7071067811865475, -0.7071067811865475],
  ],
  '5-star': [
    [0, 0],
    [0, 1],
    [0.9510565162951535, 0.30901699437494745],
    [0.5877852522924732, -0.8090169943749473],
    [-0.587785252292473, -0.8090169943749476],
    [-0.9510565162951536, 0.30901699437494723],
  ],
  '6-star': [
    [0, 0],
    [0, 1],
    [0.8660254037844386, 0.5],
    [0.8660254037844386, -0.5],
    [0, -1],
    [-0.8660254037844386, -0.5],
    [-0.8660254037844386, 0.5],
  ],
  '9-grid': [
    [-1.4, 1.4],
    [0, 1.4],
    [1.4, 1.4],
    [-1.4, 0],
    [0, 0],
    [1.4, 0],
    [-1.4, -1.4],
    [0, -1.4],
    [1.4, -1.4],
  ],
  '9-star': [
    [0, 0],
    [1.4, 0],
    [0.9899494936611664, -0.9899494936611664],
    [0, -1.4],
    [-0.9899494936611664, -0.9899494936611664],
    [-1.4, 0],
    [-0.9899494936611664, 0.9899494936611664],
    [0, 1.4],
    [0.9899494936611664, 0.9899494936611664],
  ],
};

/** Plain names of the file's part elements, for approximation subjects (D-084). */
const PART_LABELS: Readonly<Record<string, string>> = {
  nosecone: 'Nose cone',
  bodytube: 'Body tube',
  transition: 'Transition',
  trapezoidfinset: 'Fin set',
  freeformfinset: 'Freeform fin set',
  ellipticalfinset: 'Elliptical fin set',
  tubefinset: 'Tube fin set',
  launchlug: 'Launch lug',
  railbutton: 'Rail buttons',
  innertube: 'Inner tube',
  tubecoupler: 'Tube coupler',
  engineblock: 'Engine block',
  centeringring: 'Centering ring',
  bulkhead: 'Bulkhead',
  masscomponent: 'Mass component',
  shockcord: 'Shock cord',
  parachute: 'Parachute',
  streamer: 'Streamer',
  podset: 'Pod set',
  parallelstage: 'Booster set',
  stage: 'Stage',
};

function subjectOf(el: Element): string {
  const label = PART_LABELS[el.node.name] ?? `<${el.node.name}>`;
  const name = el.node.children.find((c) => c.name === 'name')?.text;
  return name === undefined || name === '' ? label : `${label} "${name}"`;
}

/** Parts whose stand-in loses lift or drag that matters to the flight (D-084). */
const AERODYNAMIC_PARTS = new Set([
  'trapezoidfinset',
  'freeformfinset',
  'ellipticalfinset',
  'tubefinset',
  'launchlug',
  'railbutton',
  'podset',
  'parallelstage',
]);

/** OpenRocket 24.12's automatic parachute drag coefficient (D-079, reference/rockets/parts-probe/values.txt). */
const OPENROCKET_AUTO_PARACHUTE_CD = 0.8;

/** The configuration OpenRocket opens a file in when none of several is marked default: no motor. */
const NO_CONFIGURATION = '';

class Reader {
  readonly components: OrkPlacedComponent[] = [];
  readonly recoveryDevices: OrkRecoveryDevice[] = [];
  motorMount: OrkMotorMount | undefined;
  length = 0;
  maxBodyRadius = 0;
  readonly notices: string[] = [];
  /** Unsupported features met so far; reading goes on past them to list them all (D-082). */
  readonly problems: OrkUnsupportedError[] = [];
  /** Approximations of the design as a whole (D-084). */
  readonly approximations: Approximation[] = [];
  /** The stage's mass or CG override as the as-built mass and CG (D-089). */
  asBuilt: AsBuilt | undefined;
  /** Approximations noted for an element before its part is placed (D-084). */
  private readonly pending = new Map<XmlNode, Approximation[]>();
  /** The index of the (first) part placed for each element. */
  private readonly placed = new Map<XmlNode, number>();

  /**
   * Note an approximation of the part `el` reads (D-084): attached to that part, when it is placed,
   * or to the design when the element places nothing.
   */
  private note(el: Element, a: Omit<Approximation, 'subject'>): void {
    const approximation = { subject: subjectOf(el), ...a };
    const index = this.placed.get(el.node);
    if (index !== undefined) {
      this.attach(index, approximation);
      return;
    }
    const list = this.pending.get(el.node) ?? [];
    list.push(approximation);
    this.pending.set(el.node, list);
  }

  /**
   * Check a part's element for anything left unread (D-084): an element the reader does not know
   * is skipped and listed, as major because what it would change is not known.
   */
  private finishPart(el: Element, ignored: readonly string[]): void {
    el.finish(ignored, (name) => {
      this.note(el, {
        what: `the setting <${name}> in the file, which the app does not read`,
        method: 'the part simulated without it',
        effect: 'whatever it changes in OpenRocket is not simulated',
        impact: 'major',
      });
    });
    // A part that placed nothing (a weightless engine block) leaves its notes to the design.
    const left = this.pending.get(el.node);
    if (left !== undefined) {
      this.pending.delete(el.node);
      this.approximations.push(...left);
    }
  }

  /** Attach an approximation to a part already placed (D-084). */
  private attach(index: number, a: Approximation): void {
    const c = this.components[index];
    if (c === undefined) {
      this.approximations.push(a);
      return;
    }
    this.components[index] = { ...c, approximations: [...(c.approximations ?? []), a] };
  }

  /**
   * D-084: the axisymmetric model has no radial offset; a part placed off the axis keeps its mass
   * and position along the rocket, on the axis, and the offset is listed.
   */
  private onAxis(el: Element): void {
    const radial = el.optionalNumber('radialposition') ?? 0;
    if (radial === 0) return;
    this.note(el, {
      what: `its ${String(Math.round(radial * 1000))} mm offset from the rocket’s axis`,
      method: 'the part placed on the axis at the same position along the rocket',
      effect: 'the sideways CG offset, which tilts the flight slightly, is not simulated',
      impact: 'minor',
    });
  }

  /**
   * Read one child, recording an unsupported feature instead of stopping, so that the remaining
   * children are still checked (D-082). Malformed input still stops at once.
   */
  private attempt(
    read: () => void,
    standIn?: { readonly path: string; readonly put: (error: OrkUnsupportedError) => void },
  ): void {
    const components = this.components.length;
    const devices = this.recoveryDevices.length;
    const mount = this.motorMount;
    try {
      read();
    } catch (error) {
      if (!(error instanceof OrkUnsupportedError)) throw error;
      // A stand-in replaces the part only for a problem of the part itself; one inside it (its
      // motor mount) is the motor's and stays a problem (D-084).
      if (
        standIn === undefined ||
        error instanceof OrkUnsupportedFeaturesError ||
        error.path !== standIn.path
      ) {
        this.problems.push(
          ...(error instanceof OrkUnsupportedFeaturesError ? error.problems : [error]),
        );
        return;
      }
      // D-084: undo whatever the part placed before it failed, then put in its stand-in.
      this.components.splice(components);
      this.recoveryDevices.splice(devices);
      for (const [node, index] of this.placed) if (index >= components) this.placed.delete(node);
      this.motorMount = mount;
      standIn.put(error);
    }
  }

  /**
   * D-084: a part inside the rocket that the reader cannot model. With a mass in the file
   * (`<overridemass>` or `<mass>`) it becomes a mass at its position; otherwise it is left out.
   * Either way it is listed, as major when it is a lifting surface, a recovery device or a pod,
   * whose aerodynamics or descent then go unmodelled.
   */
  private standInForInternal(el: Element, parent: Parent, error: OrkUnsupportedError): void {
    // A motor mount (a motor cluster) is not stood in: a mass in its place would fly without its
    // motor. It stays a problem until clusters are modelled (plan 0055).
    if (el.has('motormount')) {
      this.problems.push(error);
      return;
    }
    const fresh = new Element(el.node, el.path, el.file);
    const optional = (name: string): number | undefined => {
      try {
        return fresh.optionalNumber(name);
      } catch {
        return undefined;
      }
    };
    const aerodynamic = AERODYNAMIC_PARTS.has(el.node.name);
    const recovery = el.node.name === 'streamer' || el.node.name === 'parachute';
    const mass = optional('overridemass') ?? optional('mass');
    const length = optional('length') ?? optional('packedlength') ?? optional('rootchord') ?? 0;
    let position = parent.position;
    try {
      position = axialPosition(fresh, parent, length);
    } catch {
      // the part's own position could not be read: its holder's front is used
    }
    const lost = aerodynamic
      ? 'its drag and lift are not simulated; without its lift the stability shown is lower than the rocket’s (the cautious side)'
      : recovery
        ? 'it does not slow the descent: the descent is simulated without it'
        : 'nothing else is affected';
    const impact = aerodynamic || recovery ? 'major' : mass === undefined ? 'moderate' : 'minor';
    const approximation: Approximation = {
      subject: subjectOf(el),
      what: `${error.feature} (the app cannot model this part yet)`,
      method:
        mass === undefined
          ? 'the part left out: the file gives no mass for it'
          : `a ${String(Math.round(mass * 1e4) / 10)} g mass at its position, from the file`,
      effect: `${mass === undefined ? 'its mass is missing from the total and the CG; ' : ''}${lost}`,
      impact,
    };
    if (mass === undefined || !(mass >= 0)) {
      this.approximations.push(approximation);
      return;
    }
    const radius = optional('packedradius') ?? optional('outerradius') ?? optional('radius');
    this.components.push({
      name: el.optionalText('name') ?? '',
      element: el.node.name,
      component: {
        kind: 'massComponent',
        mass: kilograms(mass),
        length: metres(Math.max(length, 0)),
        // The holder's radius when the part gives none: it only enters the inertia.
        radius: metres(radius !== undefined && radius > 0 ? radius : parent.radius),
      },
      position: metres(position),
      approximations: [approximation],
    });
  }
  /** The `configid` of the motor configuration OpenRocket selects (D-077); undefined with no configurations. */
  private selectedConfig: string | undefined;

  /** Place a part; its mass override is read from `el` unless one is given. */
  private place(
    el: Element,
    component: Component,
    position: number,
    override: MassOverride | undefined | 'from file' = 'from file',
  ): number {
    const massOverride =
      override === 'from file'
        ? readMassOverride(el, component.kind === 'parachute', (a) => {
            this.note(el, a);
          })
        : override;
    const approximations = this.pending.get(el.node);
    this.pending.delete(el.node);
    if (!this.placed.has(el.node)) this.placed.set(el.node, this.components.length);
    this.components.push({
      name: el.optionalText('name') ?? '',
      element: el.node.name,
      component,
      position: metres(position),
      ...(massOverride === undefined ? {} : { massOverride }),
      ...(approximations === undefined ? {} : { approximations }),
    });
    return this.components.length - 1;
  }

  /**
   * A shoulder cap (D-078): a disc of the shoulder's wall thickness and inner radius, at the
   * shoulder's far end, of the component's material. OpenRocket counts it in the component, so a
   * mass override of that component would cover it; that combination is refused.
   */
  private placeShoulderCap(
    el: Element,
    shoulder: Shoulder,
    farEnd: number,
    side: 'fore' | 'aft',
  ): void {
    if (el.has('overridemass') || el.has('overridecg')) {
      throw el.unsupported(`a mass or CG override on a component with a capped ${side} shoulder`);
    }
    const t = shoulder.wallThickness as number;
    const position = side === 'aft' ? farEnd - t : farEnd;
    this.components.push({
      name: `${el.optionalText('name') ?? ''} (shoulder cap)`,
      element: 'shouldercap',
      component: {
        kind: 'bulkhead',
        length: metres(t),
        outerRadius: metres((shoulder.radius as number) - t),
        innerRadius: metres(0),
        density: el.bulkDensity(),
      },
      position: metres(position),
    });
  }

  /**
   * The selected configuration's ignition, from its <ignitionconfiguration> or else the mount's own
   * elements, must be at launch with no delay: a single-stage rocket's motor starts on the pad.
   */
  private checkIgnition(mount: Element): void {
    const own = mount
      .all('ignitionconfiguration')
      .find((n) => n.attributes['configid'] === this.selectedConfig);
    const from = own === undefined ? mount : mount.wrap(own);
    const event = from.optionalText('ignitionevent');
    if (event !== undefined && event !== 'automatic' && event !== 'launch') {
      throw from.unsupported(`motor ignition event "${event}"`);
    }
    const delay = from.optionalNumber('ignitiondelay');
    if (delay !== undefined && delay !== 0) throw from.unsupported('a motor ignition delay');
    if (own !== undefined) from.finish([]);
  }

  private readMotorMount(el: Element, mountIndex: number, aftEndOfMount: number): void {
    const mount = el.optionalChild('motormount');
    if (mount === undefined) return;
    if (this.motorMount !== undefined) throw mount.unsupported('more than one motor mount');
    const motors = mount.all('motor');
    // D-077: the motor of the selected configuration; a file with one configuration may omit the configid.
    const chosen =
      motors.length === 1 && this.selectedConfig === undefined
        ? motors[0]
        : motors.find((m) => m.attributes['configid'] === this.selectedConfig);
    if (chosen === undefined) {
      // A mount with no motor in the configuration used: the design is imported without a motor.
      if (this.selectedConfig !== NO_CONFIGURATION) {
        this.notices.push(
          `The motor mount "${el.optionalText('name') ?? ''}" has no motor in the ${motors.length === 0 ? 'file' : 'default motor configuration'}: choose a motor in the motor panel.`,
        );
      }
      mount.all('ignitionconfiguration');
      for (const name of ['overhang', 'ignitionevent', 'ignitiondelay']) mount.optional(name);
      mount.finish([]);
      return;
    }
    this.checkIgnition(mount);
    const overhang = mount.number('overhang');
    const motor = mount.wrap(chosen);
    // D-081: single-use, reloadable or hybrid is catalogue information; the motor's thrust and mass
    // come from its definition, matched by name.
    const type = motor.optionalText('type');
    if (type !== undefined && !['single', 'reload', 'hybrid'].includes(type)) {
      throw motor.unsupported(`motor type "${type}"`);
    }
    this.motorMount = {
      designation: motor.text('designation'),
      manufacturer: motor.text('manufacturer'),
      diameter: metres(motor.number('diameter')),
      length: metres(motor.number('length')),
      // D-081: OpenRocket writes "none" for a plugged motor (no ejection charge).
      delay: motor.text('delay') === 'none' ? undefined : seconds(motor.number('delay')),
      aftEnd: metres(aftEndOfMount + overhang),
      mountComponent: mountIndex,
    };
    motor.finish(['digest']);
    mount.finish(['ignitionevent', 'ignitiondelay', 'ignitionconfiguration']);
  }

  /** Children of a body tube. */
  private readInternal(subcomponents: Element, parent: Parent): void {
    for (const node of subcomponents.node.children) {
      this.attempt(
        () => {
          const el = subcomponents.wrap(node);
          switch (node.name) {
            case 'trapezoidfinset':
            case 'ellipticalfinset':
            case 'freeformfinset':
              this.readFinSet(el, parent);
              break;
            case 'launchlug':
              this.readLaunchLug(el, parent);
              break;
            case 'railbutton':
              this.readRailButton(el, parent);
              break;
            case 'innertube':
              this.readInnerTube(el, parent);
              break;
            case 'centeringring':
              this.readRing(el, parent, 'centeringRing');
              break;
            case 'bulkhead':
              this.readRing(el, parent, 'bulkhead');
              break;
            case 'masscomponent':
              this.readMassComponent(el, parent);
              break;
            case 'parachute':
              this.readParachute(el, parent);
              break;
            case 'shockcord':
              this.readShockCord(el, parent);
              break;
            case 'tubecoupler':
              this.readTubeCoupler(el, parent);
              break;
            case 'engineblock':
              this.readEngineBlock(el, parent);
              break;
            default:
              throw el.unsupported(`element <${node.name}>`);
          }
        },
        {
          path: subcomponents.wrap(node).path,
          put: (error) => {
            this.standInForInternal(subcomponents.wrap(node), parent, error);
          },
        },
      );
    }
  }

  private readFinSet(el: Element, parent: Parent): void {
    const count = el.integer('fincount');
    const instances = el.optionalNumber('instancecount');
    if (instances !== undefined && instances !== count) {
      throw el.parseError(
        `<instancecount> ${String(instances)} differs from <fincount> ${String(count)}`,
      );
    }
    // OpenRocket writes the cant in degrees (D-085, reference/rockets/cant-probe/values.txt).
    const cant = el.optionalNumber('cant') ?? 0;
    if (cant !== 0) {
      // D-084: the roll forcing of canted fins is not yet modelled (plan 0055 step 6).
      this.note(el, {
        what: `the fins’ ${String(Math.round(cant * 10) / 10)}° cant`,
        method: 'the fins flown straight: no roll forcing',
        effect:
          'the spin the cant gives is not simulated; the trajectory and stability change little, the roll rate is not shown',
        impact: 'minor',
      });
    }
    const fillet = el.optionalNumber('filletradius') ?? 0;
    if (fillet !== 0) {
      this.note(el, {
        what: `fin fillets of ${String(Math.round(fillet * 1e4) / 10)} mm radius`,
        method: 'the fins without fillets',
        effect: 'the fillets’ few grams and small drag are missing',
        impact: 'minor',
      });
    }
    const written = el.optionalText('crosssection') ?? 'square';
    const known = written === 'square' || written === 'rounded' || written === 'airfoil';
    if (!known) {
      // D-084: a cross-section the app does not know is flown as square, whose blunt edges have
      // the most drag and whose slab has the most mass, aft of the CG (the cautious side).
      this.note(el, {
        what: `the fin cross-section "${written}"`,
        method: 'the fins flown as square-edged flat plates',
        effect:
          'the fin drag and mass are those of square edges, likely a little high: the apogee shown is a little low',
        impact: 'moderate',
      });
    }
    const crossSection = known ? written : 'square';
    // Rounded and airfoil fins: the slab mass is listed by the physics (D-077, D-083).
    const planform = readFinPlanform(el);
    const position = axialPosition(el, parent, planform.rootChord);
    const tab = readFinTab(el, planform.rootChord);
    this.place(
      el,
      {
        kind: 'finSet',
        crossSection,
        count,
        rootChord: metres(planform.rootChord),
        tipChord: metres(planform.tipChord),
        sweep: metres(planform.sweep),
        span: metres(planform.span),
        ...(planform.shape === undefined ? {} : { shape: planform.shape }),
        thickness: metres(el.number('thickness')),
        density: el.bulkDensity(),
        bodyRadius: metres(parent.radius),
        ...(tab === undefined ? {} : { tab }),
      },
      position,
    );
    this.finishPart(el, [...IGNORED_COMMON, ...IGNORED_ANGULAR, 'filletmaterial']);
  }

  private readLaunchLug(el: Element, parent: Parent): void {
    // D-084: OpenRocket's n instances are n lugs, the first at the component's position and each
    // next one <instanceseparation> further aft, with n times the mass and the drag of one
    // (reference/rockets/lug-probe/values.txt cases 0 to 2); they are placed as n lugs. A mass
    // override is the set's total at the override CG, from the first lug's front, or else at the
    // set's own CG (case 5: 0.01 kg at 0.02 m); it is put on the first lug and the others weigh 0.
    const count = el.has('instancecount') ? el.integer('instancecount') : 1;
    if (count < 1) throw el.parseError(`<instancecount> must be 1 or more, got ${String(count)}`);
    const separation = count > 1 ? el.number('instanceseparation') : 0;
    const length = el.number('length');
    const radius = el.number('radius');
    const position = axialPosition(el, parent, length);
    const lug: Component = {
      kind: 'launchLug',
      length: metres(length),
      outerRadius: metres(radius),
      wallThickness: metres(el.number('thickness')),
      density: el.bulkDensity(),
      radialOffset: metres(parent.radius + radius),
    };
    const override = readMassOverride(el, false, (a) => {
      this.note(el, a);
    });
    for (let i = 0; i < count; i++) {
      this.place(
        el,
        lug,
        position + i * separation,
        instanceOverride(override, count, i, separation, length),
      );
    }
    this.finishPart(el, [...IGNORED_COMMON, ...IGNORED_ANGULAR, 'instanceseparation']);
  }

  private readRailButton(el: Element, parent: Parent): void {
    const count = el.integer('instancecount');
    const screw = el.optionalNumber('screwheight') ?? 0;
    if (screw > 0) {
      // D-084: OpenRocket counts each screw head as a half-ellipsoid of the button's outer radius
      // and the screw height, mass only, no drag (reference/rockets/lug-probe/values.txt cases 3
      // and 4: 0.4197 g for two 9.7 mm Delrin buttons with 3 mm screws).
      const outer = el.number('outerdiameter') / 2;
      const grams = count * ((2 / 3) * Math.PI * outer ** 2 * screw) * el.bulkDensity() * 1000;
      this.note(el, {
        what: `the screw heads (${String(Math.round(screw * 1e4) / 10)} mm)`,
        method: 'the buttons without their screw heads',
        effect: `about ${grams.toPrecision(2)} g is missing from the total; they add no drag`,
        impact: 'minor',
      });
    }
    const separation = el.optionalNumber('instanceseparation');
    if (count > 1 && separation === undefined) {
      throw el.parseError('<instanceseparation> is required for more than one button');
    }
    const position = axialPosition(el, parent, 0);
    this.place(
      el,
      {
        kind: 'railButton',
        count,
        outerDiameter: metres(el.number('outerdiameter')),
        innerDiameter: metres(el.number('innerdiameter')),
        totalHeight: metres(el.number('height')),
        baseHeight: metres(el.number('baseheight')),
        flangeHeight: metres(el.number('flangeheight')),
        density: el.bulkDensity(),
        bodyRadius: metres(parent.radius),
        ...(count > 1 && separation !== undefined ? { separation: metres(separation) } : {}),
      },
      position,
    );
    this.finishPart(el, [...IGNORED_COMMON, ...IGNORED_ANGULAR]);
  }

  private readInnerTube(el: Element, parent: Parent): void {
    this.onAxis(el);
    const length = el.number('length');
    const position = axialPosition(el, parent, length);
    const outer = el.length('outerradius');
    const wall = el.number('thickness');
    const cluster = this.readCluster(el, outer);
    const count = cluster?.length ?? 1;
    const tube: Component = {
      kind: 'innerTube',
      length: metres(length),
      outerRadius: metres(outer),
      wallThickness: metres(wall),
      density: el.bulkDensity(),
    };
    const override = readMassOverride(el, false, (a) => {
      this.note(el, a);
    });
    if (cluster !== undefined) {
      this.note(el, {
        what: `the ${String(count)} tubes’ offsets from the rocket’s axis`,
        method: 'the tubes placed on the axis, as OpenRocket does for their mass',
        effect:
          'the tubes’ roll and pitch inertia is slightly low; their mass and CG are exact and the motors are placed at their offsets',
        impact: 'minor',
      });
    }
    // Plan 0057: a cluster is n identical tubes, each holding the same motor.
    let index = -1;
    for (let i = 0; i < count; i++) {
      const placed = this.place(
        el,
        tube,
        position,
        instanceOverride(override, count, i, 0, length),
      );
      if (i === 0) index = placed;
    }
    this.readMotorMount(el, index, position + length);
    if (cluster !== undefined && this.motorMount?.mountComponent === index) {
      this.motorMount = { ...this.motorMount, cluster };
    }
    // D-081: parts inside an inner tube (an engine block in a motor tube) are positioned against the
    // tube; an automatic outer radius there is its inner radius (tab-probe: 0.009 m in a 0.0095 m
    // tube with a 0.0005 m wall).
    const sub = el.optionalChild('subcomponents');
    if (sub !== undefined) {
      const parentOfChildren: Parent = {
        position,
        length,
        radius: outer,
        autoOuterRadius: () => outer - wall,
      };
      // Each tube of a cluster holds its own copy of the parts inside.
      for (let i = 0; i < count; i++) {
        this.readNoseInternal(sub, { ...parentOfChildren, innerTubes: [] }, 'an inner tube');
      }
    }
    this.finishPart(el, [...IGNORED_COMMON, ...IGNORED_ANGULAR]);
  }

  /**
   * Plan 0057: the motor offsets of a clustered inner tube, or undefined for a single tube. The
   * layout's unit points are scaled by the outer diameter times `<clusterscale>` and turned by
   * `<clusterrotation>` degrees, as OpenRocket places them (cluster-probe cases 1 and 2: the
   * "3-ring" point (−0.5, −0.2887) at scale 1.2 and 30° is at (−0.017321, 0) m for a 25 mm tube).
   */
  private readCluster(el: Element, outerRadius: number): ClusterOffset[] | undefined {
    const name = el.optionalText('clusterconfiguration') ?? 'single';
    const scale = el.optionalNumber('clusterscale') ?? 1;
    const rotation = ((el.optionalNumber('clusterrotation') ?? 0) * Math.PI) / 180;
    if (name === 'single') return undefined;
    const layout = CLUSTER_LAYOUTS[name];
    if (layout === undefined) {
      this.note(el, {
        what: `the motor cluster layout "${name}", which the app does not know`,
        method: 'one tube and one motor on the axis',
        effect:
          'the thrust and the motors’ mass are those of one motor: the apogee, speeds and stability shown can be far off',
        impact: 'major',
      });
      return undefined;
    }
    const step = 2 * outerRadius * scale;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return layout.map(([y, z]) => ({
      y: metres(step * (y * cos + z * sin)),
      z: metres(step * (z * cos - y * sin)),
    }));
  }

  /**
   * A tube coupler (D-079): a thin tube inside the body, read as an inner tube that is not a motor
   * mount; OpenRocket's mass for it is the tube's (reference/rockets/parts-probe/values.txt).
   */
  private readTubeCoupler(el: Element, parent: Parent): void {
    this.onAxis(el);
    const length = el.number('length');
    const fore = axialPosition(el, parent, length);
    const outer = el.radiusOrAuto('outerradius', () =>
      parent.autoOuterRadius?.(fore, fore + length),
    );
    const wall = el.number('thickness');
    this.place(
      el,
      {
        kind: 'innerTube',
        length: metres(length),
        outerRadius: metres(outer),
        wallThickness: metres(wall),
        density: el.bulkDensity(),
      },
      fore,
    );
    // D-080: children of a coupler are positioned against the coupler, like those of a body tube,
    // and an automatic outer radius inside it is its inner radius (auto-ring-probe).
    const sub = el.optionalChild('subcomponents');
    if (sub !== undefined) {
      const parentOfChildren: Parent = {
        position: fore,
        length,
        radius: outer,
        autoOuterRadius: () => outer - wall,
      };
      this.readNoseInternal(
        sub,
        { ...parentOfChildren, innerTubes: innerTubeSpans(sub, parentOfChildren) },
        'a tube coupler',
      );
    }
    this.finishPart(el, [...IGNORED_COMMON, ...IGNORED_ANGULAR]);
  }

  /**
   * An engine block (D-079): a ring of the given outer radius and wall thickness, so its inner
   * radius is the outer radius minus the thickness (parts-probe: 0.0095 and 0.003 give 0.0065).
   */
  private readEngineBlock(el: Element, parent: Parent): void {
    el.requireValue('instancecount', '1', 'more than one engine block instance');
    this.onAxis(el);
    const length = el.number('length');
    const fore = axialPosition(el, parent, length);
    const outer = el.radiusOrAuto('outerradius', () =>
      parent.autoOuterRadius?.(fore, fore + length),
    );
    const thickness = el.number('thickness');
    if (thickness === 0) {
      // OpenRocket gives a zero-thickness engine block no mass (tab-probe case 0); nothing to place.
      this.finishPart(el, [
        ...IGNORED_COMMON,
        ...IGNORED_ANGULAR,
        'instanceseparation',
        'material',
      ]);
      return;
    }
    if (!(thickness > 0 && thickness <= outer)) {
      throw el.parseError(
        `engine block thickness must be greater than 0 and at most the outer radius, got ${String(thickness)} and ${String(outer)}`,
      );
    }
    this.place(
      el,
      {
        kind: 'centeringRing',
        length: metres(length),
        outerRadius: metres(outer),
        innerRadius: metres(outer - thickness),
        density: el.bulkDensity(),
      },
      fore,
    );
    this.finishPart(el, [...IGNORED_COMMON, ...IGNORED_ANGULAR, 'instanceseparation']);
  }

  /**
   * A shock cord (D-079): a mass of cord length × line density, packed as a cylinder of the
   * packed length and radius (parts-probe: 1.5 m × 0.005 kg/m = 0.0075 kg at the packed centre).
   */
  private readShockCord(el: Element, parent: Parent): void {
    this.onAxis(el);
    const length = el.number('packedlength');
    const cord = el.number('cordlength');
    if (!(cord >= 0)) throw el.parseError(`<cordlength> must be 0 m or more, got ${String(cord)}`);
    this.place(
      el,
      {
        kind: 'massComponent',
        mass: kilograms(cord * el.materialDensity('material', 'line')),
        length: metres(length),
        radius: metres(el.number('packedradius')),
      },
      axialPosition(el, parent, length),
    );
    this.finishPart(el, [...IGNORED_COMMON, ...IGNORED_ANGULAR]);
  }

  private readRing(el: Element, parent: Parent, kind: 'centeringRing' | 'bulkhead'): void {
    el.requireValue('instancecount', '1', `more than one ${kind} instance`);
    this.onAxis(el);
    const length = el.number('length');
    const position = axialPosition(el, parent, length);
    const aft = position + length;
    // D-080: an automatic inner radius fits the largest inner tube the ring overlaps, else 0.
    const autoInner = (): number =>
      Math.max(
        0,
        ...(parent.innerTubes ?? [])
          .filter((t) => position < t.aft && aft > t.fore)
          .map((t) => t.outerRadius),
      );
    this.place(
      el,
      {
        kind,
        length: metres(length),
        outerRadius: metres(
          el.radiusOrAuto('outerradius', () => parent.autoOuterRadius?.(position, aft)),
        ),
        innerRadius: metres(
          kind === 'centeringRing' ? el.radiusOrAuto('innerradius', autoInner) : 0,
        ),
        density: el.bulkDensity(),
      },
      position,
    );
    this.finishPart(el, [...IGNORED_COMMON, ...IGNORED_ANGULAR, 'instanceseparation']);
  }

  private readMassComponent(el: Element, parent: Parent): void {
    this.onAxis(el);
    const length = el.number('packedlength');
    const position = axialPosition(el, parent, length);
    this.place(
      el,
      {
        kind: 'massComponent',
        mass: kilograms(el.number('mass')),
        length: metres(length),
        radius: metres(el.number('packedradius')),
      },
      position,
    );
    this.finishPart(el, [...IGNORED_COMMON, ...IGNORED_ANGULAR, 'masscomponenttype']);
  }

  private readParachute(el: Element, parent: Parent): void {
    this.onAxis(el);
    // An override "including subcomponents" is the parachute's own: OpenRocket gives a parachute no
    // children, and any in the file are refused by name (D-084).
    const diameter = el.number('diameter');
    // D-079: without an override, OpenRocket's parachute mass is the canopy disc, π (d/2)² × the
    // surface density, plus the lines, count × length × the line density
    // (reference/rockets/parts-probe/values.txt: 0.018944 + 0.0072 = 0.026144 kg).
    const mass = el.has('overridemass')
      ? el.number('overridemass')
      : Math.PI * (diameter / 2) ** 2 * el.materialDensity('material', 'surface') +
        el.number('linecount') *
          el.number('linelength') *
          el.materialDensity('linematerial', 'line');
    const length = el.number('packedlength');
    const position = axialPosition(el, parent, length);
    const index = this.place(
      el,
      {
        kind: 'parachute',
        mass: kilograms(mass),
        length: metres(length),
        radius: metres(el.number('packedradius')),
      },
      position,
    );
    // D-077: a <deploymentconfiguration> for the selected configuration replaces the parachute's own
    // deployment elements; the other configurations' entries are not used.
    const own = el
      .all('deploymentconfiguration')
      .find((n) => n.attributes['configid'] === this.selectedConfig);
    const deploy = own === undefined ? el : el.wrap(own);
    const written = deploy.text('deployevent');
    const known = ['launch', 'ejection', 'apogee', 'altitude', 'never'].includes(written);
    if (!known) {
      // D-084: an event the app does not model (a stage separation) deploys at apogee, the usual
      // intent; the deployment speed and descent can then be wrong in kind, so it is major.
      this.attach(index, {
        subject: subjectOf(el),
        what: `deployment at the "${written}" event`,
        method: 'deployed at apogee instead',
        effect:
          'the deployment speed, descent and drift are those of an apogee deployment, which may not be what happens',
        impact: 'major',
      });
    }
    const event = known ? written : 'apogee';
    const cdText = el.text('cd');
    if (cdText === 'auto') {
      // D-079 (the owner's choice): OpenRocket's automatic parachute C_D, 0.8 (parts-probe), an
      // OpenRocket default with no approved source, used and listed (D-084).
      this.attach(index, {
        subject: subjectOf(el),
        what: 'the canopy’s drag coefficient ("auto" in the file)',
        method: 'OpenRocket’s default C_D of 0.8',
        effect:
          'the descent rate and drift depend on it; a real canopy’s figure can differ by 20 % or more. Enter the maker’s value if you have it',
        impact: 'moderate',
      });
    }
    this.recoveryDevices.push({
      name: el.optionalText('name') ?? '',
      component: index,
      diameter: metres(el.number('diameter')),
      dragCoefficient: cdText === 'auto' ? OPENROCKET_AUTO_PARACHUTE_CD : el.number('cd'),
      deployEvent: event as OrkDeployEvent,
      deployAltitude: metres(deploy.number('deployaltitude')),
      deployDelay: seconds(deploy.number('deploydelay')),
    });
    if (own !== undefined) {
      deploy.finish([]);
      // The parachute's own deployment elements are the other configurations' settings.
      for (const name of ['deployevent', 'deployaltitude', 'deploydelay']) el.optional(name);
    }
    this.finishPart(el, [
      ...IGNORED_COMMON,
      ...IGNORED_ANGULAR,
      'material',
      'linecount',
      'linelength',
      'linematerial',
    ]);
  }

  /** External components in a stage: stacked from the nose tip in file order. */
  private readStage(stage: Element): void {
    const sub = stage.child('subcomponents');
    let x = 0;
    for (const node of sub.node.children) {
      this.attempt(() => {
        const el = sub.wrap(node);
        const offset = el.optional('axialoffset');
        if (
          offset !== undefined &&
          (offset.attributes['method'] !== 'after' || Number(offset.text) !== 0)
        ) {
          throw el.unsupported(
            'external components positioned other than stacked after the previous one',
          );
        }
        el.optional('position');
        switch (node.name) {
          case 'nosecone':
            x = this.readNoseCone(el, x);
            break;
          case 'bodytube':
            x = this.readBodyTube(el, x);
            break;
          case 'transition':
            x = this.readTransition(el, x);
            break;
          default:
            throw el.unsupported(`element <${node.name}>`);
        }
      });
    }
    this.length = x;
    this.readStageOverride(stage);
    stage.finish([...IGNORED_COMMON]);
  }

  /**
   * D-089: a stage mass or CG override as the design's as-built mass and CG (GEO-17), as OpenRocket
   * applies it (reference/rockets/stage-override-probe/values.txt): covering the parts, the stage's
   * total mass (case 4) and CG (cases 5, 6); not covering them, a point mass added at the stage's CG
   * or at the overridden CG (cases 1, 3), here spread over the parts in proportion (minor); a CG
   * override alone not covering the parts does nothing (case 2). A drag override stays listed
   * (D-084). The stage's front is the nose tip, as it is the only stage.
   */
  private readStageOverride(stage: Element): void {
    const flag = (name: string): boolean | undefined =>
      stage.has(name) ? stage.boolean(name) : undefined;
    const both = flag('overridesubcomponents');
    const coversMass = flag('overridesubcomponentsmass') ?? both ?? false;
    const coversCg = flag('overridesubcomponentscg') ?? both ?? false;
    // Read so that it is not reported as unknown; a drag override is listed either way.
    flag('overridesubcomponentscd');
    const mass = stage.optionalNumber('overridemass');
    const cg = stage.optionalNumber('overridecg');
    const cd = stage.optionalNumber('overridecd');
    if (cd !== undefined) {
      this.approximations.push({
        subject: subjectOf(stage),
        what: `the stage’s drag coefficient override (${String(cd)})`,
        method: 'the drag of the stage’s parts, without the override',
        effect:
          'the drag differs from what the file’s author set for the whole stage, which moves the apogee',
        impact: 'moderate',
      });
    }
    if (mass !== undefined && !(mass > 0)) {
      throw stage.parseError(`<overridemass> must be greater than 0 kg, got ${String(mass)}`);
    }
    if (mass === undefined && (cg === undefined || !coversCg)) return;
    if (mass !== undefined && !coversMass) {
      // Cases 1 and 3: OpenRocket adds the mass as a point at the stage's CG, or at the overridden CG.
      const parts = rocketMassProperties(this.components);
      const total = parts.mass + mass;
      const at = cg ?? parts.cg;
      this.asBuilt = {
        mass: kilograms(total),
        cg: metres((parts.mass * parts.cg + mass * at) / total),
      };
      this.approximations.push({
        subject: subjectOf(stage),
        what: `the stage’s mass override (${String(Math.round(mass * 1e4) / 10)} g added at ${String(Math.round(at * 1e4) / 10)} mm from the nose)`,
        method:
          'the added mass spread over the parts in proportion to theirs, at the same total and CG',
        effect:
          'the mass and CG are OpenRocket’s; the pitch inertia differs a little from a point mass, so the pitching motion changes slightly',
        impact: 'minor',
      });
      return;
    }
    // Cases 4 to 6: the stage's total and CG.
    this.asBuilt = {
      ...(mass === undefined ? {} : { mass: kilograms(mass) }),
      ...(cg === undefined || !coversCg ? {} : { cg: metres(cg) }),
    };
    if (cg !== undefined && !coversCg) {
      // A CG override for the stage alone beside a total mass: not observed in OpenRocket.
      this.approximations.push({
        subject: subjectOf(stage),
        what: `the stage’s CG override (${String(Math.round(cg * 1e4) / 10)} mm), set for the stage alone beside a mass for the whole stage`,
        method: 'the parts’ own CG, at the stage’s total mass',
        effect: 'the CG, and so the stability margin, may differ from the file author’s',
        impact: 'moderate',
      });
    }
  }

  private readNoseCone(el: Element, x: number): number {
    if (el.boolean('isflipped')) throw el.unsupported('flipped nose cones');
    // <shapeclipped> is written for clippable shapes. For a nose cone the fore
    // radius is zero, so the clipped and non-clipped profiles of Niskanen
    // Appendix A.7 (pp. 103 to 104) coincide and the flag has no effect.
    if (el.has('shapeclipped')) el.boolean('shapeclipped');
    const { shape, shapeParameter } = readShape(el);
    const length = el.number('length');
    const baseRadius = el.length('aftradius');
    const thickness = el.thickness('thickness');
    const { shoulder: aftShoulder, capped } = readShoulder(el, 'aft');
    this.maxBodyRadius = Math.max(this.maxBodyRadius, baseRadius);
    this.place(
      el,
      {
        kind: 'noseCone',
        shape,
        length: metres(length),
        baseRadius: metres(baseRadius),
        ...(shapeParameter === undefined ? {} : { shapeParameter }),
        ...(thickness === 'filled' ? {} : { wallThickness: metres(thickness) }),
        density: el.bulkDensity(),
        ...(aftShoulder === undefined ? {} : { aftShoulder }),
      },
      x,
    );
    if (capped && aftShoulder !== undefined) {
      this.placeShoulderCap(el, aftShoulder, x + length + aftShoulder.length, 'aft');
    }
    const sub = el.optionalChild('subcomponents');
    if (sub !== undefined) {
      // D-080: an automatic outer radius inside a hollow nose cone is the cone's radius less its
      // wall, at the end of the part where that is smaller (the fore end on a nose); unknown when
      // filled.
      const profile = noseProfile(shape, metres(length), metres(baseRadius), shapeParameter);
      const radiusAt = (at: number): number =>
        profile.radius(Math.min(Math.max(at - x, 0), length)) - (thickness as number);
      const parent: Parent = {
        position: x,
        length,
        radius: baseRadius,
        autoOuterRadius:
          thickness === 'filled'
            ? () => undefined
            : (fore, aft) => Math.min(radiusAt(fore), radiusAt(aft)),
      };
      this.readNoseInternal(sub, { ...parent, innerTubes: innerTubeSpans(sub, parent) });
    }
    this.finishPart(el, [...IGNORED_COMMON]);
    return x + length;
  }

  /**
   * Children of a nose cone. OpenRocket positions them against the cone's own
   * length, the shoulder excluded, with the same methods as in a body tube
   * (reference/rockets/nose-child-probe/values.txt: "bottom" is the cone's aft
   * end with or without a shoulder). Only parts whose geometry does not use the
   * parent's radius are read: fins, lugs, rail buttons and inner tubes would
   * need the body radius, which varies along a nose cone.
   */
  private readNoseInternal(subcomponents: Element, parent: Parent, where = 'a nose cone'): void {
    for (const node of subcomponents.node.children) {
      this.attempt(
        () => {
          const el = subcomponents.wrap(node);
          switch (node.name) {
            case 'centeringring':
              this.readRing(el, parent, 'centeringRing');
              break;
            case 'bulkhead':
              this.readRing(el, parent, 'bulkhead');
              break;
            case 'masscomponent':
              this.readMassComponent(el, parent);
              break;
            case 'parachute':
              this.readParachute(el, parent);
              break;
            case 'shockcord':
              this.readShockCord(el, parent);
              break;
            case 'tubecoupler':
              this.readTubeCoupler(el, parent);
              break;
            case 'engineblock':
              this.readEngineBlock(el, parent);
              break;
            default:
              throw el.unsupported(`element <${node.name}> inside ${where}`);
          }
        },
        {
          path: subcomponents.wrap(node).path,
          put: (error) => {
            this.standInForInternal(subcomponents.wrap(node), parent, error);
          },
        },
      );
    }
  }

  private readTransition(el: Element, x: number): number {
    const { shape, shapeParameter } = readShape(el);
    // D-084: clipped transition profiles are not in the physics (plan 0003); the unclipped shape of
    // the same length and radii is used and listed.
    if (shape !== 'conical' && el.has('shapeclipped') && el.boolean('shapeclipped')) {
      this.note(el, {
        what: `its clipped ${shape} profile`,
        method: `the unclipped ${shape} profile of the same length and end radii`,
        effect: 'the transition’s outline, and so its mass, drag and lift, differ slightly',
        impact: 'moderate',
      });
    } else if (el.has('shapeclipped')) {
      el.boolean('shapeclipped');
    }
    const length = el.number('length');
    const foreRadius = el.length('foreradius');
    const aftRadius = el.length('aftradius');
    const thickness = el.thickness('thickness');
    const shoulders = (['fore', 'aft'] as const).map((side) => ({
      side,
      ...readShoulder(el, side),
    }));
    this.maxBodyRadius = Math.max(this.maxBodyRadius, foreRadius, aftRadius);
    this.place(
      el,
      {
        kind: 'transition',
        shape,
        length: metres(length),
        foreRadius: metres(foreRadius),
        aftRadius: metres(aftRadius),
        ...(shapeParameter === undefined ? {} : { shapeParameter }),
        ...(thickness === 'filled' ? {} : { wallThickness: metres(thickness) }),
        density: el.bulkDensity(),
      },
      x,
    );
    // D-084: a transition shoulder is a tube of the shoulder's radius, length and wall beyond each
    // end, with a cap disc when capped: the nose cone rule of D-078, which OpenRocket gives
    // transitions too (reference/rockets/transition-shoulder-probe/values.txt: fore 3.7605 g, cap
    // 1.7241 g at 0.0295 m ahead, aft with cap 2.1749 g).
    // OpenRocket's override would cover the shoulders, which are separate parts here (as for caps).
    if (
      shoulders.some((s) => s.shoulder !== undefined) &&
      (el.has('overridemass') || el.has('overridecg'))
    ) {
      throw el.unsupported('a mass or CG override on a transition with shoulders');
    }
    for (const { side, shoulder, capped } of shoulders) {
      if (shoulder === undefined) continue;
      const fore = side === 'fore' ? x - (shoulder.length as number) : x + length;
      this.components.push({
        name: `${el.optionalText('name') ?? ''} (${side} shoulder)`,
        element: 'transitionshoulder',
        component: {
          kind: 'innerTube',
          length: shoulder.length,
          outerRadius: shoulder.radius,
          wallThickness: shoulder.wallThickness,
          density: el.bulkDensity(),
        },
        position: metres(fore),
      });
      if (capped)
        this.placeShoulderCap(
          el,
          shoulder,
          side === 'fore' ? fore : x + length + (shoulder.length as number),
          side,
        );
    }
    this.finishPart(el, [...IGNORED_COMMON]);
    return x + length;
  }

  private readBodyTube(el: Element, x: number): number {
    const length = el.number('length');
    const radius = el.length('radius');
    this.maxBodyRadius = Math.max(this.maxBodyRadius, radius);
    const index = this.place(
      el,
      {
        kind: 'bodyTube',
        length: metres(length),
        outerRadius: metres(radius),
        wallThickness: metres(el.number('thickness')),
        density: el.bulkDensity(),
      },
      x,
    );
    this.readMotorMount(el, index, x + length);
    const sub = el.optionalChild('subcomponents');
    if (sub !== undefined) {
      // D-080: an automatic outer radius inside a body tube is the tube's inner radius.
      const inner = radius - el.number('thickness');
      const parent: Parent = { position: x, length, radius, autoOuterRadius: () => inner };
      this.readInternal(sub, { ...parent, innerTubes: innerTubeSpans(sub, parent) });
    }
    this.finishPart(el, [...IGNORED_COMMON]);
    return x + length;
  }

  readRocket(root: Element): OrkRocket {
    const version = root.attribute('version') ?? '';
    if (!version.startsWith('1.')) throw root.unsupported(`format version "${version}"`);
    const rocket = root.child('rocket');
    root.finish(['simulations', 'photostudio', 'docprefs']);

    rocket.requireValue(
      'referencetype',
      'maximum',
      'reference length other than the maximum body diameter',
    );
    // D-077: OpenRocket simulates the configuration marked default="true" (config-probe case 3).
    const configs = rocket.all('motorconfiguration');
    if (configs.length > 0) {
      const defaults = configs.filter((c) => c.attributes['default'] === 'true');
      if (defaults.length > 1) {
        throw rocket.unsupported(
          `${String(configs.length)} motor configurations with ${String(defaults.length)} marked as the default`,
        );
      }
      const selected = configs.length === 1 ? configs[0] : defaults[0];
      if (selected === undefined) {
        // With none marked, OpenRocket opens the file in its own empty configuration: no motor, and
        // every parachute on its own deployment elements (D-078, SelProbe on "Base drag hack").
        this.selectedConfig = NO_CONFIGURATION;
        this.notices.push(
          `This file has ${String(configs.length)} motor configurations and none is marked as the default, so OpenRocket opens it with no motor selected, and so does this import: choose a motor in the motor panel.`,
        );
      } else {
        this.selectedConfig = selected.attributes['configid'];
      }
      if (selected !== undefined && configs.length > 1) {
        this.notices.push(
          `This file has ${String(configs.length)} motor configurations; the default one, the configuration OpenRocket opens with, was imported. To use another, make it the default in OpenRocket and import again, or choose the motor here.`,
        );
      }
    }
    const offset = rocket.optional('axialoffset');
    if (offset !== undefined && Number(offset.text) !== 0) {
      throw rocket.unsupported('a rocket axial offset');
    }
    rocket.optional('position');
    const subcomponents = rocket.child('subcomponents');
    const stages = subcomponents.all('stage');
    const [stage] = stages;
    if (stage === undefined || stages.length !== 1) {
      throw rocket.unsupported(`${String(stages.length)} stages`);
    }
    this.readStage(subcomponents.wrap(stage));
    subcomponents.finish([]);
    rocket.finish([...IGNORED_COMMON, 'designtype', 'revision', 'designer']);

    if (this.problems.length > 0) throw new OrkUnsupportedFeaturesError(root.file, this.problems);
    if (this.components.length === 0) throw rocket.parseError('the rocket has no components');
    return {
      name: rocket.optionalText('name') ?? '',
      formatVersion: version,
      creator: root.attribute('creator'),
      components: this.components,
      length: metres(this.length),
      maxBodyRadius: metres(this.maxBodyRadius),
      motorMount: this.motorMount,
      recoveryDevices: this.recoveryDevices,
      approximations: this.approximations,
      ...(this.asBuilt === undefined ? {} : { asBuilt: this.asBuilt }),
      notices: this.notices,
    };
  }
}

/**
 * Parse an OpenRocket design: the zip container (entry `rocket.ork`) or the
 * bare XML. Throws `OrkParseError` for malformed input and
 * `OrkUnsupportedError` for anything outside the minimal reader's scope.
 */
export function parseOrk(data: Uint8Array | string, fileName?: string): OrkRocket {
  const xml = toXmlText(data, fileName);
  const root = parseXml(xml, fileName);
  return new Reader().readRocket(new Element(root, 'openrocket', fileName));
}
