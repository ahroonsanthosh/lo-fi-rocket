/**
 * The design specification Claude writes (plans 0079 and 0082): the schema of the `build_and_fly`
 * tool, and its mapping to `Session.build`. The MCP server and the web app's paste box both use
 * this module, so a pasted answer is checked and built exactly as the tool call is. Browser-safe:
 * zod and the session only, no MCP SDK and no Node module.
 */
import * as z from 'zod';
import type { AddPartInput } from './edit.js';
import type { BuildSpec, RecoveryInput } from './session.js';

// The web site's content security policy forbids eval (script-src 'self'). zod probes for it with
// `new Function` when an object schema is created, to compile its checks; without that the checks
// give the same result, interpreted. This must run before the schemas below are created.
z.config({ jitless: true });

/** Longest text a tool or the paste box accepts (a design or motor file's content): far above any real file. */
export const MAX_CONTENT_CHARACTERS = 8 * 1024 * 1024;

export const stageNumber = z
  .number()
  .int()
  .min(0)
  .max(20)
  .describe('The stage, 0 being the top stage (set_stages lists them).');

export const quantity = z.union([z.number(), z.string().max(64)]);
export const id = z.string().min(1).max(200);
export const position = z.union([
  quantity,
  z.object({
    relativeTo: id.describe('Id of the part to place this one against.'),
    method: z
      .enum(['top', 'bottom', 'middle', 'after'])
      .describe(
        'top: fore ends level; bottom: aft ends level; middle: centres level; after: this part starts at the other part’s aft end.',
      ),
    offset: quantity
      .optional()
      .describe('Moves the part aft (positive) or forward (negative) from that alignment.'),
  }),
]);
export const fields = z
  .record(z.string().max(64), z.unknown())
  .describe(
    'The part’s fields by name (about lists them per kind). Quantities as numbers in SI or strings with units. null leaves an optional field out (for example wallThickness: null for a solid nose cone).',
  );
export const kind = z.enum([
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
]);

export const part = z.object({
  kind,
  name: z.string().min(1).max(200).optional(),
  position: position.optional(),
  fields: fields.optional(),
  stage: stageNumber.optional(),
});
export const recoveryDevice = z.object({
  name: z.string().min(1).max(200),
  diameter: quantity.optional(),
  streamer: z.object({ length: quantity, width: quantity, surfaceDensity: quantity }).optional(),
  dragCoefficient: z.number().positive().max(10).optional(),
  deploy: z.object({
    event: z.enum(['apogee', 'ejection', 'altitude', 'launch', 'never']),
    altitude: quantity.optional(),
    delay: quantity.optional(),
  }),
  stage: stageNumber.optional(),
});
type RecoveryDeviceInput = z.infer<typeof recoveryDevice>;
export const launchFields = {
  siteAltitude: quantity.optional(),
  temperature: quantity.optional(),
  pressure: quantity.optional(),
  railLength: quantity.optional(),
  railAngle: quantity.optional(),
  railAzimuth: quantity.optional(),
  windSpeed: quantity.optional(),
  windFrom: quantity.optional(),
  windProfile: z
    .array(z.object({ altitude: quantity, speed: quantity, from: quantity }))
    .max(100)
    .optional(),
  turbulence: z
    .object({ intensity: z.number().min(0).max(1), seed: z.number().int() })
    .nullable()
    .optional(),
};
export const impact = z.enum(['minor', 'moderate', 'major']);

/** The recovery inputs without the keys left out (exactOptionalPropertyTypes). */
export function recoveryInputs(devices: readonly RecoveryDeviceInput[]): RecoveryInput[] {
  return devices.map((d) => ({
    name: d.name,
    ...(d.diameter === undefined ? {} : { diameter: d.diameter }),
    ...(d.streamer === undefined ? {} : { streamer: d.streamer }),
    ...(d.dragCoefficient === undefined ? {} : { dragCoefficient: d.dragCoefficient }),
    deploy: {
      event: d.deploy.event,
      ...(d.deploy.altitude === undefined ? {} : { altitude: d.deploy.altitude }),
      ...(d.deploy.delay === undefined ? {} : { delay: d.deploy.delay }),
    },
    ...(d.stage === undefined ? {} : { stage: d.stage }),
  }));
}

/** `T` with its optional keys typed as absent rather than undefined (exactOptionalPropertyTypes). */
export type Defined<T> = { [K in keyof T as undefined extends T[K] ? never : K]: T[K] } & {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
};

/** An object without the keys whose value is undefined. */
export function defined<T extends Record<string, unknown>>(o: T): Defined<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Defined<T>;
}

/** The `build_and_fly` tool's input, field by field (the MCP SDK takes the shape). */
export const buildAndFlyShape = {
  name: z.string().min(1).max(200),
  stages: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        separation: z
          .object({
            event: z.enum([
              'upper-ignition',
              'ignition',
              'burnout',
              'ejection',
              'launch',
              'apogee',
              'altitude-ascending',
              'altitude-descending',
              'never',
            ]),
            delay: quantity.optional(),
            altitude: quantity.optional(),
          })
          .optional(),
      }),
    )
    .max(10)
    .optional(),
  parts: z.array(part).max(200),
  motor: z
    .object({
      name: z.string().min(1).max(100),
      mount: z
        .union([z.number().int().min(0), z.string().min(1).max(200)])
        .optional()
        .describe(
          'The tube that holds the motor: its index in parts (from 0) or its name. Left out: the aftmost inner tube, else the aftmost body tube.',
        ),
      overhang: quantity.optional(),
      ejectionDelay: z.union([quantity, z.literal('plugged')]).optional(),
      cluster: z
        .array(z.object({ y: quantity, z: quantity }))
        .max(64)
        .optional(),
    })
    .optional(),
  recovery: z.array(recoveryDevice).max(20).optional(),
  launch: z.object(launchFields).optional(),
  asBuilt: z.object({ mass: quantity.optional(), cg: quantity.optional() }).optional(),
  assumptions: z
    .array(
      z.object({
        part: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Index in parts (from 0); left out: the design as a whole.'),
        what: z.string().min(1).max(2000),
        method: z.string().min(1).max(2000),
        effect: z.string().min(1).max(2000),
        impact,
      }),
    )
    .max(100)
    .optional(),
  samples: z.number().int().min(0).max(200).optional(),
};

/** The whole specification as one schema (the paste box validates against it). */
export const buildAndFlyInput = z.object(buildAndFlyShape);
export type BuildAndFlyInput = z.infer<typeof buildAndFlyInput>;

/** A checked specification as `Session.build` takes it (`samples` is the report's, not the design's). */
export function toBuildSpec(input: BuildAndFlyInput): BuildSpec {
  return {
    name: input.name,
    ...(input.stages === undefined
      ? {}
      : {
          stages: input.stages.map((st) => ({
            name: st.name,
            ...(st.separation === undefined ? {} : { separation: defined(st.separation) }),
          })),
        }),
    parts: input.parts.map((p) => defined(p) as AddPartInput),
    ...(input.motor === undefined ? {} : { motor: defined(input.motor) }),
    ...(input.recovery === undefined ? {} : { recovery: recoveryInputs(input.recovery) }),
    ...(input.launch === undefined ? {} : { launch: defined(input.launch) }),
    ...(input.asBuilt === undefined
      ? {}
      : {
          asBuilt: {
            ...(input.asBuilt.mass === undefined ? {} : { mass: input.asBuilt.mass }),
            ...(input.asBuilt.cg === undefined ? {} : { cg: input.asBuilt.cg }),
          },
        }),
    ...(input.assumptions === undefined
      ? {}
      : {
          assumptions: input.assumptions.map((a) => ({
            what: a.what,
            method: a.method,
            effect: a.effect,
            impact: a.impact,
            ...(a.part === undefined ? {} : { part: a.part }),
          })),
        }),
  };
}
