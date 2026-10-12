import fc from 'fast-check';
import { exampleDesign, newDesign, validateDesign } from '@lo-fi-rocket/formats';
import { metres } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import {
  COMPONENT_LABELS,
  initialState,
  reduce,
  type Action,
  type ComponentKind,
} from './reducer.js';

const KINDS = Object.keys(COMPONENT_LABELS) as ComponentKind[];

describe('reducer (plan 0012)', () => {
  it('adds a component at the tail with a unique id and selects it', () => {
    let s = initialState(exampleDesign());
    s = reduce(s, { type: 'add-component', kind: 'bodyTube', id: 'new-tube' });
    const added = s.design.components.at(-1);
    expect(added?.id).toBe('new-tube');
    expect(added?.component.kind).toBe('bodyTube');
    // R1's outline ends at 0.6 m (nose 0.1 + body 0.5)
    expect(added?.position).toBe(0.6);
    expect(s.selectedId).toBe('new-tube');
    expect(s.revision).toBe(1);
    expect(() => validateDesign(JSON.parse(JSON.stringify(s.design)))).not.toThrow();
  });
  it('updates one field and keeps the rest; removing the mount tube clears the motor mount', () => {
    let s = initialState(exampleDesign());
    s = reduce(s, { type: 'update-component', id: 'fins', name: 'Big fins' });
    expect(s.design.components.find((c) => c.id === 'fins')?.name).toBe('Big fins');
    expect(s.design.components.find((c) => c.id === 'fins')?.position).toBe(0.5);
    expect(s.design.motorMount).toBeDefined();
    s = reduce(s, { type: 'remove-component', id: 'mount' });
    expect(s.design.motorMount).toBeUndefined();
    expect('motorMount' in s.design).toBe(false);
    expect(s.design.components.some((c) => c.id === 'mount')).toBe(false);
  });
  it('moves components and ignores moves past the ends', () => {
    let s = initialState(exampleDesign());
    const first = s.design.components[0]?.id;
    s = reduce(s, { type: 'move-component', id: 'nose', direction: -1 });
    expect(s.design.components[0]?.id).toBe(first);
    s = reduce(s, { type: 'move-component', id: 'nose', direction: 1 });
    expect(s.design.components[1]?.id).toBe('nose');
    expect(s.design.components[0]?.id).toBe('body');
  });
  it('every action sequence leaves a design that validates (property)', () => {
    const action: fc.Arbitrary<Action> = fc.oneof(
      fc.record({
        type: fc.constant('add-component' as const),
        kind: fc.constantFrom(...KINDS),
        id: fc.uuid(),
      }),
      fc.record({
        type: fc.constant('remove-component' as const),
        id: fc.constantFrom('nose', 'body', 'fins', 'mount'),
      }),
      fc.record({
        type: fc.constant('move-component' as const),
        id: fc.constantFrom('nose', 'body', 'fins'),
        direction: fc.constantFrom(-1 as const, 1 as const),
      }),
      fc.record({ type: fc.constant('add-recovery' as const), id: fc.uuid() }),
      fc.record({ type: fc.constant('rename' as const), name: fc.string() }),
      fc.record({
        type: fc.constant('update-component' as const),
        id: fc.constantFrom('nose', 'body'),
        position: fc.double({ min: 0, max: 2, noNaN: true }).map(metres),
      }),
    );
    fc.assert(
      fc.property(fc.array(action, { maxLength: 12 }), (actions) => {
        let s = initialState(exampleDesign());
        for (const a of actions) s = reduce(s, a);
        validateDesign(JSON.parse(JSON.stringify(s.design)));
        return true;
      }),
      { seed: 20261012, numRuns: 150 },
    );
  });
  it('defaults scale with the outline of an empty design too', () => {
    let s = initialState(newDesign('x', 'empty'));
    s = reduce(s, { type: 'add-component', kind: 'noseCone', id: 'n' });
    s = reduce(s, { type: 'add-component', kind: 'bodyTube', id: 'b' });
    s = reduce(s, { type: 'add-component', kind: 'finSet', id: 'f' });
    const nose = s.design.components[0]?.component;
    const body = s.design.components[1];
    expect(nose?.kind === 'noseCone' ? nose.length : Number.NaN).toBeCloseTo(0.075, 12);
    expect(body?.position).toBeCloseTo(0.075, 12);
    expect(() => validateDesign(JSON.parse(JSON.stringify(s.design)))).not.toThrow();
  });
});
