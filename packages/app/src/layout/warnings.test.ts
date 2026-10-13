import { exampleDesign, newDesign, type RocketDesign } from '@lo-fi-rocket/formats';
import { metres, radians } from '@lo-fi-rocket/physics';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runNow } from '../simulation/runner.js';
import {
  CODE_SEVERITY,
  designWarningItems,
  flightWarningItems,
  motorFitMessage,
  splitMessage,
} from './warnings.js';

describe('splitMessage (redesign section 5, rule 3)', () => {
  it('splits at the first colon followed by a space, keeping ratios whole', () => {
    expect(
      splitMessage(
        'Average thrust to liftoff weight is 4.2:1, below 5:1: the rocket accelerates slowly off the pad.',
      ),
    ).toEqual({
      title: 'Average thrust to liftoff weight is 4.2:1, below 5:1',
      reason: 'the rocket accelerates slowly off the pad.',
    });
  });

  it('keeps a message without one as the whole title', () => {
    expect(splitMessage('The rail is 45.0° from vertical; the NAR code forbids it.')).toEqual({
      title: 'The rail is 45.0° from vertical; the NAR code forbids it.',
      reason: '',
    });
  });

  it('never drops or changes a word: title, ": " and reason give the message back', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const { title, reason } = splitMessage(message);
        if (message.includes(': ')) expect(`${title}: ${reason}`).toBe(message);
        else expect({ title, reason }).toEqual({ title: message, reason: '' });
      }),
    );
  });
});

describe('severities (D-UI-5)', () => {
  it('maps every flight warning code', () => {
    expect(CODE_SEVERITY['rail-exit-velocity']).toBe('danger');
    expect(CODE_SEVERITY['deployment-velocity']).toBe('danger');
    expect(CODE_SEVERITY['no-recovery']).toBe('danger');
    expect(CODE_SEVERITY['thrust-to-weight']).toBe('caution');
    expect(CODE_SEVERITY['max-time']).toBe('caution');
    expect(CODE_SEVERITY.transonic).toBe('limitation');
    expect(CODE_SEVERITY.supersonic).toBe('limitation');
    expect(CODE_SEVERITY['model-limit']).toBe('limitation');
    expect(CODE_SEVERITY.model).toBe('limitation');
  });
});

describe('design warnings', () => {
  it('the example has none; an empty design has none', () => {
    expect(designWarningItems(exampleDesign('w'), 'metric')).toEqual([]);
    expect(designWarningItems(newDesign('n', 'New'), 'metric')).toEqual([]);
  });

  it('a design with parts and no recovery device is a danger, in the flight check’s words', () => {
    const d: RocketDesign = { ...exampleDesign('w'), recovery: [] };
    const items = designWarningItems(d, 'metric');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'no-recovery',
      severity: 'danger',
      title: 'No recovery device',
      reason: 'the rocket falls ballistically and lands at its terminal speed.',
    });
  });

  it('a rail beyond the NAR limit is a danger with the physics message unchanged', () => {
    const base = exampleDesign('w');
    const d: RocketDesign = {
      ...base,
      launch: {
        ...base.launch,
        rail: { ...base.launch.rail, angleFromVertical: radians((45 * Math.PI) / 180) },
      },
    };
    const items = designWarningItems(d, 'metric');
    expect(items).toHaveLength(1);
    expect(items[0]?.severity).toBe('danger');
    expect(items[0]?.title).toMatch(
      /^The rail is 45\.0° from vertical; the NAR safety code forbids launching more than 30°/,
    );
  });

  it('a motor wider than its mount tube is a caution, also shown in the motor step', () => {
    const base = exampleDesign('w');
    const mount = base.motorMount;
    const motor = mount?.motor;
    if (mount === undefined || motor === undefined) throw new Error('example has a motor');
    // A 1 m wide motor cannot fit any tube of the example.
    const wide: RocketDesign = {
      ...base,
      motorMount: {
        ...mount,
        motor: { ...motor, definition: { ...motor.definition, diameter: metres(1) } },
      },
    };
    expect(motorFitMessage(wide, 'metric')).toMatch(/^The motor is 1000\.0 mm wide/);
    expect(designWarningItems(wide, 'metric').map((w) => w.severity)).toEqual(['caution']);
  });
});

describe('flight warnings', () => {
  it('the example flight has none (the Phase 2 example, review screenshot 13)', () => {
    const d = exampleDesign('f');
    const outcome = runNow(d);
    if (!outcome.ok) throw new Error(outcome.message);
    expect(flightWarningItems(d, outcome.result, false)).toEqual([]);
  });

  it('lists "No recovery device" once: left out when the design check already shows it', () => {
    const d: RocketDesign = { ...exampleDesign('f'), recovery: [] };
    const outcome = runNow(d);
    if (!outcome.ok) throw new Error(outcome.message);
    const all = flightWarningItems(d, outcome.result, false).map((w) => w.title);
    const without = flightWarningItems(d, outcome.result, true).map((w) => w.title);
    expect(all).toContain('No recovery device');
    expect(without).not.toContain('No recovery device');
    expect(all.length - without.length).toBe(1);
  });
});
