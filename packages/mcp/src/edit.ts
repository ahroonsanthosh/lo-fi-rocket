/**
 * Design edits as the MCP tools make them (plan 0062): parts added, changed and removed with
 * quantities converted to SI, relative positions resolved, and every value the caller did not give
 * recorded on the part as an approximation (D-083, CLAUDE.md 1 rule 3), so a default can never be
 * mistaken for the user's figure. Every edit returns a design that passes the design file's
 * validator and that the engine can compute; otherwise it throws EditError with a plain message.
 */
import {
  COMPONENT_FIELDS,
  componentLength,
  defaultComponent,
  designMassProperties,
  designStability,
  isExternal,
  newId,
  validateDesign,
  withoutComponent,
  type ComponentKind,
  type DesignComponent,
  type RocketDesign,
} from '@lo-fi-rocket/formats';
import type { Approximation, ApproximationImpact, Component } from '@lo-fi-rocket/physics';
import { PART_FIELDS, type FieldSpec } from './fields.js';
import { QuantityError, SI_UNIT, toSi, type Dimension } from './quantity.js';

/** An edit that cannot be made, with what to do instead. */
export class EditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditError';
  }
}

export type QuantityInput = number | string;

/** A part's position: from the nose tip, or relative to another part (OpenRocket's terms). */
export type PositionInput =
  | QuantityInput
  | {
      readonly relativeTo: string;
      /** top: fore ends level; bottom: aft ends level; middle: centres level; after: this part's fore end at the other's aft end. */
      readonly method: 'top' | 'bottom' | 'middle' | 'after';
      /** Moves the part aft (positive) or forward (negative) from that alignment. */
      readonly offset?: QuantityInput;
    };

const QUANTITY_TYPES: ReadonlySet<FieldSpec['type']> = new Set<FieldSpec['type']>([
  'length',
  'mass',
  'angle',
  'time',
  'speed',
  'temperature',
  'pressure',
  'density',
  'number',
]);

/** Plain name of a part kind for messages and approximation subjects. */
export function subjectOf(kind: ComponentKind, name: string): string {
  const label: Record<ComponentKind, string> = {
    noseCone: 'Nose cone',
    transition: 'Transition',
    bodyTube: 'Body tube',
    innerTube: 'Inner tube',
    launchLug: 'Launch lug',
    centeringRing: 'Centering ring',
    bulkhead: 'Bulkhead',
    massComponent: 'Mass item',
    parachute: 'Packed parachute',
    finSet: 'Fin set',
    railButton: 'Rail buttons',
  };
  return `${label[kind]} "${name}"`;
}

function fieldPath(kind: ComponentKind, key: string): string {
  return `${kind}.${key}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function quantity(path: string, dimension: Dimension, v: unknown): number {
  if (typeof v !== 'number' && typeof v !== 'string') {
    throw new QuantityError(
      path,
      `expected a number or a string such as "38 mm", received ${JSON.stringify(v)}`,
    );
  }
  return toSi(path, dimension, v);
}

/** One field's value in SI, as the design file holds it. */
function convertField(kind: ComponentKind, key: string, spec: FieldSpec, v: unknown): unknown {
  const path = fieldPath(kind, key);
  switch (spec.type) {
    case 'length':
    case 'mass':
    case 'angle':
    case 'time':
    case 'speed':
    case 'temperature':
    case 'pressure':
    case 'density':
    case 'number':
      return quantity(path, spec.type, v);
    case 'integer': {
      const n = quantity(path, 'number', v);
      if (!Number.isInteger(n))
        throw new QuantityError(path, `must be a whole number, received ${String(n)}`);
      return n;
    }
    case 'noseShape':
    case 'finSection':
      return v;
    case 'shoulder': {
      if (!isRecord(v)) throw new QuantityError(path, 'expected {length, radius, wallThickness}');
      return {
        length: quantity(`${path}.length`, 'length', v['length']),
        radius: quantity(`${path}.radius`, 'length', v['radius']),
        wallThickness: quantity(`${path}.wallThickness`, 'length', v['wallThickness']),
        ...Object.fromEntries(
          Object.entries(v).filter(([k]) => !['length', 'radius', 'wallThickness'].includes(k)),
        ),
      };
    }
    case 'tab': {
      if (!isRecord(v)) throw new QuantityError(path, 'expected {height, length, foreOffset}');
      return {
        height: quantity(`${path}.height`, 'length', v['height']),
        length: quantity(`${path}.length`, 'length', v['length']),
        foreOffset: quantity(`${path}.foreOffset`, 'length', v['foreOffset']),
        ...Object.fromEntries(
          Object.entries(v).filter(([k]) => !['height', 'length', 'foreOffset'].includes(k)),
        ),
      };
    }
    case 'finShape': {
      if (!isRecord(v))
        throw new QuantityError(
          path,
          'expected {"kind":"elliptical"} or {"kind":"freeform","points":[…]}',
        );
      if (v['kind'] !== 'freeform') return v;
      const points = v['points'];
      if (!Array.isArray(points))
        throw new QuantityError(`${path}.points`, 'expected a list of {x, y}');
      if (points.length > MAX_FIN_POINTS) {
        throw new QuantityError(`${path}.points`, `at most ${String(MAX_FIN_POINTS)} points`);
      }
      return {
        ...v,
        points: points.map((p: unknown, i) => {
          if (!isRecord(p))
            throw new QuantityError(`${path}.points[${String(i)}]`, 'expected {x, y}');
          return {
            ...p,
            x: quantity(`${path}.points[${String(i)}].x`, 'length', p['x']),
            y: quantity(`${path}.points[${String(i)}].y`, 'length', p['y']),
          };
        }),
      };
    }
  }
}

/** Limits on what one design may hold (plan 0062 section 5). */
export const MAX_PARTS = 500;
export const MAX_FIN_POINTS = 1000;

/** The given fields in SI, and the optional fields given as null (left out: a solid nose cone). */
export interface ConvertedFields {
  readonly values: Record<string, unknown>;
  readonly absent: ReadonlySet<string>;
}

/** The given fields in SI; unknown fields are refused with the accepted list. */
export function convertFields(
  kind: ComponentKind,
  fields: Readonly<Record<string, unknown>>,
): ConvertedFields {
  const specs = PART_FIELDS[kind];
  const values: Record<string, unknown> = {};
  const absent = new Set<string>();
  const optional: readonly string[] = COMPONENT_FIELDS[kind].optional;
  for (const [key, v] of Object.entries(fields)) {
    if (key === 'kind') continue;
    const spec = specs[key];
    if (spec === undefined) {
      const accepted = Object.entries(specs).map(([k, s]) => `${k} (${s.label})`);
      throw new EditError(`${kind} has no field "${key}". Its fields are: ${accepted.join(', ')}.`);
    }
    if (v === undefined) continue;
    if (v === null) {
      if (!optional.includes(key))
        throw new EditError(`${kind}.${key} is required and cannot be null`);
      absent.add(key);
      continue;
    }
    values[key] = convertField(kind, key, spec, v);
  }
  return { values, absent };
}

/** The outer radius of the body outline at x, from the body tube there; undefined elsewhere. */
function bodyTubeRadiusAt(design: RocketDesign, x: number): number | undefined {
  for (const d of design.components) {
    const c = d.component;
    if (c.kind !== 'bodyTube') continue;
    if (x >= d.position - 1e-12 && x <= d.position + c.length + 1e-12) return c.outerRadius;
  }
  return undefined;
}

/** Resolve a position input to metres from the nose tip. */
export function resolvePosition(
  design: RocketDesign,
  length: number,
  position: PositionInput,
): number {
  if (typeof position === 'number' || typeof position === 'string')
    return toSi('position', 'length', position);
  const ref = design.components.find((c) => c.id === position.relativeTo);
  if (ref === undefined) {
    throw new EditError(
      `position.relativeTo: no part with id "${position.relativeTo}" in this design (get_design lists them).`,
    );
  }
  const offset =
    position.offset === undefined ? 0 : toSi('position.offset', 'length', position.offset);
  const refLength = componentLength(ref.component);
  switch (position.method) {
    case 'top':
      return ref.position + offset;
    case 'bottom':
      return ref.position + refLength - length + offset;
    case 'middle':
      return ref.position + (refLength - length) / 2 + offset;
    case 'after':
      return ref.position + refLength + offset;
  }
}

/** How much a value left at its default can move the results (fidelity.ts impact levels). */
function defaultImpact(kind: ComponentKind, key: string): ApproximationImpact {
  const outline = new Set([
    'shape',
    'length',
    'baseRadius',
    'foreRadius',
    'aftRadius',
    'rootChord',
    'tipChord',
    'sweep',
    'span',
    'count',
  ]);
  if (
    (kind === 'noseCone' || kind === 'transition' || kind === 'bodyTube' || kind === 'finSet') &&
    outline.has(key)
  ) {
    return 'major';
  }
  if (kind === 'bodyTube' && key === 'outerRadius') return 'major';
  if (kind === 'launchLug' || kind === 'railButton') return 'minor';
  return 'moderate';
}

const EFFECT: Record<ApproximationImpact, string> = {
  major:
    'the outline, and with it the stability margin, the drag and the apogee, may differ a lot from the real rocket',
  moderate:
    'the mass and the centre of gravity, and with them the stability margin and the apogee, may differ from the real rocket',
  minor: 'a small effect on the drag and the mass',
};

function describeValue(spec: FieldSpec, v: unknown): string {
  if (typeof v === 'number' && QUANTITY_TYPES.has(spec.type)) {
    const unit = SI_UNIT[spec.type as Dimension];
    return unit === '' ? String(v) : `${String(Number(v.toPrecision(6)))} ${unit}`;
  }
  return JSON.stringify(v);
}

/** The approximation that marks a field left at the app's editing default. */
export function defaultApproximation(
  kind: ComponentKind,
  name: string,
  key: string,
  value: unknown,
): Approximation {
  const spec = PART_FIELDS[kind][key];
  const label = spec?.label ?? key;
  const impact = defaultImpact(kind, key);
  return {
    subject: subjectOf(kind, name),
    what: `${label} not given`,
    method: `the app's editing default, ${spec === undefined ? JSON.stringify(value) : describeValue(spec, value)}; ask the user for the real value`,
    effect: EFFECT[impact],
    impact,
  };
}

/** The approximation that marks a part placed where the caller did not say. */
function positionApproximation(
  kind: ComponentKind,
  name: string,
  x: number,
  how: string,
): Approximation {
  return {
    subject: subjectOf(kind, name),
    what: 'position not given',
    method: `placed ${how}, ${String(Number(x.toPrecision(6)))} m from the nose tip; ask the user where it sits`,
    effect: EFFECT.moderate,
    impact: 'moderate',
  };
}

/** Check a design with the file validator and the engine; throw EditError with the reason. */
export function checked(design: RocketDesign): RocketDesign {
  if (design.components.length > MAX_PARTS) {
    throw new EditError(`a design holds at most ${String(MAX_PARTS)} parts`);
  }
  let valid: RocketDesign;
  try {
    valid = validateDesign(JSON.parse(JSON.stringify(design)));
  } catch (error) {
    throw new EditError(error instanceof Error ? error.message : String(error));
  }
  // The engine must be able to compute the mass and, once there is an outline, the stability.
  try {
    designMassProperties(valid, 'no-motor');
    if (valid.components.some((c) => isExternal(c.component.kind))) designStability(valid);
  } catch (error) {
    throw new EditError(
      `the engine cannot use this design: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return valid;
}

export interface AddPartInput {
  readonly kind: ComponentKind;
  readonly name?: string;
  readonly position?: PositionInput;
  readonly fields?: Readonly<Record<string, unknown>>;
}

export interface EditResult {
  readonly design: RocketDesign;
  readonly part: DesignComponent | undefined;
  /** Fields that took the editing default, by label. */
  readonly defaulted: readonly string[];
}

/** Add a part; fields not given take the app's editing defaults, each recorded as an approximation. */
export function addPart(
  design: RocketDesign,
  input: AddPartInput,
  id: string = newId(),
): EditResult {
  const { values: given, absent } = convertFields(input.kind, input.fields ?? {});
  const base = defaultComponent(input.kind, design);
  const name = input.name ?? base.name;
  const component: Record<string, unknown> = Object.fromEntries(
    Object.entries({ ...base.component, ...given }).filter(([k]) => !absent.has(k)),
  );
  const approximations: Approximation[] = [];
  const defaulted: string[] = [];

  // Every value of the default that the caller did not give is listed. The shape parameter is the
  // exception: without one the physics uses the profile's own default (noseProfile: ogive 1, that
  // is tangent; parabolic 1; power 0.5; Haack 0, Von Kármán), listed only for the profiles whose
  // default is a choice rather than the profile's usual meaning.
  for (const key of Object.keys(base.component)) {
    if (key === 'kind' || key in given || absent.has(key) || key === 'shapeParameter') continue;
    if (key === 'bodyRadius' || key === 'radialOffset') continue; // derived below
    defaulted.push(PART_FIELDS[input.kind][key]?.label ?? key);
    approximations.push(defaultApproximation(input.kind, name, key, component[key]));
  }
  if (!('shapeParameter' in given)) {
    delete component['shapeParameter'];
    const shape = component['shape'];
    if (
      'shape' in given &&
      !absent.has('shapeParameter') &&
      (shape === 'parabolic' || shape === 'power')
    ) {
      defaulted.push('shape parameter');
      approximations.push({
        subject: subjectOf(input.kind, name),
        what: 'shape parameter not given',
        method: `the ${shape} profile's default κ = ${shape === 'power' ? '0.5' : '1'}; ask the user for the real profile`,
        effect: 'a small change in the nose drag and the centre of pressure',
        impact: 'minor',
      });
    }
  }

  const length = componentLength(component as unknown as Component);
  let position: number;
  if (input.position !== undefined) {
    position = resolvePosition(design, length, input.position);
  } else if (isExternal(input.kind)) {
    // Stacked on the outline: the natural place for an outline part, not an approximation.
    position = base.position;
  } else if (input.kind === 'finSet') {
    // Flush with the aft end of the outline, the usual place for fins.
    const aft = design.components
      .filter((c) => isExternal(c.component.kind))
      .reduce((x, c) => Math.max(x, c.position + componentLength(c.component)), 0);
    position = Math.max(0, aft - length);
    approximations.push(
      positionApproximation(input.kind, name, position, 'flush with the aft end of the body'),
    );
  } else {
    position = base.position;
    approximations.push(
      positionApproximation(input.kind, name, position, 'at the app’s editing default'),
    );
  }

  // The body radius under fins and buttons, and a lug's offset, follow from the body tube there.
  const derivedKey =
    input.kind === 'launchLug'
      ? 'radialOffset'
      : input.kind === 'finSet' || input.kind === 'railButton'
        ? 'bodyRadius'
        : undefined;
  if (derivedKey !== undefined && !(derivedKey in given)) {
    const r = bodyTubeRadiusAt(design, position);
    if (r !== undefined) {
      component[derivedKey] =
        derivedKey === 'radialOffset' ? r + (component['outerRadius'] as number) : r;
    } else {
      defaulted.push(PART_FIELDS[input.kind][derivedKey]?.label ?? derivedKey);
      approximations.push(
        defaultApproximation(input.kind, name, derivedKey, component[derivedKey]),
      );
    }
  }

  const part: DesignComponent = {
    id,
    name,
    position: position as DesignComponent['position'],
    component: component as unknown as Component,
    ...(approximations.length === 0 ? {} : { approximations }),
  };
  const next = checked({ ...design, components: [...design.components, part] });
  return { design: next, part: next.components.find((c) => c.id === id), defaulted };
}

export interface UpdatePartInput {
  readonly name?: string;
  readonly position?: PositionInput;
  readonly fields?: Readonly<Record<string, unknown>>;
  /** Remove these optional fields (for example a nose cone's wallThickness to make it solid). */
  readonly remove?: readonly string[];
}

/** Change a part; each field given clears its "not given" approximation. */
export function updatePart(design: RocketDesign, id: string, input: UpdatePartInput): EditResult {
  const old = design.components.find((c) => c.id === id);
  if (old === undefined)
    throw new EditError(`no part with id "${id}" in this design (get_design lists them)`);
  const kind = old.component.kind;
  const { values: given, absent } = convertFields(kind, input.fields ?? {});
  const removed = new Set<string>([...absent, ...(input.remove ?? [])]);
  for (const key of removed) {
    if (!(COMPONENT_FIELDS[kind].optional as readonly string[]).includes(key)) {
      throw new EditError(
        `${kind}.${key} cannot be removed; only optional fields can (${COMPONENT_FIELDS[kind].optional.join(', ') || 'none'})`,
      );
    }
  }
  const component: Record<string, unknown> = Object.fromEntries(
    Object.entries({ ...old.component, ...given }).filter(([k]) => !removed.has(k)),
  );
  const name = input.name ?? old.name;
  const length = componentLength(component as unknown as Component);
  const position =
    input.position === undefined ? old.position : resolvePosition(design, length, input.position);
  const cleared = new Set<string>([
    ...Object.keys(given).map((k) => `${PART_FIELDS[kind][k]?.label ?? k} not given`),
    ...[...removed].map((k) => `${PART_FIELDS[kind][k]?.label ?? k} not given`),
    ...(input.position === undefined ? [] : ['position not given']),
  ]);
  const approximations = (old.approximations ?? [])
    .filter((a) => !cleared.has(a.what))
    .map((a) =>
      a.subject === subjectOf(kind, old.name) ? { ...a, subject: subjectOf(kind, name) } : a,
    );
  const part: DesignComponent = {
    id: old.id,
    name,
    position: position as DesignComponent['position'],
    component: component as unknown as Component,
    ...(old.massOverride === undefined ? {} : { massOverride: old.massOverride }),
    ...(approximations.length === 0 ? {} : { approximations }),
  };
  const next = checked({
    ...design,
    components: design.components.map((c) => (c.id === id ? part : c)),
  });
  return { design: next, part: next.components.find((c) => c.id === id), defaulted: [] };
}

/** Remove a part, and every motor mount on it. */
export function removePart(design: RocketDesign, id: string): RocketDesign {
  if (!design.components.some((c) => c.id === id)) {
    throw new EditError(`no part with id "${id}" in this design (get_design lists them)`);
  }
  return checked(withoutComponent(design, id));
}
