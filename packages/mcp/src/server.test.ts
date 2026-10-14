/**
 * The MCP server driven as Claude drives it, through the SDK's client over an in-memory transport
 * (plan 0062 section 7). Expected values come from the engine called directly on the same design,
 * never from the server itself.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  BUNDLED_MOTOR_FILES,
  decodeDesignLink,
  runDispersion,
  type Transport,
  designSimulationOptions,
  designStability,
  designVehicle,
  ESTES_D12,
  exampleDesign,
  motorFromEng,
  orkToDesign,
  parseDesign,
  parseEng,
  parseOrk,
  type RocketDesign,
} from '@lo-fi-rocket/formats';
import { simulateFlight } from '@lo-fi-rocket/physics';
import { beforeEach, describe, expect, it } from 'vitest';
import { r } from './report.js';
import { createServer, MAX_CONTENT_CHARACTERS } from './server.js';
import { Session } from './session.js';

const ROCKETS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'rockets',
);

interface Call {
  readonly ok: boolean;
  readonly text: string;
  readonly json: unknown;
}

let client: Client;

async function connect(session?: Session): Promise<Client> {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(session).connect(a);
  const c = new Client({ name: 'test', version: '0' });
  await c.connect(b);
  return c;
}

beforeEach(async () => {
  client = await connect();
});

async function call(name: string, args: Record<string, unknown> = {}): Promise<Call> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as readonly { type: string; text?: string }[];
  const text = content[0]?.text ?? '';
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { ok: result.isError !== true, text, json };
}

async function ok(
  name: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const c = await call(name, args);
  if (!c.ok) throw new Error(`${name} failed: ${c.text}`);
  return c.json as Record<string, unknown>;
}

const get = (o: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>(
    (v, k) => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>)[k] : undefined),
    o,
  );

describe('tool list', () => {
  it('offers the tools of plan 0062; only the two catalogue tools reach the network', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'about',
        'add_part',
        'design_link',
        'export_design',
        'find_motor',
        'get_design',
        'import_design',
        'import_motor',
        'list_designs',
        'monte_carlo',
        'new_design',
        'note_assumption',
        'remove_part',
        'review_design',
        'search_thrustcurve',
        'add_thrustcurve_motor',
        'set_as_built',
        'set_launch',
        'set_motor',
        'set_recovery',
        'simulate',
        'stability',
        'update_part',
      ].sort(),
    );
    for (const t of tools) {
      expect(t.annotations?.openWorldHint).toBe(
        t.name === 'search_thrustcurve' || t.name === 'add_thrustcurve_motor',
      );
    }
  });

  it('sends the working instructions at connection', () => {
    expect(client.getInstructions()).toMatch(/Never compute physics yourself/);
  });
});

describe('the example rocket built part by part', () => {
  it('matches the example design and the engine bit for bit', async () => {
    const example = exampleDesign();
    const d = await ok('new_design', { name: example.name });
    const designId = d['id'] as string;
    const ids = new Map<string, string>();
    for (const c of example.components) {
      const { kind, ...given } = c.component;
      // The example's nose cone is solid: an optional field given as null is left out.
      const fields = kind === 'noseCone' ? { ...given, wallThickness: null } : given;
      const added = await ok('add_part', {
        designId,
        kind,
        name: c.name,
        position: c.position,
        fields,
      });
      expect(added['not_given']).toEqual([]);
      ids.set(c.id, added['part_id'] as string);
    }
    const mount = example.motorMount;
    await ok('set_motor', {
      designId,
      mountPartId: ids.get('mount'),
      motorId: 'Estes_D12.eng',
      overhang: 0,
      ejectionDelay: 5,
    });
    await ok('set_recovery', {
      designId,
      devices: [
        {
          name: 'Parachute',
          diameter: 0.3,
          dragCoefficient: 0.8,
          deploy: { event: 'apogee', delay: 0 },
        },
      ],
    });
    await ok('set_launch', {
      designId,
      siteAltitude: 0,
      railLength: 1.5,
      railAngle: 0,
      railAzimuth: 0,
      windSpeed: 0,
      windFrom: 0,
    });

    // The bundled D12 file gives the example's motor exactly.
    const bundled = BUNDLED_MOTOR_FILES.find((m) => m.file === 'Estes_D12.eng');
    expect(motorFromEng(parseEng(bundled?.text ?? '')[0]!)).toEqual(ESTES_D12);

    const exported = await call('export_design', { designId });
    const built: RocketDesign = parseDesign(exported.text);
    const strip = (x: RocketDesign): unknown => ({
      components: x.components.map(({ name, position, component }) => ({
        name,
        position,
        component,
      })),
      motor: x.motorMount?.motor,
      overhang: x.motorMount?.overhang,
      recovery: x.recovery.map(({ name, diameter, dragCoefficient, deploy }) => ({
        name,
        diameter,
        dragCoefficient,
        deploy,
      })),
      launch: x.launch,
      approximations: x.approximations,
    });
    expect(strip(built)).toEqual(strip(example));
    expect(mount?.componentId).toBe('mount');

    const expected = designStability(example);
    const stability = await ok('stability', { designId });
    expect(get(stability, 'cp_from_nose_m')).toBe(r(expected.result.centreOfPressure.cp));
    expect(get(stability, 'liftoff', 'margin_calibers')).toBe(r(expected.result.marginLiftoff));
    expect(get(stability, 'burnout', 'cg_from_nose_m')).toBe(r(expected.result.cgBurnout));

    const flight = simulateFlight(designVehicle(example), designSimulationOptions(example));
    const sim = await ok('simulate', { designId, samples: 50 });
    expect(get(sim, 'summary', 'apogee_m')).toBe(r(flight.summary.apogee));
    expect(get(sim, 'summary', 'rail_exit_velocity_m_s')).toBe(r(flight.summary.railExitVelocity));
    expect(get(sim, 'confidence')).toEqual(flight.confidence);
    expect((get(sim, 'time_series') as unknown[]).length).toBeLessThanOrEqual(51);
    // The pad temperature and pressure were not given: said with the result.
    expect(get(sim, 'launch_settings_not_given')).toEqual(['temperature', 'pressure']);
  });
});

describe('defaults are never silent (CLAUDE.md 1 rule 3)', () => {
  it('lists every field not given, flags it in the review, and clears it when given', async () => {
    const designId = (await ok('new_design', { name: 'Partial' }))['id'] as string;
    await ok('add_part', {
      designId,
      kind: 'noseCone',
      fields: { shape: 'ogive', length: '100 mm', baseRadius: '1 in' },
    });
    const tube = await ok('add_part', { designId, kind: 'bodyTube', fields: { length: '12 in' } });
    // The body tube stacks behind the nose: 100 mm.
    expect(get(tube, 'part', 'position')).toBe(0.1);
    expect(tube['not_given']).toEqual(['outer radius', 'wall thickness', 'density']);
    // 12 in = 12 × 0.0254 m (UNIT-5): 0.3048 m to the rounding of one multiplication.
    expect(get(tube, 'part', 'component', 'length')).toBeCloseTo(0.3048, 15);
    const approximations = get(tube, 'part', 'approximations') as {
      what: string;
      impact: string;
    }[];
    expect(approximations.map((a) => [a.what, a.impact])).toEqual([
      ['outer radius not given', 'major'],
      ['wall thickness not given', 'moderate'],
      ['density not given', 'moderate'],
    ]);
    const review = await ok('review_design', { designId });
    expect(review['ready']).toBe(false);
    expect(JSON.stringify(review['items'])).toMatch(
      /Body tube: outer radius, wall thickness, density not given/,
    );

    const partId = tube['part_id'] as string;
    const updated = await ok('update_part', {
      designId,
      partId,
      fields: { outerRadius: '1 in', wallThickness: '0.5 mm' },
    });
    expect(
      (get(updated, 'part', 'approximations') as { what: string }[]).map((a) => a.what),
    ).toEqual(['density not given']);
    const done = await ok('update_part', { designId, partId, fields: { density: '0.68 g/cm3' } });
    expect(get(done, 'part', 'approximations')).toBeUndefined();
    expect(get(done, 'part', 'component', 'density')).toBeCloseTo(680, 9);
  });

  it('places fins flush with the aft end and works out their body radius, listing the position', async () => {
    const designId = (await ok('new_design', { name: 'Fins' }))['id'] as string;
    await ok('add_part', {
      designId,
      kind: 'noseCone',
      fields: { shape: 'conical', length: 0.1, baseRadius: 0.02, density: 160 },
    });
    const body = await ok('add_part', {
      designId,
      kind: 'bodyTube',
      fields: { length: 0.4, outerRadius: 0.02, wallThickness: 0.001, density: 680 },
    });
    const fins = await ok('add_part', {
      designId,
      kind: 'finSet',
      fields: {
        count: 4,
        rootChord: 0.08,
        tipChord: 0.04,
        sweep: 0.04,
        span: 0.05,
        thickness: 0.002,
        density: 600,
      },
    });
    // Aft end of the outline 0.5 m, root chord 0.08 m: 0.42 m.
    expect(get(fins, 'part', 'position')).toBeCloseTo(0.42, 15);
    expect(get(fins, 'part', 'component', 'bodyRadius')).toBe(0.02);
    expect((get(fins, 'part', 'approximations') as { what: string }[]).map((a) => a.what)).toEqual([
      'cross-section not given',
      'position not given',
    ]);
    // Placed explicitly against the body: the position note clears. 'bottom' with 10 mm forward.
    const moved = await ok('update_part', {
      designId,
      partId: fins['part_id'],
      position: { relativeTo: body['part_id'], method: 'bottom', offset: '-10 mm' },
      fields: { crossSection: 'rounded' },
    });
    // 0.1 + 0.4 − 0.08 − 0.01 = 0.41 m.
    expect(get(moved, 'part', 'position')).toBeCloseTo(0.41, 15);
    expect(get(moved, 'part', 'approximations')).toBeUndefined();
  });

  it('records a missing ejection delay and makes it a must when the parachute needs the charge', async () => {
    const designId = (await ok('new_design', { name: 'Example', from: 'example' }))['id'] as string;
    const design = await ok('get_design', { designId });
    const mount = (design['parts'] as { id: string; name: string }[]).find(
      (p) => p.name === 'Motor mount',
    );
    await ok('set_motor', {
      designId,
      mountPartId: mount?.id,
      motorId: 'Estes_C6.eng',
      overhang: '5 mm',
    });
    await ok('set_recovery', {
      designId,
      devices: [{ name: 'Chute', diameter: '12 in', deploy: { event: 'ejection' } }],
    });
    const review = await ok('review_design', { designId });
    const items = JSON.stringify(review['items']);
    expect(items).toMatch(/ejection delay not given/);
    expect(items).toMatch(/opens at the ejection charge but the motor is plugged/);
    expect(items).toMatch(/Recovery device \\"Chute\\": drag coefficient not given/);
    const sim = await ok('simulate', { designId });
    expect((get(sim, 'confidence') as { level: string }).level).toBe('medium');
  });

  it('lists a recorded assumption with every result', async () => {
    const designId = (await ok('new_design', { name: 'Example', from: 'example' }))['id'] as string;
    await ok('note_assumption', {
      designId,
      what: 'nose cone density',
      method: 'balsa estimated from the photo',
      effect: 'the CG moves if the nose is heavier',
      impact: 'major',
    });
    const sim = await ok('simulate', { designId });
    expect((get(sim, 'confidence') as { level: string }).level).toBe('low');
    expect(JSON.stringify(get(sim, 'approximations'))).toMatch(/balsa estimated from the photo/);
  });
});

describe('imported files fly as the formats package flies them', () => {
  const library = BUNDLED_MOTOR_FILES.map(({ file, text }) => ({
    definition: motorFromEng(parseEng(text, file)[0]!),
    provenance: { kind: 'bundled' as const, file },
  }));
  for (const file of ['r1-three-fin-conical.ork', 'r4-scratch-38mm.ork']) {
    it(`${file}, as base64 zip and as XML`, async () => {
      const bytes = readFileSync(join(ROCKETS, file));
      const design = orkToDesign(
        parseOrk(new Uint8Array(bytes), file),
        library,
        'x',
        () => 'y',
      ).design;
      const expected = simulateFlight(designVehicle(design), designSimulationOptions(design));
      const imported = await ok('import_design', {
        content: bytes.toString('base64'),
        format: 'ork-base64',
        fileName: file,
      });
      const sim = await ok('simulate', { designId: imported['id'] });
      expect(get(sim, 'summary', 'apogee_m')).toBe(r(expected.summary.apogee));
    });
  }
});

describe('hostile and mistaken input', () => {
  it('answers each with a plain error and keeps working', async () => {
    const designId = (await ok('new_design', { name: 'H' }))['id'] as string;
    const unknownField = await call('add_part', {
      designId,
      kind: 'bodyTube',
      fields: { colour: 'red' },
    });
    expect(unknownField.ok).toBe(false);
    expect(unknownField.text).toMatch(
      /bodyTube has no field "colour". Its fields are: length \(length\)/,
    );
    const badUnit = await call('add_part', {
      designId,
      kind: 'bodyTube',
      fields: { length: '3 furlongs' },
    });
    expect(badUnit.text).toMatch(
      /unit "furlongs" is not accepted; give a number in m or one of m, cm, mm, in/,
    );
    const noDesign = await call('simulate', { designId: 'nope' });
    expect(noDesign.text).toMatch(/no design with id "nope"/);
    const laughs = await call('import_design', {
      content:
        '<!DOCTYPE x [<!ENTITY a "aaaa">]><openrocket version="1.10"><rocket>&a;</rocket></openrocket>',
      format: 'ork',
    });
    expect(laughs.text).toMatch(/document type declaration/);
    const tooLong = await call('import_design', {
      content: 'x'.repeat(MAX_CONTENT_CHARACTERS + 1),
      format: 'lofi',
    });
    expect(tooLong.ok).toBe(false);
    const path = await call('import_design', { content: '/etc/passwd', format: 'lofi' });
    expect(path.text).toMatch(/not valid JSON/);
    const negative = await call('add_part', { designId, kind: 'bodyTube', fields: { length: -1 } });
    expect(negative.ok).toBe(false);
    const noMotor = await call('simulate', { designId });
    expect(noMotor.text).toMatch(/no motor is selected/);
    // Still answering.
    expect((await ok('list_designs')) as unknown).toHaveLength(1);
  });
});

describe('the ThrustCurve.org catalogue (recorded answers, no network)', () => {
  // The answers follow reference/docs/thrustcurve-api/swagger.json, as in the formats client tests;
  // the download carries reference/motors/Estes_D12.eng in Base64.
  const d12 = BUNDLED_MOTOR_FILES.find((m) => m.file === 'Estes_D12.eng')?.text ?? '';
  const answers: Record<string, unknown> = {
    'search.json': {
      matches: 1,
      results: [
        {
          motorId: '5f4294d20002310000000055',
          manufacturer: 'Estes Industries',
          manufacturerAbbrev: 'Estes',
          designation: 'D12',
          commonName: 'D12',
          impulseClass: 'D',
          diameter: 24,
          length: 70,
          type: 'SU',
          avgThrustN: 10.2,
          maxThrustN: 29.7,
          totImpulseNs: 16.8,
          burnTimeS: 1.6,
          dataFiles: 2,
          delays: '0,3,5,7',
          availability: 'regular',
        },
      ],
    },
    'download.json': {
      results: [
        {
          motorId: '5f4294d20002310000000055',
          simfileId: 'sim-1',
          format: 'RASP',
          source: 'cert',
          data: Buffer.from(d12).toString('base64'),
        },
      ],
    },
  };
  const bodies: unknown[] = [];
  const transport: Transport = (url, init) => {
    bodies.push(JSON.parse(init.body));
    const answer = answers[url.replace('https://www.thrustcurve.org/api/v1/', '')];
    return Promise.resolve({
      ok: answer !== undefined,
      status: answer === undefined ? 404 : 200,
      text: () => Promise.resolve(JSON.stringify(answer)),
    });
  };

  it('searches, downloads into the library and flies the downloaded motor as the bundled one', async () => {
    const c = await connect(new Session(transport));
    const call2 = async (
      name: string,
      args: Record<string, unknown>,
    ): Promise<Record<string, unknown>> => {
      const result = await c.callTool({ name, arguments: args });
      const text = (result.content as { text?: string }[])[0]?.text ?? '';
      if (result.isError === true) throw new Error(text);
      return JSON.parse(text) as Record<string, unknown>;
    };
    const found = await call2('search_thrustcurve', { designation: 'D12', diameter: '24 mm' });
    expect(get(found, 'results')).toHaveLength(1);
    // The diameter goes to the API in millimetres; only motors with data files are asked for.
    expect(bodies[0]).toMatchObject({ commonName: 'D12', diameter: 24, hasDataFiles: true });
    const added = await call2('add_thrustcurve_motor', { motorId: '5f4294d20002310000000055' });
    expect(added['id']).toBe('thrustcurve:5f4294d20002310000000055');
    expect(added['delays_s']).toEqual([0, 3, 5, 7]);
    const designId = (await call2('new_design', { name: 'E', from: 'example' }))['id'] as string;
    const parts = (await call2('get_design', { designId }))['parts'] as {
      id: string;
      name: string;
    }[];
    const mount = parts.find((p) => p.name === 'Motor mount')?.id;
    const a = await call2('set_motor', {
      designId,
      mountPartId: mount,
      motorId: 'thrustcurve:5f4294d20002310000000055',
      overhang: 0,
      ejectionDelay: 5,
    });
    expect(get(a, 'motor', 'designation')).toBe('Estes D12');
    const viaCatalogue = await call2('simulate', { designId });
    await call2('set_motor', {
      designId,
      mountPartId: mount,
      motorId: 'Estes_D12.eng',
      overhang: 0,
      ejectionDelay: 5,
    });
    const viaBundled = await call2('simulate', { designId });
    expect(get(viaCatalogue, 'summary', 'apogee_m')).toBe(get(viaBundled, 'summary', 'apogee_m'));
  });

  it('says plainly when the catalogue is not available', async () => {
    const offline = await call('search_thrustcurve', { designation: 'D12' });
    expect(offline.ok).toBe(false);
    expect(offline.text).toMatch(/not available in this server \(offline\)/);
  });
});

describe('Monte Carlo', () => {
  it('reports the seed and reproduces runDispersion on the same design and settings', async () => {
    const designId = (await ok('new_design', { name: 'E', from: 'example' }))['id'] as string;
    const variations = {
      windSpeed: 1,
      windDirection: 0.2,
      railAngle: 0.02,
      railAzimuth: 0.1,
      motorImpulseScale: 0.03,
      structuralMassScale: 0.02,
    };
    const mc = await ok('monte_carlo', { designId, runs: 8, seed: 42, variations });
    expect(mc['seed']).toBe(42);
    expect(mc['not_varied']).toEqual([]);
    const exported = parseDesign((await call('export_design', { designId })).text);
    const expected = runDispersion(exported, { runs: 8, seed: 42, variations });
    expect(get(mc, 'apogee_m', 'p50')).toBe(r(expected.summary.apogee?.p50 ?? Number.NaN));
    expect(get(mc, 'landing_radius_95_m')).toBe(r(expected.summary.containmentRadius95));
    const again = await ok('monte_carlo', { designId, runs: 8, seed: 42, variations });
    expect(again).toEqual(mc);
    expect((await call('monte_carlo', { designId, runs: 5000 })).ok).toBe(false);
  }, 60_000);
});

describe('design_link', () => {
  it('gives a link to the web app that carries the design exactly', async () => {
    const designId = (await ok('new_design', { name: 'Linked', from: 'example' }))['id'] as string;
    await ok('note_assumption', {
      designId,
      what: 'fin thickness',
      method: 'from a photo',
      effect: 'mass',
      impact: 'minor',
    });
    const link = await ok('design_link', { designId });
    const url = link['url'] as string;
    expect(url.startsWith('https://ahroonsanthosh.github.io/lo-fi-rocket/#design=v1.')).toBe(true);
    const exported = parseDesign((await call('export_design', { designId })).text);
    expect(decodeDesignLink(url.slice(url.indexOf('#')))).toEqual(exported);
  });
});
