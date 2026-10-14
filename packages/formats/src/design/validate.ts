/**
 * Structural validation of a parsed JSON value into a RocketDesign (plan
 * 0011, D-041). Every field is checked for presence and type; unknown keys
 * and unknown kinds are errors; every number must be finite. Nothing is
 * defaulted or dropped (CLAUDE.md rule 3 and section 8). Physical range
 * rules (a chord greater than 0, a motor's masses) are the physics
 * package's and are applied when the design is used.
 */
import {
  type Approximation,
  type AsBuilt,
  type FinShape,
  type DragCurve,
  kelvin,
  kilograms,
  kilogramsPerCubicMetre,
  metres,
  metresPerSecond,
  newtons,
  pascals,
  radians,
  seconds,
  type Component,
  type IntegratorOptions,
  type MassOverride,
  type MotorDefinition,
  type MotorMassRule,
  type NoseShape,
  type Quantity,
} from '@lo-fi-rocket/physics';
import { DesignFileError } from './errors.js';
import {
  CURRENT_SCHEMA_VERSION,
  type DeployEvent,
  type DispersionSettingsRecord,
  type RecordedFlight,
  type DesignComponent,
  type DesignRecoveryDevice,
  type LaunchConditions,
  type MotorMount,
  type MotorProvenance,
  type MotorSelection,
  type RocketDesign,
  type SimulationSettings,
  type StabilityThresholds,
  type WarningThresholds,
} from './model.js';

type Json = Record<string, unknown>;

class Ctx {
  constructor(readonly fileName: string | undefined) {}
  fail(path: string, problem: string): never {
    throw new DesignFileError(this.fileName, path, problem);
  }
  object(path: string, v: unknown): Json {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      this.fail(path, `expected an object, received ${describe(v)}`);
    }
    return v as Json;
  }
  array(path: string, v: unknown): unknown[] {
    if (!Array.isArray(v)) this.fail(path, `expected an array, received ${describe(v)}`);
    return v;
  }
  string(path: string, v: unknown): string {
    if (typeof v !== 'string') this.fail(path, `expected a string, received ${describe(v)}`);
    return v;
  }
  nonEmptyString(path: string, v: unknown): string {
    const s = this.string(path, v);
    if (s.trim() === '') this.fail(path, 'must not be empty');
    return s;
  }
  number(path: string, v: unknown): number {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.fail(path, `expected a finite number, received ${describe(v)}`);
    }
    return v;
  }
  boolean(path: string, v: unknown): boolean {
    if (typeof v !== 'boolean') this.fail(path, `expected true or false, received ${describe(v)}`);
    return v;
  }
  integer(path: string, v: unknown): number {
    const n = this.number(path, v);
    if (!Number.isInteger(n)) this.fail(path, `expected an integer, received ${String(n)}`);
    return n;
  }
  oneOf<T extends string>(path: string, v: unknown, allowed: readonly T[]): T {
    const s = this.string(path, v);
    const hit = allowed.find((a) => a === s);
    if (hit === undefined)
      this.fail(path, `expected one of ${allowed.join(', ')}, received "${s}"`);
    return hit;
  }
  /** Reject keys outside the declared set so that typos and newer fields are never silently ignored. */
  keys(path: string, o: Json, required: readonly string[], optional: readonly string[] = []): void {
    for (const k of required) {
      if (!(k in o)) this.fail(path, `missing required field "${k}"`);
    }
    for (const k of Object.keys(o)) {
      if (!required.includes(k) && !optional.includes(k)) this.fail(path, `unknown field "${k}"`);
    }
  }
  quantity<Q extends Quantity<string>>(path: string, v: unknown, make: (x: number) => Q): Q {
    return make(this.number(path, v));
  }
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'an array';
  if (typeof v === 'string') return `the string "${v}"`;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'a non-finite number';
  if (typeof v === 'object') return 'an object';
  if (typeof v === 'undefined') return 'nothing';
  return typeof v === 'boolean' || typeof v === 'bigint' ? String(v) : typeof v;
}

const NOSE_SHAPES: readonly NoseShape[] = [
  'conical',
  'ogive',
  'elliptical',
  'parabolic',
  'power',
  'haack',
];
const COMPONENT_KINDS = [
  'noseCone',
  'transition',
  'bodyTube',
  'innerTube',
  'launchLug',
  'centeringRing',
  'bulkhead',
  'massComponent',
  'parachute',
  'finSet',
  'railButton',
] as const;
const DEPLOY_EVENTS: readonly DeployEvent[] = ['apogee', 'ejection', 'altitude', 'launch', 'never'];
const MASS_RULES: readonly MotorMassRule[] = [
  'impulse-proportional',
  'linear-in-time',
  'mass-profile',
];
const SOURCE_FORMATS = ['RASP', 'RockSim', 'custom'] as const;
const FIN_SECTIONS = ['square', 'rounded', 'airfoil', 'wedge', 'double-wedge'] as const;

/**
 * The fields each component kind accepts in a design file, required and optional (the `kind` key
 * included). The validator below checks against this table, and the MCP server builds its tool
 * schemas from it (plan 0062), so the two cannot drift apart.
 */
export const COMPONENT_FIELDS = {
  noseCone: {
    required: ['kind', 'shape', 'length', 'baseRadius', 'density'],
    optional: ['shapeParameter', 'wallThickness', 'aftShoulder'],
  },
  transition: {
    required: ['kind', 'shape', 'length', 'foreRadius', 'aftRadius', 'density'],
    optional: ['shapeParameter', 'wallThickness'],
  },
  bodyTube: {
    required: ['kind', 'length', 'outerRadius', 'wallThickness', 'density'],
    optional: ['radialOffset'],
  },
  innerTube: {
    required: ['kind', 'length', 'outerRadius', 'wallThickness', 'density'],
    optional: ['radialOffset'],
  },
  launchLug: {
    required: ['kind', 'length', 'outerRadius', 'wallThickness', 'density'],
    optional: ['radialOffset'],
  },
  centeringRing: {
    required: ['kind', 'length', 'outerRadius', 'innerRadius', 'density'],
    optional: [],
  },
  bulkhead: { required: ['kind', 'length', 'outerRadius', 'innerRadius', 'density'], optional: [] },
  massComponent: { required: ['kind', 'mass', 'length', 'radius'], optional: [] },
  parachute: { required: ['kind', 'mass', 'length', 'radius'], optional: [] },
  finSet: {
    required: [
      'kind',
      'count',
      'rootChord',
      'tipChord',
      'sweep',
      'span',
      'thickness',
      'density',
      'bodyRadius',
    ],
    optional: ['crossSection', 'shearModulus', 'tab', 'shape'],
  },
  railButton: {
    required: [
      'kind',
      'count',
      'outerDiameter',
      'innerDiameter',
      'totalHeight',
      'baseHeight',
      'flangeHeight',
      'density',
      'bodyRadius',
    ],
    optional: ['separation'],
  },
} as const satisfies Record<
  Component['kind'],
  { readonly required: readonly string[]; readonly optional: readonly string[] }
>;

function component(c: Ctx, path: string, v: unknown): Component {
  const o = c.object(path, v);
  const kind = c.oneOf(`${path}.kind`, o['kind'], COMPONENT_KINDS);
  const m = (k: string): number => c.number(`${path}.${k}`, o[k]);
  const opt = <T>(k: string, f: (x: unknown) => T): T | undefined =>
    k in o && o[k] !== undefined ? f(o[k]) : undefined;
  switch (kind) {
    case 'noseCone': {
      c.keys(path, o, COMPONENT_FIELDS.noseCone.required, COMPONENT_FIELDS.noseCone.optional);
      const shapeParameter = opt('shapeParameter', (x) => c.number(`${path}.shapeParameter`, x));
      const wallThickness = opt('wallThickness', (x) =>
        metres(c.number(`${path}.wallThickness`, x)),
      );
      const aftShoulder = opt('aftShoulder', (x) => {
        const s = c.object(`${path}.aftShoulder`, x);
        c.keys(`${path}.aftShoulder`, s, ['length', 'radius', 'wallThickness']);
        return {
          length: metres(c.number(`${path}.aftShoulder.length`, s['length'])),
          radius: metres(c.number(`${path}.aftShoulder.radius`, s['radius'])),
          wallThickness: metres(c.number(`${path}.aftShoulder.wallThickness`, s['wallThickness'])),
        };
      });
      return {
        kind,
        shape: c.oneOf(`${path}.shape`, o['shape'], NOSE_SHAPES),
        length: metres(m('length')),
        baseRadius: metres(m('baseRadius')),
        density: kilogramsPerCubicMetre(m('density')),
        ...(shapeParameter === undefined ? {} : { shapeParameter }),
        ...(wallThickness === undefined ? {} : { wallThickness }),
        ...(aftShoulder === undefined ? {} : { aftShoulder }),
      };
    }
    case 'transition': {
      c.keys(path, o, COMPONENT_FIELDS.transition.required, COMPONENT_FIELDS.transition.optional);
      const shapeParameter = opt('shapeParameter', (x) => c.number(`${path}.shapeParameter`, x));
      const wallThickness = opt('wallThickness', (x) =>
        metres(c.number(`${path}.wallThickness`, x)),
      );
      return {
        kind,
        shape: c.oneOf(`${path}.shape`, o['shape'], NOSE_SHAPES),
        length: metres(m('length')),
        foreRadius: metres(m('foreRadius')),
        aftRadius: metres(m('aftRadius')),
        density: kilogramsPerCubicMetre(m('density')),
        ...(shapeParameter === undefined ? {} : { shapeParameter }),
        ...(wallThickness === undefined ? {} : { wallThickness }),
      };
    }
    case 'bodyTube':
    case 'innerTube':
    case 'launchLug': {
      c.keys(path, o, COMPONENT_FIELDS[kind].required, COMPONENT_FIELDS[kind].optional);
      const radialOffset = opt('radialOffset', (x) => metres(c.number(`${path}.radialOffset`, x)));
      return {
        kind,
        length: metres(m('length')),
        outerRadius: metres(m('outerRadius')),
        wallThickness: metres(m('wallThickness')),
        density: kilogramsPerCubicMetre(m('density')),
        ...(radialOffset === undefined ? {} : { radialOffset }),
      };
    }
    case 'centeringRing':
    case 'bulkhead':
      c.keys(path, o, COMPONENT_FIELDS[kind].required, COMPONENT_FIELDS[kind].optional);
      return {
        kind,
        length: metres(m('length')),
        outerRadius: metres(m('outerRadius')),
        innerRadius: metres(m('innerRadius')),
        density: kilogramsPerCubicMetre(m('density')),
      };
    case 'massComponent':
    case 'parachute':
      c.keys(path, o, COMPONENT_FIELDS[kind].required, COMPONENT_FIELDS[kind].optional);
      return {
        kind,
        mass: kilograms(m('mass')),
        length: metres(m('length')),
        radius: metres(m('radius')),
      };
    case 'finSet': {
      c.keys(path, o, COMPONENT_FIELDS.finSet.required, COMPONENT_FIELDS.finSet.optional);
      const crossSection = opt('crossSection', (x) =>
        c.oneOf(`${path}.crossSection`, x, FIN_SECTIONS),
      );
      // D-081: a fin tab; the physics checks its sizes against the fin and body.
      const tab = opt('tab', (x) => {
        const t = c.object(`${path}.tab`, x);
        c.keys(`${path}.tab`, t, ['height', 'length', 'foreOffset']);
        return {
          height: metres(c.number(`${path}.tab.height`, t['height'])),
          length: metres(c.number(`${path}.tab.length`, t['length'])),
          foreOffset: metres(c.number(`${path}.tab.foreOffset`, t['foreOffset'])),
        };
      });
      // D-087: an elliptical or freeform planform; the physics checks the outline against the root and span.
      const shape = opt('shape', (x): FinShape => {
        const sh = c.object(`${path}.shape`, x);
        const shapeKind = c.oneOf(`${path}.shape.kind`, sh['kind'], [
          'elliptical',
          'freeform',
        ] as const);
        if (shapeKind === 'elliptical') {
          c.keys(`${path}.shape`, sh, ['kind']);
          return { kind: 'elliptical' };
        }
        c.keys(`${path}.shape`, sh, ['kind', 'points']);
        return {
          kind: 'freeform',
          points: c.array(`${path}.shape.points`, sh['points']).map((item, i) => {
            const pp = `${path}.shape.points[${String(i)}]`;
            const pt = c.object(pp, item);
            c.keys(pp, pt, ['x', 'y']);
            return {
              x: metres(c.number(`${pp}.x`, pt['x'])),
              y: metres(c.number(`${pp}.y`, pt['y'])),
            };
          }),
        };
      });
      const shearModulus = opt('shearModulus', (x) => {
        const g = c.number(`${path}.shearModulus`, x);
        if (!(g > 0)) c.fail(`${path}.shearModulus`, 'must be greater than 0 Pa');
        return pascals(g);
      });
      return {
        kind,
        count: c.integer(`${path}.count`, o['count']),
        rootChord: metres(m('rootChord')),
        tipChord: metres(m('tipChord')),
        sweep: metres(m('sweep')),
        span: metres(m('span')),
        thickness: metres(m('thickness')),
        density: kilogramsPerCubicMetre(m('density')),
        bodyRadius: metres(m('bodyRadius')),
        ...(crossSection === undefined ? {} : { crossSection }),
        ...(shearModulus === undefined ? {} : { shearModulus }),
        ...(tab === undefined ? {} : { tab }),
        ...(shape === undefined ? {} : { shape }),
      };
    }
    case 'railButton': {
      c.keys(path, o, COMPONENT_FIELDS.railButton.required, COMPONENT_FIELDS.railButton.optional);
      const separation = opt('separation', (x) => metres(c.number(`${path}.separation`, x)));
      return {
        kind,
        count: c.integer(`${path}.count`, o['count']),
        outerDiameter: metres(m('outerDiameter')),
        innerDiameter: metres(m('innerDiameter')),
        totalHeight: metres(m('totalHeight')),
        baseHeight: metres(m('baseHeight')),
        flangeHeight: metres(m('flangeHeight')),
        density: kilogramsPerCubicMetre(m('density')),
        bodyRadius: metres(m('bodyRadius')),
        ...(separation === undefined ? {} : { separation }),
      };
    }
  }
}

function motorDefinition(c: Ctx, path: string, v: unknown): MotorDefinition {
  const o = c.object(path, v);
  c.keys(
    path,
    o,
    [
      'designation',
      'manufacturer',
      'diameter',
      'length',
      'totalMass',
      'propellantMass',
      'points',
      'massRule',
      'sourceFormat',
    ],
    ['massProfile'],
  );
  const points = c.array(`${path}.points`, o['points']).map((p, i) => {
    const pp = c.object(`${path}.points[${String(i)}]`, p);
    c.keys(`${path}.points[${String(i)}]`, pp, ['time', 'thrust']);
    return {
      time: seconds(c.number(`${path}.points[${String(i)}].time`, pp['time'])),
      thrust: newtons(c.number(`${path}.points[${String(i)}].thrust`, pp['thrust'])),
    };
  });
  const massProfile =
    'massProfile' in o && o['massProfile'] !== undefined
      ? c.array(`${path}.massProfile`, o['massProfile']).map((p, i) => {
          const pp = c.object(`${path}.massProfile[${String(i)}]`, p);
          c.keys(
            `${path}.massProfile[${String(i)}]`,
            pp,
            ['time', 'propellantRemaining'],
            ['cgFromForeEnd'],
          );
          const cg =
            'cgFromForeEnd' in pp && pp['cgFromForeEnd'] !== undefined
              ? metres(
                  c.number(`${path}.massProfile[${String(i)}].cgFromForeEnd`, pp['cgFromForeEnd']),
                )
              : undefined;
          return {
            time: seconds(c.number(`${path}.massProfile[${String(i)}].time`, pp['time'])),
            propellantRemaining: kilograms(
              c.number(
                `${path}.massProfile[${String(i)}].propellantRemaining`,
                pp['propellantRemaining'],
              ),
            ),
            ...(cg === undefined ? {} : { cgFromForeEnd: cg }),
          };
        })
      : undefined;
  return {
    designation: c.nonEmptyString(`${path}.designation`, o['designation']),
    manufacturer: c.string(`${path}.manufacturer`, o['manufacturer']),
    diameter: metres(c.number(`${path}.diameter`, o['diameter'])),
    length: metres(c.number(`${path}.length`, o['length'])),
    totalMass: kilograms(c.number(`${path}.totalMass`, o['totalMass'])),
    propellantMass: kilograms(c.number(`${path}.propellantMass`, o['propellantMass'])),
    points,
    massRule: c.oneOf(`${path}.massRule`, o['massRule'], MASS_RULES),
    sourceFormat: c.oneOf(`${path}.sourceFormat`, o['sourceFormat'], SOURCE_FORMATS),
    ...(massProfile === undefined ? {} : { massProfile }),
  };
}

function provenance(c: Ctx, path: string, v: unknown): MotorProvenance {
  const o = c.object(path, v);
  const kind = c.oneOf(`${path}.kind`, o['kind'], ['bundled', 'thrustcurve', 'file', 'custom']);
  switch (kind) {
    case 'bundled':
      c.keys(path, o, ['kind', 'file']);
      return { kind, file: c.nonEmptyString(`${path}.file`, o['file']) };
    case 'thrustcurve':
      c.keys(path, o, ['kind', 'motorId', 'simfileId']);
      return {
        kind,
        motorId: c.nonEmptyString(`${path}.motorId`, o['motorId']),
        simfileId: c.nonEmptyString(`${path}.simfileId`, o['simfileId']),
      };
    case 'file':
      c.keys(path, o, ['kind', 'fileName']);
      return { kind, fileName: c.nonEmptyString(`${path}.fileName`, o['fileName']) };
    case 'custom':
      c.keys(path, o, ['kind']);
      return { kind };
  }
}

function motorSelection(c: Ctx, path: string, v: unknown): MotorSelection {
  const o = c.object(path, v);
  c.keys(path, o, ['definition', 'provenance'], ['ejectionDelay']);
  const ejectionDelay =
    'ejectionDelay' in o && o['ejectionDelay'] !== undefined
      ? seconds(c.number(`${path}.ejectionDelay`, o['ejectionDelay']))
      : undefined;
  return {
    definition: motorDefinition(c, `${path}.definition`, o['definition']),
    provenance: provenance(c, `${path}.provenance`, o['provenance']),
    ...(ejectionDelay === undefined ? {} : { ejectionDelay }),
  };
}

function motorMount(c: Ctx, path: string, v: unknown): MotorMount {
  const o = c.object(path, v);
  c.keys(path, o, ['componentId', 'overhang'], ['motor', 'cluster']);
  const motor =
    'motor' in o && o['motor'] !== undefined
      ? motorSelection(c, `${path}.motor`, o['motor'])
      : undefined;
  // Plan 0057: one offset per motor, finite, at least one.
  const cluster =
    'cluster' in o && o['cluster'] !== undefined
      ? c.array(`${path}.cluster`, o['cluster']).map((item, i) => {
          const p = `${path}.cluster[${String(i)}]`;
          const off = c.object(p, item);
          c.keys(p, off, ['y', 'z']);
          return {
            y: metres(c.number(`${p}.y`, off['y'])),
            z: metres(c.number(`${p}.z`, off['z'])),
          };
        })
      : undefined;
  if (cluster?.length === 0) c.fail(`${path}.cluster`, 'must list at least one motor offset');
  return {
    componentId: c.nonEmptyString(`${path}.componentId`, o['componentId']),
    overhang: metres(c.number(`${path}.overhang`, o['overhang'])),
    ...(motor === undefined ? {} : { motor }),
    ...(cluster === undefined ? {} : { cluster }),
  };
}

/** A list of approximations (D-084): each with its subject, what, method, effect and impact. */
function approximationList(c: Ctx, path: string, v: unknown): Approximation[] {
  return c.array(path, v).map((item, i) => {
    const p = `${path}[${String(i)}]`;
    const o = c.object(p, item);
    c.keys(p, o, ['subject', 'what', 'method', 'effect', 'impact']);
    return {
      subject: c.string(`${p}.subject`, o['subject']),
      what: c.string(`${p}.what`, o['what']),
      method: c.string(`${p}.method`, o['method']),
      effect: c.string(`${p}.effect`, o['effect']),
      impact: c.oneOf(`${p}.impact`, o['impact'], ['minor', 'moderate', 'major'] as const),
    };
  });
}

/** D-073: a mass of 0 kg or more and a finite CG from the component's forward end; at least one. */
function designMassOverride(c: Ctx, path: string, v: unknown): MassOverride {
  const o = c.object(path, v);
  c.keys(path, o, [], ['mass', 'cg']);
  const mass =
    'mass' in o && o['mass'] !== undefined ? c.number(`${path}.mass`, o['mass']) : undefined;
  const cg = 'cg' in o && o['cg'] !== undefined ? c.number(`${path}.cg`, o['cg']) : undefined;
  if (mass !== undefined && !(mass >= 0)) c.fail(`${path}.mass`, 'must be 0 kg or more');
  if (mass === undefined && cg === undefined) c.fail(path, 'must give a mass, a CG or both');
  return {
    ...(mass === undefined ? {} : { mass: kilograms(mass) }),
    ...(cg === undefined ? {} : { cg: metres(cg) }),
  };
}

function recoveryDevice(c: Ctx, path: string, v: unknown): DesignRecoveryDevice {
  const o = c.object(path, v);
  c.keys(path, o, ['id', 'name', 'diameter', 'dragCoefficient', 'deploy']);
  const d = c.object(`${path}.deploy`, o['deploy']);
  c.keys(`${path}.deploy`, d, ['event', 'delay'], ['altitude']);
  const event = c.oneOf(`${path}.deploy.event`, d['event'], DEPLOY_EVENTS);
  const altitude =
    'altitude' in d && d['altitude'] !== undefined
      ? metres(c.number(`${path}.deploy.altitude`, d['altitude']))
      : undefined;
  if (event === 'altitude' && altitude === undefined) {
    c.fail(`${path}.deploy`, 'an altitude deployment needs "altitude"');
  }
  return {
    id: c.nonEmptyString(`${path}.id`, o['id']),
    name: c.string(`${path}.name`, o['name']),
    diameter: metres(c.number(`${path}.diameter`, o['diameter'])),
    dragCoefficient: c.number(`${path}.dragCoefficient`, o['dragCoefficient']),
    deploy: {
      event,
      delay: seconds(c.number(`${path}.deploy.delay`, d['delay'])),
      ...(altitude === undefined ? {} : { altitude }),
    },
  };
}

function launch(c: Ctx, path: string, v: unknown): LaunchConditions {
  const o = c.object(path, v);
  c.keys(path, o, ['site', 'rail', 'wind']);
  const s = c.object(`${path}.site`, o['site']);
  c.keys(`${path}.site`, s, ['altitude'], ['latitude', 'temperature', 'pressure']);
  const has = (k: string): boolean => k in s && s[k] !== undefined;
  if (has('temperature') !== has('pressure')) {
    c.fail(`${path}.site`, 'temperature and pressure overrides must be given together');
  }
  const latitude = has('latitude')
    ? radians(c.number(`${path}.site.latitude`, s['latitude']))
    : undefined;
  const temperature = has('temperature')
    ? kelvin(c.number(`${path}.site.temperature`, s['temperature']))
    : undefined;
  const pressure = has('pressure')
    ? pascals(c.number(`${path}.site.pressure`, s['pressure']))
    : undefined;
  const r = c.object(`${path}.rail`, o['rail']);
  c.keys(`${path}.rail`, r, ['length', 'angleFromVertical', 'azimuth']);
  const w = c.object(`${path}.wind`, o['wind']);
  c.keys(`${path}.wind`, w, ['speed', 'from'], ['profile', 'turbulence']);
  const profile =
    'profile' in w && w['profile'] !== undefined
      ? c.array(`${path}.wind.profile`, w['profile']).map((row, i) => {
          const r = c.object(`${path}.wind.profile[${String(i)}]`, row);
          c.keys(`${path}.wind.profile[${String(i)}]`, r, ['altitude', 'speed', 'from']);
          return {
            altitude: metres(
              c.number(`${path}.wind.profile[${String(i)}].altitude`, r['altitude']),
            ),
            speed: metresPerSecond(
              c.number(`${path}.wind.profile[${String(i)}].speed`, r['speed']),
            ),
            from: radians(c.number(`${path}.wind.profile[${String(i)}].from`, r['from'])),
          };
        })
      : undefined;
  const turbulence =
    'turbulence' in w && w['turbulence'] !== undefined
      ? (() => {
          const t = c.object(`${path}.wind.turbulence`, w['turbulence']);
          c.keys(`${path}.wind.turbulence`, t, ['intensity', 'seed']);
          return {
            intensity: c.number(`${path}.wind.turbulence.intensity`, t['intensity']),
            seed: c.integer(`${path}.wind.turbulence.seed`, t['seed']),
          };
        })()
      : undefined;
  return {
    site: {
      altitude: metres(c.number(`${path}.site.altitude`, s['altitude'])),
      ...(latitude === undefined ? {} : { latitude }),
      ...(temperature === undefined ? {} : { temperature }),
      ...(pressure === undefined ? {} : { pressure }),
    },
    rail: {
      length: metres(c.number(`${path}.rail.length`, r['length'])),
      angleFromVertical: radians(
        c.number(`${path}.rail.angleFromVertical`, r['angleFromVertical']),
      ),
      azimuth: radians(c.number(`${path}.rail.azimuth`, r['azimuth'])),
    },
    wind: {
      speed: metresPerSecond(c.number(`${path}.wind.speed`, w['speed'])),
      from: radians(c.number(`${path}.wind.from`, w['from'])),
      ...(profile === undefined ? {} : { profile }),
      ...(turbulence === undefined ? {} : { turbulence }),
    },
  };
}

function integrator(c: Ctx, path: string, v: unknown): IntegratorOptions {
  const o = c.object(path, v);
  const kind = c.oneOf(`${path}.kind`, o['kind'], ['rk4', 'dormand-prince']);
  if (kind === 'rk4') {
    c.keys(path, o, ['kind', 'timeStep']);
    return { kind, timeStep: seconds(c.number(`${path}.timeStep`, o['timeStep'])) };
  }
  c.keys(path, o, ['kind', 'relativeTolerance', 'absoluteTolerance', 'initialStep', 'maxStep']);
  return {
    kind,
    relativeTolerance: c.number(`${path}.relativeTolerance`, o['relativeTolerance']),
    absoluteTolerance: c.number(`${path}.absoluteTolerance`, o['absoluteTolerance']),
    initialStep: seconds(c.number(`${path}.initialStep`, o['initialStep'])),
    maxStep: seconds(c.number(`${path}.maxStep`, o['maxStep'])),
  };
}

function simulation(c: Ctx, path: string, v: unknown): SimulationSettings {
  const o = c.object(path, v);
  c.keys(path, o, ['integrator', 'maxTime', 'recordInterval']);
  return {
    integrator: integrator(c, `${path}.integrator`, o['integrator']),
    maxTime: seconds(c.number(`${path}.maxTime`, o['maxTime'])),
    recordInterval: seconds(c.number(`${path}.recordInterval`, o['recordInterval'])),
  };
}

function stabilityThresholds(c: Ctx, path: string, v: unknown): StabilityThresholds {
  const o = c.object(path, v);
  c.keys(path, o, ['unstableBelow', 'overstableAbove']);
  return {
    unstableBelow: c.number(`${path}.unstableBelow`, o['unstableBelow']),
    overstableAbove: c.number(`${path}.overstableAbove`, o['overstableAbove']),
  };
}

function warningThresholds(c: Ctx, path: string, v: unknown): WarningThresholds {
  const o = c.object(path, v);
  c.keys(path, o, ['minRailExitVelocity', 'minThrustToWeight', 'maxDeploymentVelocity']);
  return {
    minRailExitVelocity: metresPerSecond(
      c.number(`${path}.minRailExitVelocity`, o['minRailExitVelocity']),
    ),
    minThrustToWeight: c.number(`${path}.minThrustToWeight`, o['minThrustToWeight']),
    maxDeploymentVelocity: metresPerSecond(
      c.number(`${path}.maxDeploymentVelocity`, o['maxDeploymentVelocity']),
    ),
  };
}

function dragCurve(c: Ctx, path: string, v: unknown): DragCurve {
  const o = c.object(path, v);
  c.keys(path, o, ['label', 'points']);
  return {
    label: c.string(`${path}.label`, o['label']),
    points: c.array(`${path}.points`, o['points']).map((p, i) => {
      const pp = c.object(`${path}.points[${String(i)}]`, p);
      c.keys(`${path}.points[${String(i)}]`, pp, ['mach', 'cd']);
      return {
        mach: c.number(`${path}.points[${String(i)}].mach`, pp['mach']),
        cd: c.number(`${path}.points[${String(i)}].cd`, pp['cd']),
      };
    }),
  };
}

function recordedFlight(c: Ctx, path: string, v: unknown): RecordedFlight {
  const o = c.object(path, v);
  c.keys(path, o, ['label', 'points']);
  return {
    label: c.string(`${path}.label`, o['label']),
    points: c.array(`${path}.points`, o['points']).map((p, i) => {
      const pp = c.object(`${path}.points[${String(i)}]`, p);
      c.keys(`${path}.points[${String(i)}]`, pp, ['time', 'altitude']);
      return {
        time: seconds(c.number(`${path}.points[${String(i)}].time`, pp['time'])),
        altitude: metres(c.number(`${path}.points[${String(i)}].altitude`, pp['altitude'])),
      };
    }),
  };
}

const VARIATION_KEYS = [
  'windSpeed',
  'windDirection',
  'railAngle',
  'railAzimuth',
  'motorImpulseScale',
  'structuralMassScale',
] as const;

function dispersion(c: Ctx, path: string, v: unknown): DispersionSettingsRecord {
  const o = c.object(path, v);
  c.keys(path, o, ['runs', 'seed', 'variations']);
  const vars = c.object(`${path}.variations`, o['variations']);
  c.keys(`${path}.variations`, vars, [...VARIATION_KEYS]);
  const read = (k: (typeof VARIATION_KEYS)[number]): number =>
    c.number(`${path}.variations.${k}`, vars[k]);
  return {
    runs: c.integer(`${path}.runs`, o['runs']),
    seed: c.integer(`${path}.seed`, o['seed']),
    variations: {
      windSpeed: read('windSpeed'),
      windDirection: read('windDirection'),
      railAngle: read('railAngle'),
      railAzimuth: read('railAzimuth'),
      motorImpulseScale: read('motorImpulseScale'),
      structuralMassScale: read('structuralMassScale'),
    },
  };
}

/** Validate a stored motor selection (definition and provenance) on its own, for the motor cache. */
export function validateMotorSelection(value: unknown, fileName?: string): MotorSelection {
  return motorSelection(new Ctx(fileName), '$', value);
}

/**
 * Validate a parsed JSON value of the current schema version into a
 * RocketDesign. Throws DesignFileError naming the path and the problem.
 */
export function validateDesign(value: unknown, fileName?: string): RocketDesign {
  const c: Ctx = new Ctx(fileName);
  const o = c.object('$', value);
  c.keys(
    '$',
    o,
    [
      'schemaVersion',
      'id',
      'name',
      'components',
      'recovery',
      'finish',
      'launch',
      'simulation',
      'stabilityThresholds',
      'warningThresholds',
    ],
    [
      'motorMount',
      'referenceDiameter',
      'dragCurve',
      'recordedFlight',
      'dispersion',
      'approximations',
      'asBuilt',
    ],
  );
  const version = c.integer('$.schemaVersion', o['schemaVersion']);
  if (version !== CURRENT_SCHEMA_VERSION) {
    c.fail(
      '$.schemaVersion',
      `expected ${String(CURRENT_SCHEMA_VERSION)}, received ${String(version)} (migrate first)`,
    );
  }
  const ids = new Set<string>();
  const components: DesignComponent[] = c.array('$.components', o['components']).map((v, i) => {
    const path = `$.components[${String(i)}]`;
    const co = c.object(path, v);
    c.keys(path, co, ['id', 'name', 'position', 'component'], ['massOverride', 'approximations']);
    const id = c.nonEmptyString(`${path}.id`, co['id']);
    if (ids.has(id)) c.fail(`${path}.id`, `duplicate id "${id}"`);
    ids.add(id);
    const massOverride =
      'massOverride' in co && co['massOverride'] !== undefined
        ? designMassOverride(c, `${path}.massOverride`, co['massOverride'])
        : undefined;
    return {
      id,
      name: c.string(`${path}.name`, co['name']),
      position: metres(c.number(`${path}.position`, co['position'])),
      component: component(c, `${path}.component`, co['component']),
      ...(massOverride === undefined ? {} : { massOverride }),
      ...('approximations' in co && co['approximations'] !== undefined
        ? { approximations: approximationList(c, `${path}.approximations`, co['approximations']) }
        : {}),
    };
  });
  const recovery = c.array('$.recovery', o['recovery']).map((v, i) => {
    const d = recoveryDevice(c, `$.recovery[${String(i)}]`, v);
    if (ids.has(d.id)) c.fail(`$.recovery[${String(i)}].id`, `duplicate id "${d.id}"`);
    ids.add(d.id);
    return d;
  });
  const mount =
    'motorMount' in o && o['motorMount'] !== undefined
      ? motorMount(c, '$.motorMount', o['motorMount'])
      : undefined;
  if (mount !== undefined) {
    const target = components.find((x) => x.id === mount.componentId);
    if (target === undefined) {
      c.fail('$.motorMount.componentId', `no component has the id "${mount.componentId}"`);
    }
    if (target.component.kind !== 'innerTube' && target.component.kind !== 'bodyTube') {
      c.fail(
        '$.motorMount.componentId',
        `the motor mount must be an inner tube or a body tube, "${target.name}" is a ${target.component.kind}`,
      );
    }
  }
  const finishObj = c.object('$.finish', o['finish']);
  c.keys('$.finish', finishObj, ['roughnessHeight']);
  const referenceDiameter =
    'referenceDiameter' in o && o['referenceDiameter'] !== undefined
      ? metres(c.number('$.referenceDiameter', o['referenceDiameter']))
      : undefined;
  const curve =
    'dragCurve' in o && o['dragCurve'] !== undefined
      ? dragCurve(c, '$.dragCurve', o['dragCurve'])
      : undefined;
  const recorded =
    'recordedFlight' in o && o['recordedFlight'] !== undefined
      ? recordedFlight(c, '$.recordedFlight', o['recordedFlight'])
      : undefined;
  const disp =
    'dispersion' in o && o['dispersion'] !== undefined
      ? dispersion(c, '$.dispersion', o['dispersion'])
      : undefined;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: c.nonEmptyString('$.id', o['id']),
    name: c.string('$.name', o['name']),
    components,
    ...(mount === undefined ? {} : { motorMount: mount }),
    recovery,
    finish: {
      roughnessHeight: metres(c.number('$.finish.roughnessHeight', finishObj['roughnessHeight'])),
    },
    ...(referenceDiameter === undefined ? {} : { referenceDiameter }),
    launch: launch(c, '$.launch', o['launch']),
    simulation: simulation(c, '$.simulation', o['simulation']),
    stabilityThresholds: stabilityThresholds(c, '$.stabilityThresholds', o['stabilityThresholds']),
    warningThresholds: warningThresholds(c, '$.warningThresholds', o['warningThresholds']),
    ...(curve === undefined ? {} : { dragCurve: curve }),
    ...(recorded === undefined ? {} : { recordedFlight: recorded }),
    ...(disp === undefined ? {} : { dispersion: disp }),
    ...('approximations' in o && o['approximations'] !== undefined
      ? { approximations: approximationList(c, '$.approximations', o['approximations']) }
      : {}),
    ...('asBuilt' in o && o['asBuilt'] !== undefined
      ? { asBuilt: asBuiltOf(c, '$.asBuilt', o['asBuilt']) }
      : {}),
  };
}

/** D-089: a positive mass and/or a finite CG from the nose tip; at least one. */
function asBuiltOf(c: Ctx, path: string, v: unknown): AsBuilt {
  const o = c.object(path, v);
  c.keys(path, o, [], ['mass', 'cg']);
  const mass =
    'mass' in o && o['mass'] !== undefined ? c.number(`${path}.mass`, o['mass']) : undefined;
  const cg = 'cg' in o && o['cg'] !== undefined ? c.number(`${path}.cg`, o['cg']) : undefined;
  if (mass === undefined && cg === undefined) c.fail(path, 'needs a mass, a CG or both');
  if (mass !== undefined && !(mass > 0)) c.fail(`${path}.mass`, 'must be greater than 0 kg');
  return {
    ...(mass === undefined ? {} : { mass: kilograms(mass) }),
    ...(cg === undefined ? {} : { cg: metres(cg) }),
  };
}
