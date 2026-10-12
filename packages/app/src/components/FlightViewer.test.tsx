/**
 * The 3D replay's readouts are the simulator's stored values converted at
 * the display boundary (plan 0024). jsdom has no WebGL, so the canvas does
 * not start; the scene, the clock, the readouts and the Monte Carlo replay
 * do, and are what is checked here.
 */
import {
  exampleDesign,
  type KeyValueStore,
  type RocketDesign,
  type Transport,
} from '@lo-fi-rocket/formats';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App.js';
import { runNow, synchronousRunner } from '../simulation/runner.js';
import type { Storage } from '../state/autosave.js';

function memory(): Storage & KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    keys: () => [...map.keys()],
  };
}
const noNetwork: Transport = () => Promise.reject(new Error('no network in tests'));

function renderApp(design: RocketDesign): ReturnType<typeof userEvent.setup> {
  render(
    <App
      storage={memory()}
      motorStore={memory()}
      transport={noNetwork}
      initialDesign={design}
      services={{ runner: synchronousRunner(), saveFile: () => undefined }}
    />,
  );
  return userEvent.setup();
}

async function simulate(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(within(screen.getByRole('listbox', { name: 'Flight' })).getByRole('option'));
  await user.click(screen.getByRole('button', { name: 'Simulate flight' }));
  return screen.findByRole('region', { name: '3D replay' });
}

function readout(viewer: HTMLElement, label: string): string {
  const dt = within(viewer).getByText(label, { selector: 'dt' });
  return dt.nextElementSibling?.textContent ?? '';
}

describe('FlightViewer (plan 0024)', () => {
  it('starts at the stored first step and shows the stored values at the apogee step after seeking to the apogee event', async () => {
    const design = exampleDesign('v');
    const user = renderApp(design);
    const viewer = await simulate(user);
    // The same deterministic flight, for the expected values (the test does not read the viewer's numbers from the viewer).
    const outcome = runNow(design);
    if (!outcome.ok) throw new Error(outcome.message);
    const result = outcome.result;
    expect(readout(viewer, 'Shown')).toBe('This flight');
    expect(readout(viewer, 'Stored step')).toMatch(/^1 of \d+, at 0\.000 s \(on-rail\)$/);
    expect(readout(viewer, 'Altitude')).toBe('0.00 m');
    expect(readout(viewer, 'Stability margin')).toMatch(/calibers$/);
    const apogee = result.events.find((e) => e.kind === 'apogee');
    if (apogee === undefined) throw new Error('no apogee');
    const apogeeIndex = result.samples.findIndex((s) => s.time === apogee.time);
    const stored = result.samples[apogeeIndex];
    if (stored === undefined) throw new Error('no apogee sample');
    const events = within(viewer).getByRole('list', { name: 'Replay events' });
    await user.click(within(events).getByRole('button', { name: /^Apogee / }));
    expect(readout(viewer, 'Stored step')).toBe(
      `${String(apogeeIndex + 1)} of ${String(result.samples.length)}, at ${(apogee.time as number).toFixed(3)} s (${stored.phase})`,
    );
    expect(readout(viewer, 'Altitude')).toBe(`${stored.altitude.toFixed(2)} m`);
    expect(readout(viewer, 'Altitude')).toBe(`${result.summary.apogee.toFixed(2)} m`);
    expect(readout(viewer, 'Velocity')).toBe(`${stored.speed.toFixed(1)} m/s`);
    // The apogee sample is recorded after the deployment at the same time (descent): no Mach, no
    // angle of attack, no margin are stored (NaN) and none is shown; a value is shown only when stored.
    expect(readout(viewer, 'Mach')).toBe(
      Number.isNaN(stored.mach) ? 'not available in this phase' : stored.mach.toFixed(3),
    );
    expect(readout(viewer, 'Angle of attack')).toBe(
      Number.isNaN(stored.angleOfAttack)
        ? 'not available in this phase'
        : `${((stored.angleOfAttack * 180) / Math.PI).toFixed(1)} °`,
    );
    expect(readout(viewer, 'Stability margin')).toBe(
      Number.isNaN(stored.stabilityCalibers)
        ? 'not available in this phase'
        : `${stored.stabilityCalibers.toFixed(2)} calibers`,
    );
    // The burnout step is powered flight: Mach and the angle of attack are stored and shown.
    await user.click(within(events).getByRole('button', { name: /^Burnout / }));
    const burnout = result.events.find((e) => e.kind === 'burnout');
    if (burnout === undefined) throw new Error('no burnout');
    const atBurnout = result.samples.find((s) => Math.abs(s.time - burnout.time) < 1e-9);
    if (atBurnout === undefined) throw new Error('no burnout sample');
    expect(readout(viewer, 'Mach')).toBe(atBurnout.mach.toFixed(3));
    expect(readout(viewer, 'Angle of attack')).toBe(
      `${((atBurnout.angleOfAttack * 180) / Math.PI).toFixed(1)} °`,
    );
    expect(readout(viewer, 'Stability margin')).toBe(
      `${atBurnout.stabilityCalibers.toFixed(2)} calibers`,
    );
    await user.click(within(events).getByRole('button', { name: /^Apogee / }));
    // The replay time is the stored step's own time, not an interpolation.
    expect(screen.getByLabelText('Replay time')).toHaveValue(String(apogee.time));
    // Liftoff has no stored step of its own and says so.
    expect(within(events).getByRole('button', { name: /^Liftoff / })).toHaveTextContent(
      'nearest stored step',
    );
  });

  it('the units toggle converts the readouts at the display boundary', async () => {
    const design = exampleDesign('u');
    const user = renderApp(design);
    const viewer = await simulate(user);
    const outcome = runNow(design);
    if (!outcome.ok) throw new Error(outcome.message);
    const events = within(viewer).getByRole('list', { name: 'Replay events' });
    await user.click(within(events).getByRole('button', { name: /^Apogee / }));
    await user.click(screen.getByRole('radio', { name: 'Imperial' }));
    const apogeeFt = outcome.result.summary.apogee / 0.3048;
    expect(readout(viewer, 'Altitude')).toBe(`${apogeeFt.toFixed(1)} ft`);
  });

  it('replays a Monte Carlo run: the same stored flight for zero variations, labelled as the run', async () => {
    const design = exampleDesign('m');
    const user = renderApp(design);
    const viewer = await simulate(user);
    await user.click(screen.getByRole('button', { name: 'Run dispersion' }));
    await screen.findByRole('region', { name: 'Dispersion results' });
    const picker = within(viewer).getByLabelText('Replay run');
    expect(within(picker).getAllByRole('option')).toHaveLength(51); // "This flight" + 50 runs
    await user.selectOptions(picker, '2');
    await within(viewer).findByText('Monte Carlo run 3');
    expect(readout(viewer, 'Shown')).toBe('Monte Carlo run 3');
    const outcome = runNow(design);
    if (!outcome.ok) throw new Error(outcome.message);
    const events = within(viewer).getByRole('list', { name: 'Replay events' });
    await user.click(within(events).getByRole('button', { name: /^Landing / }));
    const landing = outcome.result.events.find((e) => e.kind === 'landing');
    if (landing === undefined) throw new Error('no landing');
    expect(readout(viewer, 'Stored step')).toContain(`at ${(landing.time as number).toFixed(3)} s`);
    expect(readout(viewer, 'Stability margin')).toBe('not available in this phase');
    await user.selectOptions(picker, '');
    expect(readout(viewer, 'Shown')).toBe('This flight');
  });
});
