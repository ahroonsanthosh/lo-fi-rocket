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
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved[0]).toBe('Example: three-fin sport rocket (R1).lofi.json');
    expect(parseDesign(saved[1] ?? '').id).toBe('s');
    const other = { ...exampleDesign('other'), name: 'Opened rocket' };
    await user.upload(
      screen.getByLabelText('Open a design file'),
      new File([serializeDesign(other)], 'other.lofi.json', { type: 'application/json' }),
    );
    // File notes and failures are listed in the checks column (docs/ui/redesign.md section 5).
    const warnings = screen.getByRole('region', { name: 'Warnings' });
    expect(await within(warnings).findByText('Opened other.lofi.json.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('Opened rocket');
    await user.upload(
      screen.getByLabelText('Open a design file'),
      new File(['{"schemaVersion":1}'], 'bad.lofi.json'),
    );
    expect(
      await within(warnings).findByText(/bad\.lofi\.json, \$: missing required field "id"/),
    ).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('button', { name: 'Designs' }));
    const list = screen.getByRole('list', { name: 'Stored designs' });
    expect(within(list).getByText('Alpha (current)')).toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: 'Open Beta' }));
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('Beta');
  });

  it('asks before deleting a stored design, and the list updates at once (issue #39)', async () => {
    const storage = memory();
    const a = exampleDesign('a');
    const b = { ...exampleDesign('b'), name: 'Keep me' };
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
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('button', { name: 'Designs' }));
    const list = screen.getByRole('list', { name: 'Stored designs' });
    await user.click(within(list).getByRole('button', { name: 'Delete Keep me' }));
    // Nothing is deleted yet: the row asks.
    expect(within(list).getByRole('alert')).toHaveTextContent(
      'Delete “Keep me”? This cannot be undone.',
    );
    expect(storage.getItem('lofi-rocket:design:b')).not.toBeNull();
    await user.click(within(list).getByRole('button', { name: 'Keep Keep me' }));
    expect(within(list).getByText('Keep me')).toBeInTheDocument();
    expect(storage.getItem('lofi-rocket:design:b')).not.toBeNull();
    await user.click(within(list).getByRole('button', { name: 'Delete Keep me' }));
    await user.click(within(list).getByRole('button', { name: 'Delete Keep me for good' }));
    expect(storage.getItem('lofi-rocket:design:b')).toBeNull();
    expect(within(list).queryByText('Keep me')).toBeNull();
  });

  it('exports the design as a RASAero II file (plan 0077) and says what was mapped', async () => {
    const saved: string[] = [];
    render(
      <App
        storage={memory()}
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
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('button', { name: 'Export RASAero' }));
    expect(saved[0]).toBe('Example: three-fin sport rocket (R1).CDX1');
    expect(saved[1]).toMatch(/^<RASAeroDocument>/);
    expect(await screen.findByRole('region', { name: 'Warnings' })).toHaveTextContent(
      /Exported Example: three-fin sport rocket \(R1\)\.CDX1 for RASAero II\..*Rough Camouflage Paint/,
    );
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
    expect(await screen.findByRole('region', { name: 'Warnings' })).toHaveTextContent(
      /Imported r1\.ork \(OpenRocket 1\.\d+\)\. ?Motor Estes D12 taken from the library/,
    );
    // The imported rocket's stability is one of the three numbers on the stage.
    const status = screen.getByRole('region', { name: 'Status' });
    expect(within(status).getByText('1.84')).toBeInTheDocument();
  });

  it('imports a RASAero II file (plan 0075) with the bundled D12 and its recorded apogees', async () => {
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
    // A small rocket written for this test in RASAero II's format.
    const cdx1 = `<RASAeroDocument><FileVersion>2</FileVersion><RocketDesign>
<NoseCone><Length>4</Length><Diameter>1</Diameter><Shape>Conical</Shape><Location>0</Location></NoseCone>
<BodyTube><Length>14</Length><Diameter>1</Diameter><Location>4</Location>
<Fin><Count>3</Count><Chord>2.5</Chord><Span>1.5</Span><SweepDistance>1</SweepDistance><TipChord>1.5</TipChord>
<Thickness>0.0625</Thickness><Location>2.5</Location><AirfoilSection>Square</AirfoilSection></Fin></BodyTube>
<Comments>Altimeter: Peak Altitude = 820 ft</Comments></RocketDesign>
<SimulationList><Simulation><SustainerEngine>D12  (Estes)</SustainerEngine><SustainerLaunchWt>0.2</SustainerLaunchWt>
<SustainerCG>11</SustainerCG><MaxAltitude>900</MaxAltitude></Simulation></SimulationList></RASAeroDocument>`;
    await user.upload(
      screen.getByLabelText('Import a RASAero II file'),
      new File([cdx1], 'small.CDX1'),
    );
    const warnings = await screen.findByRole('region', { name: 'Warnings' });
    expect(warnings).toHaveTextContent(
      /Imported small\.CDX1 \(RASAero II\)\. ?Motor Estes D12 taken/,
    );
    // 900 ft = 274.32 m; 820 ft = 249.94 m.
    expect(warnings).toHaveTextContent('RASAero II predicted an apogee of 274 m (900 ft).');
    expect(warnings).toHaveTextContent('flown apogee of 250 m (820 ft).');
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('small');
  });
});
