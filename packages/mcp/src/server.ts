/**
 * The MCP server (plan 0062): the tools Claude calls to build, check and fly designs. Every tool
 * computes and returns data; none reads or writes a file, runs a command or contacts a network
 * host (plan 0061 section 5). Inputs are checked by each tool's schema, then by the design file's
 * validator and the engine; an input that cannot be used comes back as a tool error with a plain
 * message, and the server keeps answering.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { FormatError, serializeDesign } from '@lo-fi-rocket/formats';
import { PhysicsError } from '@lo-fi-rocket/physics';
import * as z from 'zod';
import { addPart, EditError, removePart, updatePart, type PositionInput } from './edit.js';
import { PART_KINDS } from './fields.js';
import { QuantityError, SI_UNIT, UNITS } from './quantity.js';
import {
  designSummary,
  fieldReference,
  r,
  reviewReport,
  simulateReport,
  stabilityReport,
} from './report.js';
import { MAX_RUNS, motorFacts, Session } from './session.js';
import { SERVER_VERSION } from './version.js';

export const SERVER_NAME = 'lo-fi-rocket';
export { SERVER_VERSION };

/** Longest text a tool accepts (a design or motor file's content): far above any real file. */
export const MAX_CONTENT_CHARACTERS = 8 * 1024 * 1024;

export const INSTRUCTIONS = `Lo-Fi Rocket models and simulates model and high-power rockets with sourced, tested physics (Barrowman and Niskanen aerodynamics, the 1976 Standard Atmosphere, a 6-degree-of-freedom flight). You build the design; the engine computes every number. Work like this:
1. Gather the specification first: every part's dimensions, materials or masses, the motor, the recovery, and the launch site, rail and wind. Ask the user for what is missing before estimating. Call about once for the fields and units.
2. Build with new_design or import_design, then add_part for each part, set_motor, set_recovery and set_launch. Quantities may be numbers in SI or strings such as "38 mm", "1.5 in", "4 oz", "3 deg".
3. A field you do not give takes the app's editing default and is recorded as an approximation ("not given"). Replace defaults with the user's figures using update_part. When you estimate a value yourself (from a photo, a material name, a similar kit), record it with note_assumption; never present an estimate as a measurement.
4. If the rocket is built, ask for its weighed mass and balance point with the motor out, and set_as_built.
5. Run review_design and clear or explain every "must" item before simulate. Never compute physics yourself.
6. With every result, report the confidence and the largest approximations, the warnings, and the launch settings not given. Say plainly that the figures are predictions with the stated confidence, not guarantees; safety decisions (stability, rail exit speed, deployment speed) need the user's own judgement and their club's or the manufacturer's rules.
7. Designs live only while this connection is open: export_design gives the .lofi.json file to save, which the web app opens with File > Open.`;

const quantity = z.union([z.number(), z.string().max(64)]);
const id = z.string().min(1).max(200);
const position = z.union([
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
const fields = z
  .record(z.string().max(64), z.unknown())
  .describe(
    'The part’s fields by name (about lists them per kind). Quantities as numbers in SI or strings with units. null leaves an optional field out (for example wallThickness: null for a solid nose cone).',
  );
const kind = z.enum([
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

function message(error: unknown): string {
  if (
    error instanceof EditError ||
    error instanceof QuantityError ||
    error instanceof FormatError ||
    error instanceof PhysicsError
  ) {
    return error.message;
  }
  const text = error instanceof Error ? error.message : String(error);
  return `Unexpected error in the simulator: ${text}. This is a fault in the app, not in your input; please report it with the design.`;
}

function respond(f: () => unknown): CallToolResult {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(f()) }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: message(error) }] };
  }
}

async function respondAsync(f: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await f()) }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: message(error) }] };
  }
}

const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
const catalogue = { readOnlyHint: true, openWorldHint: true } as const;
const edits = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

/** A server with its own session; connect it to a transport. */
export function createServer(session: Session = new Session()): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    'about',
    {
      title: 'About the simulator',
      description:
        'The part kinds and every field with its meaning and units, the units accepted, how to work, and what the models cover. Call once before building.',
      annotations: readOnly,
    },
    () =>
      respond(() => ({
        workflow: INSTRUCTIONS,
        part_kinds: PART_KINDS,
        fields: fieldReference(),
        units: Object.fromEntries(
          Object.entries(UNITS).map(([d, u]) => [
            d,
            [SI_UNIT[d as keyof typeof SI_UNIT], ...Object.keys(u)].filter((x) => x !== ''),
          ]),
        ),
        coordinates:
          'Positions are the forward end of each part, in metres from the nose tip, positive aft. A fin set’s position is its root leading edge.',
        models: {
          stability:
            'Barrowman normal force and centre of pressure with Niskanen’s extensions, at Mach 0.3, worst roll angle',
          drag: 'Niskanen (2009) chapter 3: skin friction with roughness, nose, fin, base and protuberance drag, subsonic to supersonic; less accurate from Mach 0.8 to 1.2',
          flight:
            '6 degrees of freedom, Dormand–Prince integrator, U.S. Standard Atmosphere 1976, wind and turbulence, recovery by event',
          limits:
            'Multi-stage flights, pods and the booster’s flight path are not modelled yet; files with them import with their approximations listed. The web app’s known-limitations page has the full list.',
        },
      })),
  );

  server.registerTool(
    'new_design',
    {
      title: 'New design',
      description:
        'Start a design: empty, or the example (a three-fin sport rocket with an Estes D12). Returns its id.',
      inputSchema: {
        name: z.string().min(1).max(200),
        from: z.enum(['empty', 'example']).default('empty'),
      },
      annotations: edits,
    },
    ({ name, from }) =>
      respond(() => {
        const design = session.create(name, from);
        return designSummary(design, session.launchSettingsGiven(design.id));
      }),
  );

  server.registerTool(
    'list_designs',
    {
      title: 'List designs',
      description: 'The designs in this session, with ids.',
      annotations: readOnly,
    },
    () =>
      respond(() =>
        session.list().map((d) => ({ id: d.id, name: d.name, parts: d.components.length })),
      ),
  );

  server.registerTool(
    'import_design',
    {
      title: 'Import a design file',
      description:
        'Open a design from file content: a Lo-Fi Rocket .lofi.json (format "lofi"), an OpenRocket .ork as XML text ("ork") or as the zip file in base64 ("ork-base64"). Pass the content, not a path. Returns the design with the import notices and approximations.',
      inputSchema: {
        content: z.string().max(MAX_CONTENT_CHARACTERS),
        format: z.enum(['lofi', 'ork', 'ork-base64']),
        fileName: z.string().max(260).optional(),
      },
      annotations: edits,
    },
    ({ content, format, fileName }) =>
      respond(() => {
        const { design, notices } = session.import(content, format, fileName);
        return {
          notices,
          ...designSummary(design, session.launchSettingsGiven(design.id)),
          review: reviewReport(design, session.launchSettingsGiven(design.id)),
        };
      }),
  );

  server.registerTool(
    'get_design',
    {
      title: 'Get a design',
      description:
        'The design: parts with ids, positions, fields and the fields not given; motor, recovery, launch.',
      inputSchema: { designId: id },
      annotations: readOnly,
    },
    ({ designId }) =>
      respond(() => designSummary(session.get(designId), session.launchSettingsGiven(designId))),
  );

  server.registerTool(
    'export_design',
    {
      title: 'Export a design',
      description:
        'The design as a .lofi.json file text, to save (the web app opens it with File > Open). Approximations and defaults travel with it.',
      inputSchema: { designId: id },
      annotations: readOnly,
    },
    ({ designId }) => {
      try {
        return { content: [{ type: 'text', text: serializeDesign(session.get(designId)) }] };
      } catch (error) {
        return { isError: true, content: [{ type: 'text', text: message(error) }] };
      }
    },
  );

  server.registerTool(
    'add_part',
    {
      title: 'Add a part',
      description:
        'Add a part of the given kind. Give every field you know (about lists them); the rest take editing defaults and are recorded as "not given". Without a position, outline parts stack aft of the outline and fins sit flush with its aft end; other parts need a position. A fin set’s or rail buttons’ body radius, and a launch lug’s offset, are worked out from the body tube there.',
      inputSchema: {
        designId: id,
        kind,
        name: z.string().min(1).max(200).optional(),
        position: position.optional(),
        fields: fields.optional(),
      },
      annotations: edits,
    },
    (input) =>
      respond(() => {
        const design = session.get(input.designId);
        const result = addPart(design, {
          kind: input.kind,
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.position === undefined ? {} : { position: input.position as PositionInput }),
          ...(input.fields === undefined ? {} : { fields: input.fields }),
        });
        session.put(result.design);
        return { part_id: result.part?.id, not_given: result.defaulted, part: result.part };
      }),
  );

  server.registerTool(
    'update_part',
    {
      title: 'Change a part',
      description:
        'Change a part’s fields, name or position. A field given clears its "not given" note. remove lists optional fields to drop (for example wallThickness to make a nose cone solid).',
      inputSchema: {
        designId: id,
        partId: id,
        name: z.string().min(1).max(200).optional(),
        position: position.optional(),
        fields: fields.optional(),
        remove: z.array(z.string().max(64)).max(20).optional(),
      },
      annotations: edits,
    },
    (input) =>
      respond(() => {
        const result = updatePart(session.get(input.designId), input.partId, {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.position === undefined ? {} : { position: input.position as PositionInput }),
          ...(input.fields === undefined ? {} : { fields: input.fields }),
          ...(input.remove === undefined ? {} : { remove: input.remove }),
        });
        session.put(result.design);
        return { part: result.part };
      }),
  );

  server.registerTool(
    'remove_part',
    {
      title: 'Remove a part',
      description: 'Remove a part (and the motor mount, if it held the motor).',
      inputSchema: { designId: id, partId: id },
      annotations: edits,
    },
    ({ designId, partId }) =>
      respond(() => {
        session.put(removePart(session.get(designId), partId));
        return { removed: partId };
      }),
  );

  server.registerTool(
    'find_motor',
    {
      title: 'Find a motor',
      description:
        'Search the motor library (the bundled motors, imported motor files and ThrustCurve.org motors added in this session) by text, diameter and impulse class letter. Use the id with set_motor. For any other motor, search_thrustcurve.',
      inputSchema: {
        text: z.string().max(100).optional(),
        diameter: quantity.optional(),
        impulseClass: z.string().max(4).optional(),
      },
      annotations: readOnly,
    },
    (query) =>
      respond(() =>
        session
          .findMotors({
            ...(query.text === undefined ? {} : { text: query.text }),
            ...(query.diameter === undefined ? {} : { diameter: query.diameter }),
            ...(query.impulseClass === undefined ? {} : { impulseClass: query.impulseClass }),
          })
          .map(motorFacts),
      ),
  );

  server.registerTool(
    'search_thrustcurve',
    {
      title: 'Search ThrustCurve.org',
      description:
        'Search the ThrustCurve.org motor catalogue (read-only; motors with data files). Give a designation or common name (for example "H128"), a manufacturer, an impulse class letter or a diameter. Then add_thrustcurve_motor with the motorId.',
      inputSchema: {
        designation: z.string().max(100).optional(),
        manufacturer: z.string().max(100).optional(),
        impulseClass: z.string().max(4).optional(),
        diameter: quantity.optional(),
        maxResults: z.number().int().min(1).max(50).optional(),
      },
      annotations: catalogue,
    },
    (query) =>
      respondAsync(async () => {
        const found = await session.searchCatalogue({
          ...(query.designation === undefined ? {} : { designation: query.designation }),
          ...(query.manufacturer === undefined ? {} : { manufacturer: query.manufacturer }),
          ...(query.impulseClass === undefined ? {} : { impulseClass: query.impulseClass }),
          ...(query.diameter === undefined ? {} : { diameter: query.diameter }),
          ...(query.maxResults === undefined ? {} : { maxResults: query.maxResults }),
        });
        return {
          matches: found.matches,
          results: found.results.map((m) => ({
            motorId: m.motorId,
            manufacturer: m.manufacturer,
            designation: m.designation,
            common_name: m.commonName,
            impulse_class: m.impulseClass,
            diameter_m: m.diameter,
            length_m: m.length,
            total_impulse_Ns: m.totImpulseNs,
            average_thrust_N: m.avgThrustN,
            burn_time_s: m.burnTimeS,
            delays: m.delays,
            availability: m.availability,
            type: m.type,
          })),
        };
      }),
  );

  server.registerTool(
    'add_thrustcurve_motor',
    {
      title: 'Add a ThrustCurve.org motor',
      description:
        'Download a catalogue motor’s data file (RASP first, else RockSim) into this session’s library, read-only; then set_motor with the returned id.',
      inputSchema: { motorId: z.string().min(1).max(64) },
      annotations: catalogue,
    },
    ({ motorId }) => respondAsync(async () => motorFacts(await session.addCatalogueMotor(motorId))),
  );

  server.registerTool(
    'import_motor',
    {
      title: 'Import a motor file',
      description:
        'Add motors from file content to this session’s library: RASP .eng, RockSim .rse, or a thrust curve CSV (time, thrust) with its designation, manufacturer, diameter, length, total mass and propellant mass. Pass the content, not a path.',
      inputSchema: {
        content: z.string().max(MAX_CONTENT_CHARACTERS),
        format: z.enum(['eng', 'rse', 'csv']),
        fileName: z.string().max(260).optional(),
        csv: z
          .object({
            designation: z.string().min(1).max(100),
            manufacturer: z.string().min(1).max(100),
            diameter: quantity,
            length: quantity,
            totalMass: quantity,
            propellantMass: quantity,
          })
          .optional(),
      },
      annotations: edits,
    },
    ({ content, format, fileName, csv }) =>
      respond(() => session.importMotor(content, format, fileName, csv).map(motorFacts)),
  );

  server.registerTool(
    'set_motor',
    {
      title: 'Set the motor',
      description:
        'Put a library motor in a motor mount (an inner tube or body tube). Give the ejection delay the user flies (seconds, or "plugged") and the overhang past the mount’s aft end; either left out is recorded as "not given". cluster gives each motor’s offset (y, z) from the axis for a cluster.',
      inputSchema: {
        designId: id,
        mountPartId: id,
        motorId: z.string().min(1).max(300),
        overhang: quantity.optional(),
        ejectionDelay: z.union([quantity, z.literal('plugged')]).optional(),
        cluster: z
          .array(z.object({ y: quantity, z: quantity }))
          .max(64)
          .optional(),
      },
      annotations: edits,
    },
    (input) =>
      respond(() => {
        const { design, fitProblems } = session.setMotor(input.designId, {
          mountPartId: input.mountPartId,
          motorId: input.motorId,
          ...(input.overhang === undefined ? {} : { overhang: input.overhang }),
          ...(input.ejectionDelay === undefined ? {} : { ejectionDelay: input.ejectionDelay }),
          ...(input.cluster === undefined ? {} : { cluster: input.cluster }),
        });
        return {
          motor: designSummary(design, session.launchSettingsGiven(design.id))['motor'],
          fit_problems: fitProblems,
        };
      }),
  );

  server.registerTool(
    'set_recovery',
    {
      title: 'Set the recovery devices',
      description:
        'Replace the recovery devices (parachutes, streamers): canopy diameter, drag coefficient (left out: 0.8, recorded as "not given") and when it opens: apogee, ejection (the motor’s charge), altitude (descending through it), launch or never, plus a delay. The packed mass is a parachute part (add_part kind parachute).',
      inputSchema: {
        designId: id,
        devices: z
          .array(
            z.object({
              name: z.string().min(1).max(200),
              diameter: quantity,
              dragCoefficient: z.number().positive().max(10).optional(),
              deploy: z.object({
                event: z.enum(['apogee', 'ejection', 'altitude', 'launch', 'never']),
                altitude: quantity.optional(),
                delay: quantity.optional(),
              }),
            }),
          )
          .max(20),
      },
      annotations: edits,
    },
    ({ designId, devices }) =>
      respond(() => {
        const design = session.setRecovery(
          designId,
          devices.map((d) => ({
            name: d.name,
            diameter: d.diameter,
            ...(d.dragCoefficient === undefined ? {} : { dragCoefficient: d.dragCoefficient }),
            deploy: {
              event: d.deploy.event,
              ...(d.deploy.altitude === undefined ? {} : { altitude: d.deploy.altitude }),
              ...(d.deploy.delay === undefined ? {} : { delay: d.deploy.delay }),
            },
          })),
        );
        return {
          recovery: designSummary(design, session.launchSettingsGiven(designId))['recovery'],
        };
      }),
  );

  server.registerTool(
    'set_launch',
    {
      title: 'Set the launch conditions',
      description:
        'Launch site altitude, pad temperature and pressure (both or neither), rail length, angle from vertical and azimuth, and wind (speed and the direction it blows from, or a profile by altitude; turbulence intensity σ/U with a seed, or null to remove it). Settings left out keep their values and stay listed as not given.',
      inputSchema: {
        designId: id,
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
      },
      annotations: edits,
    },
    ({ designId, ...input }) =>
      respond(() => {
        const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
        const design = session.setLaunch(designId, clean);
        return designSummary(design, session.launchSettingsGiven(designId))['launch'];
      }),
  );

  server.registerTool(
    'set_as_built',
    {
      title: 'Set the weighed mass and balance point',
      description:
        'The empty rocket as weighed, motor out: its mass and its balance point (CG) from the nose tip. Every part is scaled and moved to match (GEO-17). null clears a figure.',
      inputSchema: {
        designId: id,
        mass: quantity.nullable().optional(),
        cg: quantity.nullable().optional(),
      },
      annotations: edits,
    },
    ({ designId, mass, cg }) =>
      respond(() => {
        const design = session.setAsBuilt(designId, {
          ...(mass === undefined ? {} : { mass }),
          ...(cg === undefined ? {} : { cg }),
        });
        return { as_built: design.asBuilt ?? 'none' };
      }),
  );

  server.registerTool(
    'note_assumption',
    {
      title: 'Record an assumption',
      description:
        'Record an estimate you made (a value read from a photo, a density from a material name, a dimension from a similar kit) on a part or the design. It is listed with every result and lowers the confidence by its impact: minor (under about 1 % on the key results), moderate (a few per cent), major (results may be wrong in kind).',
      inputSchema: {
        designId: id,
        partId: id.optional(),
        what: z.string().min(1).max(2000).describe('What was estimated.'),
        method: z.string().min(1).max(2000).describe('How, and from what.'),
        effect: z
          .string()
          .min(1)
          .max(2000)
          .describe('What a wrong estimate would do to the results.'),
        impact: z.enum(['minor', 'moderate', 'major']),
      },
      annotations: edits,
    },
    ({ designId, partId, what, method, effect, impact }) =>
      respond(() => {
        session.noteAssumption(designId, {
          ...(partId === undefined ? {} : { partId }),
          what,
          method,
          effect,
          impact,
        });
        return { recorded: what };
      }),
  );

  server.registerTool(
    'monte_carlo',
    {
      title: 'Monte Carlo dispersion',
      description:
        'Fly the design many times with randomly varied wind, rail, motor impulse and structural mass (standard deviations: windSpeed m/s, windDirection rad, railAngle rad, railAzimuth rad, motorImpulseScale and structuralMassScale as fractions). Returns the spread of apogee and landing and the 95 % landing radius, with the seed for reproducing it. Up to 200 runs per call, about 0.3 s each. Variations not given are taken from the design, else 0 (not varied).',
      inputSchema: {
        designId: id,
        runs: z.number().int().min(1).max(MAX_RUNS).optional(),
        seed: z.number().int().min(0).max(4294967295).optional(),
        variations: z
          .object({
            windSpeed: z.number().min(0).optional(),
            windDirection: z.number().min(0).optional(),
            railAngle: z.number().min(0).optional(),
            railAzimuth: z.number().min(0).optional(),
            motorImpulseScale: z.number().min(0).optional(),
            structuralMassScale: z.number().min(0).optional(),
          })
          .optional(),
      },
      annotations: readOnly,
    },
    ({ designId, runs, seed, variations }) =>
      respond(() => {
        const v =
          variations === undefined
            ? undefined
            : Object.fromEntries(Object.entries(variations).filter(([, x]) => x !== undefined));
        const result = session.monteCarlo(designId, {
          ...(runs === undefined ? {} : { runs }),
          ...(seed === undefined ? {} : { seed }),
          ...(v === undefined ? {} : { variations: v }),
        });
        const stats = (x: typeof result.summary.apogee): unknown =>
          x === undefined
            ? undefined
            : {
                mean: r(x.mean),
                standard_deviation: r(x.standardDeviation),
                p5: r(x.p5),
                p50: r(x.p50),
                p95: r(x.p95),
                min: r(x.min),
                max: r(x.max),
                count: x.count,
              };
        const failures = result.runs.filter((run) => run.error !== undefined).slice(0, 5);
        return {
          seed: result.seed,
          runs: result.settings.runs,
          variations: result.settings.variations,
          not_varied: Object.entries(result.settings.variations)
            .filter(([, x]) => x === 0)
            .map(([k]) => k),
          apogee_m: stats(result.summary.apogee),
          landing_distance_m: stats(result.summary.landingDistance),
          mean_landing_m:
            result.summary.meanLanding === undefined
              ? undefined
              : {
                  east: r(result.summary.meanLanding.east),
                  north: r(result.summary.meanLanding.north),
                },
          landing_radius_95_m: r(result.summary.containmentRadius95),
          landed: result.summary.landed,
          not_landed: result.summary.notLanded,
          failed: result.summary.failed,
          ...(failures.length === 0
            ? {}
            : { first_failures: failures.map((f) => ({ run: f.index, error: f.error })) }),
          approximations_and_confidence: 'as for simulate: call simulate for the list',
        };
      }),
  );

  server.registerTool(
    'review_design',
    {
      title: 'Review before simulating',
      description:
        'The checklist to clear before simulate: missing parts, fields not given, motor fit, launch settings not given, the weighed mass, stability, every approximation and the confidence. "must" items need the user’s answer or a fix.',
      inputSchema: { designId: id },
      annotations: readOnly,
    },
    ({ designId }) =>
      respond(() => reviewReport(session.get(designId), session.launchSettingsGiven(designId))),
  );

  server.registerTool(
    'stability',
    {
      title: 'Stability',
      description:
        'Centre of pressure, centre of gravity and margin in calibers at liftoff and burnout, with the plain assessment and the approximations.',
      inputSchema: { designId: id },
      annotations: readOnly,
    },
    ({ designId }) => respond(() => stabilityReport(session.get(designId))),
  );

  server.registerTool(
    'simulate',
    {
      title: 'Simulate a flight',
      description:
        'Fly the design with its launch conditions: apogee, speeds, rail exit, deployment and landing, the events, the warnings, the launch settings not given, the approximations and the confidence. samples (up to 200) adds a thinned time series.',
      inputSchema: { designId: id, samples: z.number().int().min(0).max(200).optional() },
      annotations: readOnly,
    },
    ({ designId, samples }) =>
      respond(() =>
        simulateReport(
          session.get(designId),
          session.launchSettingsGiven(designId),
          samples === undefined ? {} : { samples },
        ),
      ),
  );

  return server;
}
