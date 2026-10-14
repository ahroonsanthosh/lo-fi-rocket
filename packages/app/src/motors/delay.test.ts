/**
 * Issue #10: the delay a newly chosen motor gets. The cases are the
 * review's steps with the bundled motors' delays (reference/motors:
 * Estes D12 and C6 0-3-5-7, AeroTech F39T 3-6-9, H123W 0).
 */
import { seconds, type Seconds } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { chooseDelay } from './delay.js';

const s = (...xs: number[]): Seconds[] => xs.map((x) => seconds(x));

describe('chooseDelay (issue #10)', () => {
  it('keeps the previous delay when the new motor is sold with it, and says nothing', () => {
    expect(chooseDelay('E C6', s(0, 3, 5, 7), seconds(5))).toEqual({ delay: 5, note: undefined });
  });

  it('takes the nearest delay and says so (D12 at 5 s to the F39T: 6 s, |6 − 5| = 1 < |3 − 5| = 2)', () => {
    expect(chooseDelay('AT F39T', s(3, 6, 9), seconds(5))).toEqual({
      delay: 6,
      note: 'Delay changed from 5 s to 6 s: the AT F39T is sold with 3, 6, 9 s.',
    });
  });

  it('breaks a tie towards the longer delay (6 s to the C6: 5 s and 7 s are both 1 s away)', () => {
    expect(chooseDelay('E C6', s(7, 0, 5, 3), seconds(6))).toEqual({
      delay: 7,
      note: 'Delay changed from 6 s to 7 s: the E C6 is sold with 0, 3, 5, 7 s.',
    });
  });

  it('with no previous delay, takes the shortest above 0 s and asks the user to choose', () => {
    const c = chooseDelay('E C6', s(0, 3, 5, 7), undefined);
    expect(c.delay).toBe(3);
    expect(c.note).toBe(
      "Delay set to 3 s, the shortest above 0 s of the E C6's 0, 3, 5, 7 s. Choose the delay that fits your rocket.",
    );
  });

  it('never picks 0 s without saying so', () => {
    const booster = chooseDelay('AT H123W', s(0), undefined);
    expect(booster.delay).toBe(0);
    expect(booster.note).toMatch(/0 s delay only: a booster motor/);
    const fromFive = chooseDelay('AT H123W', s(0), seconds(5));
    expect(fromFive.delay).toBe(0);
    expect(fromFive.note).toBe('Delay changed from 5 s to 0 s: the AT H123W is sold with 0 s.');
  });

  it('a plugged motor or a file with no delays is never silent', () => {
    expect(chooseDelay('X P1', 'plugged', seconds(5))).toEqual({
      delay: undefined,
      note: 'The X P1 is plugged (no ejection charge), so the 5 s delay no longer applies: deploy the recovery with an altimeter or timer.',
    });
    expect(chooseDelay('X P1', 'plugged', undefined).note).toMatch(/^The X P1 is plugged/);
    expect(chooseDelay('Custom', undefined, seconds(5))).toEqual({
      delay: 5,
      note: "The Custom's file lists no delays: the 5 s delay was kept. Check it against the motor you fly.",
    });
    expect(chooseDelay('Custom', undefined, undefined)).toEqual({
      delay: undefined,
      note: "The Custom's file lists no delays, so it is treated as plugged (no ejection charge). Enter its delay below if it has one.",
    });
    expect(chooseDelay('Custom', [], undefined).delay).toBeUndefined();
  });
});
