import {
  BUNDLED_MOTOR_FILES,
  designThrustToWeight,
  exampleDesign,
  type KeyValueStore,
  type Transport,
} from '@lo-fi-rocket/formats';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App.js';
import F39T_RSE from '../../../../reference/motors/AeroTech_F39T.rse?raw';
import type { Storage } from '../state/autosave.js';

const C6_ENG = BUNDLED_MOTOR_FILES.find((m) => m.file === 'Estes_C6.eng')?.text ?? '';

function memory(): Storage & KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
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

const b64 = (text: string): string => btoa(text);

function fixtureTransport(): Transport & { calls: string[] } {
  const calls: string[] = [];
  const t: Transport = (url, init) => {
    const endpoint = url.split('/').pop() ?? '';
    calls.push(endpoint);
    const body = JSON.parse(init.body) as Record<string, unknown>;
    if (endpoint === 'search.json') {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              matches: 1,
              results: [
                {
                  motorId: 'tc-c6',
                  manufacturer: 'Estes Industries',
                  manufacturerAbbrev: 'Estes',
                  designation: 'C6',
                  commonName: 'C6',
                  impulseClass: 'C',
                  certOrg: 'NAR',
                  diameter: body['diameter'],
                  length: 70,
                  type: 'SU',
                  avgThrustN: 4.7,
                  maxThrustN: 14.1,
                  totImpulseNs: 8.8,
                  burnTimeS: 1.9,
                  dataFiles: 1,
                  availability: 'regular',
                },
              ],
            }),
          ),
      });
    }
    if (endpoint === 'download.json') {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              results: [
                {
                  motorId: 'tc-c6',
                  simfileId: 'sf1',
                  format: 'RASP',
                  source: 'cert',
                  data: b64(C6_ENG),
                },
              ],
            }),
          ),
      });
    }
    return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
  };
  return Object.assign(t, { calls });
}

async function openMotorPanel(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  await user.click(within(screen.getByRole('listbox', { name: 'Motor' })).getByRole('option'));
  return user;
}

describe('MotorPanel (plan 0013)', () => {
  it('shows the selected D12 with its figures and the delay list, and lists the bundled motors', async () => {
    render(
      <App
        storage={memory()}
        motorStore={memory()}
        transport={fixtureTransport()}
        initialDesign={exampleDesign('m')}
      />,
    );
    await openMotorPanel();
    const panel = screen.getByRole('region', { name: 'Motor' });
    expect(within(panel).getByText('16.84 N·s')).toBeInTheDocument();
    expect(within(panel).getByText('10.2 N')).toBeInTheDocument();
    // The whole rocket's thrust to weight at liftoff, against the 5 to 1 rule of thumb (CLAUDE.md 9).
    const twr = designThrustToWeight(exampleDesign('m'));
    if (twr === undefined) throw new Error('the example has a motor');
    expect(within(panel).getByText(new RegExp(`^${twr.toFixed(1)} to 1`))).toBeInTheDocument();
    expect(within(panel).getByText('At least 5 to 1')).toBeInTheDocument();
    expect(within(panel).getByLabelText('Ejection delay after burnout')).toHaveValue('5');
    const lib = within(panel).getByRole('list', { name: 'Motor library' });
    // Only motors fitting the 24 mm mount (inner diameter 24 mm): C6 18, D12 24, F39T 24
    expect(within(lib).getAllByRole('listitem').length).toBe(3);
  });

  it('using the C6 from the library changes the liftoff mass and the delay options', async () => {
    render(
      <App
        storage={memory()}
        motorStore={memory()}
        transport={fixtureTransport()}
        initialDesign={exampleDesign('m')}
      />,
    );
    const user = await openMotorPanel();
    await user.click(screen.getByRole('button', { name: 'Use E C6' }));
    await user.click(screen.getByRole('button', { name: 'Your rocket' }));
    expect(
      within(screen.getByRole('listbox', { name: 'Motor' })).getByText(/E C6/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Stability and mass/ }));
    const mass = screen.getByRole('region', { name: 'Mass and size' });
    // R1 without motor 148.3 g plus the C6's loaded mass 23.1 g (header field 6: .0231) = 171.4 g
    expect(within(mass).getByText('171.4 g')).toBeInTheDocument();
  });

  it('warns when the motor is wider than the mount tube', async () => {
    render(
      <App
        storage={memory()}
        motorStore={memory()}
        transport={fixtureTransport()}
        initialDesign={exampleDesign('m')}
      />,
    );
    const user = await openMotorPanel();
    await user.click(screen.getByLabelText('Only motors that fit the mount tube'));
    await user.click(screen.getByRole('button', { name: 'Use AT H123W' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      /38\.0 mm wide but the mount tube's inside is 24\.0 mm/,
    );
  });

  it('searches ThrustCurve.org through the injected transport, downloads once and caches the motor', async () => {
    const motorStore = memory();
    const transport = fixtureTransport();
    render(
      <App
        storage={memory()}
        motorStore={motorStore}
        transport={transport}
        initialDesign={exampleDesign('m')}
      />,
    );
    const user = await openMotorPanel();
    await user.click(screen.getByRole('tab', { name: 'ThrustCurve.org' }));
    expect(screen.getByLabelText('Diameter (mm)')).toHaveValue('24');
    await user.click(screen.getByRole('button', { name: 'Search ThrustCurve.org' }));
    expect(await screen.findByText('1 motor found')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download and use Estes C6' }));
    expect(await screen.findByText('Downloaded and added to the library.')).toBeInTheDocument();
    expect(transport.calls).toEqual(['search.json', 'download.json']);
    expect(motorStore.map.has('lofi-rocket:motor:thrustcurve:tc-c6')).toBe(true);
    // Second use comes from the cache without a download.
    await user.click(screen.getByRole('button', { name: 'Download and use Estes C6' }));
    expect(await screen.findByText('Used the cached copy.')).toBeInTheDocument();
    expect(transport.calls.filter((c) => c === 'download.json').length).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Your rocket' }));
    expect(
      within(screen.getByRole('listbox', { name: 'Motor' })).getByText(/E C6/),
    ).toBeInTheDocument();
  });

  it('reports a network failure in plain words', async () => {
    const offline: Transport = () => Promise.reject(new Error('Failed to fetch'));
    render(
      <App
        storage={memory()}
        motorStore={memory()}
        transport={offline}
        initialDesign={exampleDesign('m')}
      />,
    );
    const user = await openMotorPanel();
    await user.click(screen.getByRole('tab', { name: 'ThrustCurve.org' }));
    await user.click(screen.getByRole('button', { name: 'Search ThrustCurve.org' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      /could not be reached \(Failed to fetch\)/,
    );
  });

  it('a second motor file import names the second file, not the first', async () => {
    render(
      <App
        storage={memory()}
        motorStore={memory()}
        transport={fixtureTransport()}
        initialDesign={exampleDesign('m')}
      />,
    );
    const user = await openMotorPanel();
    await user.click(screen.getByRole('tab', { name: 'Import .eng / .rse' }));
    const input = screen.getByLabelText('RASP .eng or RockSim .rse file');
    await user.upload(input, new File([C6_ENG], 'first.eng', { type: 'text/plain' }));
    expect(await screen.findByText(/first\.eng: E C6 imported and selected/)).toBeInTheDocument();
    await user.upload(input, new File([C6_ENG], 'second.eng', { type: 'text/plain' }));
    expect(await screen.findByText(/second\.eng: E C6 imported and selected/)).toBeInTheDocument();
    expect(screen.queryByText(/first\.eng/)).not.toBeInTheDocument();
  });

  it('a RockSim .rse import keeps the delays the file lists (3, 6 and 9 s)', async () => {
    render(
      <App
        storage={memory()}
        motorStore={memory()}
        transport={fixtureTransport()}
        initialDesign={exampleDesign('m')}
      />,
    );
    const user = await openMotorPanel();
    await user.click(screen.getByRole('tab', { name: 'Import .eng / .rse' }));
    await user.upload(
      screen.getByLabelText('RASP .eng or RockSim .rse file'),
      new File([F39T_RSE], 'AeroTech_F39T.rse', { type: 'text/plain' }),
    );
    expect(
      await screen.findByText(/AeroTech_F39T\.rse: .* imported and selected/),
    ).toBeInTheDocument();
    const delay = screen.getByLabelText('Ejection delay after burnout');
    const offered = within(delay)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(offered.join(' ')).toMatch(/3.*6.*9/);
  });

  it('imports a .eng file and a custom CSV, keeping both in the library', async () => {
    const motorStore = memory();
    render(
      <App
        storage={memory()}
        motorStore={motorStore}
        transport={fixtureTransport()}
        initialDesign={exampleDesign('m')}
      />,
    );
    const user = await openMotorPanel();
    await user.click(screen.getByRole('tab', { name: 'Import .eng / .rse' }));
    await user.upload(
      screen.getByLabelText('RASP .eng or RockSim .rse file'),
      new File([C6_ENG], 'my_c6.eng', { type: 'text/plain' }),
    );
    expect(await screen.findByText(/my_c6\.eng: E C6 imported and selected/)).toBeInTheDocument();
    expect(motorStore.map.has('lofi-rocket:motor:file:my_c6.eng')).toBe(true);
    await user.click(screen.getByRole('tab', { name: 'Custom CSV' }));
    await user.upload(
      screen.getByLabelText('Thrust curve CSV'),
      new File(['time,thrust\n0,0\n1,10\n2,10\n3,0\n'], 'curve.csv', { type: 'text/csv' }),
    );
    expect(
      await screen.findByText(
        /curve\.csv: custom motor Custom created and selected \(impulse-proportional\)/,
      ),
    ).toBeInTheDocument();
    const panel = screen.getByRole('region', { name: 'Motor' });
    expect(within(panel).getByText('20.00 N·s')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Library' }));
    await user.click(screen.getByLabelText('Only motors that fit the mount tube'));
    expect(
      within(screen.getByRole('list', { name: 'Motor library' })).getAllByRole('listitem').length,
    ).toBe(10);
  });
});
