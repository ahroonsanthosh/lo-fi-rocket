/**
 * One connection's state (plan 0062): designs by id, the motor library (bundled files and files
 * imported in this session), and which launch settings the caller gave. Nothing is read from or
 * written to disk; everything is lost when the connection closes, by design.
 */
import {
  BUNDLED_MOTOR_FILES,
  designMotorFitProblems,
  downloadMotor,
  exampleDesign,
  importCdx1,
  motorFromEng,
  motorFromRse,
  newDesign,
  newId,
  orkToDesign,
  parseDesign,
  parseEng,
  parseOrk,
  parseRse,
  parseThrustCurveCsv,
  runDispersion,
  searchMotorsWithData,
  ZERO_VARIATIONS,
  type DataSearchResult,
  type DeployEvent,
  type DesignStage,
  type DispersionResult,
  type IgnitionEvent,
  type MotorMount,
  type DispersionVariations,
  type Transport,
  type DesignRecoveryDevice,
  type MotorProvenance,
  type RocketDesign,
} from '@lo-fi-rocket/formats';
import {
  burnTime,
  kelvin,
  kilograms,
  kilogramsPerSquareMetre,
  metres,
  metresPerSecond,
  pascals,
  radians,
  seconds,
  totalImpulse,
  type Approximation,
  type ApproximationImpact,
  type MotorDefinition,
  type SeparationEvent,
} from '@lo-fi-rocket/physics';
import {
  addPart,
  checked,
  EditError,
  subjectOf,
  type AddPartInput,
  type PositionInput,
  type QuantityInput,
} from './edit.js';
import {
  compactDesignation,
  matchLibrary,
  parseMotorName,
  sameManufacturer,
  type MotorName,
} from './motor-name.js';
import { toSi } from './quantity.js';

export const MAX_DESIGNS = 50;
export const MAX_MOTORS = 200;
export const MAX_ASSUMPTIONS = 200;
export const MAX_TEXT = 2000;

export interface LibraryMotor {
  readonly id: string;
  readonly definition: MotorDefinition;
  readonly provenance: MotorProvenance;
  readonly delays: readonly number[] | 'plugged' | undefined;
  readonly source: 'bundled' | 'imported' | 'thrustcurve';
}

/** Launch settings a caller can give; the rest stay at the new design's values and are reported. */
export const LAUNCH_SETTINGS = [
  'siteAltitude',
  'temperature',
  'pressure',
  'railLength',
  'railAngle',
  'railAzimuth',
  'windSpeed',
  'windFrom',
] as const;
export type LaunchSetting = (typeof LAUNCH_SETTINGS)[number];

export interface LaunchInput {
  readonly siteAltitude?: QuantityInput;
  readonly temperature?: QuantityInput;
  readonly pressure?: QuantityInput;
  readonly railLength?: QuantityInput;
  readonly railAngle?: QuantityInput;
  readonly railAzimuth?: QuantityInput;
  readonly windSpeed?: QuantityInput;
  readonly windFrom?: QuantityInput;
  readonly windProfile?: readonly {
    altitude: QuantityInput;
    speed: QuantityInput;
    from: QuantityInput;
  }[];
  readonly turbulence?: { readonly intensity: number; readonly seed: number } | null;
}

export interface RecoveryInput {
  readonly name: string;
  /** A parachute's canopy diameter; give this or `streamer`. */
  readonly diameter?: QuantityInput;
  /** Plan 0073: a streamer's strip and material; give this or `diameter`. */
  readonly streamer?: {
    readonly length: QuantityInput;
    readonly width: QuantityInput;
    readonly surfaceDensity: QuantityInput;
  };
  /** Left out: 0.8 for a parachute (listed), eq. (C.6) for a streamer. */
  readonly dragCoefficient?: number;
  readonly deploy: {
    readonly event: DeployEvent;
    readonly altitude?: QuantityInput;
    readonly delay?: QuantityInput;
  };
  /** Plan 0064: the stage the device is on (0, the top stage, when left out). */
  readonly stage?: number;
}

export interface MotorInput {
  readonly mountPartId: string;
  readonly motorId: string;
  readonly overhang?: QuantityInput;
  /** Seconds after burnout, or "plugged" for no ejection charge. */
  readonly ejectionDelay?: QuantityInput;
  readonly cluster?: readonly { readonly y: QuantityInput; readonly z: QuantityInput }[];
  /** Plan 0064: when the motor ignites; automatic when left out. */
  readonly ignition?: { readonly event: IgnitionEvent; readonly delay?: QuantityInput };
  /** Plan 0064: add the mount beside the stage's existing one (an air start) instead of replacing it. */
  readonly add?: boolean;
}

/** Plan 0064: a stage, top first; every stage but the top one says when it separates. */
export interface StageInput {
  readonly name: string;
  readonly separation?: {
    readonly event: SeparationEvent;
    readonly delay?: QuantityInput;
    readonly altitude?: QuantityInput;
  };
}

export interface AssumptionInput {
  readonly partId?: string;
  readonly what: string;
  readonly method: string;
  readonly effect: string;
  readonly impact: ApproximationImpact;
}

/** Plan 0079: a whole design in one call, as a user pastes it. */
export interface BuildSpec {
  readonly name: string;
  readonly stages?: readonly StageInput[];
  /** Positions relative to another part may name an earlier part of this list instead of an id. */
  readonly parts: readonly AddPartInput[];
  readonly motor?: {
    /** As people write it: "D12-5", "Estes D12", "G80-7T", "AeroTech H128W". */
    readonly name: string;
    /** The tube that holds it: its index in `parts` or its name; the aftmost inner tube when left out. */
    readonly mount?: number | string;
    readonly overhang?: QuantityInput;
    /** Seconds, or "plugged"; overrides a delay written in the name. */
    readonly ejectionDelay?: QuantityInput;
    readonly cluster?: readonly { readonly y: QuantityInput; readonly z: QuantityInput }[];
  };
  readonly recovery?: readonly RecoveryInput[];
  readonly launch?: LaunchInput;
  readonly asBuilt?: { readonly mass?: QuantityInput; readonly cg?: QuantityInput };
  /** What the caller estimated from the paste, each listed with every result. */
  readonly assumptions?: readonly (Omit<AssumptionInput, 'partId'> & { readonly part?: number })[];
}

export interface BuildResult {
  readonly design: RocketDesign;
  /** The motor used, and where it came from. */
  readonly motor?: {
    readonly id: string;
    readonly name: string;
    readonly source: LibraryMotor['source'];
    readonly downloaded: boolean;
    readonly delay: string;
  };
  /** Why the rocket was not flown (no motor given, or the motor could not be found). */
  readonly notFlown?: string;
}

const MOTOR_MOUNT = 'Motor mount';
/** The subject of a mount's "not given" notes: the first mount's is "Motor mount" (plan 0062). */
const mountSubject = (first: boolean, partName: string): string =>
  first ? MOTOR_MOUNT : `${MOTOR_MOUNT} "${partName}"`;
const MOTOR_WHATS = new Set(['ejection delay not given', 'motor overhang not given']);
const RECOVERY_WHATS = new Set(['drag coefficient not given']);

/** The design with its design-level approximations replaced (the key left out when there are none). */
function withApproximations(design: RocketDesign, list: readonly Approximation[]): RocketDesign {
  const copy: { -readonly [K in keyof RocketDesign]: RocketDesign[K] } = { ...design };
  delete copy.approximations;
  return list.length === 0 ? copy : { ...copy, approximations: list };
}

function text(field: string, v: string): string {
  if (v.length > MAX_TEXT) throw new EditError(`${field}: at most ${String(MAX_TEXT)} characters`);
  return v;
}

/**
 * Largest Monte Carlo batch one tool call runs. A flight with its descent takes about 0.3 s here
 * (the example rocket), so 200 runs take about a minute; more would outlast a client's patience.
 */
export const MAX_RUNS = 200;

export class Session {
  private readonly designs = new Map<string, RocketDesign>();
  private readonly launchGiven = new Map<string, Set<LaunchSetting>>();
  readonly motors = new Map<string, LibraryMotor>();

  /** `transport` reaches ThrustCurve.org (transport.ts); without one the catalogue is offline. */
  constructor(private readonly transport?: Transport) {
    for (const { file, text: fileText } of BUNDLED_MOTOR_FILES) {
      const eng = parseEng(fileText, file)[0];
      if (eng === undefined) continue;
      this.motors.set(file, {
        id: file,
        definition: motorFromEng(eng),
        provenance: { kind: 'bundled', file },
        delays: eng.delays === 'plugged' ? 'plugged' : eng.delays.map(Number),
        source: 'bundled',
      });
    }
  }

  get(id: string): RocketDesign {
    const d = this.designs.get(id);
    if (d === undefined) {
      throw new EditError(
        `no design with id "${id}" in this session (list_designs shows them; designs are kept only while the connection is open)`,
      );
    }
    return d;
  }

  list(): RocketDesign[] {
    return [...this.designs.values()];
  }

  put(design: RocketDesign): RocketDesign {
    if (!this.designs.has(design.id) && this.designs.size >= MAX_DESIGNS) {
      throw new EditError(
        `a session holds at most ${String(MAX_DESIGNS)} designs; export and close some first`,
      );
    }
    this.designs.set(design.id, design);
    return design;
  }

  launchSettingsGiven(id: string): ReadonlySet<LaunchSetting> {
    return this.launchGiven.get(id) ?? new Set();
  }

  /** An empty design, or the example (R1 with the Estes D12, the reference of plan 0011). */
  create(name: string, from: 'empty' | 'example'): RocketDesign {
    const id = newId();
    const base =
      from === 'example'
        ? { ...exampleDesign(id), name: text('name', name) }
        : newDesign(id, text('name', name));
    if (from === 'example') this.launchGiven.set(id, new Set(LAUNCH_SETTINGS));
    return this.put(base);
  }

  /** A design from file content: `.lofi.json` text, `.ork` XML text, or a base64 `.ork` zip. */
  import(
    content: string,
    format: 'lofi' | 'ork' | 'ork-base64' | 'cdx1',
    fileName?: string,
  ): { design: RocketDesign; notices: readonly string[] } {
    let design: RocketDesign;
    let notices: readonly string[] = [];
    if (format === 'lofi') {
      design = parseDesign(content, fileName);
    } else if (format === 'cdx1') {
      // Plan 0079: a pasted RASAero II file (plan 0075's importer).
      const library = [...this.motors.values()].map((m) => ({
        definition: m.definition,
        provenance: m.provenance,
      }));
      const imported = importCdx1(content, library, newId(), fileName);
      design = imported.design;
      notices = imported.notices;
    } else {
      const data = format === 'ork' ? content : Uint8Array.from(Buffer.from(content, 'base64'));
      const rocket = parseOrk(data, fileName);
      const library = [...this.motors.values()].map((m) => ({
        definition: m.definition,
        provenance: m.provenance,
      }));
      const imported = orkToDesign(rocket, library, newId(), () => newId());
      design = imported.design;
      notices = imported.notices;
    }
    // A fresh id, so the same file can be imported twice and edited separately.
    const fresh = { ...design, id: newId() };
    this.launchGiven.set(fresh.id, new Set(LAUNCH_SETTINGS));
    return { design: this.put(fresh), notices };
  }

  /** Motor files into the session's library; returns the new entries. */
  importMotor(
    content: string,
    format: 'eng' | 'rse' | 'csv',
    fileName: string | undefined,
    csv?: {
      designation: string;
      manufacturer: string;
      diameter: QuantityInput;
      length: QuantityInput;
      totalMass: QuantityInput;
      propellantMass: QuantityInput;
    },
  ): LibraryMotor[] {
    const added: { definition: MotorDefinition; delays: LibraryMotor['delays'] }[] = [];
    if (format === 'eng') {
      for (const m of parseEng(content, fileName))
        added.push({
          definition: motorFromEng(m),
          delays: m.delays === 'plugged' ? 'plugged' : m.delays.map(Number),
        });
    } else if (format === 'rse') {
      for (const m of parseRse(content, {}, fileName))
        added.push({ definition: motorFromRse(m, fileName), delays: m.delays.map(Number) });
    } else {
      if (csv === undefined)
        throw new EditError(
          'a CSV thrust curve needs designation, manufacturer, diameter, length, totalMass and propellantMass',
        );
      const definition = parseThrustCurveCsv(
        content,
        {
          designation: text('designation', csv.designation),
          manufacturer: text('manufacturer', csv.manufacturer),
          diameter: metres(toSi('diameter', 'length', csv.diameter)),
          length: metres(toSi('length', 'length', csv.length)),
          totalMass: kilograms(toSi('totalMass', 'mass', csv.totalMass)),
          propellantMass: kilograms(toSi('propellantMass', 'mass', csv.propellantMass)),
        },
        fileName,
      );
      added.push({ definition, delays: undefined });
    }
    if (this.motors.size + added.length > MAX_MOTORS) {
      throw new EditError(`the session's motor library holds at most ${String(MAX_MOTORS)} motors`);
    }
    const out: LibraryMotor[] = [];
    for (const a of added) {
      const stem = `${a.definition.manufacturer}-${a.definition.designation}`.replace(
        /[^A-Za-z0-9.-]+/g,
        '_',
      );
      let id = `imported:${stem}`;
      for (let n = 2; this.motors.has(id); n++) id = `imported:${stem}-${String(n)}`;
      const provenance: MotorProvenance =
        format === 'csv'
          ? { kind: 'custom' }
          : { kind: 'file', fileName: fileName ?? `${stem}.${format}` };
      const m: LibraryMotor = {
        id,
        definition: a.definition,
        provenance,
        delays: a.delays,
        source: 'imported',
      };
      this.motors.set(id, m);
      out.push(m);
    }
    return out;
  }

  /** Library motors matching a text (designation or manufacturer), a diameter and an impulse class letter. */
  findMotors(query: {
    text?: string;
    diameter?: QuantityInput;
    impulseClass?: string;
  }): LibraryMotor[] {
    const t = query.text?.trim().toLowerCase();
    const d = query.diameter === undefined ? undefined : toSi('diameter', 'length', query.diameter);
    const cls = query.impulseClass?.trim().toUpperCase();
    return [...this.motors.values()].filter((m) => {
      const def = m.definition;
      if (
        t !== undefined &&
        t !== '' &&
        !`${def.manufacturer} ${def.designation}`.toLowerCase().includes(t)
      )
        return false;
      // Within 0.5 mm: catalogue diameters are given to the millimetre.
      if (d !== undefined && Math.abs(def.diameter - d) > 0.0005) return false;
      if (cls !== undefined && cls !== '' && !def.designation.toUpperCase().startsWith(cls))
        return false;
      return true;
    });
  }

  /** Search the ThrustCurve.org catalogue (motors with data files only). */
  async searchCatalogue(query: {
    designation?: string;
    manufacturer?: string;
    impulseClass?: string;
    diameter?: QuantityInput;
    maxResults?: number;
  }): Promise<DataSearchResult> {
    if (this.transport === undefined)
      throw new EditError(
        'the ThrustCurve.org catalogue is not available in this server (offline)',
      );
    const diameter =
      query.diameter === undefined ? undefined : toSi('diameter', 'length', query.diameter);
    // Only motors with a data file are kept (issue #8: the API's hasDataFiles criterion matched nothing).
    return searchMotorsWithData(this.transport, {
      ...(query.designation === undefined
        ? {}
        : { commonName: text('designation', query.designation) }),
      ...(query.manufacturer === undefined
        ? {}
        : { manufacturer: text('manufacturer', query.manufacturer) }),
      ...(query.impulseClass === undefined
        ? {}
        : { impulseClass: text('impulseClass', query.impulseClass) }),
      // The API takes millimetres (x_mm = 1000 x_m, the inverse of UNIT-1), as a search key to 0.1 mm.
      ...(diameter === undefined ? {} : { diameter: Math.round(diameter * 10000) / 10 }),
      maxResults: Math.min(50, Math.max(1, query.maxResults ?? 20)),
    });
  }

  /** Download a catalogue motor's data file into the session's library. */
  async addCatalogueMotor(motorId: string): Promise<LibraryMotor> {
    if (this.transport === undefined)
      throw new EditError(
        'the ThrustCurve.org catalogue is not available in this server (offline)',
      );
    const id = `thrustcurve:${motorId}`;
    const known = this.motors.get(id);
    if (known !== undefined) return known;
    if (this.motors.size >= MAX_MOTORS)
      throw new EditError(`the session's motor library holds at most ${String(MAX_MOTORS)} motors`);
    const d = await downloadMotor(this.transport, text('motorId', motorId));
    const delays: LibraryMotor['delays'] =
      d.format === 'RASP'
        ? (() => {
            const eng = parseEng(d.fileText)[0];
            return eng === undefined || eng.delays === 'plugged'
              ? 'plugged'
              : eng.delays.map(Number);
          })()
        : (parseRse(d.fileText)[0]?.delays.map(Number) ?? undefined);
    const m: LibraryMotor = {
      id,
      definition: d.definition,
      provenance: { kind: 'thrustcurve', motorId: d.motorId, simfileId: d.simfileId },
      delays,
      source: 'thrustcurve',
    };
    this.motors.set(id, m);
    return m;
  }

  /** A Monte Carlo batch (plan 0017): the design's dispersion record unless the call overrides it. */
  monteCarlo(
    id: string,
    input: { runs?: number; seed?: number; variations?: Partial<DispersionVariations> },
  ): DispersionResult {
    const design = this.get(id);
    const record = design.dispersion;
    const runs = input.runs ?? record?.runs ?? 100;
    if (runs > MAX_RUNS) throw new EditError(`at most ${String(MAX_RUNS)} runs per call`);
    // A seed is always used and reported (CLAUDE.md 5): the given one, the design's, or a fresh one.
    const seed =
      input.seed ?? record?.seed ?? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
    const variations: DispersionVariations = {
      ...ZERO_VARIATIONS,
      ...(record?.variations ?? {}),
      ...(input.variations ?? {}),
    };
    return runDispersion(design, { runs, seed, variations });
  }

  setMotor(id: string, input: MotorInput): { design: RocketDesign; fitProblems: string[] } {
    const design = this.get(id);
    const mount = design.components.find((c) => c.id === input.mountPartId);
    if (mount === undefined)
      throw new EditError(`no part with id "${input.mountPartId}" in this design`);
    if (mount.component.kind !== 'innerTube' && mount.component.kind !== 'bodyTube') {
      throw new EditError(
        `the motor goes in an inner tube or a body tube; "${mount.name}" is a ${mount.component.kind}`,
      );
    }
    const motor = this.motors.get(input.motorId);
    if (motor === undefined)
      throw new EditError(`no motor "${input.motorId}" in the library (find_motor lists them)`);
    // Plan 0064: the mount replaces its stage's mount (or the one on the same part), or is added.
    const stageOf = (partId: string): number =>
      design.components.find((c) => c.id === partId)?.stage ?? 0;
    const stage = mount.stage ?? 0;
    const sameSlot = (m: MotorMount): boolean =>
      m.componentId === mount.id || (input.add !== true && stageOf(m.componentId) === stage);
    const additional = [...(design.additionalMotorMounts ?? [])];
    const replaced = [design.motorMount, ...additional].find(
      (m): m is MotorMount => m !== undefined && sameSlot(m),
    );
    const first = design.motorMount === undefined || design.motorMount === replaced;
    const subject = mountSubject(first, mount.name);
    const oldSubject =
      replaced === undefined
        ? subject
        : mountSubject(
            first,
            design.components.find((c) => c.id === replaced.componentId)?.name ?? '',
          );
    const approximations: Approximation[] = (design.approximations ?? []).filter(
      (a) => !((a.subject === subject || a.subject === oldSubject) && MOTOR_WHATS.has(a.what)),
    );
    let ejectionDelay: number | undefined;
    if (input.ejectionDelay === undefined) {
      approximations.push({
        subject,
        what: 'ejection delay not given',
        method: `treated as plugged, no ejection charge${Array.isArray(motor.delays) && motor.delays.length > 0 ? ` (the motor file lists ${motor.delays.join(', ')} s)` : ''}; ask the user which delay they fly`,
        effect: 'a parachute set to open at the ejection charge never opens in this simulation',
        impact: 'moderate',
      });
    } else if (input.ejectionDelay !== 'plugged') {
      ejectionDelay = toSi('ejectionDelay', 'time', input.ejectionDelay);
    }
    const overhang = input.overhang === undefined ? 0 : toSi('overhang', 'length', input.overhang);
    if (input.overhang === undefined) {
      approximations.push({
        subject,
        what: 'motor overhang not given',
        method: 'the motor’s aft end level with the mount’s aft end (0 overhang); ask the user',
        effect:
          'the motor’s mass sits a little forward or aft of where it is, moving the centre of gravity',
        impact: 'minor',
      });
    }
    const cluster = input.cluster?.map((o, i) => ({
      y: metres(toSi(`cluster[${String(i)}].y`, 'length', o.y)),
      z: metres(toSi(`cluster[${String(i)}].z`, 'length', o.z)),
    }));
    const ignition =
      input.ignition === undefined
        ? undefined
        : {
            event: input.ignition.event,
            delay: seconds(
              input.ignition.delay === undefined
                ? 0
                : toSi('ignition.delay', 'time', input.ignition.delay),
            ),
          };
    const placed: MotorMount = {
      componentId: mount.id,
      overhang: metres(overhang),
      motor: {
        definition: motor.definition,
        provenance: motor.provenance,
        ...(ejectionDelay === undefined ? {} : { ejectionDelay: seconds(ejectionDelay) }),
      },
      ...(cluster === undefined || cluster.length === 0 ? {} : { cluster }),
      ...(ignition === undefined ? {} : { ignition }),
    };
    const others = additional.filter((m) => m !== replaced);
    const rest = first
      ? design.motorMount === undefined || design.motorMount === replaced
        ? others
        : [design.motorMount, ...others]
      : [...others, placed];
    const next: { -readonly [K in keyof RocketDesign]: RocketDesign[K] } = {
      ...withApproximations(design, approximations),
      additionalMotorMounts: rest,
    };
    if (first) next.motorMount = placed;
    if (rest.length === 0) delete next.additionalMotorMounts;
    const valid = checked(next);
    return { design: this.put(valid), fitProblems: designMotorFitProblems(valid) };
  }

  setRecovery(id: string, devices: readonly RecoveryInput[]): RocketDesign {
    const design = this.get(id);
    const approximations: Approximation[] = (design.approximations ?? []).filter(
      (a) => !(a.subject.startsWith('Recovery device "') && RECOVERY_WHATS.has(a.what)),
    );
    const recovery: DesignRecoveryDevice[] = devices.map((d, i): DesignRecoveryDevice => {
      const name = text(`devices[${String(i)}].name`, d.name);
      if ((d.diameter === undefined) === (d.streamer === undefined)) {
        throw new EditError(
          `devices[${String(i)}] needs either "diameter" (a parachute) or "streamer" (its length, width and surfaceDensity), not both`,
        );
      }
      if (d.dragCoefficient === undefined && d.streamer === undefined) {
        approximations.push({
          subject: `Recovery device "${name}"`,
          what: 'drag coefficient not given',
          method:
            '0.8, Niskanen (2009) p. 67 for a round parachute; ask the user for the maker’s figure',
          effect: 'the descent rate and the landing distance may differ',
          impact: 'moderate',
        });
      }
      if (d.deploy.event === 'altitude' && d.deploy.altitude === undefined) {
        throw new EditError(
          `devices[${String(i)}].deploy.altitude is needed for the event "altitude"`,
        );
      }
      const deploy = {
        event: d.deploy.event,
        delay: seconds(
          d.deploy.delay === undefined
            ? 0
            : toSi(`devices[${String(i)}].deploy.delay`, 'time', d.deploy.delay),
        ),
        ...(d.deploy.altitude === undefined
          ? {}
          : {
              altitude: metres(
                toSi(`devices[${String(i)}].deploy.altitude`, 'length', d.deploy.altitude),
              ),
            }),
      };
      const common = {
        id: newId(),
        name,
        deploy,
        ...(d.stage === undefined || d.stage === 0 ? {} : { stage: d.stage }),
      };
      if (d.streamer !== undefined) {
        const at = `devices[${String(i)}].streamer`;
        return {
          kind: 'streamer',
          ...common,
          length: metres(toSi(`${at}.length`, 'length', d.streamer.length)),
          width: metres(toSi(`${at}.width`, 'length', d.streamer.width)),
          surfaceDensity: kilogramsPerSquareMetre(
            toSi(`${at}.surfaceDensity`, 'surfaceDensity', d.streamer.surfaceDensity),
          ),
          ...(d.dragCoefficient === undefined ? {} : { dragCoefficient: d.dragCoefficient }),
        };
      }
      return {
        ...common,
        diameter: metres(toSi(`devices[${String(i)}].diameter`, 'length', d.diameter ?? 0)),
        dragCoefficient: d.dragCoefficient ?? 0.8,
      };
    });
    return this.put(checked({ ...withApproximations(design, approximations), recovery }));
  }

  /**
   * Plan 0064: the stages, top first. A separation delay left out is 0 s and recorded as "not
   * given"; one stage clears the list (a one-stage rocket).
   */
  setStages(id: string, input: readonly StageInput[]): RocketDesign {
    const design = this.get(id);
    if (input.length === 0) throw new EditError('give at least one stage (the top stage)');
    const approximations: Approximation[] = (design.approximations ?? []).filter(
      (a) => !(a.subject.startsWith('Stage "') && a.what === 'separation delay not given'),
    );
    const stages: DesignStage[] = input.map((st, k) => {
      const name = text(`stages[${String(k)}].name`, st.name);
      if (k === 0) {
        if (st.separation !== undefined) {
          throw new EditError(
            'the top stage (stages[0]) never separates; leave out its separation',
          );
        }
        return { name };
      }
      const sep = st.separation;
      if (sep === undefined) {
        throw new EditError(
          `stages[${String(k)}].separation is needed: when "${name}" leaves the vehicle`,
        );
      }
      if (sep.delay === undefined) {
        approximations.push({
          subject: `Stage "${name}"`,
          what: 'separation delay not given',
          method: '0 s after the event; ask the user',
          effect: 'the stage may leave a little later in the real flight',
          impact: 'minor',
        });
      }
      const altitudeEvent =
        sep.event === 'altitude-ascending' || sep.event === 'altitude-descending';
      if (altitudeEvent && sep.altitude === undefined) {
        throw new EditError(
          `stages[${String(k)}].separation.altitude is needed for the event "${sep.event}"`,
        );
      }
      return {
        name,
        separation: {
          event: sep.event,
          delay: seconds(
            sep.delay === undefined
              ? 0
              : toSi(`stages[${String(k)}].separation.delay`, 'time', sep.delay),
          ),
          ...(sep.altitude === undefined
            ? {}
            : {
                altitude: metres(
                  toSi(`stages[${String(k)}].separation.altitude`, 'length', sep.altitude),
                ),
              }),
        },
      };
    });
    const next: { -readonly [K in keyof RocketDesign]: RocketDesign[K] } = {
      ...withApproximations(design, approximations),
      stages,
    };
    if (stages.length === 1) delete next.stages;
    return this.put(checked(next));
  }

  setLaunch(id: string, input: LaunchInput): RocketDesign {
    const design = this.get(id);
    const l = design.launch;
    const q = (key: LaunchSetting, dimension: Parameters<typeof toSi>[1]): number | undefined => {
      const v = input[key];
      return v === undefined ? undefined : toSi(key, dimension, v);
    };
    const temperature = q('temperature', 'temperature');
    const pressure = q('pressure', 'pressure');
    if (
      (temperature === undefined) !== (pressure === undefined) &&
      l.site.temperature === undefined
    ) {
      throw new EditError(
        'give the pad temperature and pressure together (both override the standard atmosphere, ATM-11), or neither',
      );
    }
    const altitude = q('siteAltitude', 'length');
    const railLength = q('railLength', 'length');
    const railAngle = q('railAngle', 'angle');
    const railAzimuth = q('railAzimuth', 'angle');
    const windSpeed = q('windSpeed', 'speed');
    const windFrom = q('windFrom', 'angle');
    const profile = input.windProfile?.map((r, i) => ({
      altitude: metres(toSi(`windProfile[${String(i)}].altitude`, 'length', r.altitude)),
      speed: metresPerSecond(toSi(`windProfile[${String(i)}].speed`, 'speed', r.speed)),
      from: radians(toSi(`windProfile[${String(i)}].from`, 'angle', r.from)),
    }));
    const { profile: oldProfile, turbulence: oldTurbulence, ...wind } = l.wind;
    const turbulence =
      input.turbulence === undefined ? oldTurbulence : (input.turbulence ?? undefined);
    const nextProfile = profile ?? oldProfile;
    const next = checked({
      ...design,
      launch: {
        site: {
          ...l.site,
          ...(altitude === undefined ? {} : { altitude: metres(altitude) }),
          ...(temperature === undefined ? {} : { temperature: kelvin(temperature) }),
          ...(pressure === undefined ? {} : { pressure: pascals(pressure) }),
        },
        rail: {
          length: railLength === undefined ? l.rail.length : metres(railLength),
          angleFromVertical:
            railAngle === undefined ? l.rail.angleFromVertical : radians(railAngle),
          azimuth: railAzimuth === undefined ? l.rail.azimuth : radians(railAzimuth),
        },
        wind: {
          speed: windSpeed === undefined ? wind.speed : metresPerSecond(windSpeed),
          from: windFrom === undefined ? wind.from : radians(windFrom),
          ...(nextProfile === undefined || nextProfile.length === 0
            ? {}
            : { profile: nextProfile }),
          ...(turbulence === undefined ? {} : { turbulence }),
        },
      },
    });
    const given = new Set(this.launchSettingsGiven(id));
    for (const k of LAUNCH_SETTINGS) if (input[k] !== undefined) given.add(k);
    if (profile !== undefined) {
      given.add('windSpeed');
      given.add('windFrom');
    }
    this.launchGiven.set(id, given);
    return this.put(next);
  }

  /** Forget a design: a one-call build that fails part way keeps nothing (plan 0079). */
  discard(id: string): void {
    this.designs.delete(id);
    this.launchGiven.delete(id);
  }

  /**
   * Plan 0079: the library motor a written name means ("D12-5", "Estes D12", "G80-7T"). When the
   * library has none, ThrustCurve.org is searched by the common name and only an exact
   * designation (and the manufacturer, when written) is downloaded. A motor that cannot be found
   * is never an error: the answer says why, so the design is still built and its stability given.
   */
  async resolveMotor(
    written: string,
  ): Promise<
    | { readonly motor: LibraryMotor; readonly parsed: MotorName; readonly downloaded: boolean }
    | { readonly problem: string }
  > {
    const parsed = parseMotorName(text('motor.name', written));
    if (parsed === undefined)
      return {
        problem: `"${written}" is not a motor code (for example "D12-5", "Estes D12", "G80-7T", "H128W")`,
      };
    const label = (m: LibraryMotor): string =>
      `${m.definition.manufacturer} ${m.definition.designation}`;
    const local = matchLibrary(parsed, [...this.motors.values()]);
    const only = local.length === 1 ? local[0] : undefined;
    if (only !== undefined) return { motor: only, parsed, downloaded: false };
    if (local.length > 1)
      return {
        problem: `"${written}" matches ${local.map(label).join(', ')} in the library: give the manufacturer or the full designation`,
      };
    if (this.transport === undefined)
      return {
        problem: `no ${parsed.designation} in the library, and the ThrustCurve.org catalogue is not available in this server: give its .eng or .rse file with import_motor`,
      };
    let found: DataSearchResult;
    try {
      found = await searchMotorsWithData(this.transport, {
        commonName: parsed.commonName,
        maxResults: 50,
      });
    } catch (error) {
      return {
        problem: `no ${parsed.designation} in the library, and ThrustCurve.org could not be searched (${error instanceof Error ? error.message : String(error)}): give its .eng or .rse file with import_motor, or try again later`,
      };
    }
    const maker = found.results.filter(
      (m) =>
        sameManufacturer(parsed.manufacturer, m.manufacturer) ||
        sameManufacturer(parsed.manufacturer, m.manufacturerAbbrev),
    );
    const exact = maker.filter((m) => compactDesignation(m.designation) === parsed.designation);
    // Without a propellant suffix ("F39"), the common name alone may name one motor.
    const pick = exact.length > 0 || parsed.designation !== parsed.commonName ? exact : maker;
    const chosen = pick.length === 1 ? pick[0] : undefined;
    if (chosen === undefined) {
      return {
        problem:
          pick.length === 0
            ? `no motor "${written}" with a thrust curve in the library or on ThrustCurve.org: check the name, or give its .eng or .rse file with import_motor`
            : `"${written}" matches ${pick
                .slice(0, 8)
                .map((m) => `${m.manufacturerAbbrev} ${m.designation}`)
                .join(', ')} on ThrustCurve.org: give the manufacturer and the full designation`,
      };
    }
    try {
      return { motor: await this.addCatalogueMotor(chosen.motorId), parsed, downloaded: true };
    } catch (error) {
      return {
        problem: `${chosen.manufacturerAbbrev} ${chosen.designation} could not be downloaded from ThrustCurve.org (${error instanceof Error ? error.message : String(error)})`,
      };
    }
  }

  /**
   * Plan 0079: a whole design in one call, built with the same steps as the step-by-step tools,
   * so every default is recorded as they record it. A step that fails names itself and leaves
   * nothing behind. The motor is looked up first, so a slow or failed catalogue search never
   * leaves a half-built design.
   */
  async build(spec: BuildSpec): Promise<BuildResult> {
    const resolved =
      spec.motor === undefined ? undefined : await this.resolveMotor(spec.motor.name);
    const id = this.create(spec.name, 'empty').id;
    let step = 'the stages';
    try {
      if (spec.stages !== undefined) this.setStages(id, spec.stages);
      const ids: string[] = [];
      const names = new Map<string, string>();
      spec.parts.forEach((part, i) => {
        step = `part ${String(i + 1)} (${part.name ?? part.kind})`;
        const position: PositionInput | undefined =
          part.position !== undefined &&
          typeof part.position === 'object' &&
          names.has(part.position.relativeTo)
            ? { ...part.position, relativeTo: names.get(part.position.relativeTo) ?? '' }
            : part.position;
        const result = addPart(this.get(id), {
          ...part,
          ...(position === undefined ? {} : { position }),
        });
        this.put(result.design);
        const partId = result.part?.id ?? '';
        ids.push(partId);
        if (part.name !== undefined && !names.has(part.name)) names.set(part.name, partId);
      });
      let motor: BuildResult['motor'];
      let notFlown: string | undefined;
      if (spec.motor === undefined || resolved === undefined) {
        notFlown = 'no motor was given: give one (motor.name) to fly the rocket';
      } else if ('problem' in resolved) {
        notFlown = resolved.problem;
      } else {
        step = 'the motor';
        const design = this.get(id);
        const tubes = design.components.filter(
          (c) => c.component.kind === 'innerTube' || c.component.kind === 'bodyTube',
        );
        const mountOf = (m: number | string): string => {
          const found =
            typeof m === 'number'
              ? design.components.find((c) => c.id === ids[m])
              : design.components.find((c) => c.name === m);
          if (found === undefined)
            throw new EditError(
              `motor.mount: no part ${typeof m === 'number' ? `number ${String(m)} (counted from 0)` : `named "${m}"`}`,
            );
          return found.id;
        };
        const aftEnd = (c: (typeof tubes)[number]): number =>
          c.position +
          (c.component.kind === 'innerTube' || c.component.kind === 'bodyTube'
            ? c.component.length
            : 0);
        const aftmost = (kind: 'innerTube' | 'bodyTube'): (typeof tubes)[number] | undefined =>
          tubes
            .filter((c) => c.component.kind === kind)
            .reduce<(typeof tubes)[number] | undefined>(
              (best, c) => (best === undefined || aftEnd(c) > aftEnd(best) ? c : best),
              undefined,
            );
        const defaultMount = aftmost('innerTube') ?? aftmost('bodyTube');
        if (spec.motor.mount === undefined && defaultMount === undefined) {
          notFlown = 'there is no body tube or inner tube to hold the motor';
        } else {
          const mountPartId =
            spec.motor.mount === undefined ? (defaultMount?.id ?? '') : mountOf(spec.motor.mount);
          const delay = spec.motor.ejectionDelay ?? resolved.parsed.delay;
          this.setMotor(id, {
            mountPartId,
            motorId: resolved.motor.id,
            ...(spec.motor.overhang === undefined ? {} : { overhang: spec.motor.overhang }),
            ...(delay === undefined ? {} : { ejectionDelay: delay }),
            ...(spec.motor.cluster === undefined ? {} : { cluster: spec.motor.cluster }),
          });
          if (spec.motor.mount === undefined && defaultMount !== undefined) {
            this.noteAssumption(id, {
              partId: defaultMount.id,
              what: 'motor mount not given',
              method: `the motor is put in "${defaultMount.name}", the aftmost ${defaultMount.component.kind === 'innerTube' ? 'inner tube' : 'body tube'}`,
              effect: 'the motor’s mass sits in that tube; another tube would move the CG',
              impact: 'minor',
            });
          }
          const placed = this.get(id).motorMount?.motor;
          motor = {
            id: resolved.motor.id,
            name: `${resolved.motor.definition.manufacturer} ${resolved.motor.definition.designation}`,
            source: resolved.motor.source,
            downloaded: resolved.downloaded,
            delay:
              placed?.ejectionDelay === undefined
                ? resolved.parsed.delayCode === undefined
                  ? 'plugged (not given)'
                  : `plugged: the delay code "${resolved.parsed.delayCode}" is not a time, give the delay in seconds`
                : `${String(placed.ejectionDelay)} s`,
          };
        }
      }
      if (spec.recovery !== undefined) {
        step = 'the recovery';
        this.setRecovery(id, spec.recovery);
      }
      if (spec.launch !== undefined && Object.keys(spec.launch).length > 0) {
        step = 'the launch';
        this.setLaunch(id, spec.launch);
      }
      if (spec.asBuilt !== undefined) {
        step = 'the weighed mass and CG';
        this.setAsBuilt(id, spec.asBuilt);
      }
      (spec.assumptions ?? []).forEach((a, i) => {
        step = `assumption ${String(i + 1)}`;
        const partId = a.part === undefined ? undefined : ids[a.part];
        if (a.part !== undefined && partId === undefined)
          throw new EditError(`no part number ${String(a.part)} (counted from 0)`);
        this.noteAssumption(id, {
          what: a.what,
          method: a.method,
          effect: a.effect,
          impact: a.impact,
          ...(partId === undefined ? {} : { partId }),
        });
      });
      return {
        design: this.get(id),
        ...(motor === undefined ? {} : { motor }),
        ...(notFlown === undefined ? {} : { notFlown }),
      };
    } catch (error) {
      this.discard(id);
      if (error instanceof Error && !(error instanceof TypeError)) {
        error.message = `${step}: ${error.message}`;
      }
      throw error;
    }
  }

  setAsBuilt(
    id: string,
    input: { mass?: QuantityInput | null; cg?: QuantityInput | null },
  ): RocketDesign {
    const design = this.get(id);
    const old = design.asBuilt ?? {};
    const mass =
      input.mass === undefined
        ? old.mass
        : input.mass === null
          ? undefined
          : kilograms(toSi('mass', 'mass', input.mass));
    const cg =
      input.cg === undefined
        ? old.cg
        : input.cg === null
          ? undefined
          : metres(toSi('cg', 'length', input.cg));
    const copy: { -readonly [K in keyof RocketDesign]: RocketDesign[K] } = { ...design };
    delete copy.asBuilt;
    const asBuilt = {
      ...(mass === undefined ? {} : { mass }),
      ...(cg === undefined ? {} : { cg }),
    };
    return this.put(
      checked({ ...copy, ...(mass === undefined && cg === undefined ? {} : { asBuilt }) }),
    );
  }

  /** Record an estimate the caller made, on a part or the design, so it is listed with every result. */
  noteAssumption(id: string, input: AssumptionInput): RocketDesign {
    const design = this.get(id);
    const count =
      (design.approximations?.length ?? 0) +
      design.components.reduce((n, c) => n + (c.approximations?.length ?? 0), 0);
    if (count >= MAX_ASSUMPTIONS)
      throw new EditError(`a design holds at most ${String(MAX_ASSUMPTIONS)} approximations`);
    const entry = (subject: string): Approximation => ({
      subject,
      what: text('what', input.what),
      method: text('method', input.method),
      effect: text('effect', input.effect),
      impact: input.impact,
    });
    if (input.partId === undefined) {
      return this.put(
        checked({ ...design, approximations: [...(design.approximations ?? []), entry('Design')] }),
      );
    }
    const part = design.components.find((c) => c.id === input.partId);
    if (part === undefined) throw new EditError(`no part with id "${input.partId}" in this design`);
    const updated = {
      ...part,
      approximations: [
        ...(part.approximations ?? []),
        entry(subjectOf(part.component.kind, part.name)),
      ],
    };
    return this.put(
      checked({
        ...design,
        components: design.components.map((c) => (c.id === part.id ? updated : c)),
      }),
    );
  }
}

/** A library motor's figures for the tools, in SI with the units in the keys. */
export function motorFacts(m: LibraryMotor): Record<string, unknown> {
  const def = m.definition;
  const impulse: number = totalImpulse(def);
  const burn: number = burnTime(def);
  return {
    id: m.id,
    manufacturer: def.manufacturer,
    designation: def.designation,
    diameter_m: def.diameter,
    length_m: def.length,
    total_impulse_Ns: Number(impulse.toPrecision(6)),
    burn_time_s: Number(burn.toPrecision(6)),
    average_thrust_N: Number((impulse / burn).toPrecision(6)),
    total_mass_kg: def.totalMass,
    propellant_mass_kg: def.propellantMass,
    delays_s: m.delays ?? 'not listed',
    source: m.source,
  };
}
