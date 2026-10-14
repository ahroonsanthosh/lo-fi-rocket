/**
 * RASAero II `.CDX1` design files (plan 0075, CLAUDE.md 6.7 item 3, D-114).
 *
 * The format is undocumented. What is read here is what RASAero II 1.0.2.0's own files contain
 * (`<RASAeroDocument>`, `FileVersion` 2; the 24 example designs it ships), with the meanings its
 * user's manual gives: inches, pounds, feet, °F and mph; fins placed by their "distance from the
 * base of the tube" (manual p. 13); two rail guides of the given size (p. 19); surface finishes
 * as equivalent sand roughness (Table 1, p. 52); a standard-day pressure at the launch site's
 * elevation unless a barometric pressure is given (p. 79).
 *
 * A RASAero file gives no part masses, only the launch weight and CG with the motor. The design
 * takes them as its as-built mass and CG (D-089) less the library's motor of that name; the
 * parts are nominal thin shells that only carry the inertias. Every such choice is listed (rule 3).
 */
import {
  degreesToRadians,
  fahrenheitToKelvin,
  feetToMetres,
  inchesToMetres,
  kilograms,
  kilogramsPerCubicMetre,
  metres,
  metresPerSecond,
  milesPerHourToMetresPerSecond,
  motorStateAt,
  poundsToKilograms,
  radians,
  seconds,
  standardAtmosphere1976,
  type Approximation,
  type Component,
  type FinCrossSection,
  type Metres,
  type NoseShape,
  withAsBuilt,
} from '@lo-fi-rocket/physics';
import { newDesign } from './design/example.js';
import type { LibraryMotorRef } from './design/from-ork.js';
import type {
  DesignComponent,
  DesignRecoveryDevice,
  DesignStage,
  MotorMount,
  RocketDesign,
} from './design/model.js';
import { designPlacedComponents } from './design/to-physics.js';
import { FormatError } from './errors.js';
import { MAX_INPUT_BYTES, requireWithin } from './limits.js';
import { NUMBER, parseXmlRoots, XmlSyntaxError, type XmlNode } from './xml.js';

/** A `.CDX1` file that cannot be read at all, with where and what to fix. */
export class Cdx1ParseError extends FormatError {
  constructor(file: string | undefined, where: string, problem: string, options?: ErrorOptions) {
    super(`${file ?? 'RASAero file'}, ${where}: ${problem}`, options);
    this.name = 'Cdx1ParseError';
  }
}

/** RASAero's own results, kept in the file with the design. */
export interface Cdx1Prediction {
  readonly apogee: Metres;
  readonly maxVelocity: number;
  readonly timeToApogee: number;
}

/** How a flown apogee was measured (plan 0080): each has its own errors. */
export type MeasuringInstrument = 'GPS' | 'barometric' | 'accelerometer' | 'optical tracking';

export interface Cdx1Import {
  readonly design: RocketDesign;
  /** What the user should know: the motor taken or missing, what was approximated. */
  readonly notices: readonly string[];
  /** RASAero's predicted apogee (above the pad), maximum velocity and time to apogee, if run. */
  readonly prediction?: Cdx1Prediction;
  /** An apogee measured in flight, when the file's comments give one ("Altitude = 3964 ft"). */
  readonly measuredApogee?: Metres;
  /** Plan 0080: what measured it, as the comments name it. */
  readonly measuredBy?: MeasuringInstrument;
  /** The motor the file names, as "designation (manufacturer)". */
  readonly motorName?: string;
}

/** RASAero II's equivalent sand roughness per finish (manual Table 1 p. 52), inches. */
export const RASAERO_FINISHES: Readonly<Record<string, number>> = {
  'Smooth (Zero Roughness)': 0,
  Polished: 0.00005,
  'Sheet Metal': 0.00016,
  'Smooth Paint': 0.00025,
  'Camouflage Paint': 0.0004,
  'Rough Camouflage Paint': 0.0012,
  'Galvanized Metal': 0.006,
  'Cast Iron (Very Rough)': 0.01,
};

/** Nominal parts: the file gives no masses, so these only shape the inertias (listed). */
const NOMINAL_DENSITY = kilogramsPerCubicMetre(1850);
const NOMINAL_WALL = 0.0015;

class Reader {
  readonly approximations: Approximation[] = [];
  readonly notices: string[] = [];
  constructor(readonly file: string | undefined) {}

  error(where: string, problem: string): Cdx1ParseError {
    return new Cdx1ParseError(this.file, where, problem);
  }
  child(node: XmlNode, name: string): XmlNode | undefined {
    return node.children.find((c) => c.name === name);
  }
  text(node: XmlNode, name: string): string {
    const c = this.child(node, name);
    if (c === undefined) throw this.error(node.name, `missing <${name}>`);
    return c.text.trim();
  }
  optionalText(node: XmlNode, name: string): string | undefined {
    return this.child(node, name)?.text.trim();
  }
  number(node: XmlNode, name: string): number {
    const t = this.text(node, name);
    if (!NUMBER.test(t))
      throw this.error(`${node.name} > ${name}`, `expected a number, received "${t}"`);
    return Number(t);
  }
  optionalNumber(node: XmlNode, name: string): number | undefined {
    return this.child(node, name) === undefined ? undefined : this.number(node, name);
  }
  flag(node: XmlNode, name: string): boolean {
    return this.optionalText(node, name)?.toLowerCase() === 'true';
  }
  note(a: Approximation): void {
    this.approximations.push(a);
  }
}

const inches = (x: number): Metres => inchesToMetres(x);

/** RASAero's nose shapes (manual p. 10) as ours (Niskanen Appendix A). */
function noseShape(
  r: Reader,
  written: string,
): { readonly shape: NoseShape; readonly shapeParameter?: number } {
  switch (written) {
    case 'Conical':
      return { shape: 'conical' };
    case 'Tangent Ogive':
      return { shape: 'ogive', shapeParameter: 1 };
    case 'Von Karman Ogive':
      return { shape: 'haack', shapeParameter: 0 };
    case 'LV-Haack':
      return { shape: 'haack', shapeParameter: 1 / 3 };
    case 'Parabolic':
      return { shape: 'parabolic', shapeParameter: 1 };
    case 'Elliptical':
      return { shape: 'elliptical' };
    case 'Power Law':
      // The exponent's element is not in any file seen; ½ is the usual power-series nose.
      r.note({
        subject: 'Nose cone',
        what: 'the power-law nose’s exponent, which the app cannot read from this file',
        method: 'a power-series nose of exponent ½',
        effect: 'the nose’s shape, and so its drag and CP, may differ a little',
        impact: 'moderate',
      });
      return { shape: 'power', shapeParameter: 0.5 };
    default:
      r.note({
        subject: 'Nose cone',
        what: `the nose shape "${written}", which the app does not know`,
        method: 'a tangent ogive of the same length and diameter',
        effect: 'the nose’s drag and CP may differ',
        impact: 'moderate',
      });
      return { shape: 'ogive', shapeParameter: 1 };
  }
}

/** RASAero's fin sections (manual p. 14) as ours (D-062, D-066). */
function finSection(r: Reader, written: string, subject: string): FinCrossSection {
  switch (written) {
    case 'Square':
      return 'square';
    case 'Rounded':
      return 'rounded';
    case 'NACA':
    case 'Subsonic NACA':
    case 'Biconvex':
      return 'airfoil';
    case 'Double Wedge':
    case 'Double-Wedge':
      return 'double-wedge';
    case 'Single Wedge':
      return 'wedge';
    case 'Hexagonal':
      r.note({
        subject,
        what: 'the hexagonal fin section (bevelled leading and trailing edges, a flat middle)',
        method: 'a double wedge (diamond) of the same thickness: sharp edges, like it',
        effect:
          'subsonic drag alike; the supersonic wave drag is that of a diamond section, which can differ from the hexagon’s',
        impact: 'moderate',
      });
      return 'double-wedge';
    case 'Hexagonal Blunt-Base':
    case 'Hexagonal Blunt Base':
      r.note({
        subject,
        what: 'the hexagonal blunt-base fin section',
        method: 'a single wedge (sharp leading edge, blunt base) of the same thickness',
        effect: 'the supersonic wave drag is that of a wedge, which can differ from the hexagon’s',
        impact: 'moderate',
      });
      return 'wedge';
    default:
      r.note({
        subject,
        what: `the fin section "${written}", which the app does not know`,
        method: 'square-edged flat plates, the most drag',
        effect: 'the fin drag is likely a little high: the apogee shown a little low',
        impact: 'moderate',
      });
      return 'square';
  }
}

/** One part of the rocket as it is stacked: its outline, where it is, and its stage. */
interface Placed {
  readonly name: string;
  readonly fore: number;
  readonly component: Component;
  /** 0 for the sustainer, k for the k-th booster below it. */
  readonly stage: number;
}

/** Read a RASAero II `.CDX1` file into a design. */
export function importCdx1(
  text: string,
  library: readonly LibraryMotorRef[],
  id: string,
  fileName?: string,
): Cdx1Import {
  requireWithin(fileName ?? 'The RASAero file', text.length, MAX_INPUT_BYTES);
  const r = new Reader(fileName);
  let roots: XmlNode[];
  try {
    roots = parseXmlRoots(text);
  } catch (error) {
    if (error instanceof XmlSyntaxError) {
      throw new Cdx1ParseError(fileName, 'document', error.message, { cause: error });
    }
    throw error;
  }
  const root = roots.find((n) => n.name === 'RASAeroDocument');
  if (root === undefined) throw r.error('document', 'not a RASAero II file: no <RASAeroDocument>');
  const version = r.optionalText(root, 'FileVersion');
  if (version !== '2') {
    r.notices.push(
      `The file is RASAero format version ${version ?? 'unknown'}; this reader knows version 2 and read what it recognised.`,
    );
  }
  const rocket = r.child(root, 'RocketDesign');
  if (rocket === undefined) throw r.error('RASAeroDocument', 'missing <RocketDesign>');

  const parts: Placed[] = [];
  const extras: DesignComponent[] = [];
  let mainTubeIndex = -1;
  let aft = 0;
  // The stage being read: the sustainer's parts come first, then each booster's (manual p. 39).
  let stage = 0;
  const boosterNodes: XmlNode[] = [];
  const inStage = (from: number): void => {
    for (let i = from; i < extras.length; i++) {
      const e = extras[i];
      if (e !== undefined && stage > 0) extras[i] = { ...e, stage };
    }
  };

  for (const node of rocket.children) {
    const extrasBefore = extras.length;
    switch (node.name) {
      case 'NoseCone': {
        const length = r.number(node, 'Length');
        const radius = r.number(node, 'Diameter') / 2;
        const { shape, shapeParameter } = noseShape(r, r.text(node, 'Shape'));
        const blunt = r.optionalNumber(node, 'BluntRadius') ?? 0;
        if (blunt > 0) {
          r.note({
            subject: 'Nose cone',
            what: `the blunt (spherical) tip of ${String(blunt)} in radius`,
            method: 'a pointed tip of the same shape, length and diameter',
            effect: 'a blunt tip adds a little pressure drag, mostly above Mach 1',
            impact: 'minor',
          });
        }
        const fore = r.number(node, 'Location');
        parts.push({
          name: 'Nose cone',
          fore,
          stage,
          component: {
            kind: 'noseCone',
            shape,
            ...(shapeParameter === undefined ? {} : { shapeParameter }),
            length: inches(length),
            baseRadius: inches(radius),
            wallThickness: metres(Math.min(NOMINAL_WALL, inches(radius) / 2)),
            density: NOMINAL_DENSITY,
          },
        });
        aft = Math.max(aft, fore + length);
        break;
      }
      case 'BodyTube': {
        const fore = r.number(node, 'Location');
        const length = r.number(node, 'Length');
        const radius = r.number(node, 'Diameter') / 2;
        mainTubeIndex = parts.length;
        parts.push({ name: 'Body tube', fore, stage, component: tube(length, radius) });
        aft = Math.max(aft, fore + length);
        readFins(r, node, fore + length, radius, 'Fins', extras);
        readGuides(r, node, fore, length, radius, extras);
        break;
      }
      case 'BoatTail': {
        const fore = r.number(node, 'Location');
        const length = r.number(node, 'Length');
        parts.push({
          name: 'Boat tail',
          fore,
          stage,
          component: {
            kind: 'transition',
            shape: 'conical',
            length: inches(length),
            foreRadius: inches(r.number(node, 'Diameter') / 2),
            aftRadius: inches(r.number(node, 'RearDiameter') / 2),
            wallThickness: metres(NOMINAL_WALL),
            density: NOMINAL_DENSITY,
          },
        });
        aft = Math.max(aft, fore + length);
        break;
      }
      case 'FinCan': {
        // A sleeve over the body's aft end: `Offset` (negative) moves it forward over the tube.
        // Its shoulder is a taper from the body's diameter to its own (exact geometry).
        const fore = r.number(node, 'Location') + (r.optionalNumber(node, 'Offset') ?? 0);
        const length = r.number(node, 'Length');
        const radius = r.number(node, 'Diameter') / 2;
        const inside = (r.optionalNumber(node, 'InsideDiameter') ?? 2 * radius) / 2;
        const shoulder = Math.min(r.optionalNumber(node, 'ShoulderLength') ?? 0, length);
        // The body tube under the can ends where the can begins.
        const main = parts[mainTubeIndex];
        if (main?.component.kind === 'bodyTube') {
          const tubeLength = fore - main.fore;
          if (tubeLength > 0) {
            parts[mainTubeIndex] = {
              ...main,
              component: { ...main.component, length: inches(tubeLength) },
            };
          }
        }
        // A can with no shoulder steps out from the body: a 1 mm taper keeps the outline whole.
        const taper = radius > inside ? (shoulder > 0 ? shoulder : 1 / 25.4) : 0;
        if (taper > 0) {
          if (shoulder === 0) {
            r.note({
              subject: 'Fin can',
              what: 'the step from the body to the larger fin can, with no shoulder',
              method: 'a taper of 1 mm',
              effect: 'a negligible drag difference',
              impact: 'minor',
            });
          }
          parts.push({
            name: 'Fin can shoulder',
            fore,
            stage,
            component: {
              kind: 'transition',
              shape: 'conical',
              length: inches(taper),
              foreRadius: inches(inside),
              aftRadius: inches(radius),
              wallThickness: metres(NOMINAL_WALL),
              density: NOMINAL_DENSITY,
            },
          });
        }
        parts.push({
          name: 'Fin can',
          fore: fore + taper,
          stage,
          component: tube(length - taper, radius),
        });
        aft = Math.max(aft, fore + length);
        readFins(r, node, fore + length, radius, 'Fin can fins', extras);
        readGuides(r, node, fore, length, radius, extras);
        break;
      }
      case 'Booster': {
        // A stage below the ones before it (manual pp. 39 to 46): its own tube, fins and guides,
        // with a conical transition of `ShoulderLength` from the stage above's diameter to its own.
        if (!boosterIncluded(r, root, boosterNodes.length + 1)) {
          r.notices.push(
            `Booster ${String(boosterNodes.length + 1)} is not included in the file’s simulation, so it is left out, as RASAero leaves it out.`,
          );
          break;
        }
        stage = boosterNodes.length + 1;
        boosterNodes.push(node);
        const fore = r.number(node, 'Location');
        const length = r.number(node, 'Length');
        const radius = r.number(node, 'Diameter') / 2;
        const last = parts.reduce<Placed | undefined>(
          (a, p) => (a === undefined || p.fore > a.fore ? p : a),
          undefined,
        );
        const above = last === undefined ? radius : aftRadiusIn(last.component);
        // A nested stage above (manual p. 39): its aft end sits inside the booster's front. Its parts
        // stay whole, so that it flies on alone as it is; the booster's outline starts behind them.
        const start = Math.max(fore, aft);
        if (aft - fore > 1e-9) {
          r.note({
            subject: `Booster ${String(stage)}`,
            what: `the last ${(aft - fore).toFixed(2)} in of the stage above, which nests inside the booster’s front`,
            method:
              'the stage above keeps those parts; the booster’s outline starts where they end, its aft end where the file puts it',
            effect:
              'while stacked the outline shows the nested part instead of the booster’s front: a slightly different friction and CP',
            impact: 'minor',
          });
        }
        const shoulder = Math.min(
          r.optionalNumber(node, 'ShoulderLength') ?? 0,
          fore + length - start,
        );
        const steps = Math.abs(radius - above) > 1e-9;
        const taper = steps ? (shoulder > 0 ? shoulder : 1 / 25.4) : 0;
        if (steps && shoulder === 0) {
          r.note({
            subject: `Booster ${String(stage)}`,
            what: 'the step between the stage above and the booster, with no transition length',
            method: 'a taper of 1 mm',
            effect: 'a negligible drag difference',
            impact: 'minor',
          });
        }
        if (taper > 0) {
          parts.push({
            name: `Booster ${String(stage)} transition`,
            fore: start,
            stage,
            component: {
              kind: 'transition',
              shape: 'conical',
              length: inches(taper),
              foreRadius: inches(above),
              aftRadius: inches(radius),
              wallThickness: metres(NOMINAL_WALL),
              density: NOMINAL_DENSITY,
            },
          });
        }
        mainTubeIndex = parts.length;
        parts.push({
          name: `Booster ${String(stage)} tube`,
          fore: start + taper,
          stage,
          component: tube(fore + length - start - taper, radius),
        });
        aft = Math.max(aft, fore + length);
        readFins(r, node, fore + length, radius, `Booster ${String(stage)} fins`, extras);
        readGuides(r, node, start, fore + length - start, radius, extras);
        break;
      }
      default:
        break;
    }
    inStage(extrasBefore);
  }
  if (parts.length === 0) throw r.error('RocketDesign', 'no nose cone or body tube');

  // The design's parts in stacking order, then the fins, guides and lugs.
  parts.sort((a, b) => a.fore - b.fore);
  const components: DesignComponent[] = [
    ...parts.map((p, i) => ({
      id: `cdx-${String(i)}`,
      name: p.name,
      position: inches(p.fore),
      component: p.component,
      ...(p.stage === 0 ? {} : { stage: p.stage }),
    })),
    ...extras.map((e, i) => ({ ...e, id: `cdx-x${String(i)}` })),
  ];

  // Surface finish: the class's equivalent sand roughness, as R_s (D-110).
  const surface = r.optionalText(rocket, 'Surface') ?? 'Smooth (Zero Roughness)';
  let roughness = RASAERO_FINISHES[surface];
  if (roughness === undefined) {
    r.note({
      subject: 'Design',
      what: `the surface finish "${surface}", which the app does not know`,
      method: 'regular paint, 60 µm',
      effect: 'the skin friction may be higher or lower',
      impact: 'moderate',
    });
    roughness = 60e-6 / 0.0254;
  }
  if (r.flag(rocket, 'ModifiedBarrowman')) {
    r.notices.push(
      'The file asks for RASAero’s Rogers-modified Barrowman CP; this app uses its own methods (Barrowman and Niskanen).',
    );
  }
  const nozzle = r.optionalNumber(rocket, 'SustainerNozzle') ?? 0;
  if (nozzle > 0) {
    r.note({
      subject: 'Design',
      what: `the motor’s nozzle exit diameter (${String(nozzle)} in), which RASAero uses for the base drag and the thrust at altitude`,
      method: 'not used: the base drag takes the motor’s own diameter, the thrust as measured',
      effect: 'a small difference in the base drag while the motor burns',
      impact: 'minor',
    });
  }

  const site = r.child(root, 'LaunchSite');
  const siteAltitude = site === undefined ? 0 : feetToMetres(r.number(site, 'Altitude'));
  const temperatureF = site === undefined ? undefined : r.optionalNumber(site, 'Temperature');
  const pressure = site === undefined ? 0 : (r.optionalNumber(site, 'Pressure') ?? 0);
  if (pressure > 0) {
    r.note({
      subject: 'Launch site',
      what: `the barometric pressure (${String(pressure)} inHg)`,
      method: 'the standard day’s pressure at the site’s elevation',
      effect: 'the air density differs by the pressure’s difference from the standard day',
      impact: 'minor',
    });
  }
  const temperature =
    temperatureF === undefined || temperatureF === 0 ? undefined : fahrenheitToKelvin(temperatureF);
  const rodLength = site === undefined ? 1.5 : feetToMetres(r.number(site, 'RodLength'));
  const rodAngle = site === undefined ? radians(0) : degreesToRadians(r.number(site, 'RodAngle'));
  const windMph = site === undefined ? 0 : (r.optionalNumber(site, 'WindSpeed') ?? 0);

  // Recovery: up to two devices, each with its event, size (diameter, in) and C_D.
  const recovery: DesignRecoveryDevice[] = [];
  const rec = r.child(root, 'Recovery');
  if (rec !== undefined) {
    for (const k of [1, 2]) {
      if (!r.flag(rec, `Event${String(k)}`)) continue;
      const type = r.optionalText(rec, `DeviceType${String(k)}`) ?? 'None';
      const event = r.optionalText(rec, `EventType${String(k)}`) ?? 'None';
      if (type === 'None' || event === 'None') continue;
      const size = r.number(rec, `Size${String(k)}`);
      const cd = r.number(rec, `CD${String(k)}`);
      recovery.push({
        id: `cdx-recovery-${String(k)}`,
        name: k === 1 ? 'Parachute' : 'Main parachute',
        diameter: inches(size),
        dragCoefficient: cd,
        deploy:
          event === 'Altitude'
            ? {
                event: 'altitude',
                altitude: feetToMetres(r.number(rec, `Altitude${String(k)}`)),
                delay: seconds(0),
              }
            : { event: 'apogee', delay: seconds(0) },
      });
    }
  }

  // The simulation RASAero ran: each stage's motor, lift-off weight and CG, and its results.
  const simulation = r.child(r.child(root, 'SimulationList') ?? root, 'Simulation');
  const stageCount = boosterNodes.length + 1;
  const prefix = (k: number): string => (k === 0 ? 'Sustainer' : `Booster${String(k)}`);
  const simText = (name: string): string | undefined =>
    simulation === undefined ? undefined : r.optionalText(simulation, name);
  const simNumber = (name: string): number | undefined =>
    simulation === undefined ? undefined : r.optionalNumber(simulation, name);

  interface StageMotor {
    readonly engine: string | undefined;
    readonly match: LibraryMotorRef | undefined;
    readonly holder: DesignComponent | undefined;
    readonly holderAft: number;
    readonly motorAft: number;
  }
  const stageMotors: StageMotor[] = [];
  for (let k = 0; k < stageCount; k++) {
    const own = components.filter((c) => (c.stage ?? 0) === k);
    const outline = own.filter(
      (c) => c.component.kind === 'bodyTube' || c.component.kind === 'transition',
    );
    const aftOf = (c: DesignComponent): number =>
      c.position +
      (c.component.kind === 'bodyTube' ||
      c.component.kind === 'transition' ||
      c.component.kind === 'noseCone'
        ? (c.component.length as number)
        : 0);
    const stageAft = own.reduce((a, c) => Math.max(a, aftOf(c)), 0);
    // The motor sits in the stage's last tube, its aft end at the stage's aft end plus the overhang.
    const holder =
      [...own].reverse().find((c) => c.component.kind === 'bodyTube') ?? outline.at(-1);
    const overhangNode = k === 0 ? r.child(rocket, 'BodyTube') : boosterNodes[k - 1];
    const overhang = inches(
      overhangNode === undefined ? 0 : (r.optionalNumber(overhangNode, 'Overhang') ?? 0),
    );
    const engine = simText(`${prefix(k)}Engine`);
    const match = engine === undefined ? undefined : findMotor(r, library, engine);
    stageMotors.push({
      engine,
      match,
      holder,
      holderAft: holder === undefined ? 0 : aftOf(holder),
      motorAft: stageAft + (overhang as number),
    });
    const which = stageCount === 1 ? '' : k === 0 ? ' (sustainer)' : ` (booster ${String(k)})`;
    if (match === undefined) {
      r.notices.push(
        engine === undefined
          ? `The file names no motor${which}: choose one in the motor panel.`
          : `The file names the motor ${engine.replace(/\s+/g, ' ')}${which}, which is not in the library: choose it in the motor panel.`,
      );
    } else {
      r.notices.push(
        `Motor ${match.definition.manufacturer} ${match.definition.designation}${which} taken from the library.`,
      );
    }
  }
  const engine = stageMotors[0]?.engine;

  // Masses (D-089). Each stage's lift-off weight and CG in the file include the stages above it
  // (RASAero's flight output starts the two-stage AeroPac example at the booster's 61 lb and
  // 77.5 in, then carries on with the sustainer's 22.79 lb). A stage's own parts are its weight
  // less the stages above and less its motor; they are scaled to that mass and CG (GEO-17).
  interface StageMass {
    readonly mass: number;
    readonly cg: number;
  }
  const stageMasses: (StageMass | undefined)[] = [];
  let above: { readonly weight: number; readonly moment: number } | undefined = {
    weight: 0,
    moment: 0,
  };
  for (let k = 0; k < stageCount; k++) {
    const w = simNumber(`${prefix(k)}LaunchWt`);
    const cgIn = simNumber(`${prefix(k)}CG`);
    const sm = stageMotors[k];
    if (
      above === undefined ||
      w === undefined ||
      !(w > 0) ||
      cgIn === undefined ||
      !(cgIn > 0) ||
      sm?.match === undefined
    ) {
      stageMasses.push(undefined);
      above =
        w !== undefined && w > 0 && cgIn !== undefined && cgIn > 0
          ? { weight: poundsToKilograms(w), moment: poundsToKilograms(w) * inchesToMetres(cgIn) }
          : undefined;
      continue;
    }
    const total = poundsToKilograms(w) as number;
    const moment = total * (inchesToMetres(cgIn) as number);
    const motor = motorStateAt(sm.match.definition, seconds(0));
    const motorCg =
      sm.motorAft - (sm.match.definition.length as number) + (motor.cgFromForeEnd as number);
    const m = total - above.weight - (motor.mass as number);
    stageMasses.push(
      m > 0
        ? { mass: m, cg: (moment - above.moment - (motor.mass as number) * motorCg) / m }
        : undefined,
    );
    above = { weight: total, moment };
  }

  let asBuilt: RocketDesign['asBuilt'];
  const weighed = stageMasses.filter((x) => x !== undefined).length;
  if (stageCount === 1) {
    const one = stageMasses[0];
    if (one !== undefined) asBuilt = { mass: kilograms(one.mass), cg: metres(one.cg) };
  } else {
    // GEO-17 per stage: the stage's parts scaled to its own mass and CG, kept as their overrides.
    const placed = designPlacedComponents({
      ...newDesign(id, 'stages'),
      components,
    });
    for (let k = 0; k < stageCount; k++) {
      const target = stageMasses[k];
      if (target === undefined) continue;
      const indices = components.flatMap((c, i) => ((c.stage ?? 0) === k ? [i] : []));
      const scaled = withAsBuilt(
        indices.flatMap((i) => {
          const pc = placed[i];
          return pc === undefined ? [] : [pc];
        }),
        { mass: kilograms(target.mass), cg: metres(target.cg) },
      );
      indices.forEach((i, j) => {
        const c = components[i];
        const o = scaled[j]?.massOverride;
        if (c !== undefined && o !== undefined) components[i] = { ...c, massOverride: o };
      });
    }
  }
  if (simNumber('SustainerLaunchWt') !== undefined) {
    const all = weighed === stageCount;
    r.note({
      subject: 'Design',
      what: 'the parts’ masses, which a RASAero file does not give',
      method: all
        ? stageCount === 1
          ? 'nominal thin fibreglass parts, scaled to the file’s launch weight and CG less the motor (the as-built mass and CG)'
          : 'nominal thin fibreglass parts, each stage’s scaled to its own lift-off weight and CG less the stages above and its motor'
        : 'nominal thin fibreglass parts (choose the motor, then enter the launch weight less the motor as the as-built mass)',
      effect: all
        ? 'the mass and CG are the file’s; the inertias are those of the nominal parts, which change only how the rocket oscillates'
        : 'the mass and CG are not the file’s until the motor is chosen and the as-built mass entered',
      impact: all ? 'minor' : 'major',
    });
  }

  // Staging (manual p. 103): a booster separates its separation delay after its burnout; the
  // stage above lights its ignition delay after that.
  const stages: DesignStage[] = [];
  if (stageCount > 1) {
    for (let k = 0; k < stageCount; k++) {
      const name = k === 0 ? 'Sustainer' : `Booster ${String(k)}`;
      if (k === 0) {
        stages.push({ name });
        continue;
      }
      const delay = simNumber(`${prefix(k)}SeparationDelay`) ?? simNumber(`${prefix(k)}Delay`) ?? 0;
      stages.push({ name, separation: { event: 'burnout', delay: seconds(delay) } });
    }
    if (stageCount > 2) {
      r.note({
        subject: 'Design',
        what: 'the delays of a three-stage stack, whose names in the file the app reads as a two-stage stack’s',
        method:
          'each booster separates its separation delay after its burnout; each stage above lights its ignition delay after that',
        effect: 'the staging times may differ from RASAero’s if the file means otherwise',
        impact: 'moderate',
      });
    }
  } else if ((simNumber('SustainerIgnitionDelay') ?? 0) > 0) {
    r.notices.push(
      'The file gives the sustainer an ignition delay, which applies only with a booster; the motor lights at launch.',
    );
  }
  const mounts: MotorMount[] = [];
  stageMotors.forEach((sm, k) => {
    if (sm.holder === undefined) return;
    const below = k + 1 < stageCount;
    const ignitionDelay =
      (simNumber(`${prefix(k)}IgnitionDelay`) ?? 0) +
      (simNumber(`${prefix(k + 1)}SeparationDelay`) ?? simNumber(`${prefix(k + 1)}Delay`) ?? 0);
    mounts.push({
      componentId: sm.holder.id,
      overhang: metres(sm.motorAft - sm.holderAft),
      ...(sm.match === undefined
        ? {}
        : { motor: { definition: sm.match.definition, provenance: sm.match.provenance } }),
      ...(below ? { ignition: { event: 'burnout', delay: seconds(ignitionDelay) } } : {}),
    });
  });
  const mount = mounts[0];

  const base = newDesign(id, fileName?.replace(/\.cdx1$/i, '') ?? 'RASAero design');
  const design: RocketDesign = {
    ...base,
    components,
    ...(mount === undefined ? {} : { motorMount: mount }),
    ...(mounts.length > 1 ? { additionalMotorMounts: mounts.slice(1) } : {}),
    ...(stages.length > 1 ? { stages } : {}),
    recovery,
    finish: { roughnessHeight: inches(roughness) },
    ...(asBuilt === undefined ? {} : { asBuilt }),
    ...(r.approximations.length === 0 ? {} : { approximations: r.approximations }),
    launch: {
      site: {
        altitude: metres(siteAltitude),
        ...(temperature === undefined
          ? {}
          : {
              temperature,
              // RASAero's standard day at the elevation (manual p. 79), with the site temperature.
              pressure: standardAtmosphere1976(metres(siteAltitude)).pressure,
            }),
      },
      rail: { length: metres(rodLength), angleFromVertical: rodAngle, azimuth: radians(0) },
      // A positive RASAero wind is a headwind: from the direction the rail leans towards.
      wind: {
        speed: metresPerSecond(Math.abs(milesPerHourToMetresPerSecond(windMph))),
        from: radians(windMph >= 0 ? 0 : Math.PI),
      },
    },
  };

  const apogeeFt =
    simulation === undefined ? undefined : r.optionalNumber(simulation, 'MaxAltitude');
  const prediction: Cdx1Prediction | undefined =
    simulation === undefined || apogeeFt === undefined || apogeeFt <= 0
      ? undefined
      : {
          apogee: feetToMetres(apogeeFt),
          maxVelocity: feetToMetres(r.optionalNumber(simulation, 'MaxVelocity') ?? 0),
          timeToApogee: r.optionalNumber(simulation, 'TimetoApogee') ?? 0,
        };
  const comments = r.optionalText(rocket, 'Comments') ?? '';
  const measured = measuredApogee(comments);
  const instrument = measured === undefined ? undefined : measuringInstrument(comments);
  if (r.approximations.length > 0) {
    const major = r.approximations.filter((a) => a.impact === 'major').length;
    const n = r.approximations.length;
    r.notices.push(
      `${String(n)} part${n === 1 ? '' : 's'} or setting${n === 1 ? ' is' : 's are'} approximated${major === 0 ? '' : `, ${String(major)} in a way that can change the results a lot`}; each is listed with the flight results.`,
    );
  }
  return {
    design,
    notices: r.notices,
    ...(prediction === undefined ? {} : { prediction }),
    ...(measured === undefined ? {} : { measuredApogee: measured }),
    ...(instrument === undefined ? {} : { measuredBy: instrument }),
    ...(engine === undefined ? {} : { motorName: engine.replace(/\s+/g, ' ') }),
  };
}

/** RASAero's manufacturer abbreviations (its `rasp.eng`) and the names a library may use instead. */
const MANUFACTURER_NAMES: Readonly<Record<string, readonly string[]>> = {
  at: ['aerotech'],
  cti: ['cesaroni'],
  ces: ['cesaroni'],
  lok: ['loki'],
  ac: ['animal motor works'],
  amw: ['animal motor works'],
  ex: ['experimental'],
};

/**
 * "I205  (CTI)": the designation and the manufacturer, matched in the library; by the designation
 * alone when the manufacturer's name differs but only one motor has it.
 */
function findMotor(
  r: Reader,
  library: readonly LibraryMotorRef[],
  engine: string,
): LibraryMotorRef | undefined {
  const parsed = /^(\S+)\s*\(([^)]*)\)\s*$/.exec(engine);
  const designation = (parsed?.[1] ?? engine).toLowerCase();
  const manufacturer = parsed?.[2]?.trim().toLowerCase() ?? '';
  const names = [manufacturer, ...(MANUFACTURER_NAMES[manufacturer] ?? [])];
  const named = library.filter((m) => m.definition.designation.toLowerCase() === designation);
  const exact = named.find((m) => {
    const made = m.definition.manufacturer.toLowerCase();
    return (
      manufacturer === '' ||
      names.some((n) => n !== '' && (made.startsWith(n) || n.startsWith(made)))
    );
  });
  if (exact !== undefined) return exact;
  const only = named.length === 1 ? named[0] : undefined;
  if (only !== undefined) {
    r.notices.push(
      `The motor ${engine.replace(/\s+/g, ' ')} was matched by its designation alone, to ${only.definition.manufacturer} ${only.definition.designation}: check it is the same motor.`,
    );
  }
  return only;
}

/** Whether the file's simulation flies booster k (absent flags mean it does). */
function boosterIncluded(r: Reader, root: XmlNode, k: number): boolean {
  const rocket = r.child(root, 'RocketDesign');
  const use = rocket === undefined ? undefined : r.optionalText(rocket, `UseBooster${String(k)}`);
  const simulation = r.child(r.child(root, 'SimulationList') ?? root, 'Simulation');
  const include =
    simulation === undefined ? undefined : r.optionalText(simulation, `IncludeBooster${String(k)}`);
  return use?.toLowerCase() !== 'false' && include?.toLowerCase() !== 'false';
}

/** A body part's aft radius, inches; 0 for a part that is not on the outline. */
function aftRadiusIn(c: Component): number {
  if (c.kind === 'noseCone') return (c.baseRadius as number) / 0.0254;
  if (c.kind === 'bodyTube') return (c.outerRadius as number) / 0.0254;
  if (c.kind === 'transition') return (c.aftRadius as number) / 0.0254;
  return 0;
}

function tube(lengthIn: number, radiusIn: number): Component {
  return {
    kind: 'bodyTube',
    length: inches(lengthIn),
    outerRadius: inches(radiusIn),
    wallThickness: metres(Math.min(NOMINAL_WALL, inches(radiusIn) / 2)),
    density: NOMINAL_DENSITY,
  };
}

/** A part's fins, placed by their distance from the part's aft end (manual p. 13). */
function readFins(
  r: Reader,
  node: XmlNode,
  partAftIn: number,
  radiusIn: number,
  name: string,
  out: DesignComponent[],
): void {
  const fin = r.child(node, 'Fin');
  if (fin === undefined) return;
  const count = r.number(fin, 'Count');
  if (!(count >= 1)) return;
  const thickness = r.number(fin, 'Thickness');
  const le = r.optionalNumber(fin, 'LERadius') ?? 0;
  const section = finSection(r, r.text(fin, 'AirfoilSection'), name);
  if (le > 0 && section === 'rounded') {
    r.notices.push(
      `${name}: the leading-edge radius (${String(le)} in) is not used; rounded edges are taken as half the thickness.`,
    );
  }
  out.push({
    id: '',
    name,
    position: inches(partAftIn - r.number(fin, 'Location')),
    component: {
      kind: 'finSet',
      count: Math.round(count),
      rootChord: inches(r.number(fin, 'Chord')),
      tipChord: inches(r.number(fin, 'TipChord')),
      sweep: inches(r.number(fin, 'SweepDistance')),
      span: inches(r.number(fin, 'Span')),
      thickness: inches(thickness),
      density: NOMINAL_DENSITY,
      bodyRadius: inches(radiusIn),
      crossSection: section,
    },
  });
}

/** Rail guides (two, manual p. 19), a launch lug and a launch shoe on a part. */
function readGuides(
  r: Reader,
  node: XmlNode,
  foreIn: number,
  lengthIn: number,
  radiusIn: number,
  out: DesignComponent[],
): void {
  const guideD = r.optionalNumber(node, 'RailGuideDiameter') ?? 0;
  const guideH = r.optionalNumber(node, 'RailGuideHeight') ?? 0;
  const shoe = r.optionalNumber(node, 'LaunchShoeArea') ?? 0;
  const buttons = (d: number, h: number, what: string): void => {
    out.push({
      id: '',
      name: what,
      position: inches(foreIn + lengthIn / 3),
      component: {
        kind: 'railButton',
        count: 2,
        outerDiameter: inches(d),
        innerDiameter: inches(d),
        totalHeight: inches(h),
        baseHeight: metres(0),
        flangeHeight: metres(0),
        density: kilogramsPerCubicMetre(1420),
        bodyRadius: inches(radiusIn),
        separation: inches(lengthIn / 3),
      },
    });
  };
  if (guideD > 0 && guideH > 0) {
    buttons(guideD, guideH, 'Rail guides');
    r.note({
      subject: 'Rail guides',
      what: 'where the two rail guides sit, which the file does not give',
      method: 'two solid guides of the file’s size at a third and two thirds of their tube',
      effect:
        'their mass is within the launch weight; their drag does not depend on where they are',
      impact: 'minor',
    });
  }
  if (shoe > 0) {
    const side = Math.sqrt(shoe / 2);
    buttons(side, side, 'Launch shoes');
    r.note({
      subject: 'Launch shoes',
      what: `the launch shoe of ${String(shoe)} in² frontal area`,
      method: 'two rail buttons of the same total frontal area',
      effect: 'their drag is a rail button’s for that area, which can differ from a shoe’s',
      impact: 'minor',
    });
  }
  const lugD = r.optionalNumber(node, 'LaunchLugDiameter') ?? 0;
  const lugL = r.optionalNumber(node, 'LaunchLugLength') ?? 0;
  if (lugD > 0 && lugL > 0) {
    const radius = inches(lugD / 2);
    out.push({
      id: '',
      name: 'Launch lug',
      position: inches(foreIn + lengthIn / 2 - lugL / 2),
      component: {
        kind: 'launchLug',
        length: inches(lugL),
        outerRadius: radius,
        wallThickness: metres(Math.min(0.0005, (radius as number) / 2)),
        density: NOMINAL_DENSITY,
        radialOffset: inches(radiusIn + lugD / 2),
      },
    });
    r.note({
      subject: 'Launch lug',
      what: 'the lug’s wall and place, which the file does not give',
      method: 'a 0.5 mm wall, at the middle of its tube',
      effect: 'its drag uses its inner diameter, slightly different from a thicker lug’s',
      impact: 'minor',
    });
  }
}

/** Longest comments line read for a flown apogee: far above any real one. */
const MAX_COMMENT_LINE = 500;

/**
 * The flown apogee the comments give, never RASAero's own prediction (plan 0080). In order: an
 * average of several instruments ("Average of Two Barometric Altimeters = 6188 ft"), the author's
 * final figure ("Final Altitude - GPS Altitude - 42771 ft"), the first "... Altitude = 3964 ft",
 * then "Apogee Altitude 85067 ft".
 */
function measuredApogee(comments: string): Metres | undefined {
  // Notes lines are short; a longer line is not read, so no pattern can run long on hostile text.
  const lines = comments
    .split('\n')
    .filter((l) => l.length <= MAX_COMMENT_LINE && !/predict|rasaero|error/i.test(l));
  const feet = (line: string, pattern: RegExp): number | undefined => {
    const m = pattern.exec(line);
    return m?.[1] === undefined ? undefined : Number(m[1].replace(/,/g, ''));
  };
  const number = '([\\d,]+(?:\\.\\d+)?)\\s*(?:ft|feet)';
  const rules: readonly ((line: string) => number | undefined)[] = [
    (l) => (/average/i.test(l) ? feet(l, new RegExp(`=\\s*${number}`, 'i')) : undefined),
    (l) => feet(l, new RegExp(`final altitude.*?${number}`, 'i')),
    (l) => feet(l, new RegExp(`altitude[^=\\n]*=\\s*${number}`, 'i')),
    (l) => feet(l, new RegExp(`apogee altitude\\s+${number}`, 'i')),
  ];
  for (const rule of rules) {
    for (const line of lines) {
      const ft = rule(line);
      if (ft !== undefined && ft > 0) return feetToMetres(ft);
    }
  }
  return undefined;
}

/**
 * The instrument the comments name for the flown apogee (plan 0080): the author's final figure's
 * instrument first ("Final Altitude - GPS Altitude"), then an apogee based on accelerometers, then
 * optical tracking, then a barometric altimeter, then GPS.
 */
function measuringInstrument(comments: string): MeasuringInstrument | undefined {
  const text = comments
    .split('\n')
    .filter((l) => l.length <= MAX_COMMENT_LINE)
    .join('\n')
    .toLowerCase();
  const final = /final altitude[^\n]*/.exec(text)?.[0];
  if (final?.includes('gps') === true) return 'GPS';
  if (final?.includes('accelerometer') === true) return 'accelerometer';
  if (final?.includes('barometric') === true) return 'barometric';
  if (/(apogee altitude|altitude based on)[^\n]*accelerometer/.test(text)) return 'accelerometer';
  if (text.includes('optical track')) return 'optical tracking';
  if (/barometric|altimeter|altacc/.test(text)) return 'barometric';
  if (text.includes('gps')) return 'GPS';
  return undefined;
}
