/**
 * ThrustCurve.org API client (plan 0013; CLAUDE.md 6.6). Endpoints and
 * fields follow reference/docs/thrustcurve-api/swagger.json (API 1.0.3):
 * POST /api/v1/metadata.json, /search.json and /download.json with JSON
 * bodies. The transport is injected so that tests use recorded fixtures
 * and the app passes the browser's fetch. Responses are checked field by
 * field; anything unexpected is a ThrustCurveError, never a guess.
 */
import { metres, type Metres, type MotorDefinition } from '@lo-fi-rocket/physics';
import { parseEng } from '../eng.js';
import { FormatError } from '../errors.js';
import { motorFromEng, motorFromRse } from '../motor-definition.js';
import { parseRse } from '../rse.js';

export const THRUSTCURVE_BASE_URL = 'https://www.thrustcurve.org/api/v1/';

export class ThrustCurveError extends FormatError {}

/** The subset of fetch the client needs (injectable). */
export type Transport = (
  url: string,
  init: {
    readonly method: 'POST';
    readonly headers: Record<string, string>;
    readonly body: string;
  },
) => Promise<{ readonly ok: boolean; readonly status: number; text(): Promise<string> }>;

export interface SearchRequest {
  readonly manufacturer?: string;
  readonly designation?: string;
  readonly commonName?: string;
  readonly impulseClass?: string;
  /** Millimetres, as the API defines it. */
  readonly diameter?: number;
  readonly type?: 'SU' | 'reload' | 'hybrid';
  readonly certOrg?: string;
  readonly availability?: 'regular' | 'occasional' | 'OOP' | 'available' | 'all';
  readonly hasDataFiles?: boolean;
  readonly maxResults?: number;
}

export interface MotorSummary {
  readonly motorId: string;
  readonly manufacturer: string;
  readonly manufacturerAbbrev: string;
  readonly designation: string;
  readonly commonName: string;
  readonly impulseClass: string;
  readonly certOrg: string;
  readonly diameter: Metres;
  readonly length: Metres;
  readonly type: string;
  readonly avgThrustN: number;
  readonly maxThrustN: number;
  readonly totImpulseNs: number;
  readonly burnTimeS: number;
  readonly dataFiles: number;
  readonly totalWeightG: number | undefined;
  readonly propWeightG: number | undefined;
  readonly delays: string | undefined;
  readonly availability: string;
  readonly infoUrl: string | undefined;
}

export interface SearchResult {
  readonly matches: number;
  readonly results: readonly MotorSummary[];
}

export interface Metadata {
  readonly manufacturers: readonly { name: string; abbrev: string }[];
  readonly certOrgs: readonly { name: string; abbrev: string }[];
  readonly types: readonly string[];
  readonly diameters: readonly number[];
  readonly impulseClasses: readonly string[];
}

export interface DownloadedMotor {
  readonly motorId: string;
  readonly simfileId: string;
  readonly format: 'RASP' | 'RockSim';
  readonly source: string;
  readonly license: string | undefined;
  /** The data file as text. */
  readonly fileText: string;
  readonly definition: MotorDefinition;
  readonly infoUrl: string | undefined;
}

type Json = Record<string, unknown>;

function isRecord(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function str(o: Json, k: string, where: string): string {
  const v = o[k];
  if (typeof v !== 'string') throw new ThrustCurveError(`${where}: expected "${k}" to be a string`);
  return v;
}
function optStr(o: Json, k: string): string | undefined {
  const v = o[k];
  return typeof v === 'string' ? v : undefined;
}
function num(o: Json, k: string, where: string): number {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new ThrustCurveError(`${where}: expected "${k}" to be a number`);
  }
  return v;
}
function optNum(o: Json, k: string): number | undefined {
  const v = o[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
function arr(o: Json, k: string, where: string): unknown[] {
  const v = o[k];
  if (!Array.isArray(v)) throw new ThrustCurveError(`${where}: expected "${k}" to be an array`);
  return v;
}

async function post(transport: Transport, endpoint: string, body: unknown): Promise<Json> {
  const url = `${THRUSTCURVE_BASE_URL}${endpoint}`;
  let response: Awaited<ReturnType<Transport>>;
  try {
    response = await transport(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new ThrustCurveError(
      `ThrustCurve.org could not be reached (${error instanceof Error ? error.message : String(error)}); check the connection or use a motor from the library`,
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new ThrustCurveError(
      `ThrustCurve.org answered ${String(response.status)} for ${endpoint}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await response.text());
  } catch (error) {
    throw new ThrustCurveError(`ThrustCurve.org returned invalid JSON for ${endpoint}`, {
      cause: error,
    });
  }
  if (!isRecord(parsed))
    throw new ThrustCurveError(`ThrustCurve.org returned no object for ${endpoint}`);
  const error = parsed['error'];
  if (typeof error === 'string' && error !== '') {
    throw new ThrustCurveError(`ThrustCurve.org reported: ${error}`);
  }
  return parsed;
}

export async function fetchMetadata(
  transport: Transport,
  criteria: Omit<SearchRequest, 'maxResults'> = {},
): Promise<Metadata> {
  const o = await post(transport, 'metadata.json', criteria);
  const names = (k: string): { name: string; abbrev: string }[] =>
    arr(o, k, 'metadata').map((x, i) => {
      if (!isRecord(x))
        throw new ThrustCurveError(`metadata ${k}[${String(i)}]: expected an object`);
      return { name: str(x, 'name', `metadata ${k}`), abbrev: str(x, 'abbrev', `metadata ${k}`) };
    });
  const strings = (k: string): string[] =>
    arr(o, k, 'metadata').map((x) => {
      if (typeof x !== 'string') throw new ThrustCurveError(`metadata ${k}: expected strings`);
      return x;
    });
  return {
    manufacturers: names('manufacturers'),
    certOrgs: names('certOrgs'),
    types: strings('types'),
    diameters: arr(o, 'diameters', 'metadata').map((x) => {
      if (typeof x !== 'number') throw new ThrustCurveError('metadata diameters: expected numbers');
      return x;
    }),
    impulseClasses: strings('impulseClasses'),
  };
}

export async function searchMotors(
  transport: Transport,
  request: SearchRequest,
): Promise<SearchResult> {
  if (Object.keys(request).filter((k) => k !== 'maxResults').length === 0) {
    throw new ThrustCurveError('at least one search criterion is required');
  }
  const o = await post(transport, 'search.json', request);
  const results = arr(o, 'results', 'search').map((x, i): MotorSummary => {
    const where = `search results[${String(i)}]`;
    if (!isRecord(x)) throw new ThrustCurveError(`${where}: expected an object`);
    return {
      motorId: str(x, 'motorId', where),
      manufacturer: str(x, 'manufacturer', where),
      manufacturerAbbrev: optStr(x, 'manufacturerAbbrev') ?? str(x, 'manufacturer', where),
      designation: str(x, 'designation', where),
      commonName: optStr(x, 'commonName') ?? str(x, 'designation', where),
      impulseClass: optStr(x, 'impulseClass') ?? '',
      certOrg: optStr(x, 'certOrg') ?? '',
      // UNIT-1: the API gives millimetres.
      diameter: metres(num(x, 'diameter', where) / 1000),
      length: metres(num(x, 'length', where) / 1000),
      type: optStr(x, 'type') ?? '',
      avgThrustN: num(x, 'avgThrustN', where),
      maxThrustN: num(x, 'maxThrustN', where),
      totImpulseNs: num(x, 'totImpulseNs', where),
      burnTimeS: num(x, 'burnTimeS', where),
      dataFiles: optNum(x, 'dataFiles') ?? 0,
      totalWeightG: optNum(x, 'totalWeightG'),
      propWeightG: optNum(x, 'propWeightG'),
      delays: optStr(x, 'delays'),
      availability: optStr(x, 'availability') ?? '',
      infoUrl: optStr(x, 'infoUrl'),
    };
  });
  return { matches: optNum(o, 'matches') ?? results.length, results };
}

/** Decode the API's Base64 file content to text (UTF-8; RASP and RockSim files are ASCII). */
function decodeBase64(data: string): string {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Download a motor's data file. RASP is asked for first; a RockSim file is
 * accepted when no RASP file exists. Several files for one motor: the first
 * certification-sourced one, else the first.
 */
export async function downloadMotor(
  transport: Transport,
  motorId: string,
  format: 'RASP' | 'RockSim' | 'any' = 'any',
): Promise<DownloadedMotor> {
  const formats: ('RASP' | 'RockSim')[] = format === 'any' ? ['RASP', 'RockSim'] : [format];
  for (const f of formats) {
    const o = await post(transport, 'download.json', {
      motorIds: [motorId],
      format: f,
      data: 'file',
    });
    const results = arr(o, 'results', 'download').map((x, i) => {
      if (!isRecord(x))
        throw new ThrustCurveError(`download results[${String(i)}]: expected an object`);
      return x;
    });
    if (results.length === 0) continue;
    const chosen = results.find((r) => r['source'] === 'cert') ?? results[0];
    if (chosen === undefined) continue;
    const where = `download ${motorId}`;
    const fileText = decodeBase64(str(chosen, 'data', where));
    const simfileId = str(chosen, 'simfileId', where);
    const fileName = `thrustcurve ${simfileId}.${f === 'RASP' ? 'eng' : 'rse'}`;
    let definition: MotorDefinition;
    if (f === 'RASP') {
      const motors = parseEng(fileText, fileName);
      const first = motors[0];
      if (first === undefined) throw new ThrustCurveError(`${where}: the RASP file holds no motor`);
      definition = motorFromEng(first);
    } else {
      const motors = parseRse(fileText, {}, fileName);
      const first = motors[0];
      if (first === undefined)
        throw new ThrustCurveError(`${where}: the RockSim file holds no motor`);
      definition = motorFromRse(first, fileName);
    }
    return {
      motorId,
      simfileId,
      format: f,
      source: optStr(chosen, 'source') ?? 'unknown',
      license: optStr(chosen, 'license'),
      fileText,
      definition,
      infoUrl: optStr(chosen, 'infoUrl'),
    };
  }
  throw new ThrustCurveError(
    `ThrustCurve.org has no ${format === 'any' ? 'RASP or RockSim' : format} data file for motor ${motorId}`,
  );
}
