/**
 * The paste box (plan 0082, D-122): building with Claude on the web site, with nothing to download
 * and nothing to pay. The site gives the user a prompt; they ask Claude in any Claude app, on
 * their own plan; they paste the answer back, and it is checked against the `build_and_fly`
 * schema (spec.ts) and built by `Session.build`, exactly as the MCP tool builds it. The box also
 * takes the text of a design file (.lofi.json, OpenRocket XML, RASAero II .CDX1) or a dropped file.
 *
 * Browser-safe: no MCP SDK and no Node module. Everything runs on the user's device; the one
 * network call is the read-only ThrustCurve.org lookup of a motor the library lacks, through the
 * transport the caller passes.
 */
import {
  designMotors,
  FormatError,
  MAX_INPUT_BYTES,
  newId,
  orkToDesign,
  parseOrk,
  requireWithin,
  type MotorProvenance,
  type RocketDesign,
  type Transport,
} from '@lo-fi-rocket/formats';
import type { MotorDefinition } from '@lo-fi-rocket/physics';
import * as z from 'zod';
import { PART_KINDS } from './fields.js';
import { acceptedUnits } from './quantity.js';
import { fieldReference } from './report.js';
import { LAUNCH_SETTINGS, Session, type LaunchSetting, type LibraryMotor } from './session.js';
import { buildAndFlyInput, MAX_CONTENT_CHARACTERS, toBuildSpec } from './spec.js';

export { MAX_CONTENT_CHARACTERS };

/** What the pasted text turned out to be. */
export type PasteKind = 'specification' | 'design' | 'openrocket' | 'rasaero';

/** A motor the user already has (downloaded or imported in the app), offered to the build. */
export interface PasteLibraryMotor {
  readonly definition: MotorDefinition;
  readonly provenance: MotorProvenance;
  readonly delays: readonly number[] | 'plugged' | undefined;
}

export interface PasteOptions {
  /** Reaches ThrustCurve.org for a motor the library lacks; without one the lookup is offline. */
  readonly transport?: Transport;
  /** The user's own motors, besides the bundled ones. */
  readonly library?: readonly PasteLibraryMotor[];
}

export interface PasteResult {
  readonly kind: PasteKind;
  readonly design: RocketDesign;
  /** Plain sentences: what was read, the import notices, the motor used, the settings not given. */
  readonly notices: readonly string[];
  /** Why the rocket cannot fly yet (no motor, or the motor was not found); absent when it can. */
  readonly notFlown?: string;
}

/** A paste that cannot be used, said in plain words; nothing was changed. */
export class PasteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasteError';
  }
}

const LAUNCH_WORDS: Readonly<Record<LaunchSetting, string>> = {
  siteAltitude: 'site altitude',
  temperature: 'temperature',
  pressure: 'pressure',
  railLength: 'rail length',
  railAngle: 'rail angle',
  railAzimuth: 'rail direction',
  windSpeed: 'wind speed',
  windFrom: 'wind direction',
};

/** A small rocket in the specification's form, for the prompt. Built in the tests (paste.test.ts). */
export const PROMPT_EXAMPLE = {
  name: 'Sport rocket',
  parts: [
    {
      kind: 'noseCone',
      name: 'Nose cone',
      fields: { shape: 'ogive', length: '100 mm', baseRadius: '20.5 mm', wallThickness: '1.5 mm' },
    },
    {
      kind: 'bodyTube',
      name: 'Body tube',
      fields: { length: '450 mm', outerRadius: '20.5 mm', wallThickness: '0.6 mm' },
    },
    {
      kind: 'innerTube',
      name: 'Motor mount',
      position: { relativeTo: 'Body tube', method: 'bottom' },
      fields: { length: '70 mm', outerRadius: '12 mm', wallThickness: '0.5 mm' },
    },
    {
      kind: 'finSet',
      name: 'Fins',
      fields: {
        count: 3,
        rootChord: '70 mm',
        tipChord: '30 mm',
        sweep: '40 mm',
        span: '50 mm',
        thickness: '3 mm',
      },
    },
  ],
  motor: { name: 'Estes D12-5' },
  recovery: [{ name: 'Parachute', diameter: '12 in', deploy: { event: 'ejection' } }],
  assumptions: [
    {
      part: 3,
      what: 'fin thickness 3 mm',
      method: 'read from the photo against the 41 mm body tube',
      effect: 'thicker fins add mass and a little drag',
      impact: 'minor',
    },
  ],
};

/**
 * The prompt the user copies into a Claude app. It carries everything Claude needs without the
 * MCP tools: the rules of the `build_and_fly` tool, every field with its meaning and units, and
 * the answer's JSON Schema, generated from the same schema that checks the answer.
 */
export function pastePrompt(): string {
  const units = Object.fromEntries(
    Object.entries(acceptedUnits())
      .filter(([, u]) => u.length > 0)
      .map(([d, u]) => [d, [...new Set(u)]]),
  );
  return `I am designing a model rocket in Lo-Fi Rocket (https://ahroonsanthosh.github.io/lo-fi-rocket/), a free rocket simulator. Below this message I describe my rocket, or attach a photo, a parts list or a kit page. Turn it into the JSON specification described here, and answer with only that JSON in one \`\`\`json block. I will paste your answer into the simulator, which checks it, builds the rocket and computes every figure. Do not compute stability, mass or flight figures yourself.

Rules:
1. "parts" in order from nose to tail. The part kinds: ${JSON.stringify(PART_KINDS)}. A body tube, nose cone or transition without a position is stacked behind the one before; fins sit flush with the aft end of their body tube. Positions, when given, are the forward end of the part in metres from the nose tip, positive aft, or {"relativeTo": "<an earlier part's name>", "method": "top" | "bottom" | "middle" | "after", "offset": …}.
2. Give exactly what I gave, in my units, as strings such as "38 mm", "1.5 in", "4 oz", "3 deg". Leave out every field I did not give: the simulator uses its default and lists it as "not given", with its effect.
3. If you estimate a value (from a photo, a material, a similar kit), give it and also add an entry to "assumptions" saying what, how, its effect and its impact (minor, moderate or major). Never present an estimate as if I had given it. Where a field's description below says "note_assumption", that means this list.
4. The motor by its name as people write it: "D12-5", "Estes D12", "G80-7T", "AeroTech H128W". The simulator looks it up.
5. Parachutes and streamers go in "recovery", with when they open: "apogee", "ejection" (the motor's charge), "altitude" (with an altitude), "launch" or "never". A "parachute" part is only the packed mass inside the rocket.
6. A launch site, rail or wind I mention goes in "launch". A weighed mass and balance point of the built rocket, motor out, go in "asBuilt".

The fields of each part kind (meaning, then the kind of value in brackets):
${JSON.stringify(fieldReference())}

Units accepted (the first is SI; a bare number is read in SI):
${JSON.stringify(units)}

An example answer:
\`\`\`json
${JSON.stringify(PROMPT_EXAMPLE, null, 1)}
\`\`\`

The JSON Schema your answer must follow:
${JSON.stringify(z.toJSONSchema(buildAndFlyInput))}

My rocket:
`;
}

/** The JSON or XML in the paste: the first fenced block, else the text from its first brace or tag. */
function body(text: string): string {
  const fenced = /```[a-zA-Z0-9_-]*[ \t]*\r?\n([\s\S]*?)```/.exec(text);
  if (fenced?.[1] !== undefined && fenced[1].trim() !== '') return fenced[1].trim();
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('<')) return trimmed;
  const open = trimmed.indexOf('{');
  const close = trimmed.lastIndexOf('}');
  return open >= 0 && close > open ? trimmed.slice(open, close + 1) : trimmed;
}

/** What the text is, from its first characters and its root element or keys. */
export function classifyPaste(text: string): { readonly kind: PasteKind; readonly body: string } {
  requireWithin('The pasted text', text.length, MAX_CONTENT_CHARACTERS);
  const b = body(text);
  if (b === '') throw new PasteError('The box is empty: paste Claude’s answer or a design file.');
  if (b.startsWith('<')) {
    if (/<RASAeroDocument[\s>]/.test(b)) return { kind: 'rasaero', body: b };
    if (/<openrocket[\s>]/.test(b)) return { kind: 'openrocket', body: b };
    throw new PasteError(
      'This is XML, but neither an OpenRocket design (<openrocket>) nor a RASAero II design (<RASAeroDocument>).',
    );
  }
  let document: unknown;
  try {
    document = JSON.parse(b);
  } catch (error) {
    throw new PasteError(
      `This is not Claude’s answer or a design file: it is not JSON (${error instanceof Error ? error.message : String(error)}). Copy Claude’s whole answer, from the first { to the last }.`,
    );
  }
  if (typeof document !== 'object' || document === null || Array.isArray(document))
    throw new PasteError('This JSON is not a rocket: expected an object with "name" and "parts".');
  if ('schemaVersion' in document) return { kind: 'design', body: b };
  if ('parts' in document) return { kind: 'specification', body: b };
  throw new PasteError(
    'This JSON is not a rocket: Claude’s answer has "parts", and a Lo-Fi Rocket design file has "schemaVersion". Ask Claude again with the prompt from step 1.',
  );
}

/** Where a schema problem is, as a reader would point at it: parts[2].fields. */
function where(path: readonly PropertyKey[]): string {
  return path
    .map((p, i) => (typeof p === 'number' ? `[${String(p)}]` : `${i === 0 ? '' : '.'}${String(p)}`))
    .join('');
}

/** A session with the bundled motors and the user's own, each motor once. */
function sessionFor(options: PasteOptions): Session {
  const session = new Session(options.transport);
  const key = (d: MotorDefinition): string =>
    `${d.manufacturer}|${d.designation}`.toLowerCase().replace(/\s+/g, '');
  const known = new Set([...session.motors.values()].map((m) => key(m.definition)));
  (options.library ?? []).forEach((m, i) => {
    const k = key(m.definition);
    if (known.has(k)) return;
    known.add(k);
    const id = `library-${String(i)}`;
    const entry: LibraryMotor = {
      id,
      definition: m.definition,
      provenance: m.provenance,
      delays: m.delays,
      source: m.provenance.kind === 'thrustcurve' ? 'thrustcurve' : 'imported',
    };
    session.motors.set(id, entry);
  });
  return session;
}

const NO_MOTOR = 'the design has no motor: choose one on the Motor page, then simulate';

/** A design file's result: a fresh id, so the same file can be opened twice and kept apart. */
function opened(
  kind: PasteKind,
  design: RocketDesign,
  notices: readonly string[],
  what: string,
): PasteResult {
  return {
    kind,
    design,
    notices: [`Opened ${what}.`, ...notices],
    ...(designMotors(design).length === 0 ? { notFlown: NO_MOTOR } : {}),
  };
}

/**
 * Build what was pasted. Claude's answer is checked against the schema and built as
 * `build_and_fly` builds it; a design file goes through the importer File > Open uses.
 * Throws PasteError (or the importer's FormatError) with a plain message; nothing is changed.
 */
export async function buildFromPaste(
  text: string,
  options: PasteOptions = {},
): Promise<PasteResult> {
  const { kind, body: b } = classifyPaste(text);
  const session = sessionFor(options);
  if (kind === 'design') {
    const { design, notices } = session.import(b, 'lofi');
    return opened(kind, design, notices, `the design file "${design.name}"`);
  }
  if (kind === 'openrocket') {
    const { design, notices } = session.import(b, 'ork');
    return opened(kind, design, notices, 'the OpenRocket design');
  }
  if (kind === 'rasaero') {
    const { design, notices } = session.import(b, 'cdx1');
    return opened(kind, design, notices, 'the RASAero II design');
  }
  const checked = buildAndFlyInput.safeParse(JSON.parse(b));
  if (!checked.success) {
    const shown = checked.error.issues.slice(0, 5).map((i) => {
      const at = where(i.path);
      return at === '' ? i.message : `${at}: ${i.message}`;
    });
    const more = checked.error.issues.length - shown.length;
    throw new PasteError(
      `Claude’s answer does not follow the specification, so nothing was built: ${shown.join('; ')}${more > 0 ? `; and ${String(more)} more` : ''}. Paste this message back to Claude and ask it to correct the JSON.`,
    );
  }
  const built = await session.build(toBuildSpec(checked.data));
  const given = session.launchSettingsGiven(built.design.id);
  const notGiven = LAUNCH_SETTINGS.filter((s) => !given.has(s)).map((s) => LAUNCH_WORDS[s]);
  const motor = built.motor;
  const notices = [
    `Built "${built.design.name}" from Claude’s answer: ${String(checked.data.parts.length)} ${checked.data.parts.length === 1 ? 'part' : 'parts'}.`,
    ...(motor === undefined
      ? []
      : [
          `Motor ${motor.name}, ${motor.downloaded ? 'downloaded from ThrustCurve.org' : motor.source === 'bundled' ? 'from the bundled library' : 'from your motor library'}; ejection delay ${motor.delay}.`,
        ]),
    ...(notGiven.length === 0
      ? []
      : [
          `Launch settings not given, so the app’s values are used (see the Launch page): ${notGiven.join(', ')}.`,
        ]),
  ];
  return {
    kind,
    design: built.design,
    notices,
    ...(built.notFlown === undefined ? {} : { notFlown: built.notFlown }),
  };
}

/**
 * A dropped file: an OpenRocket .ork zip by its bytes, anything else read as text and handled as
 * a paste. Its size is checked before it is read.
 */
export async function buildFromFile(
  name: string,
  bytes: Uint8Array,
  options: PasteOptions = {},
): Promise<PasteResult> {
  requireWithin(name, bytes.length, MAX_INPUT_BYTES);
  // A zip starts with "PK" (0x50 0x4B): an .ork file as OpenRocket saves it.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const session = sessionFor(options);
    const rocket = parseOrk(bytes, name);
    const library = [...session.motors.values()].map((m) => ({
      definition: m.definition,
      provenance: m.provenance,
    }));
    const imported = orkToDesign(rocket, library, newId(), () => newId());
    return opened(
      'openrocket',
      imported.design,
      imported.notices,
      `${name} (OpenRocket ${rocket.formatVersion})`,
    );
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new FormatError(
      `${name} is not a text file or an OpenRocket .ork: drop a .ork, .lofi.json or .CDX1 file, or Claude’s answer saved as text.`,
    );
  }
  return buildFromPaste(text, options);
}
