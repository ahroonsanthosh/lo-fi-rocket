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

/** The text a sighted user sees: closed tooltips and other hidden elements left out. */
function visibleText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  for (const hidden of clone.querySelectorAll('[hidden]')) hidden.remove();
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

describe('App (plan 0012)', () => {
  it('shows the example with the Phase 1 figures and selects components for editing', async () => {
    const user = userEvent.setup();
    render(<App storage={memory()} />);
    // The three numbers and the plain sentence are always on screen.
    const status = screen.getByRole('region', { name: 'Status' });
    expect(within(status).getByText('1.84')).toBeInTheDocument();
    const rocket = screen.getByRole('region', { name: 'Rocket' });
    expect(within(rocket).getByText(/typical target range/)).toBeInTheDocument();
    expect(visibleText(rocket)).toMatch(/CG\s*387\.0 mm/);
    expect(visibleText(rocket)).toMatch(/CP\s*478\.9 mm/);
    // The full card is one tap away.
    await user.click(screen.getByRole('option', { name: /Stability and mass/ }));
    const stability = screen.getByRole('region', { name: 'Stability' });
    expect(within(stability).getByText(/387\.0 mm/)).toBeInTheDocument();
    expect(within(stability).getByText('478.9 mm')).toBeInTheDocument();
    const mass = screen.getByRole('region', { name: 'Mass and size' });
    expect(within(mass).getByText('190.9 g')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Your rocket' }));
    await user.click(screen.getByRole('option', { name: /Fins/ }));
    expect(screen.getByRole('region', { name: 'Fin set editor' })).toBeInTheDocument();
    expect(screen.getByLabelText('Fin root chord')).toHaveValue('100');
  });

  /** The CP as the stage's legend shows it, in the display unit. */
  function stageCp(): number {
    const match = /CP\s*([\d.]+)/.exec(visibleText(screen.getByRole('region', { name: 'Rocket' })));
    return Number.parseFloat(match?.[1] ?? 'NaN');
  }

  it('rejects a zero chord with a plain message and keeps the figures; a larger fin moves the CP aft', async () => {
    const user = userEvent.setup();
    render(<App storage={memory()} />);
    await user.click(screen.getByRole('option', { name: /Fins/ }));
    const chord = screen.getByLabelText('Fin root chord');
    await user.clear(chord);
    await user.type(chord, '0');
    expect(screen.getByRole('alert')).toHaveTextContent('Fin root chord must be greater than 0 mm');
    expect(stageCp()).toBe(478.9);
    await user.clear(chord);
    await user.type(chord, '150');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // A longer root chord adds fin normal force aft of the old CP (CLAUDE.md 7.3: fins never move the CP forward);
    // the margin itself may fall because the heavier fins also move the CG aft.
    expect(stageCp()).toBeGreaterThan(478.9);
  });

  it("as built: the weighed mass replaces the parts' total, motor out (D-089)", async () => {
    const user = userEvent.setup();
    render(<App storage={memory()} />);
    // The as-built figures sit with the masses they change, on the Stability and mass page.
    await user.click(screen.getByRole('option', { name: /Stability and mass/ }));
    await user.click(screen.getByText(/As built: the weighed mass and balance point/));
    await user.click(screen.getByLabelText('Use the weighed mass (motor out)'));
    // R1 empty: 190.904 g at liftoff less the D12's 42.6 g = 148.304 g, offered as the start.
    const field = screen.getByLabelText('Weighed mass, motor out');
    expect(field).toHaveValue('148.304');
    await user.clear(field);
    await user.type(field, '200');
    // Liftoff 200 + 42.6 = 242.6 g.
    const mass = screen.getByRole('region', { name: 'Mass and size' });
    expect(within(mass).getByText('242.6 g')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Use the weighed mass (motor out)'));
    expect(within(mass).getByText('190.9 g')).toBeInTheDocument();
  });

  it('the units toggle shows the chord in inches and restores it in millimetres', async () => {
    const user = userEvent.setup();
    render(<App storage={memory()} />);
    await user.click(screen.getByRole('option', { name: /Fins/ }));
    await user.click(screen.getByRole('radio', { name: 'Imperial' }));
    expect(screen.getByLabelText('Fin root chord')).toHaveValue('3.937');
    expect(visibleText(screen.getByRole('region', { name: 'Rocket' }))).toMatch(/CP\s*18\.854 in/);
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
    const warnings = screen.getByRole('region', { name: 'Warnings' });
    expect(warnings).toHaveTextContent(/could not be loaded and was kept aside/);
    expect(storage.map.has('lofi-rocket:recovered:x')).toBe(true);
  });

  it('starts from a given design and adds a part from the menu', async () => {
    const user = userEvent.setup();
    render(<App storage={memory()} initialDesign={exampleDesign('given')} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Add a component' }), 'bodyTube');
    expect(screen.getByRole('region', { name: 'Body tube editor' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Your rocket' }));
    const parts = screen.getByRole('listbox', { name: 'Component list' });
    expect(within(parts).getAllByRole('option', { name: /Body tube/ })).toHaveLength(2);
  });

  it('every row of the home list opens its page, and Back returns (docs/ui/simplify.md)', async () => {
    const user = userEvent.setup();
    render(<App storage={memory()} />);
    const back = (): Promise<void> =>
      user.click(screen.getByRole('button', { name: 'Your rocket' }));
    expect(screen.getByRole('heading', { name: 'Your rocket' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /^Motor/ }));
    expect(screen.getByRole('region', { name: 'Motor' })).toBeInTheDocument();
    await back();
    await user.click(within(screen.getByRole('listbox', { name: 'Launch' })).getByRole('option'));
    expect(screen.getByLabelText('Rail length')).toBeInTheDocument();
    await back();
    await user.click(
      within(screen.getByRole('listbox', { name: 'Recovery devices' })).getByRole('option'),
    );
    expect(screen.getByRole('region', { name: /Parachute|Recovery/ })).toBeInTheDocument();
    await back();
    await user.click(screen.getByRole('option', { name: /Simulate the flight/ }));
    expect(screen.getByRole('button', { name: 'Simulate flight' })).toBeInTheDocument();
    await back();
    expect(screen.getByRole('heading', { name: 'Your rocket' })).toBeInTheDocument();
  });

  it('the three numbers say what is known and what is not yet, in words', () => {
    render(<App storage={memory()} initialDesign={exampleDesign('o')} />);
    const status = screen.getByRole('region', { name: 'Status' });
    expect(within(status).getByText('1.84')).toBeInTheDocument();
    expect(within(status).getByText('Typical range')).toBeInTheDocument();
    expect(within(status).getByText('May be overstable')).toBeInTheDocument();
    expect(within(status).getByText('Simulate to see')).toBeInTheDocument();
    expect(within(status).getByText('Needs at least 15.0 m/s')).toBeInTheDocument();
    // Nothing is wrong with the example, so the top bar says so once and lists nothing.
    expect(screen.getByText('All clear')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Warnings' })).not.toBeInTheDocument();
  });

  it('a new design offers one next step at a time', async () => {
    const user = userEvent.setup();
    render(<App storage={memory()} />);
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('button', { name: 'New' }));
    await user.click(screen.getByRole('button', { name: 'Add a body tube' }));
    expect(screen.getByRole('region', { name: 'Body tube editor' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Your rocket' }));
    expect(screen.queryByRole('button', { name: 'Add a body tube' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a nose cone' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add fins' })).not.toBeInTheDocument();
  });

  it('Settings has the appearance and the glossary; the theme follows the system until chosen', async () => {
    const user = userEvent.setup();
    const storage = memory();
    render(<App storage={storage} />);
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getByText('Static stability margin')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(storage.map.get('lofi-rocket:theme')).toBe('dark');
    await user.click(within(dialog).getByRole('radio', { name: 'System' }));
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
