/**
 * The fixtures follow reference/docs/thrustcurve-api/swagger.json; the
 * download fixture carries reference/motors/Estes_D12.eng Base64-encoded,
 * read from disk so the decoded definition can be checked against the
 * .eng reader on the same file.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { totalImpulse } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { parseEng } from '../eng.js';
import { motorFromEng } from '../motor-definition.js';
import {
  getThrustCurveMotor,
  listCachedMotors,
  putCachedMotor,
  type KeyValueStore,
} from './cache.js';
import {
  downloadMotor,
  fetchMetadata,
  searchMotors,
  ThrustCurveError,
  type Transport,
} from './client.js';

const REFERENCE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'reference',
);
const D12_ENG = readFileSync(join(REFERENCE, 'motors', 'Estes_D12.eng'), 'utf8');

const SEARCH_FIXTURE = {
  criteria: [{ name: 'diameter', value: '24', matches: 2 }],
  matches: 1,
  results: [
    {
      motorId: '5f4294d20002310000000055',
      manufacturer: 'Estes Industries',
      manufacturerAbbrev: 'Estes',
      designation: 'D12',
      commonName: 'D12',
      impulseClass: 'D',
      certOrg: 'National Association of Rocketry',
      diameter: 24,
      length: 70,
      type: 'SU',
      avgThrustN: 10.2,
      maxThrustN: 29.7,
      totImpulseNs: 16.8,
      burnTimeS: 1.6,
      dataFiles: 2,
      infoUrl: 'https://www.thrustcurve.org/motors/Estes/D12/',
      totalWeightG: 42.6,
      propWeightG: 21.1,
      delays: '0,3,5,7',
      availability: 'regular',
    },
  ],
};

function transportOf(
  handlers: Record<string, (body: unknown) => unknown>,
): Transport & { calls: string[] } {
  const calls: string[] = [];
  const t: Transport = (url, init) => {
    const endpoint = url.replace('https://www.thrustcurve.org/api/v1/', '');
    calls.push(endpoint);
    const h = handlers[endpoint];
    if (h === undefined)
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
    const out = h(JSON.parse(init.body));
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(out)),
    });
  };
  return Object.assign(t, { calls });
}

function memory(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    keys: () => [...map.keys()],
  };
}

const b64 = (text: string): string => Buffer.from(text, 'utf8').toString('base64');

describe('ThrustCurve.org client (plan 0013, swagger 1.0.3)', () => {
  it('search posts the criteria and reads the summary fields in SI', async () => {
    let body: unknown;
    const t = transportOf({
      'search.json': (b) => {
        body = b;
        return SEARCH_FIXTURE;
      },
    });
    const r = await searchMotors(t, { diameter: 24, impulseClass: 'D', maxResults: 20 });
    expect(body).toEqual({ diameter: 24, impulseClass: 'D', maxResults: 20 });
    expect(r.matches).toBe(1);
    expect(r.results[0]?.diameter).toBe(0.024);
    expect(r.results[0]?.length).toBe(0.07);
    expect(r.results[0]?.commonName).toBe('D12');
    expect(r.results[0]?.delays).toBe('0,3,5,7');
  });
  it('rejects an empty search, a non-OK answer, invalid JSON, an API error and a bad field', async () => {
    const t = transportOf({ 'search.json': () => ({ results: [{ motorId: 1 }] }) });
    await expect(searchMotors(t, {})).rejects.toThrow(/at least one search criterion/);
    await expect(searchMotors(t, { diameter: 24 })).rejects.toThrow(
      /results\[0\]: expected "motorId" to be a string/,
    );
    await expect(searchMotors(transportOf({}), { diameter: 24 })).rejects.toThrow(/answered 404/);
    const bad: Transport = () =>
      Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('<html>') });
    await expect(searchMotors(bad, { diameter: 24 })).rejects.toThrow(/invalid JSON/);
    const err = transportOf({ 'search.json': () => ({ error: 'invalid diameter' }) });
    await expect(searchMotors(err, { diameter: 24 })).rejects.toThrow(/reported: invalid diameter/);
    const down: Transport = () => Promise.reject(new Error('offline'));
    await expect(searchMotors(down, { diameter: 24 })).rejects.toThrow(
      /could not be reached \(offline\)/,
    );
  });
  it('metadata lists manufacturers, classes and diameters', async () => {
    const t = transportOf({
      'metadata.json': () => ({
        manufacturers: [{ name: 'Estes Industries', abbrev: 'Estes' }],
        certOrgs: [{ name: 'National Association of Rocketry', abbrev: 'NAR' }],
        types: ['SU'],
        diameters: [18, 24],
        impulseClasses: ['C', 'D'],
      }),
    });
    const m = await fetchMetadata(t);
    expect(m.manufacturers[0]?.abbrev).toBe('Estes');
    expect(m.diameters).toEqual([18, 24]);
  });
  it('download decodes the RASP file, prefers the certification source and parses it like the .eng reader', async () => {
    const t = transportOf({
      'download.json': (b) => {
        expect((b as { format: string }).format).toBe('RASP');
        return {
          results: [
            {
              motorId: 'id1',
              simfileId: 'user1',
              format: 'RASP',
              source: 'user',
              license: 'PD',
              data: b64('; junk\nD12 24 70 0 0.02 0.04 Estes\n1 1\n2 0\n'),
            },
            {
              motorId: 'id1',
              simfileId: 'cert1',
              format: 'RASP',
              source: 'cert',
              data: b64(D12_ENG),
              infoUrl: '/simfiles/cert1/',
            },
          ],
        };
      },
    });
    const d = await downloadMotor(t, 'id1');
    expect(d.simfileId).toBe('cert1');
    expect(d.format).toBe('RASP');
    expect(d.fileText).toBe(D12_ENG);
    const viaReader = parseEng(D12_ENG)[0];
    expect(d.definition.points).toEqual(viaReader?.points);
    expect(totalImpulse(d.definition)).toBeCloseTo(16.839, 3);
    expect(d.infoUrl).toBe('/simfiles/cert1/');
  });
  it('download falls back to RockSim when no RASP file exists, and reports when neither does', async () => {
    const rse = readFileSync(join(REFERENCE, 'motors', 'Estes_D12.rse'), 'utf8');
    const t = transportOf({
      'download.json': (b) =>
        (b as { format: string }).format === 'RASP'
          ? { results: [] }
          : {
              results: [
                {
                  motorId: 'id2',
                  simfileId: 's2',
                  format: 'RockSim',
                  source: 'user',
                  data: b64(rse),
                },
              ],
            },
    });
    const d = await downloadMotor(t, 'id2');
    expect(d.format).toBe('RockSim');
    expect(d.definition.sourceFormat).toBe('RockSim');
    expect(t.calls).toEqual(['download.json', 'download.json']);
    const none = transportOf({ 'download.json': () => ({ results: [] }) });
    await expect(downloadMotor(none, 'id3')).rejects.toThrow(ThrustCurveError);
    await expect(downloadMotor(none, 'id3')).rejects.toThrow(
      /no RASP or RockSim data file for motor id3/,
    );
  });
});

describe('motor cache (plan 0013, offline use)', () => {
  it('downloads once, then serves from the cache without the network', async () => {
    const store = memory();
    let downloads = 0;
    const t = transportOf({
      'download.json': () => {
        downloads += 1;
        return {
          results: [
            {
              motorId: 'id1',
              simfileId: 'cert1',
              format: 'RASP',
              source: 'cert',
              data: b64(D12_ENG),
            },
          ],
        };
      },
    });
    const first = await getThrustCurveMotor(store, t, 'id1', () => '2026-10-12T00:00:00Z');
    expect(first.fromCache).toBe(false);
    expect(first.motor.provenance).toEqual({
      kind: 'thrustcurve',
      motorId: 'id1',
      simfileId: 'cert1',
    });
    const offline: Transport = () => Promise.reject(new Error('offline'));
    const second = await getThrustCurveMotor(store, offline, 'id1');
    expect(second.fromCache).toBe(true);
    expect(second.motor.definition).toEqual(first.motor.definition);
    expect(second.motor.savedAt).toBe('2026-10-12T00:00:00Z');
    expect(downloads).toBe(1);
    expect(listCachedMotors(store).entries.length).toBe(1);
  });
  it('lists imported motors and reports corrupt entries without dropping the rest', () => {
    const store = memory();
    const d12 = parseEng(D12_ENG)[0];
    if (d12 === undefined) throw new Error('fixture');
    putCachedMotor(store, {
      definition: motorFromEng(d12),
      provenance: { kind: 'file', fileName: 'Estes_D12.eng' },
      fileText: D12_ENG,
      savedAt: '2026-10-12T00:00:00Z',
      infoUrl: undefined,
    });
    store.setItem('lofi-rocket:motor:file:broken.eng', '{"definition": {"designation": 5}}');
    store.setItem('other-key', 'ignored');
    const { entries, problems } = listCachedMotors(store);
    expect(entries.length).toBe(1);
    expect(entries[0]?.provenance).toEqual({ kind: 'file', fileName: 'Estes_D12.eng' });
    expect(problems.length).toBe(1);
    expect(problems[0]).toMatch(/broken\.eng/);
  });
});
