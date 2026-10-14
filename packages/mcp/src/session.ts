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
  searchMotors,
  ZERO_VARIATIONS,
  type DeployEvent,
  type DispersionResult,
  type DispersionVariations,
  type MotorSummary,
  type Transport,
  type DesignRecoveryDevice,
  type MotorProvenance,
  type RocketDesign,
} from '@lo-fi-rocket/formats';
import {
  burnTime,
  kelvin,
  kilograms,
  metres,
  metresPerSecond,
  pascals,
  radians,
  seconds,
  totalImpulse,
  type Approximation,
  type ApproximationImpact,
  type MotorDefinition,
} from '@lo-fi-rocket/physics';
import { checked, EditError, subjectOf, type QuantityInput } from './edit.js';
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
  readonly diameter: QuantityInput;
  readonly dragCoefficient?: number;
  readonly deploy: {
    readonly event: DeployEvent;
    readonly altitude?: QuantityInput;
    readonly delay?: QuantityInput;
  };
}

export interface MotorInput {
  readonly mountPartId: string;
  readonly motorId: string;
  readonly overhang?: QuantityInput;
  /** Seconds after burnout, or "plugged" for no ejection charge. */
  readonly ejectionDelay?: QuantityInput;
  readonly cluster?: readonly { readonly y: QuantityInput; readonly z: QuantityInput }[];
}

export interface AssumptionInput {
  readonly partId?: string;
  readonly what: string;
  readonly method: string;
  readonly effect: string;
  readonly impact: ApproximationImpact;
}

const MOTOR_MOUNT = 'Motor mount';
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
    format: 'lofi' | 'ork' | 'ork-base64',
    fileName?: string,
  ): { design: RocketDesign; notices: readonly string[] } {
    let design: RocketDesign;
    let notices: readonly string[] = [];
    if (format === 'lofi') {
      design = parseDesign(content, fileName);
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
  }): Promise<{ matches: number; results: readonly MotorSummary[] }> {
    if (this.transport === undefined)
      throw new EditError(
        'the ThrustCurve.org catalogue is not available in this server (offline)',
      );
    const diameter =
      query.diameter === undefined ? undefined : toSi('diameter', 'length', query.diameter);
    return searchMotors(this.transport, {
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
      hasDataFiles: true,
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
    const approximations: Approximation[] = (design.approximations ?? []).filter(
      (a) => !(a.subject === MOTOR_MOUNT && MOTOR_WHATS.has(a.what)),
    );
    let ejectionDelay: number | undefined;
    if (input.ejectionDelay === undefined) {
      approximations.push({
        subject: MOTOR_MOUNT,
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
        subject: MOTOR_MOUNT,
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
    const next = checked({
      ...withApproximations(design, approximations),
      motorMount: {
        componentId: mount.id,
        overhang: metres(overhang),
        motor: {
          definition: motor.definition,
          provenance: motor.provenance,
          ...(ejectionDelay === undefined ? {} : { ejectionDelay: seconds(ejectionDelay) }),
        },
        ...(cluster === undefined || cluster.length === 0 ? {} : { cluster }),
      },
    });
    return { design: this.put(next), fitProblems: designMotorFitProblems(next) };
  }

  setRecovery(id: string, devices: readonly RecoveryInput[]): RocketDesign {
    const design = this.get(id);
    const approximations: Approximation[] = (design.approximations ?? []).filter(
      (a) => !(a.subject.startsWith('Recovery device "') && RECOVERY_WHATS.has(a.what)),
    );
    const recovery: DesignRecoveryDevice[] = devices.map((d, i) => {
      const name = text(`devices[${String(i)}].name`, d.name);
      if (d.dragCoefficient === undefined) {
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
      return {
        id: newId(),
        name,
        diameter: metres(toSi(`devices[${String(i)}].diameter`, 'length', d.diameter)),
        dragCoefficient: d.dragCoefficient ?? 0.8,
        deploy: {
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
        },
      };
    });
    return this.put(checked({ ...withApproximations(design, approximations), recovery }));
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
