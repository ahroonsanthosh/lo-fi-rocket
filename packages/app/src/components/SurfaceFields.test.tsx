/** Plan 0073: a part's surface finish and a fin set's fillets in the component editor. */
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

async function openFins(): Promise<HTMLElement> {
  render(<App storage={memory()} motorStore={memory()} initialDesign={exampleDesign('f')} />);
  const list = screen.getByRole('listbox', { name: 'Component list' });
  await userEvent.click(within(list).getByRole('option', { name: /Fins/ }));
  return screen.getByRole('region', { name: 'Fin set editor' });
}

describe('surface finish and fillets in the editor (plan 0073)', () => {
  it('gives a part its own finish, then that finish to every part', async () => {
    const editor = await openFins();
    const finish = within(editor).getByLabelText<HTMLSelectElement>('Surface finish');
    expect(finish.value).toBe(String(60e-6));
    expect(finish.selectedOptions[0]?.textContent).toBe(
      'Regular paint (60 µm), the rest of the rocket',
    );
    await userEvent.selectOptions(finish, String(20e-6));
    expect(finish.value).toBe(String(20e-6));
    expect(editor.textContent).toContain('This part has its own finish.');
    await userEvent.click(
      within(editor).getByRole('button', { name: 'Use this finish on every part' }),
    );
    expect(finish.selectedOptions[0]?.textContent).toBe(
      'Smooth paint (20 µm), the rest of the rocket',
    );
    expect(editor.textContent).not.toContain('This part has its own finish.');
  });

  it('adds fillets with OpenRocket’s default material, and removes them at radius 0', async () => {
    const editor = await openFins();
    expect(within(editor).queryByLabelText(/Fillet material density/)).toBeNull();
    const radius = within(editor).getByLabelText<HTMLInputElement>(/Fillet radius/);
    await userEvent.clear(radius);
    await userEvent.type(radius, '6');
    await userEvent.tab();
    const density = within(editor).getByLabelText<HTMLInputElement>(/Fillet material density/);
    expect(density.value).toBe('680');
    await userEvent.clear(radius);
    await userEvent.type(radius, '0');
    await userEvent.tab();
    expect(within(editor).queryByLabelText(/Fillet material density/)).toBeNull();
  });
});
