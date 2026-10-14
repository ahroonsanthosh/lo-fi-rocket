/**
 * Schema migrations for `.lofi.json` files (plan 0011, D-041). Each step
 * is a pure function from version n to n + 1 on the raw JSON object;
 * validation runs after the chain. A file newer than the app is rejected.
 */
import { DesignFileError } from './errors.js';
import { CURRENT_SCHEMA_VERSION } from './model.js';

export type Migration = (document: Record<string, unknown>) => Record<string, unknown>;

/**
 * MIGRATIONS[n - 1] upgrades version n to n + 1.
 * 1 to 2 (plan 0064): stages, the stage of a part or device, further motor mounts and ignition
 * events are all new and optional, so a version-1 file is the same one-stage design unchanged.
 */
export const MIGRATIONS: readonly Migration[] = [
  (document: Record<string, unknown>): Record<string, unknown> => document,
];

function versionOf(document: unknown, fileName: string | undefined): number {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new DesignFileError(fileName, '$', 'expected a JSON object');
  }
  const v = (document as Record<string, unknown>)['schemaVersion'];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    throw new DesignFileError(
      fileName,
      '$.schemaVersion',
      `expected a positive integer, received ${typeof v === 'number' ? String(v) : typeof v}`,
    );
  }
  return v;
}

/** Apply `migrations` (indexed as MIGRATIONS) from the document's version up to `target`. */
export function applyMigrations(
  document: unknown,
  migrations: readonly Migration[],
  target: number,
  fileName?: string,
): Record<string, unknown> {
  let version = versionOf(document, fileName);
  if (version > target) {
    throw new DesignFileError(
      fileName,
      '$.schemaVersion',
      `this file is version ${String(version)} but this app reads up to version ${String(target)}; update the app`,
    );
  }
  let doc = document as Record<string, unknown>;
  while (version < target) {
    const step = migrations[version - 1];
    if (step === undefined) {
      throw new DesignFileError(
        fileName,
        '$.schemaVersion',
        `no migration from version ${String(version)} to ${String(version + 1)}`,
      );
    }
    doc = { ...step(doc), schemaVersion: version + 1 };
    version += 1;
  }
  return doc;
}

export function migrateDesignDocument(
  document: unknown,
  fileName?: string,
): Record<string, unknown> {
  return applyMigrations(document, MIGRATIONS, CURRENT_SCHEMA_VERSION, fileName);
}
