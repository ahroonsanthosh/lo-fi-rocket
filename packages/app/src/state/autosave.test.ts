import { exampleDesign, serializeDesign } from '@lo-fi-rocket/formats';
import { describe, expect, it } from 'vitest';
import { loadLastDesign, loadUnits, saveDesign, saveUnits, type Storage } from './autosave.js';

function memory(): Storage & { readonly map: Map<string, string> } {
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
  };
}

describe('autosave (plan 0012, D-043)', () => {
  it('saves the serialized design and reloads it as the last design', () => {
    const s = memory();
    expect(loadLastDesign(s)).toEqual({ kind: 'none' });
    const d = exampleDesign();
    saveDesign(s, d);
    expect(s.map.get('lofi-rocket:design:example-r1')).toBe(serializeDesign(d));
    expect(loadLastDesign(s)).toEqual({ kind: 'design', design: d });
  });
  it('keeps an invalid stored design under the recovered key and reports it', () => {
    const s = memory();
    s.setItem('lofi-rocket:last', 'bad');
    s.setItem('lofi-rocket:design:bad', '{"schemaVersion": 1, "id": "bad"}');
    const r = loadLastDesign(s);
    expect(r.kind).toBe('invalid');
    expect(r.kind === 'invalid' && r.message).toMatch(
      /autosave bad, \$: missing required field "name"/,
    );
    expect(s.map.get('lofi-rocket:recovered:bad')).toBe('{"schemaVersion": 1, "id": "bad"}');
    expect(s.map.has('lofi-rocket:design:bad')).toBe(false);
  });
  it('remembers the unit system, defaulting to metric', () => {
    const s = memory();
    expect(loadUnits(s)).toBe('metric');
    saveUnits(s, 'imperial');
    expect(loadUnits(s)).toBe('imperial');
  });
});
