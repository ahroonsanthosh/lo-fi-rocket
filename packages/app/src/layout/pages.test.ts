import { exampleDesign } from '@lo-fi-rocket/formats';
import { describe, expect, it } from 'vitest';
import { pageOf, STABILITY_TARGET } from './pages.js';
import { EMPTY_STEP_PREFIX } from './steps.js';

describe('pages of the task panel', () => {
  const d = exampleDesign('p');
  it('a selection opens its page', () => {
    const fins = d.components.find((c) => c.component.kind === 'finSet');
    expect(pageOf(fins?.id, d)).toBe('part');
    expect(pageOf(d.recovery[0]?.id, d)).toBe('recovery');
    expect(pageOf('motor', d)).toBe('motor');
    expect(pageOf('flight', d)).toBe('flight');
    expect(pageOf('launch', d)).toBe('launch');
    expect(pageOf(STABILITY_TARGET, d)).toBe('stability');
    expect(pageOf(`${EMPTY_STEP_PREFIX}body`, d)).toBe('add-part');
  });
  it('nothing selected, or a removed part, is the home page', () => {
    expect(pageOf(undefined, d)).toBe('home');
    expect(pageOf('a part that was removed', d)).toBe('home');
  });
});
