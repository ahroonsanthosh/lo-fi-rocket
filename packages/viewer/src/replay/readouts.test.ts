/**
 * The displayed values are the simulator's stored values (plan 0024): for
 * all five reference rockets, at every event and at sampled steps, the
 * readouts are the stored sample's fields, bit for bit, labelled with the
 * stored time; every event marker sits at the stored step of its time.
 */
import { describe, expect, it } from 'vitest';
import { REFERENCE_ROCKETS, referenceFlight } from '../test-support/reference-flights.js';
import { eventMarkers, readoutsAt, readoutsNearest } from './readouts.js';

const FIELDS = [
  'altitude',
  'speed',
  'airspeed',
  'mach',
  'angleOfAttack',
  'stabilityCalibers',
  'cg',
  'cp',
  'mass',
  'thrust',
  'acceleration',
] as const;

describe.each(REFERENCE_ROCKETS)('readouts for $id', (rocket) => {
  const { result } = referenceFlight(rocket);

  it('flies to a landing with events', () => {
    expect(result.summary.endReason).toBe('landing');
    expect(result.events.map((e) => e.kind)).toEqual(
      expect.arrayContaining(['rail-exit', 'burnout', 'apogee', 'deployment', 'landing']),
    );
  });

  it('at every event, the readouts are the stored sample at the event time (liftoff has none and shows the nearest step)', () => {
    for (const event of result.events) {
      const r = readoutsNearest(result, event.time);
      const stored = result.samples[r.index]!;
      expect(r.sample).toBe(stored);
      // The simulator records a sample at every event except liftoff, which it detects inside a
      // rail step; the timed events' samples carry the integrated time (float drift below 1e-12 s).
      if (event.kind === 'liftoff') expect(Math.abs(r.time - event.time)).toBeLessThan(0.05);
      else expect(Math.abs(r.time - event.time)).toBeLessThan(1e-9);
      expect(Object.is(r.time, stored.time)).toBe(true);
      for (const f of FIELDS) expect(Object.is(r.sample[f], stored[f])).toBe(true);
      expect(r.sample.position).toBe(stored.position);
      expect(r.sample.velocity).toBe(stored.velocity);
      expect(r.sample.orientation).toBe(stored.orientation);
    }
  });

  it('at every 25th step, the readouts are the stored sample by reference, with NaN mapped to undefined only', () => {
    for (let i = 0; i < result.samples.length; i += 25) {
      const stored = result.samples[i]!;
      const r = readoutsAt(result, i);
      expect(r.sample).toBe(stored);
      expect(r.index).toBe(i);
      expect(Object.is(r.time, stored.time)).toBe(true);
      for (const f of FIELDS) expect(Object.is(r.sample[f], stored[f])).toBe(true);
      if (Number.isNaN(stored.stabilityCalibers)) expect(r.stabilityCalibers).toBeUndefined();
      else expect(Object.is(r.stabilityCalibers, stored.stabilityCalibers)).toBe(true);
      if (Number.isNaN(stored.angleOfAttack)) expect(r.angleOfAttack).toBeUndefined();
      else expect(Object.is(r.angleOfAttack, stored.angleOfAttack)).toBe(true);
      if (Number.isNaN(stored.mach)) expect(r.mach).toBeUndefined();
      else expect(Object.is(r.mach, stored.mach)).toBe(true);
      // The same step by time.
      expect(readoutsNearest(result, stored.time).index).toBe(i);
    }
  });

  it('the apogee readout equals the summary apogee and the stored time equals the time to apogee', () => {
    const apogee = result.events.find((e) => e.kind === 'apogee')!;
    const r = readoutsNearest(result, apogee.time);
    expect(r.sample.altitude).toBe(result.summary.apogee);
    expect(r.time).toBe(result.summary.timeToApogee);
  });

  it('every event marker is at the stored step of the event time; only liftoff falls back to the nearest step', () => {
    const markers = eventMarkers(result);
    expect(markers).toHaveLength(result.events.length);
    for (const m of markers) {
      const stored = result.samples[m.index]!;
      expect(m.position).toBe(stored.position);
      expect(m.time).toBe(stored.time);
      if (m.event.kind === 'liftoff') {
        expect(m.exact).toBe(false);
      } else {
        expect(m.exact).toBe(true);
        expect(Math.abs(m.time - m.event.time)).toBeLessThan(1e-9);
      }
    }
    expect(markers.filter((m) => !m.exact).map((m) => m.event.kind)).toEqual(['liftoff']);
    const landing = markers.find((m) => m.event.kind === 'landing')!;
    expect(Math.hypot(landing.position.x, landing.position.y)).toBe(result.summary.landingDistance);
  });

  it('the descent samples have no stability margin (NaN stored, undefined shown), never a made-up number', () => {
    const descent = result.samples.filter((s) => s.phase === 'descent');
    expect(descent.length).toBeGreaterThan(0);
    for (const s of descent) {
      expect(Number.isNaN(s.stabilityCalibers)).toBe(true);
      const r = readoutsAt(result, result.samples.indexOf(s));
      expect(r.stabilityCalibers).toBeUndefined();
    }
  });
});

describe('eventMarkers with a result that lacks the event sample', () => {
  it('falls back to the nearest stored step and flags it', () => {
    const { result } = referenceFlight(REFERENCE_ROCKETS[0]);
    const apogee = result.events.find((e) => e.kind === 'apogee')!;
    const without = {
      ...result,
      samples: result.samples.filter((s) => s.time !== apogee.time),
    };
    const m = eventMarkers(without).find((x) => x.event.kind === 'apogee')!;
    expect(m.exact).toBe(false);
    expect(m.time).not.toBe(apogee.time);
    expect(m.position).toBe(without.samples[m.index]!.position);
  });
});
