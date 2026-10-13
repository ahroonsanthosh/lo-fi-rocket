import { exampleDesign, newDesign, type RocketDesign } from '@lo-fi-rocket/formats';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_STEP_PREFIX,
  FLIGHT_TARGET,
  LAUNCH_TARGET,
  MOTOR_TARGET,
  nextStep,
  STEP_ORDER,
  stepOf,
  steps,
  stepTarget,
} from './steps.js';

const facts = (design: RocketDesign, flightCurrent = false) => ({
  design,
  liftoffLevel: undefined,
  flightCurrent,
});

describe('guided steps (redesign section 3)', () => {
  it('the example: every part step done, launch done, simulate not yet', () => {
    const list = steps(facts(exampleDesign('s')), 'fins');
    expect(list.map((s) => [s.id, s.status])).toEqual([
      ['body', 'done'],
      ['nose', 'done'],
      ['fins', 'current'],
      ['motor', 'done'],
      ['recovery', 'done'],
      ['launch', 'done'],
      ['flight', 'todo'],
    ]);
  });

  it('a new empty design: nothing started except the launch defaults', () => {
    const list = steps(facts(newDesign('n', 'New')), 'body');
    expect(list.map((s) => s.status)).toEqual([
      'current',
      'todo',
      'todo',
      'todo',
      'todo',
      'done',
      'todo',
    ]);
  });

  it('fins need attention while the rocket is likely unstable; recovery while there is none', () => {
    const d: RocketDesign = { ...exampleDesign('s'), recovery: [] };
    const list = steps({ design: d, liftoffLevel: 'unstable', flightCurrent: false }, 'fins');
    expect(list[2]).toMatchObject({
      status: 'attention',
      note: 'needs attention: Rocket likely unstable',
    });
    expect(list[4]).toMatchObject({
      status: 'attention',
      note: 'needs attention: no recovery device',
    });
  });

  it('simulate is done only for a flight of the current design', () => {
    expect(steps(facts(exampleDesign('s'), true), 'body')[6]?.status).toBe('done');
  });

  it('each step opens its part, or the empty step when the part does not exist, and maps back', () => {
    const example = exampleDesign('s');
    const empty = newDesign('n', 'New');
    for (const id of STEP_ORDER) {
      expect(stepOf(stepTarget(id, example), example)).toBe(id);
      expect(stepOf(stepTarget(id, empty), empty)).toBe(id);
    }
    expect(stepTarget('body', empty)).toBe(`${EMPTY_STEP_PREFIX}body`);
    expect(stepTarget('motor', empty)).toBe(MOTOR_TARGET);
    expect(stepTarget('launch', empty)).toBe(LAUNCH_TARGET);
    expect(stepTarget('flight', empty)).toBe(FLIGHT_TARGET);
    const fins = example.components.find((c) => c.component.kind === 'finSet');
    expect(stepTarget('fins', example)).toBe(fins?.id);
  });

  it('a part outside the guide belongs to no step; Next walks the list in order', () => {
    expect(stepOf(undefined, exampleDesign('s'))).toBeUndefined();
    expect(stepOf('no-such-id', exampleDesign('s'))).toBeUndefined();
    expect(STEP_ORDER.map(nextStep)).toEqual([
      'nose',
      'fins',
      'motor',
      'recovery',
      'launch',
      'flight',
      undefined,
    ]);
  });
});
