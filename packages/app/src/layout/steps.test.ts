import { describe, expect, it } from 'vitest';
import { EMPTY_STEP_PREFIX, emptyStepOf, STEP_LABEL } from './steps.js';

describe('steps', () => {
  it('reads the step of an empty-step selection and nothing else', () => {
    expect(emptyStepOf(`${EMPTY_STEP_PREFIX}fins`)).toBe('fins');
    expect(emptyStepOf(`${EMPTY_STEP_PREFIX}cabin`)).toBeUndefined();
    expect(emptyStepOf('fins')).toBeUndefined();
    expect(emptyStepOf(undefined)).toBeUndefined();
  });
  it('names every step in plain words', () => {
    expect(STEP_LABEL.body).toBe('Body tube');
    expect(STEP_LABEL.flight).toBe('Simulate and results');
  });
});
