/**
 * The selections that are not a part of the design, and the names of the
 * steps a new design goes through (docs/ui/simplify.md section 3).
 */

export type StepId = 'body' | 'nose' | 'fins' | 'motor' | 'recovery' | 'launch' | 'flight';

export const STEP_LABEL: Readonly<Record<StepId, string>> = {
  body: 'Body tube',
  nose: 'Nose cone',
  fins: 'Fins',
  motor: 'Motor',
  recovery: 'Recovery',
  launch: 'Launch',
  flight: 'Simulate and results',
};

export const MOTOR_TARGET = 'motor';
export const LAUNCH_TARGET = 'launch';
export const FLIGHT_TARGET = 'flight';
/** Selection of a step whose part does not exist yet: the panel offers to add it. */
export const EMPTY_STEP_PREFIX = 'step:';

function isStepId(s: string): s is StepId {
  return s in STEP_LABEL;
}

/** The step of an empty-step selection ("step:fins" → "fins"), or undefined. */
export function emptyStepOf(selectedId: string | undefined): StepId | undefined {
  if (selectedId?.startsWith(EMPTY_STEP_PREFIX) !== true) return undefined;
  const id = selectedId.slice(EMPTY_STEP_PREFIX.length);
  return isStepId(id) ? id : undefined;
}
