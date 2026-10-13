/**
 * The guided path (docs/ui/redesign.md section 3): seven steps, each
 * opening a part of the design. The app decides each step's status from
 * the design; no step ever blocks another.
 */
import type { RocketDesign } from '@lo-fi-rocket/formats';
import type { Step, StepStatus } from '@lo-fi-rocket/ui';
import type { ComponentKind } from '../state/reducer.js';

export type StepId = 'body' | 'nose' | 'fins' | 'motor' | 'recovery' | 'launch' | 'flight';

export const STEP_ORDER: readonly StepId[] = [
  'body',
  'nose',
  'fins',
  'motor',
  'recovery',
  'launch',
  'flight',
];

export const STEP_LABEL: Readonly<Record<StepId, string>> = {
  body: 'Body tube',
  nose: 'Nose cone',
  fins: 'Fins',
  motor: 'Motor',
  recovery: 'Recovery',
  launch: 'Launch',
  flight: 'Simulate and results',
};

/** The one line each step says (section 3 of the plan). */
export const STEP_HINT: Readonly<Record<StepId, string>> = {
  body: 'The body sets the reference diameter that stability is measured in.',
  nose: 'Choose the nose shape and its length.',
  fins: 'Fins move the centre of pressure back; bigger or further aft fins add stability.',
  motor: 'Choose the mount tube, then a motor that fits it, and check the ejection delay.',
  recovery: 'Without a parachute or streamer the rocket falls at its terminal speed.',
  launch:
    'Launch site, rail and wind. The NAR safety code forbids a rail more than 30° from vertical.',
  flight: 'Simulate the flight and read the results.',
};

/** The component each of the first three steps opens. */
const STEP_KIND: Partial<Readonly<Record<StepId, ComponentKind>>> = {
  body: 'bodyTube',
  nose: 'noseCone',
  fins: 'finSet',
};

export const MOTOR_TARGET = 'motor';
export const LAUNCH_TARGET = 'launch';
export const FLIGHT_TARGET = 'flight';
/** Selection of a step whose part does not exist yet: the main view offers to add it. */
export const EMPTY_STEP_PREFIX = 'step:';

/** What the app knows when it decides the statuses. */
export interface StepFacts {
  readonly design: RocketDesign;
  /** The liftoff stability assessment, when it could be computed. */
  readonly liftoffLevel: 'unstable' | 'typical' | 'overstable' | undefined;
  /** True when a flight exists and was simulated from the current design. */
  readonly flightCurrent: boolean;
}

function hasKind(design: RocketDesign, kind: ComponentKind): boolean {
  return design.components.some((c) => c.component.kind === kind);
}

/** The status of one step, decided from the design (the "Done when" column of the plan). */
export function stepStatus(id: StepId, facts: StepFacts): { status: StepStatus; note?: string } {
  const d = facts.design;
  switch (id) {
    case 'body':
      return { status: hasKind(d, 'bodyTube') ? 'done' : 'todo' };
    case 'nose':
      return { status: hasKind(d, 'noseCone') ? 'done' : 'todo' };
    case 'fins':
      if (!hasKind(d, 'finSet')) return { status: 'todo' };
      return facts.liftoffLevel === 'unstable'
        ? { status: 'attention', note: 'needs attention: Rocket likely unstable' }
        : { status: 'done' };
    case 'motor':
      return { status: d.motorMount?.motor === undefined ? 'todo' : 'done' };
    case 'recovery':
      if (d.recovery.length > 0) return { status: 'done' };
      return d.components.length > 0
        ? { status: 'attention', note: 'needs attention: no recovery device' }
        : { status: 'todo' };
    case 'launch':
      // The defaults are valid, so the launch step is always done.
      return { status: 'done' };
    case 'flight':
      return { status: facts.flightCurrent ? 'done' : 'todo' };
  }
}

/** Every step with its status; the current one says so unless it needs attention. */
export function steps(facts: StepFacts, current: StepId | undefined): Step[] {
  return STEP_ORDER.map((id) => {
    const s = stepStatus(id, facts);
    const status: StepStatus = id === current && s.status !== 'attention' ? 'current' : s.status;
    return {
      id,
      label: STEP_LABEL[id],
      status,
      ...(s.note === undefined ? {} : { note: s.note }),
    };
  });
}

/** The selection a step opens: its part when it exists, or the empty step that offers to add one. */
export function stepTarget(id: StepId, design: RocketDesign): string {
  const empty = `${EMPTY_STEP_PREFIX}${id}`;
  const part = (kind: ComponentKind): string =>
    design.components.find((c) => c.component.kind === kind)?.id ?? empty;
  switch (id) {
    case 'body':
      return part('bodyTube');
    case 'nose':
      return part('noseCone');
    case 'fins':
      return part('finSet');
    case 'motor':
      return MOTOR_TARGET;
    case 'recovery':
      return design.recovery[0]?.id ?? empty;
    case 'launch':
      return LAUNCH_TARGET;
    case 'flight':
      return FLIGHT_TARGET;
  }
}

function isStepId(s: string): s is StepId {
  return (STEP_ORDER as readonly string[]).includes(s);
}

/** The step a selection belongs to, or undefined for a part outside the guide (a transition, a ring). */
export function stepOf(selectedId: string | undefined, design: RocketDesign): StepId | undefined {
  if (selectedId === undefined) return undefined;
  if (selectedId === MOTOR_TARGET) return 'motor';
  if (selectedId === LAUNCH_TARGET) return 'launch';
  if (selectedId === FLIGHT_TARGET) return 'flight';
  if (selectedId.startsWith(EMPTY_STEP_PREFIX)) {
    const id = selectedId.slice(EMPTY_STEP_PREFIX.length);
    return isStepId(id) ? id : undefined;
  }
  if (design.recovery.some((r) => r.id === selectedId)) return 'recovery';
  const kind = design.components.find((c) => c.id === selectedId)?.component.kind;
  if (kind === undefined) return undefined;
  return STEP_ORDER.find((s) => STEP_KIND[s] === kind);
}

/** The step after this one, or undefined at the end. */
export function nextStep(id: StepId): StepId | undefined {
  return STEP_ORDER[STEP_ORDER.indexOf(id) + 1];
}
