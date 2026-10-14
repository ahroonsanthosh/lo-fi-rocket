/**
 * Plan 0073 part 2: a streamer in the app. It can be added beside a parachute, its strip and
 * material edited, and its drag coefficient taken from Niskanen's eq. (C.6) or entered.
 */
import { exampleDesign, type KeyValueStore } from '@lo-fi-rocket/formats';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App.js';
import type { Storage } from '../state/autosave.js';

vi.setConfig({ testTimeout: 60_000 });

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

describe('streamers in the app (plan 0073)', () => {
  it('adds a streamer, shows its strip and eq. (C.6)’s drag coefficient, and takes a measured one', async () => {
    render(<App storage={memory()} motorStore={memory()} initialDesign={exampleDesign('s')} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add streamer' }));
    const list = screen.getByRole('listbox', { name: 'Recovery devices' });
    const option = within(list).getByRole('option', { name: /Streamer 2/ });
    expect(option.textContent).toContain('streamer, deploys at apogee');
    const editor = screen.getByRole('region', { name: 'Recovery device editor' });
    expect(within(editor).getByRole('heading', { name: 'Streamer' })).toBeTruthy();
    // The default strip, 4 × 40 cm of 41 g/m² polyethylene (Niskanen Table C.1):
    // C_D = 0.034 × (66/105) × (1.4/0.4) = 0.0748.
    expect(within(editor).getByLabelText<HTMLInputElement>(/Strip length/).value).toBe('400');
    expect(within(editor).getByLabelText<HTMLInputElement>(/Strip width/).value).toBe('40');
    expect(within(editor).getByLabelText<HTMLInputElement>(/Material weight/).value).toBe('41');
    const auto = within(editor).getByRole('checkbox', { name: /eq\. C\.6\): 0\.075/ });
    expect((auto as HTMLInputElement).checked).toBe(true);
    expect(within(editor).queryByLabelText(/Drag coefficient \(strip area\)/)).toBeNull();
    await userEvent.click(auto);
    const field = within(editor).getByLabelText(/Drag coefficient \(strip area\)/);
    expect((field as HTMLInputElement).value).toBe('0.075');
  });
});
