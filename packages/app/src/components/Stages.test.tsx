/**
 * Stage editing in the app (plan 0064 part 3b): the motor panel per stage with its ignition, the
 * stage of a part, the stages editor, and the burnout gauge of the top stage alone.
 */
import {
  ESTES_D12,
  exampleDesign,
  stageMotorMount,
  withStageAdded,
  type KeyValueStore,
  type RocketDesign,
} from '@lo-fi-rocket/formats';
import { kilogramsPerCubicMetre, metres, seconds } from '@lo-fi-rocket/physics';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App.js';
import type { Storage } from '../state/autosave.js';
import { initialState, reduce } from '../state/reducer.js';
import { designWarningItems } from '../layout/warnings.js';

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

/** The example rocket on a booster: a 0.3 m tube, fins and a motor tube with a D12-0. */
function twoStage(): RocketDesign {
  const d = withStageAdded(exampleDesign('two'));
  const paper = kilogramsPerCubicMetre(700);
  return {
    ...d,
    components: [
      ...d.components,
      {
        id: 'b-body',
        name: 'Booster body',
        position: metres(0.6),
        stage: 1,
        component: {
          kind: 'bodyTube',
          length: metres(0.3),
          outerRadius: metres(0.025),
          wallThickness: metres(0.001),
          density: paper,
        },
      },
      {
        id: 'b-fins',
        name: 'Booster fins',
        position: metres(0.8),
        stage: 1,
        component: {
          kind: 'finSet',
          crossSection: 'square',
          count: 3,
          rootChord: metres(0.1),
          tipChord: metres(0.05),
          sweep: metres(0.05),
          span: metres(0.08),
          thickness: metres(0.003),
          density: kilogramsPerCubicMetre(600),
          bodyRadius: metres(0.025),
        },
      },
      {
        id: 'b-mount',
        name: 'Booster motor tube',
        position: metres(0.825),
        stage: 1,
        component: {
          kind: 'innerTube',
          length: metres(0.075),
          outerRadius: metres(0.0125),
          wallThickness: metres(0.0005),
          density: paper,
        },
      },
    ],
    additionalMotorMounts: [
      {
        componentId: 'b-mount',
        overhang: metres(0),
        motor: {
          definition: ESTES_D12,
          provenance: { kind: 'bundled', file: 'Estes_D12.eng' },
          ejectionDelay: seconds(0),
        },
      },
    ],
  };
}

describe('stage actions', () => {
  it('add a stage, move a part to it, set its motor, and remove the stage only once it is empty', () => {
    let s = initialState(exampleDesign('e'));
    s = reduce(s, { type: 'add-stage' });
    expect(s.design.stages?.map((st) => st.name)).toEqual(['Sustainer', 'Booster']);
    s = reduce(s, { type: 'set-component-stage', id: 'fins', stage: 1 });
    expect(s.design.components.find((c) => c.id === 'fins')?.stage).toBe(1);
    // Not empty: the action leaves the design as it is.
    const before = s;
    s = reduce(s, { type: 'remove-bottom-stage' });
    expect(s).toBe(before);
    s = reduce(s, { type: 'set-component-stage', id: 'fins', stage: 0 });
    s = reduce(s, { type: 'remove-bottom-stage' });
    expect(s.design.stages).toBeUndefined();
    expect(s.design.components.some((c) => 'stage' in c)).toBe(false);
  });

  it('set one stage’s motor mount and keep the other’s', () => {
    let s = initialState(twoStage());
    const booster = stageMotorMount(s.design, 1);
    if (booster === undefined) throw new Error('the booster has a mount');
    s = reduce(s, {
      type: 'set-stage-motor-mount',
      stage: 1,
      mount: { ...booster, ignition: { event: 'launch', delay: seconds(0.5) } },
    });
    expect(stageMotorMount(s.design, 1)?.ignition).toEqual({ event: 'launch', delay: 0.5 });
    expect(stageMotorMount(s.design, 0)).toEqual(exampleDesign('two').motorMount);
  });
});

describe('the checks before a flight', () => {
  it('say at once that the sustainer cannot light while the new booster stage has no motor', () => {
    const d = withStageAdded(exampleDesign('e'));
    const items = designWarningItems(d, 'metric').filter((w) => w.id.startsWith('ignition'));
    expect(items).toHaveLength(1);
    expect(items[0]?.severity).toBe('danger');
    expect(items[0]?.title).toBe('The motor in "Motor mount" never ignites');
    expect(items[0]?.reason).toMatch(/Booster has no motor\. Give that stage a motor/);
    // With the booster's motor in place, nothing to say.
    expect(designWarningItems(twoStage(), 'metric').some((w) => w.id.startsWith('ignition'))).toBe(
      false,
    );
  });
});

describe('the app with a two-stage design', () => {
  it('edits each stage’s motor and ignition, and gauges the sustainer alone at burnout', async () => {
    render(<App storage={memory()} motorStore={memory()} initialDesign={twoStage()} />);
    // The burnout figure is the top stage's alone (the whole stack's burnout never flies).
    const status = screen.getByRole('region', { name: 'Status' });
    expect(
      within(status).getByText(/at Sustainer burnout, the top stage alone/),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(screen.getByRole('listbox', { name: 'Motor' })).getByRole('option'));
    const panel = screen.getByRole('region', { name: 'Motor' });
    // A delay note from the sustainer's motor change does not follow to the booster's page.
    await user.click(within(panel).getByRole('button', { name: 'Use AT F39T' }));
    expect(within(panel).getByRole('status')).toHaveTextContent(/Delay changed from 5 s to 6 s/);
    await user.selectOptions(within(panel).getByLabelText('Stage'), '1');
    expect(within(panel).queryByRole('status')).toBeNull();
    await user.selectOptions(within(panel).getByLabelText('Stage'), '0');
    // Back to the D12: 6 s is between its 5 s and 7 s, so the longer is taken; set 5 s again.
    await user.click(within(panel).getByRole('button', { name: 'Use Estes D12' }));
    expect(within(panel).getByLabelText('Ejection delay after burnout')).toHaveValue('7');
    await user.selectOptions(within(panel).getByLabelText('Ejection delay after burnout'), '5');
    const stage = within(panel).getByLabelText('Stage');
    expect(within(panel).getByLabelText('Motor mount tube')).toHaveValue('mount');
    await user.selectOptions(stage, '1');
    expect(within(panel).getByLabelText('Motor mount tube')).toHaveValue('b-mount');
    const ignition = within(panel).getByLabelText('Ignition');
    expect(ignition).toHaveValue('automatic');
    await user.selectOptions(ignition, 'never');
    expect(within(panel).getByLabelText('Ignition')).toHaveValue('never');
    // The sustainer's motor is untouched.
    await user.selectOptions(within(panel).getByLabelText('Stage'), '0');
    expect(within(panel).getByLabelText('Ignition')).toHaveValue('automatic');
    expect(within(panel).getByLabelText('Ejection delay after burnout')).toHaveValue('5');
  });
});
