/**
 * `.lofi.json` reading and writing (plan 0011, D-041): JSON, UTF-8, keys in
 * sorted order at every level so that the same design always produces the
 * same text, two-space indentation, SI numbers.
 */
import { DesignFileError } from './errors.js';
import { migrateDesignDocument } from './migrate.js';
import type { RocketDesign } from './model.js';
import { validateDesign } from './validate.js';

export const DESIGN_FILE_EXTENSION = '.lofi.json';

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    const record: Record<string, unknown> = value as Record<string, unknown>;
    for (const k of Object.keys(record).sort()) {
      const v = record[k];
      if (v !== undefined) out[k] = sortKeys(v);
    }
    return out;
  }
  return value;
}

export function serializeDesign(design: RocketDesign): string {
  return `${JSON.stringify(sortKeys(design), null, 2)}\n`;
}

/** Parse, migrate and validate a design file's text. */
export function parseDesign(text: string, fileName?: string): RocketDesign {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new DesignFileError(
      fileName,
      '$',
      `not valid JSON (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }
  return validateDesign(migrateDesignDocument(document, fileName), fileName);
}
