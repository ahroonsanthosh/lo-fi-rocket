/**
 * Autosave to the browser's local storage (plan 0012, D-043). Designs are
 * stored as their `.lofi.json` text under one key per design id; the last
 * edited id is remembered. A stored text that no longer validates is kept
 * under a "recovered" key and reported, never deleted or repaired silently.
 */
import { parseDesign, serializeDesign, type RocketDesign } from '@lo-fi-rocket/formats';

export const STORAGE_PREFIX = 'lofi-rocket:';
const DESIGN_KEY = (id: string): string => `${STORAGE_PREFIX}design:${id}`;
const RECOVERED_KEY = (id: string): string => `${STORAGE_PREFIX}recovered:${id}`;
const LAST_KEY = `${STORAGE_PREFIX}last`;
const UNITS_KEY = `${STORAGE_PREFIX}units`;
const THEME_KEY = `${STORAGE_PREFIX}theme`;

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function saveDesign(storage: Storage, design: RocketDesign): void {
  storage.setItem(DESIGN_KEY(design.id), serializeDesign(design));
  storage.setItem(LAST_KEY, design.id);
}

export type LoadResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'design'; readonly design: RocketDesign }
  | { readonly kind: 'invalid'; readonly id: string; readonly message: string };

/** Load the last edited design; an invalid stored text is moved to the recovered key. */
export function loadLastDesign(storage: Storage): LoadResult {
  const id = storage.getItem(LAST_KEY);
  if (id === null) return { kind: 'none' };
  const text = storage.getItem(DESIGN_KEY(id));
  if (text === null) return { kind: 'none' };
  try {
    return { kind: 'design', design: parseDesign(text, `autosave ${id}`) };
  } catch (error) {
    storage.setItem(RECOVERED_KEY(id), text);
    storage.removeItem(DESIGN_KEY(id));
    return { kind: 'invalid', id, message: error instanceof Error ? error.message : String(error) };
  }
}

export function saveUnits(storage: Storage, units: 'metric' | 'imperial'): void {
  storage.setItem(UNITS_KEY, units);
}

export function loadUnits(storage: Storage): 'metric' | 'imperial' {
  return storage.getItem(UNITS_KEY) === 'imperial' ? 'imperial' : 'metric';
}

/** The colour theme: follow the system, or a fixed choice (D-UI-12). */
export type Theme = 'auto' | 'light' | 'dark';

export function saveTheme(storage: Storage, theme: Theme): void {
  storage.setItem(THEME_KEY, theme);
}

/** The stored theme; the system's own setting unless the user picked one. */
export function loadTheme(storage: Storage): Theme {
  const t = storage.getItem(THEME_KEY);
  return t === 'light' || t === 'dark' ? t : 'auto';
}

/** The browser's local storage, or undefined where it is unavailable (private mode, tests without jsdom). */
export function browserStorage(): Storage | undefined {
  try {
    const s = globalThis.localStorage;
    s.getItem(LAST_KEY);
    return s;
  } catch {
    return undefined;
  }
}

export interface StoredDesignSummary {
  readonly id: string;
  readonly name: string;
}

/** Every design kept in storage, by name; a stored text that does not parse is listed with its id and an error marker. */
export function listStoredDesigns(
  storage: Storage & { keys?: () => string[]; length?: number; key?: (i: number) => string | null },
): StoredDesignSummary[] {
  const keys: string[] = [];
  if (storage.keys !== undefined) keys.push(...storage.keys());
  else if (storage.length !== undefined && storage.key !== undefined) {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k !== null) keys.push(k);
    }
  }
  const prefix = `${STORAGE_PREFIX}design:`;
  const out: StoredDesignSummary[] = [];
  for (const k of keys) {
    if (!k.startsWith(prefix)) continue;
    const id = k.slice(prefix.length);
    const text = storage.getItem(k);
    if (text === null) continue;
    try {
      out.push({ id, name: parseDesign(text).name });
    } catch {
      out.push({ id, name: `(unreadable design ${id})` });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function loadStoredDesign(storage: Storage, id: string): RocketDesign {
  const text = storage.getItem(DESIGN_KEY(id));
  if (text === null) throw new Error(`no stored design with the id ${id}`);
  return parseDesign(text, `stored design ${id}`);
}

export function deleteStoredDesign(storage: Storage, id: string): void {
  storage.removeItem(DESIGN_KEY(id));
  if (storage.getItem(LAST_KEY) === id) storage.removeItem(LAST_KEY);
}
