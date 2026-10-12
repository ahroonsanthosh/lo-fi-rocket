/**
 * The provenance of the running build (D-061), injected at build time by
 * the Vite and Vitest configurations as `__LOFI_BUILD__` (see
 * build/physics-fingerprint.ts), and its comparison with the provenance
 * stored with a result.
 */
import type { BuildProvenance } from './physics-fingerprint.js';

export type { BuildProvenance };

declare const __LOFI_BUILD__: BuildProvenance;

export const CURRENT_PROVENANCE: BuildProvenance = __LOFI_BUILD__;

/** True when a result was produced by this exact app version and physics source. */
export function sameProvenance(a: BuildProvenance, b: BuildProvenance): boolean {
  return a.appVersion === b.appVersion && a.physicsHash === b.physicsHash;
}

/** "app 1.0.0, physics 3fa9c0d2e1b4" for display. */
export function describeProvenance(p: BuildProvenance): string {
  return `app ${p.appVersion}, physics ${p.physicsHash.slice(0, 12)}`;
}
