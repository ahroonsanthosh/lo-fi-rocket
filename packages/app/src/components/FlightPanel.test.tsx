import {
  exampleDesign,
  type KeyValueStore,
  type RocketDesign,
  type Transport,
} from '@lo-fi-rocket/formats';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { newtons, seconds } from '@lo-fi-rocket/physics';
import { App } from '../App.js';
import { synchronousRunner } from '../simulation/runner.js';
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

function renderApp(design: RocketDesign, saved: string[] = []): ReturnType<typeof userEvent.setup> {
  render(
    <App
      storage={memory()}
      motorStore={memory()}
      transport={noNetwork}
      initialDesign={design}
      services={{
        runner: synchronousRunner(),
        saveFile: (name, text) => {
          saved.push(name, text);
        },
      }}
    />,
  );
  return userEvent.setup();
}

/** The value of a result card: the dd after the dt whose visible label is `label`. */
function resultText(results: HTMLElement, label: string): string {
  const dt = [...results.querySelectorAll('dt')].find(
    (d) => (d.querySelector('.lfr-term')?.textContent ?? d.textContent) === label,
  );
  return dt?.nextElementSibling?.textContent ?? '';
}

/** Back to the home list, from any page. */
async function home(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const back = screen.queryByRole('button', { name: 'Your rocket' });
  if (back !== null) await user.click(back);
}

/** The launch site, rail and wind have their own page, opened from the home list. */
async function openLaunch(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await home(user);
  await user.click(within(screen.getByRole('listbox', { name: 'Launch' })).getByRole('option'));
}

async function openFlight(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await home(user);
  await user.click(within(screen.getByRole('listbox', { name: 'Flight' })).getByRole('option'));
}

describe('FlightPanel (plan 0014)', () => {
  it('simulates the example and shows the Phase 2 displayed figures, the events and the plots', async () => {
    const user = renderApp(exampleDesign('f'));
    await openFlight(user);
    await user.click(screen.getByRole('button', { name: 'Simulate flight' }));
    const results = await screen.findByRole('region', { name: 'Flight' });
    const dd = (label: string): string => resultText(results, label);
    // Displayed modes with the DATCOM base drag (D-069): apogee 172.94 m, maximum velocity 63.0 m/s (167.33 m, 62.3 m/s in
    // docs/reports/phase-2-acceptance.md with Niskanen's base drag), rail exit 18.45 m/s.
    expect(dd('Apogee')).toBe('172.94 m');
    expect(dd('Maximum velocity')).toBe('63.0 m/s');
    expect(dd('Rail exit velocity')).toMatch(/^18\.5 m\/s at 0\.29\d s$/);
    // Nothing is wrong with the example's flight: the top bar says so and no list is shown.
    expect(screen.getByText('All clear')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Warnings' })).not.toBeInTheDocument();
    const events = within(results).getByRole('list', { name: 'Events' });
    const kinds = within(events)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(kinds[0]).toMatch(/^0\.000 s/);
    expect(kinds.at(-1)).toMatch(/landing at 6\.93\d m\/s/);
    expect(screen.getByRole('img', { name: 'Altitude above the pad' })).toBeInTheDocument();
  });

  it('a 5 m/s wind gives a landing distance and direction; changing the design marks the flight stale', async () => {
    const user = renderApp(exampleDesign('w'));
    await openLaunch(user);
    const wind = screen.getByLabelText('Wind speed (steady, uniform)');
    await user.clear(wind);
    await user.type(wind, '5');
    await openFlight(user);
    await user.click(screen.getByRole('button', { name: 'Simulate flight' }));
    const results = await screen.findByRole('region', { name: 'Flight' });
    const landing = resultText(results, 'Landing');
    expect(landing).toMatch(/^\d+\.\d\d m towards \d+°$/);
    expect(Number.parseFloat(landing)).toBeGreaterThan(10);
    await openLaunch(user);
    const again = screen.getByLabelText('Wind speed (steady, uniform)');
    await user.clear(again);
    await user.type(again, '2');
    // Stale results are a note in the checks column and are marked in the telemetry.
    expect(screen.getByRole('region', { name: 'Warnings' })).toHaveTextContent(
      /changed since this flight was simulated/,
    );
    expect(screen.getByRole('region', { name: 'Status' })).toHaveTextContent(/out of date/);
  });

  it('rejects a zero rail length at the field and warns above the NAR angle', async () => {
    const user = renderApp(exampleDesign('r'));
    await openLaunch(user);
    const rail = screen.getByLabelText('Rail length');
    await user.clear(rail);
    await user.type(rail, '0');
    expect(screen.getByRole('alert')).toHaveTextContent('Rail length must be greater than 0 m');
    await user.clear(rail);
    await user.type(rail, '1.5');
    const angle = screen.getByLabelText('Rail angle from vertical');
    await user.clear(angle);
    await user.type(angle, '45');
    expect(screen.getByRole('alert')).toHaveTextContent(
      /NAR safety code forbids launching more than 30°/,
    );
  });

  it('shows the thresholds warnings and the model error for a design it cannot simulate', async () => {
    const base = exampleDesign('e');
    const strict: RocketDesign = {
      ...base,
      recovery: [],
      warningThresholds: { ...base.warningThresholds, minThrustToWeight: 6 },
    };
    const user = renderApp(strict);
    await openFlight(user);
    await user.click(screen.getByRole('button', { name: 'Simulate flight' }));
    const warnings = await screen.findByRole('region', { name: 'Warnings' });
    expect(warnings).toHaveTextContent(/5\.5:1, below 6:1/);
    expect(warnings).toHaveTextContent(/No recovery device/);
  });

  it('a transonic design simulates and shows the regime warnings (D-055, D-056)', async () => {
    const base = exampleDesign('t');
    const mount = base.motorMount!;
    const definition = mount.motor!.definition;
    const fast: RocketDesign = {
      ...base,
      components: base.components.map((c) =>
        c.id === 'nose' && c.component.kind === 'noseCone'
          ? { ...c, component: { ...c.component, shape: 'haack', shapeParameter: 0 } }
          : c,
      ),
      motorMount: {
        componentId: mount.componentId,
        overhang: mount.overhang,
        motor: {
          definition: {
            ...definition,
            points: definition.points.map((p) => ({
              time: p.time,
              thrust: newtons(p.thrust * 40),
            })),
          },
          provenance: { kind: 'custom' },
        },
      },
    };
    const user = renderApp(fast);
    await openFlight(user);
    await user.click(screen.getByRole('button', { name: 'Simulate flight' }));
    const warnings = await screen.findByRole('region', { name: 'Warnings' });
    expect(warnings).toHaveTextContent(/transonic|supersonic/);
    // Issue #19: plain language, no document paths in the warnings.
    expect(warnings).not.toHaveTextContent(/held-out-validation/);
  });

  it('exports the CSV through the save service', async () => {
    const saved: string[] = [];
    const user = renderApp(exampleDesign('c'), saved);
    await openFlight(user);
    await user.click(screen.getByRole('button', { name: 'Simulate flight' }));
    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));
    expect(saved[0]).toBe('Example: three-fin sport rocket (R1).csv');
    expect(saved[1]?.split('\n')[1]).toMatch(/^time_s,phase,/);
  });
});

describe('wind profile and turbulence (plan 0016)', () => {
  it('a sheared profile and a seeded turbulence change the landing and show the seed in the modes', async () => {
    const user = renderApp(exampleDesign('wp'));
    await openLaunch(user);
    await user.click(screen.getByRole('button', { name: 'Vary the wind with altitude' }));
    const speed2 = screen.getByLabelText('Row 2 speed');
    await user.clear(speed2);
    await user.type(speed2, '8');
    const speed1 = screen.getByLabelText('Row 1 speed');
    await user.clear(speed1);
    await user.type(speed1, '3');
    const intensity = screen.getByLabelText(/Turbulence intensity/);
    await user.clear(intensity);
    await user.type(intensity, '0.1');
    expect(screen.getByLabelText(/Turbulence seed/)).toHaveValue('1');
    await openFlight(user);
    await user.click(screen.getByRole('button', { name: 'Simulate flight' }));
    const results = await screen.findByRole('region', { name: 'Flight' });
    const landing = resultText(results, 'Landing');
    expect(Number.parseFloat(landing)).toBeGreaterThan(10);
    expect(results).toHaveTextContent(/turbulence seed 1/);
    await openLaunch(user);
    await user.click(screen.getByRole('button', { name: 'Use a uniform wind' }));
    expect(screen.getByLabelText('Wind speed (steady, uniform)')).toBeInTheDocument();
  });
});

describe('Monte Carlo dispersion panel (plan 0017)', () => {
  it('runs five dispersed flights with a 2 m/s wind standard deviation and shows the seed, table and scatter plot', async () => {
    const base = exampleDesign('mc');
    const quick: RocketDesign = {
      ...base,
      simulation: {
        ...base.simulation,
        integrator: { kind: 'rk4', timeStep: seconds(0.005) },
        recordInterval: seconds(0.5),
      },
      dispersion: {
        runs: 5,
        seed: 3,
        variations: {
          windSpeed: 2,
          windDirection: 0,
          railAngle: 0,
          railAzimuth: 0,
          motorImpulseScale: 0,
          structuralMassScale: 0,
        },
      },
    };
    const user = renderApp(quick);
    await openFlight(user);
    expect(screen.getByLabelText('Wind speed standard deviation')).toHaveValue('2');
    await user.click(screen.getByRole('button', { name: 'Run dispersion' }));
    const results = await screen.findByRole(
      'region',
      { name: 'Dispersion results' },
      { timeout: 20000 },
    );
    expect(results).toHaveTextContent(/5 \(landed 5, not landed 0, failed 0\), seed 3/);
    expect(results).toHaveTextContent(/Landing distance from the pad/);
    const plot = within(results).getByRole('img', { name: 'Landing points' });
    expect(plot.querySelectorAll('.landing-point').length).toBe(5);
  }, 30000);
});

describe('warning thresholds are user-adjustable rules of thumb (D-042, D-053)', () => {
  it('raising the rail-exit threshold to 20 m/s makes the warning fire on the example', async () => {
    const user = renderApp(exampleDesign('th'));
    await openLaunch(user);
    await user.click(screen.getByText(/Warning and stability thresholds/));
    const field = screen.getByLabelText('Minimum rail exit velocity');
    await user.clear(field);
    await user.type(field, '20');
    await openFlight(user);
    await user.click(screen.getByRole('button', { name: 'Simulate flight' }));
    const warnings = await screen.findByRole('region', { name: 'Warnings' });
    expect(warnings).toHaveTextContent(/below 20 m\/s/);
  });
});
