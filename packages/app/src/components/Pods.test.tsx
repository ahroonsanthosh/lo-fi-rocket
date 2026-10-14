/**
 * Plan 0070 step 3: a pod set's parts in the app. The part list says how many pods hold each, and
 * its editor says it is repeated around the rocket and how far out.
 */
import { exampleDesign, type KeyValueStore, type RocketDesign } from '@lo-fi-rocket/formats';
import { kilogramsPerCubicMetre, metres } from '@lo-fi-rocket/physics';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App.js';
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

/** The example rocket with two pod tubes beside its body, axes 50 mm from the rocket's. */
function podded(): RocketDesign {
  const d = exampleDesign('pods');
  return {
    ...d,
    components: [
      ...d.components,
      {
        id: 'pod-tube',
        name: 'Pod tube',
        position: metres(0.3),
        pod: { count: 2, radialOffset: metres(0.05) },
        component: {
          kind: 'bodyTube',
          length: metres(0.15),
          outerRadius: metres(0.0125),
          wallThickness: metres(0.0005),
          density: kilogramsPerCubicMetre(700),
        },
      },
    ],
  };
}

describe('pod parts in the app (plan 0070)', () => {
  it('lists the pod count and explains the part in its editor', async () => {
    render(<App storage={memory()} motorStore={memory()} initialDesign={podded()} />);
    const list = screen.getByRole('listbox', { name: 'Component list' });
    const option = within(list).getByRole('option', { name: /Pod tube/ });
    expect(option.textContent).toContain('Body tube (2 pods)');
    await userEvent.click(option);
    const editor = screen.getByRole('region', { name: 'Body tube editor' });
    expect(editor.textContent).toContain(
      'Part of a pod set: repeated 2 times around the rocket, each pod’s axis 50',
    );
  });
});
