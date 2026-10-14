/** The tool field table matches the design file's fields exactly (plan 0062 section 7). */
import { COMPONENT_FIELDS } from '@lo-fi-rocket/formats';
import { describe, expect, it } from 'vitest';
import { PART_FIELDS, PART_KINDS } from './fields.js';

describe('PART_FIELDS', () => {
  it('has every field of every kind the design file accepts, and no other', () => {
    expect(Object.keys(PART_FIELDS).sort()).toEqual(Object.keys(COMPONENT_FIELDS).sort());
    expect(Object.keys(PART_KINDS).sort()).toEqual(Object.keys(COMPONENT_FIELDS).sort());
    for (const [kind, f] of Object.entries(COMPONENT_FIELDS)) {
      const file = [...f.required, ...f.optional].filter((k) => k !== 'kind').sort();
      expect(Object.keys(PART_FIELDS[kind as keyof typeof PART_FIELDS]).sort(), kind).toEqual(file);
    }
  });
});
