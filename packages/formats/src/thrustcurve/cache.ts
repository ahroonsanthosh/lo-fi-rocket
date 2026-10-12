/**
 * Offline cache of downloaded ThrustCurve.org motors (plan 0013, CLAUDE.md
 * 6.6: "local caching so the app works offline"). The store is injected
 * (local storage in the browser, a map in tests). Entries hold the data
 * file text and the parsed definition with its provenance.
 */
import type { MotorDefinition } from '@lo-fi-rocket/physics';
import type { MotorProvenance } from '../design/model.js';
import { validateMotorSelection } from '../design/validate.js';
import { downloadMotor, type DownloadedMotor, type Transport } from './client.js';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Every key in the store. */
  keys(): string[];
}

export const MOTOR_CACHE_PREFIX = 'lofi-rocket:motor:';

export interface CachedMotor {
  readonly definition: MotorDefinition;
  readonly provenance: MotorProvenance;
  readonly fileText: string | undefined;
  /** ISO date of the download or import, for display only. */
  readonly savedAt: string;
  readonly infoUrl: string | undefined;
}

function keyOf(p: MotorProvenance, definition: MotorDefinition): string {
  switch (p.kind) {
    case 'thrustcurve':
      return `${MOTOR_CACHE_PREFIX}thrustcurve:${p.motorId}`;
    case 'file':
      return `${MOTOR_CACHE_PREFIX}file:${p.fileName}`;
    case 'bundled':
      return `${MOTOR_CACHE_PREFIX}bundled:${p.file}`;
    case 'custom':
      return `${MOTOR_CACHE_PREFIX}custom:${definition.manufacturer} ${definition.designation}`;
  }
}

function parseEntry(text: string, key: string): CachedMotor {
  const raw: unknown = JSON.parse(text);
  if (typeof raw !== 'object' || raw === null) throw new Error(`${key}: not an object`);
  const o = raw as Record<string, unknown>;
  const motor = validateMotorSelection(
    { definition: o['definition'], provenance: o['provenance'] },
    key,
  );
  return {
    definition: motor.definition,
    provenance: motor.provenance,
    fileText: typeof o['fileText'] === 'string' ? o['fileText'] : undefined,
    savedAt: typeof o['savedAt'] === 'string' ? o['savedAt'] : '',
    infoUrl: typeof o['infoUrl'] === 'string' ? o['infoUrl'] : undefined,
  };
}

export function listCachedMotors(store: KeyValueStore): {
  readonly entries: CachedMotor[];
  readonly problems: string[];
} {
  const entries: CachedMotor[] = [];
  const problems: string[] = [];
  for (const key of store.keys()) {
    if (!key.startsWith(MOTOR_CACHE_PREFIX)) continue;
    const text = store.getItem(key);
    if (text === null) continue;
    try {
      entries.push(parseEntry(text, key));
    } catch (error) {
      problems.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { entries, problems };
}

export function putCachedMotor(store: KeyValueStore, entry: CachedMotor): string {
  const key = keyOf(entry.provenance, entry.definition);
  store.setItem(key, JSON.stringify(entry));
  return key;
}

export function removeCachedMotor(store: KeyValueStore, entry: CachedMotor): void {
  store.removeItem(keyOf(entry.provenance, entry.definition));
}

export function cachedThrustCurveMotor(
  store: KeyValueStore,
  motorId: string,
): CachedMotor | undefined {
  const text = store.getItem(`${MOTOR_CACHE_PREFIX}thrustcurve:${motorId}`);
  if (text === null) return undefined;
  try {
    return parseEntry(text, motorId);
  } catch {
    return undefined;
  }
}

/** The cached motor when present, otherwise a download that is then cached. */
export async function getThrustCurveMotor(
  store: KeyValueStore,
  transport: Transport,
  motorId: string,
  now: () => string = () => new Date().toISOString(),
): Promise<{ readonly motor: CachedMotor; readonly fromCache: boolean }> {
  const cached = cachedThrustCurveMotor(store, motorId);
  if (cached !== undefined) return { motor: cached, fromCache: true };
  const d: DownloadedMotor = await downloadMotor(transport, motorId);
  const motor: CachedMotor = {
    definition: d.definition,
    provenance: { kind: 'thrustcurve', motorId, simfileId: d.simfileId },
    fileText: d.fileText,
    savedAt: now(),
    infoUrl: d.infoUrl,
  };
  putCachedMotor(store, motor);
  return { motor, fromCache: false };
}
