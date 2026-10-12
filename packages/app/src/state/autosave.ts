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
