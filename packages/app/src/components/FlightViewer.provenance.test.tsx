/**
 * Replaying a Monte Carlo run checks the stored provenance and the stored
 * landing point (D-061): a batch from another build, or a run whose stored
 * landing point the replay does not reproduce, shows a clear warning; a
 * faithful replay of this build's batch shows none.
 */
import { exampleDesign, ZERO_VARIATIONS, type DispersionResult } from '@lo-fi-rocket/formats';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  CURRENT_PROVENANCE,
  describeProvenance,
  type BuildProvenance,
} from '../build/provenance.js';
import { runDispersionNow, runNow, synchronousRunner } from '../simulation/runner.js';
import { ServicesContext, type Services } from '../state/services.js';
import { FlightViewer, type DispersionState } from './FlightViewer.js';

const design = exampleDesign('p');
const flight = runNow(design);
const batch = runDispersionNow(design, { runs: 3, seed: 7, variations: ZERO_VARIATIONS });
if (!flight.ok || !batch.ok) throw new Error('the example must fly');
const flightResult = flight.result;

const services: Services = {
  transport: () => Promise.reject(new Error('no network in tests')),
  motorStore: undefined,
  readFile: () => Promise.resolve(''),
  runner: synchronousRunner(),
  saveFile: () => undefined,
};

function show(result: DispersionResult, provenance: BuildProvenance): void {
  const dispersion: DispersionState = { design, result, provenance };
  render(
    <ServicesContext.Provider value={services}>
      <FlightViewer design={design} result={flightResult} units="metric" dispersion={dispersion} />
    </ServicesContext.Provider>,
  );
}

async function replay(run: string): Promise<HTMLElement> {
  const user = userEvent.setup();
  const viewer = screen.getByRole('region', { name: '3D replay' });
  await user.selectOptions(within(viewer).getByLabelText('Replay run'), run);
  await within(viewer).findByText(`Monte Carlo run ${String(Number(run) + 1)}`, {
    selector: 'dd',
  });
  return viewer;
}

describe('Monte Carlo replay check (D-061)', () => {
  it('the batch carries the provenance of the build that ran it', () => {
    expect(batch.provenance).toEqual(CURRENT_PROVENANCE);
  });

  it('a faithful replay of this build: no warning, the exact-match note', async () => {
    show(batch.result, batch.provenance);
    const viewer = await replay('1');
    expect(within(viewer).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(viewer).getByText(/reproduces the stored landing point exactly/)).toBeVisible();
  });

  it('a batch from another app version or physics: a warning naming both builds', async () => {
    const older: BuildProvenance = { appVersion: '0.9.0', physicsHash: 'f'.repeat(64) };
    show(batch.result, older);
    const viewer = await replay('0');
    const alert = within(viewer).getByRole('alert');
    expect(alert).toHaveTextContent('This replay may not match the original Monte Carlo result.');
    expect(alert).toHaveTextContent(describeProvenance(older));
    expect(alert).toHaveTextContent(describeProvenance(CURRENT_PROVENANCE));
    // The landing point itself is reproduced, so only the version reason is given.
    expect(alert).not.toHaveTextContent('differs from the stored one');
  });

  it('a stored landing point the replay does not reproduce: a warning with both points', async () => {
    const tampered: DispersionResult = {
      ...batch.result,
      runs: batch.result.runs.map((r) =>
        r.index === 2 ? { ...r, landingEast: 12.5, landingNorth: -3.25 } : r,
      ),
    };
    show(tampered, batch.provenance);
    const viewer = await replay('2');
    const alert = within(viewer).getByRole('alert');
    expect(alert).toHaveTextContent('This replay may not match the original Monte Carlo result.');
    expect(alert).toHaveTextContent('(12.50 m east, -3.25 m north)');
    expect(alert).toHaveTextContent('differs from the stored one');
    // Same build, so no version reason.
    expect(alert).not.toHaveTextContent('The batch was run with');
  });
});
