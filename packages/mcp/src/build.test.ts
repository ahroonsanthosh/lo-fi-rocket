/**
 * Plan 0079: a pasted design built and flown in one call, driven as Claude drives it through the
 * SDK's client. Expected values come from the engine called directly on the same design (the
 * example rocket, plan 0011), never from the server itself.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  designSimulationOptions,
  designStability,
  designVehicle,
  exampleDesign,
  exportCdx1,
  realFlightRange,
  serializeDesign,
  type Transport,
} from '@lo-fi-rocket/formats';
import { simulateFlight } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { r } from './report.js';
import { createServer } from './server.js';
import { Session } from './session.js';

async function connect(session: Session = new Session()): Promise<Client> {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(session).connect(a);
  const c = new Client({ name: 'test', version: '0' });
  await c.connect(b);
  return c;
}

async function call(
  c: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; text: string; json: Record<string, unknown> }> {
  const result = await c.callTool({ name, arguments: args });
  const text = (result.content as { text?: string }[])[0]?.text ?? '';
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // An error's text is not JSON.
  }
  return { ok: result.isError !== true, text, json };
}

const get = (o: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>(
    (v, k) => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>)[k] : undefined),
    o,
  );

/** The example rocket as a user's paste becomes one call: parts, motor by name, recovery, launch. */
function examplePaste(motor: Record<string, unknown>): Record<string, unknown> {
  const example = exampleDesign();
  return {
    name: example.name,
    parts: example.components.map((c) => {
      const { kind, ...given } = c.component;
      // The example's nose cone is solid: an optional field given as null is left out.
      const fields = kind === 'noseCone' ? { ...given, wallThickness: null } : given;
      return { kind, name: c.name, position: c.position, fields };
    }),
    motor,
    recovery: [
      {
        name: 'Parachute',
        diameter: 0.3,
        dragCoefficient: 0.8,
        deploy: { event: 'apogee', delay: 0 },
      },
    ],
    launch: {
      siteAltitude: 0,
      railLength: 1.5,
      railAngle: 0,
      railAzimuth: 0,
      windSpeed: 0,
      windFrom: 0,
    },
  };
}

describe('build_and_fly (plan 0079)', () => {
  const example = exampleDesign();
  const expectedStability = designStability(example);
  const expectedFlight = simulateFlight(designVehicle(example), designSimulationOptions(example));
  const mountIndex = example.components.findIndex((c) => c.id === 'mount');

  it('builds and flies the example in one call, bit for bit as the engine flies it', async () => {
    const c = await connect();
    const res = await call(c, 'build_and_fly', {
      ...examplePaste({ name: 'Estes D12-5', mount: mountIndex, overhang: 0 }),
      samples: 10,
    });
    expect(res.ok, res.text).toBe(true);
    const out = res.json;
    expect(out['motor']).toEqual({
      id: 'Estes_D12.eng',
      name: 'Estes D12',
      source: 'bundled',
      downloaded: false,
      delay: '5 s',
    });
    expect(out['must']).toEqual([]);
    expect(get(out, 'stability', 'cp_from_nose_m')).toBe(
      r(expectedStability.result.centreOfPressure.cp),
    );
    expect(get(out, 'stability', 'liftoff', 'margin_calibers')).toBe(
      r(expectedStability.result.marginLiftoff),
    );
    expect(get(out, 'flight', 'summary', 'apogee_m')).toBe(r(expectedFlight.summary.apogee));
    expect(get(out, 'flight', 'summary', 'max_velocity_m_s')).toBe(
      r(expectedFlight.summary.maxVelocity),
    );
    expect(get(out, 'flight', 'confidence')).toEqual(expectedFlight.confidence);
    expect(get(out, 'flight', 'launch_settings_not_given')).toEqual(['temperature', 'pressure']);
    // Plan 0080 (D-119): the range measured flights reached, beside the physics, said to be such.
    const range = realFlightRange(expectedFlight.summary.apogee, expectedFlight.summary.maxMach);
    expect(get(out, 'flight', 'real_flights', 'apogee_low_m')).toBe(r(range?.low));
    expect(get(out, 'flight', 'real_flights', 'apogee_high_m')).toBe(r(range?.high));
    expect(get(out, 'flight', 'real_flights', 'note')).toMatch(/^Measured flights, not physics: /);
    expect(String(out['link'])).toMatch(/^https:\/\/ahroonsanthosh\.github\.io\/lo-fi-rocket\/#/);
    // The design stays in the session for refining.
    const list = await call(c, 'list_designs', {});
    expect((list.json as unknown as unknown[]).length).toBe(1);
  });

  it('puts the motor in the aftmost inner tube when no mount is given, and lists it', async () => {
    const c = await connect();
    const res = await call(c, 'build_and_fly', examplePaste({ name: 'D12-5', overhang: 0 }));
    expect(res.ok, res.text).toBe(true);
    // The example has one inner tube, the motor mount: the same flight.
    expect(get(res.json, 'flight', 'summary', 'apogee_m')).toBe(r(expectedFlight.summary.apogee));
    const approximations = res.json['approximations'] as { subject: string; what: string }[];
    expect(approximations).toContainEqual(
      expect.objectContaining({
        subject: 'Inner tube "Motor mount"',
        what: 'motor mount not given',
      }),
    );
  });

  it('lists every field, position and delay left out, and still flies', async () => {
    const c = await connect();
    const res = await call(c, 'build_and_fly', {
      name: 'Sketch',
      parts: [
        { kind: 'noseCone', fields: { shape: 'ogive', length: '4 in', baseRadius: '0.5 in' } },
        { kind: 'bodyTube', fields: { length: '12 in', outerRadius: '0.5 in' } },
        {
          kind: 'finSet',
          fields: { count: 3, rootChord: '2 in', tipChord: '1 in', span: '1.5 in' },
        },
        { kind: 'innerTube', name: 'Mount', fields: { length: '70 mm', outerRadius: '9.5 mm' } },
      ],
      motor: { name: 'C6' },
    });
    expect(res.ok, res.text).toBe(true);
    // A plugged C6 with no parachute: a ballistic flight, said, not refused.
    expect(get(res.json, 'flight', 'summary', 'apogee_m')).toEqual(expect.any(Number));
    expect(get(res.json, 'motor', 'delay')).toBe('plugged (not given)');
    const whats = (res.json['approximations'] as { what: string }[]).map((a) => a.what);
    expect(whats).toEqual(
      expect.arrayContaining([
        'wall thickness not given',
        'position not given',
        'ejection delay not given',
        'motor overhang not given',
        'motor mount not given',
      ]),
    );
    expect(res.json['should']).toEqual(
      expect.arrayContaining([expect.stringMatching(/No recovery device/)]),
    );
  });

  it('says a plugged motor the user wrote is plugged, not "not given"', async () => {
    const c = await connect();
    const res = await call(c, 'build_and_fly', examplePaste({ name: 'Estes D12-P', overhang: 0 }));
    expect(res.ok, res.text).toBe(true);
    expect(get(res.json, 'motor', 'delay')).toBe('plugged');
    const whats = (res.json['approximations'] as { what: string }[]).map((a) => a.what);
    expect(whats).not.toContain('ejection delay not given');
  });

  it('returns the stability without a flight when the motor cannot be found', async () => {
    const c = await connect();
    const res = await call(c, 'build_and_fly', examplePaste({ name: 'K550-6' }));
    expect(res.ok, res.text).toBe(true);
    expect(get(res.json, 'flight', 'not_flown')).toMatch(
      /no K550 in the library, and the ThrustCurve\.org catalogue is not available/,
    );
    expect(get(res.json, 'stability', 'cp_from_nose_m')).toBe(
      r(expectedStability.result.centreOfPressure.cp),
    );
    expect(res.json['must']).toContain('No motor is selected: set_motor.');
  });

  it('names the part that is wrong and keeps nothing', async () => {
    const c = await connect();
    const paste = examplePaste({ name: 'D12-5' });
    const parts = paste['parts'] as { fields: Record<string, unknown> }[];
    const body = parts[1];
    if (body === undefined) throw new Error('the example has a body tube');
    body.fields = { ...body.fields, length: -1 };
    const res = await call(c, 'build_and_fly', paste);
    expect(res.ok).toBe(false);
    expect(res.text).toMatch(/^part 2 \(Body tube\): /);
    const list = await call(c, 'list_designs', {});
    expect(list.json as unknown as unknown[]).toEqual([]);
  });

  describe('a motor only on ThrustCurve.org (recorded answers, no network)', () => {
    // A hand-made RASP file for the fixture only: it is never used as motor data elsewhere.
    const e12 = [
      'E12 24 95 0-4-6-8 0.0359 0.0582 Estes',
      '0.05 5.0',
      '0.2 25.0',
      '0.5 13.0',
      '2.5 11.0',
      '2.6 0.0',
      ';',
    ].join('\n');
    const summary = (maker: string, abbrev: string, id: string): Record<string, unknown> => ({
      motorId: id,
      manufacturer: maker,
      manufacturerAbbrev: abbrev,
      designation: 'E12',
      commonName: 'E12',
      impulseClass: 'E',
      diameter: 24,
      length: 95,
      type: 'SU',
      avgThrustN: 12,
      maxThrustN: 25,
      totImpulseNs: 30,
      burnTimeS: 2.6,
      dataFiles: 1,
      delays: '0,4,6,8',
      availability: 'regular',
    });
    function transportWith(results: Record<string, unknown>[]): Transport & { bodies: unknown[] } {
      const bodies: unknown[] = [];
      const answers: Record<string, unknown> = {
        'search.json': { matches: results.length, results },
        'download.json': {
          results: [
            {
              motorId: 'tc-e12',
              simfileId: 'sim-e12',
              format: 'RASP',
              source: 'mfr',
              data: Buffer.from(e12).toString('base64'),
            },
          ],
        },
      };
      const t: Transport = (url, init) => {
        bodies.push(JSON.parse(init.body));
        const answer = answers[url.replace('https://www.thrustcurve.org/api/v1/', '')];
        return Promise.resolve({
          ok: answer !== undefined,
          status: answer === undefined ? 404 : 200,
          text: () => Promise.resolve(JSON.stringify(answer)),
        });
      };
      return Object.assign(t, { bodies });
    }

    it('downloads the one exact match and flies it, saying so', async () => {
      const transport = transportWith([summary('Estes Industries', 'Estes', 'tc-e12')]);
      const c = await connect(new Session(transport));
      const res = await call(c, 'build_and_fly', examplePaste({ name: 'Estes E12-4' }));
      expect(res.ok, res.text).toBe(true);
      expect(res.json['motor']).toEqual({
        id: 'thrustcurve:tc-e12',
        name: 'Estes E12',
        source: 'thrustcurve',
        downloaded: true,
        delay: '4 s',
      });
      expect(get(res.json, 'flight', 'summary', 'apogee_m')).toEqual(expect.any(Number));
      // Searched by the common name, without hasDataFiles (issue #8).
      expect(transport.bodies[0]).toEqual({ commonName: 'E12', maxResults: 50 });
    });

    it('asks for the maker when two makers sell the code', async () => {
      const transport = transportWith([
        summary('Estes Industries', 'Estes', 'tc-e12'),
        summary('Quest Aerospace', 'Quest', 'tc-q-e12'),
      ]);
      const c = await connect(new Session(transport));
      const res = await call(c, 'build_and_fly', examplePaste({ name: 'E12-4' }));
      expect(res.ok, res.text).toBe(true);
      expect(get(res.json, 'flight', 'not_flown')).toMatch(
        /"E12-4" matches Estes E12, Quest E12 on ThrustCurve\.org: give the manufacturer/,
      );
      // Nothing was downloaded.
      expect(transport.bodies).toHaveLength(1);
    });
  });
});

describe('import_design with simulate (plan 0079)', () => {
  const example = exampleDesign();
  const flight = simulateFlight(designVehicle(example), designSimulationOptions(example));

  it('flies a pasted .lofi.json in the same call, as the engine flies it', async () => {
    const c = await connect();
    const res = await call(c, 'import_design', {
      content: serializeDesign(example),
      format: 'lofi',
      simulate: true,
    });
    expect(res.ok, res.text).toBe(true);
    expect(get(res.json, 'flight', 'summary', 'apogee_m')).toBe(r(flight.summary.apogee));
    expect(res.json['must']).toEqual([]);
  });

  it('reads a pasted RASAero II .CDX1 and flies it with the bundled motor', async () => {
    const c = await connect();
    const res = await call(c, 'import_design', {
      content: exportCdx1(example).text,
      format: 'cdx1',
      simulate: true,
    });
    expect(res.ok, res.text).toBe(true);
    expect(get(res.json, 'flight', 'summary', 'apogee_m')).toEqual(expect.any(Number));
    expect(get(res.json, 'stability', 'liftoff', 'margin_calibers')).toEqual(expect.any(Number));
  });
});
