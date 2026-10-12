import { exampleDesign, parseDesign } from '@lo-fi-rocket/formats';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import type { Storage } from './state/autosave.js';

function memory(): Storage & { readonly map: Map<string, string> } {
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
  };
}

describe('App (plan 0012)', () => {
  it('shows the example with the Phase 1 figures and selects components for editing', async () => {
    const user = userEvent.setup();
    render(<App storage={memory()} />);
    const stability = screen.getByRole('region', { name: 'Stability' });
    expect(within(stability).getByText('1.84')).toBeInTheDocument();
    expect(within(stability).getByText(/typical target range/)).toBeInTheDocument();
    expect(within(stability).getByText(/387\.0 mm/)).toBeInTheDocument();
    expect(within(stability).getByText('478.9 mm')).toBeInTheDocument();
    const mass = screen.getByRole('region', { name: 'Mass and size' });
    expect(within(mass).getByText('190.9 g')).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Fins/ }));
    expect(screen.getByRole('region', { name: 'Fin set editor' })).toBeInTheDocument();
    expect(screen.getByLabelText('Fin root chord')).toHaveValue('100');
  });

  it('rejects a zero chord with a plain message and keeps the figures; a larger fin moves the CP aft', async () => {
    const user = userEvent.setup();
    render(<App storage={memory()} />);
    await user.click(screen.getByRole('option', { name: /Fins/ }));
    const chord = screen.getByLabelText('Fin root chord');
    await user.clear(chord);
    await user.type(chord, '0');
    expect(screen.getByRole('alert')).toHaveTextContent('Fin root chord must be greater than 0 mm');
    const stability = screen.getByRole('region', { name: 'Stability' });
    expect(within(stability).getByText('478.9 mm')).toBeInTheDocument();
    await user.clear(chord);
    await user.type(chord, '150');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // A longer root chord adds fin normal force aft of the old CP (CLAUDE.md 7.3: fins never move the CP forward);
    // the margin itself may fall because the heavier fins also move the CG aft.
    const region = screen.getByRole('region', { name: 'Stability' });
    const cpText =
      within(region).getByText('Centre of pressure').nextElementSibling?.textContent ?? '';
    expect(Number.parseFloat(cpText)).toBeGreaterThan(478.9);
  });

  it('the units toggle shows the chord in inches and restores it in millimetres', async () => {
    const user = userEvent.setup();
    render(<App storage={memory()} />);
    await user.click(screen.getByRole('option', { name: /Fins/ }));
    await user.click(screen.getByRole('radio', { name: 'Imperial' }));
    expect(screen.getByLabelText('Fin root chord')).toHaveValue('3.937');
    const stability = screen.getByRole('region', { name: 'Stability' });
    expect(within(stability).getByText('18.854 in')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Metric' }));
    expect(screen.getByLabelText('Fin root chord')).toHaveValue('100');
  });

  it('autosaves after an edit and restores the design on the next start', async () => {
    const user = userEvent.setup();
    const storage = memory();
    const { unmount } = render(<App storage={storage} />);
    await user.clear(screen.getByRole('textbox', { name: 'Design name' }));
    await user.type(screen.getByRole('textbox', { name: 'Design name' }), 'Saved one');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    const text = storage.map.get('lofi-rocket:design:example-r1');
    expect(text).toBeDefined();
    expect(parseDesign(text ?? '').name).toBe('Saved one');
    unmount();
    render(<App storage={storage} />);
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('Saved one');
  });

  it('reports an invalid autosave instead of silently starting over', () => {
    const storage = memory();
    storage.setItem('lofi-rocket:last', 'x');
    storage.setItem('lofi-rocket:design:x', '{"schemaVersion":1}');
    render(<App storage={storage} />);
    expect(screen.getByRole('status')).toHaveTextContent(/could not be loaded and was kept aside/);
    expect(storage.map.has('lofi-rocket:recovered:x')).toBe(true);
  });

  it('starts from a given design and adds a component from the menu', async () => {
    const user = userEvent.setup();
    render(<App storage={memory()} initialDesign={exampleDesign('given')} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Add a component' }), 'bodyTube');
    expect(screen.getByRole('region', { name: 'Body tube editor' })).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: /Body tube/ }).length).toBeGreaterThanOrEqual(2);
  });
});
