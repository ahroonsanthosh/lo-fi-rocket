import { exampleDesign, type KeyValueStore, type Transport } from '@lo-fi-rocket/formats';
import { PROMPT_EXAMPLE } from '@lo-fi-rocket/mcp/paste';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App.js';
import { synchronousRunner, type Runner } from '../simulation/runner.js';
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

/** The app with the paste box open and its builder loaded; `flown` collects the designs flown. */
async function openBox(flown: string[] = []): Promise<ReturnType<typeof userEvent.setup>> {
  const engine = synchronousRunner();
  const runner: Runner = {
    ...engine,
    run: (design) => {
      flown.push(design.name);
      return engine.run(design);
    },
  };
  render(
    <App
      storage={memory()}
      motorStore={memory()}
      transport={noNetwork}
      initialDesign={exampleDesign()}
      services={{ runner }}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Build with Claude' }));
  const dialog = screen.getByRole('dialog', { name: 'Build with Claude' });
  await waitFor(() => {
    expect(within(dialog).getByRole('button', { name: 'Copy the prompt' })).toBeEnabled();
  });
  return user;
}

describe('Build with Claude, the paste box (plan 0082)', () => {
  it('copies the prompt, and builds and flies the pasted answer in place of the design', async () => {
    const flown: string[] = [];
    const user = await openBox(flown);
    const dialog = screen.getByRole('dialog', { name: 'Build with Claude' });
    await user.click(within(dialog).getByRole('button', { name: 'Copy the prompt' }));
    expect(await navigator.clipboard.readText()).toMatch(/^I am designing a model rocket/);
    expect(within(dialog).getByRole('button', { name: 'Copied' })).toBeInTheDocument();

    const build = within(dialog).getByRole('button', { name: 'Build and fly' });
    expect(build).toBeDisabled();
    await user.click(within(dialog).getByLabelText('Paste Claude’s answer here.'));
    await user.paste(`\`\`\`json\n${JSON.stringify(PROMPT_EXAMPLE)}\n\`\`\``);
    await user.click(build);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Build with Claude' })).toBeNull();
    });
    expect(flown).toEqual(['Sport rocket']);
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('Sport rocket');
    expect(screen.getByRole('heading', { name: 'Simulate and results' })).toBeInTheDocument();
    expect(
      screen.getAllByText('Built "Sport rocket" from Claude’s answer: 4 parts.'),
    ).not.toHaveLength(0);
  }, 30000);

  it('a paste that is not a rocket says why, and keeps the design', async () => {
    const flown: string[] = [];
    const user = await openBox(flown);
    const dialog = screen.getByRole('dialog', { name: 'Build with Claude' });
    await user.click(within(dialog).getByLabelText('Paste Claude’s answer here.'));
    await user.paste('a three-fin rocket on a D12');
    await user.click(within(dialog).getByRole('button', { name: 'Build and fly' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/not JSON/);
    expect(flown).toEqual([]);
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue(exampleDesign().name);
  });
});
