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
  seconds,
  type Component,
  type KilogramsPerCubicMetre,
  type MassOverride,
  type Metres,
  type NoseShape,
  type PlacedComponent,
  type Seconds,
  type Shoulder,
} from '@lo-fi-rocket/physics';
import { OrkParseError, OrkUnsupportedError } from './errors.js';
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
  /** Ejection delay as written in the file. */
  readonly delay: Seconds;
  /** Aft end of the motor from the nose tip: the mount's aft end plus the overhang. */
  readonly aftEnd: Metres;
  /** Index into `components` of the tube that is the mount. */
  readonly mountComponent: number;
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
   * Every child must have been read or be on the ignore list; anything else
   * is rejected by name. Override elements get a specific message.
   */
  finish(ignored: readonly string[]): void {
    for (const c of this.node.children) {
      if (this.used.has(c.name) || ignored.includes(c.name)) continue;
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
function readMassOverride(el: Element, massIsComponentMass: boolean): MassOverride | undefined {
  if (el.has('overridecd')) throw el.unsupported('drag coefficient override (<overridecd>)');
  if (el.has('overridesubcomponentscd') && el.boolean('overridesubcomponentscd')) {
    throw el.unsupported('drag coefficient override of subcomponents (<overridesubcomponentscd>)');
  }
  const children = el.node.children.find((c) => c.name === 'subcomponents')?.children ?? [];
  for (const flag of [
    'overridesubcomponents',
    'overridesubcomponentsmass',
    'overridesubcomponentscg',
  ]) {
    if (el.has(flag) && el.boolean(flag) && children.length > 0) {
      throw el.unsupported(
        `a mass or CG override that includes the subcomponents (<${flag}> true on a component with subcomponents); set the override on the component alone, or override each subcomponent`,
      );
    }
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
  /** The `configid` of the motor configuration OpenRocket selects (D-077); undefined with no configurations. */
  private selectedConfig: string | undefined;

  private place(el: Element, component: Component, position: number): number {
    const massOverride = readMassOverride(el, component.kind === 'parachute');
    this.components.push({
      name: el.optionalText('name') ?? '',
      element: el.node.name,
      component,
      position: metres(position),
      ...(massOverride === undefined ? {} : { massOverride }),
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
    motor.requireValue('type', 'single', 'motor type other than "single"');
    this.motorMount = {
      designation: motor.text('designation'),
      manufacturer: motor.text('manufacturer'),
      diameter: metres(motor.number('diameter')),
      length: metres(motor.number('length')),
      delay: seconds(motor.number('delay')),
      aftEnd: metres(aftEndOfMount + overhang),
      mountComponent: mountIndex,
    };
    motor.finish(['digest']);
    mount.finish(['ignitionevent', 'ignitiondelay', 'ignitionconfiguration']);
  }

  /** Children of a body tube. */
  private readInternal(subcomponents: Element, parent: Parent): void {
    for (const node of subcomponents.node.children) {
      const el = subcomponents.wrap(node);
      switch (node.name) {
        case 'trapezoidfinset':
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
    el.requireZero('cant', 'canted fins');
    el.requireZero('filletradius', 'fin fillets');
    const crossSection = el.optionalText('crosssection') ?? 'square';
    if (crossSection !== 'square' && crossSection !== 'rounded' && crossSection !== 'airfoil') {
      throw el.unsupported(`fin cross-section "${crossSection}"`);
    }
    if (crossSection !== 'square') {
      // D-077: OpenRocket reduces the volume of rounded and airfoil fins (to 0.99 and 0.85 of the slab,
      // reference/rockets/config-probe/values.txt); no source gives such factors, so the slab is kept.
      this.notices.push(
        `Fin set "${el.optionalText('name') ?? ''}" has ${crossSection} edges. OpenRocket makes such fins ${crossSection === 'rounded' ? '1' : '15'} % lighter than a flat slab of the same outline; this app uses the full slab (area × thickness), so the fins weigh slightly more and the CG sits slightly further aft than in OpenRocket. Use a mass override if you know the real fin mass.`,
      );
    }
    const rootChord = el.number('rootchord');
    const position = axialPosition(el, parent, rootChord);
    this.place(
      el,
      {
        kind: 'finSet',
        crossSection,
        count,
        rootChord: metres(rootChord),
        tipChord: metres(el.number('tipchord')),
        sweep: metres(el.number('sweeplength')),
        span: metres(el.number('height')),
        thickness: metres(el.number('thickness')),
        density: el.bulkDensity(),
        bodyRadius: metres(parent.radius),
      },
      position,
    );
    el.finish([...IGNORED_COMMON, ...IGNORED_ANGULAR, 'filletmaterial']);
  }

  private readLaunchLug(el: Element, parent: Parent): void {
    el.requireValue('instancecount', '1', 'more than one launch lug instance');
    const length = el.number('length');
    const radius = el.number('radius');
    const position = axialPosition(el, parent, length);
    this.place(
      el,
      {
        kind: 'launchLug',
        length: metres(length),
        outerRadius: metres(radius),
        wallThickness: metres(el.number('thickness')),
        density: el.bulkDensity(),
        radialOffset: metres(parent.radius + radius),
      },
      position,
    );
    el.finish([...IGNORED_COMMON, ...IGNORED_ANGULAR, 'instanceseparation']);
  }

  private readRailButton(el: Element, parent: Parent): void {
    const count = el.integer('instancecount');
    el.requireZero('screwheight', 'rail button screw height');
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
    el.finish([...IGNORED_COMMON, ...IGNORED_ANGULAR]);
  }

  private readInnerTube(el: Element, parent: Parent): void {
    el.requireZero('radialposition', 'radially offset inner tubes');
    el.requireValue('clusterconfiguration', 'single', 'motor clusters');
    const sub = el.optionalChild('subcomponents');
    if (sub !== undefined && sub.node.children.length > 0) {
      throw sub.unsupported('components inside an inner tube');
    }
    const length = el.number('length');
    const position = axialPosition(el, parent, length);
    const index = this.place(
      el,
      {
        kind: 'innerTube',
        length: metres(length),
        outerRadius: metres(el.length('outerradius')),
        wallThickness: metres(el.number('thickness')),
        density: el.bulkDensity(),
      },
      position,
    );
    this.readMotorMount(el, index, position + length);
    el.finish([...IGNORED_COMMON, ...IGNORED_ANGULAR, 'clusterscale', 'clusterrotation']);
  }

  /**
   * A tube coupler (D-079): a thin tube inside the body, read as an inner tube that is not a motor
   * mount; OpenRocket's mass for it is the tube's (reference/rockets/parts-probe/values.txt).
   */
  private readTubeCoupler(el: Element, parent: Parent): void {
    el.requireZero('radialposition', 'radially offset tube couplers');
    const sub = el.optionalChild('subcomponents');
    if (sub !== undefined && sub.node.children.length > 0) {
      throw sub.unsupported('components inside a tube coupler');
    }
    const length = el.number('length');
    this.place(
      el,
      {
        kind: 'innerTube',
        length: metres(length),
        outerRadius: metres(el.length('outerradius')),
        wallThickness: metres(el.number('thickness')),
        density: el.bulkDensity(),
      },
      axialPosition(el, parent, length),
    );
    el.finish([...IGNORED_COMMON, ...IGNORED_ANGULAR]);
  }

  /**
   * An engine block (D-079): a ring of the given outer radius and wall thickness, so its inner
   * radius is the outer radius minus the thickness (parts-probe: 0.0095 and 0.003 give 0.0065).
   */
  private readEngineBlock(el: Element, parent: Parent): void {
    el.requireValue('instancecount', '1', 'more than one engine block instance');
    el.requireZero('radialposition', 'radially offset engine blocks');
    const length = el.number('length');
    const outer = el.length('outerradius');
    const thickness = el.number('thickness');
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
      axialPosition(el, parent, length),
    );
    el.finish([...IGNORED_COMMON, ...IGNORED_ANGULAR, 'instanceseparation']);
  }

  /**
   * A shock cord (D-079): a mass of cord length × line density, packed as a cylinder of the
   * packed length and radius (parts-probe: 1.5 m × 0.005 kg/m = 0.0075 kg at the packed centre).
   */
  private readShockCord(el: Element, parent: Parent): void {
    el.requireZero('radialposition', 'radially offset shock cords');
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
    el.finish([...IGNORED_COMMON, ...IGNORED_ANGULAR]);
  }

  private readRing(el: Element, parent: Parent, kind: 'centeringRing' | 'bulkhead'): void {
    el.requireValue('instancecount', '1', `more than one ${kind} instance`);
    el.requireZero('radialposition', `radially offset ${kind}`);
    const length = el.number('length');
    const position = axialPosition(el, parent, length);
    this.place(
      el,
      {
        kind,
        length: metres(length),
        outerRadius: metres(el.length('outerradius')),
        innerRadius: metres(kind === 'centeringRing' ? el.length('innerradius') : 0),
        density: el.bulkDensity(),
      },
      position,
    );
    el.finish([...IGNORED_COMMON, ...IGNORED_ANGULAR, 'instanceseparation']);
  }

  private readMassComponent(el: Element, parent: Parent): void {
    el.requireZero('radialposition', 'radially offset mass components');
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
    el.finish([...IGNORED_COMMON, ...IGNORED_ANGULAR, 'masscomponenttype']);
  }

  private readParachute(el: Element, parent: Parent): void {
    el.requireZero('radialposition', 'radially offset parachutes');
    if (el.has('overridesubcomponentsmass') && el.boolean('overridesubcomponentsmass')) {
      throw el.unsupported('<overridesubcomponentsmass> true');
    }
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
    const event = deploy.text('deployevent');
    if (!['launch', 'ejection', 'apogee', 'altitude', 'never'].includes(event)) {
      throw deploy.unsupported(`deployment event "${event}"`);
    }
    const cdText = el.text('cd');
    if (cdText === 'auto') {
      // D-079 (the owner's choice): OpenRocket's automatic parachute C_D, 0.8 (parts-probe), an
      // OpenRocket default with no approved source, used and stated.
      this.notices.push(
        `Parachute "${el.optionalText('name') ?? ''}" uses OpenRocket's automatic drag coefficient, 0.8. That is OpenRocket's default, not a measured value for this canopy; enter the maker's figure if you have it.`,
      );
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
    el.finish([
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
    }
    this.length = x;
    stage.finish([...IGNORED_COMMON]);
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
    if (sub !== undefined) this.readNoseInternal(sub, { position: x, length, radius: baseRadius });
    el.finish([...IGNORED_COMMON]);
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
  private readNoseInternal(subcomponents: Element, parent: Parent): void {
    for (const node of subcomponents.node.children) {
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
          throw el.unsupported(`element <${node.name}> inside a nose cone`);
      }
    }
  }

  private readTransition(el: Element, x: number): number {
    // Clipped transitions are not implemented in the physics package (plan 0003).
    if (el.has('shapeclipped') && el.boolean('shapeclipped')) {
      throw el.unsupported('clipped transitions');
    }
    const { shape, shapeParameter } = readShape(el);
    const length = el.number('length');
    const foreRadius = el.length('foreradius');
    const aftRadius = el.length('aftradius');
    const thickness = el.thickness('thickness');
    for (const prefix of ['fore', 'aft'] as const) {
      const fields = ['radius', 'length', 'thickness'].map((f) =>
        el.number(`${prefix}shoulder${f}`),
      );
      if (fields.some((v) => v !== 0)) throw el.unsupported('transition shoulders');
      if (el.boolean(`${prefix}shouldercapped`)) throw el.unsupported(`capped ${prefix} shoulder`);
    }
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
    el.finish([...IGNORED_COMMON]);
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
    if (sub !== undefined) this.readInternal(sub, { position: x, length, radius });
    el.finish([...IGNORED_COMMON]);
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
    rocket.finish([...IGNORED_COMMON, 'designtype', 'revision']);

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
