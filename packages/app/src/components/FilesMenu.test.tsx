import {
  exampleDesign,
  parseDesign,
  serializeDesign,
  type KeyValueStore,
  type Transport,
} from '@lo-fi-rocket/formats';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { App } from '../App.js';
import { synchronousRunner } from '../simulation/runner.js';
import type { Storage } from '../state/autosave.js';

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
const noNetwork: Transport = () => Promise.reject(new Error('no network'));

describe('files (plan 0015)', () => {
  it('saves the design as .lofi.json through the save service and opens one back', async () => {
    const saved: string[] = [];
    const storage = memory();
    render(
      <App
        storage={storage}
        motorStore={memory()}
        transport={noNetwork}
        initialDesign={exampleDesign('s')}
        services={{
          runner: synchronousRunner(),
          saveFile: (n, t) => {
            saved.push(n, t);
          },
        }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved[0]).toBe('Example: three-fin sport rocket (R1).lofi.json');
    expect(parseDesign(saved[1] ?? '').id).toBe('s');
    const other = { ...exampleDesign('other'), name: 'Opened rocket' };
    await user.upload(
      screen.getByLabelText('Open a design file'),
      new File([serializeDesign(other)], 'other.lofi.json', { type: 'application/json' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Opened other.lofi.json.');
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('Opened rocket');
    await user.upload(
      screen.getByLabelText('Open a design file'),
      new File(['{"schemaVersion":1}'], 'bad.lofi.json'),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      /bad\.lofi\.json, \$: missing required field "id"/,
    );
  });

  it('lists stored designs and switches between them', async () => {
    const storage = memory();
    const a = { ...exampleDesign('a'), name: 'Alpha' };
    const b = { ...exampleDesign('b'), name: 'Beta' };
    storage.setItem('lofi-rocket:design:a', serializeDesign(a));
    storage.setItem('lofi-rocket:design:b', serializeDesign(b));
    render(
      <App
        storage={storage}
        motorStore={memory()}
        transport={noNetwork}
        initialDesign={a}
        services={{ runner: synchronousRunner() }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Designs' }));
    const list = screen.getByRole('list', { name: 'Stored designs' });
    expect(within(list).getByText('Alpha (current)')).toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: 'Open Beta' }));
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('Beta');
  });

  it('imports R1 from the .ork file with the bundled D12 and shows its figures', async () => {
    render(
      <App
        storage={memory()}
        motorStore={memory()}
        transport={noNetwork}
        initialDesign={{ ...exampleDesign('x'), name: 'Before' }}
        services={{ runner: synchronousRunner() }}
      />,
    );
    const user = userEvent.setup();
    // The .ork reference file is a zip; the importer reads it through File.arrayBuffer.
    const bytes = new Uint8Array(
      readFileSync(
        join(
          dirname(fileURLToPath(import.meta.url)),
          '..',
          '..',
          '..',
          '..',
          'reference',
          'rockets',
          'r1-three-fin-conical.ork',
        ),
      ),
    );
    await user.upload(
      screen.getByLabelText('Import an OpenRocket file'),
      new File([bytes], 'r1.ork'),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Imported r1\.ork \(OpenRocket 1\.\d+\)\. Motor Estes D12 taken from the library/,
    );
    const stability = screen.getByRole('region', { name: 'Stability' });
    expect(within(stability).getByText('1.84')).toBeInTheDocument();
  });
});
