import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { Term } from './Tooltip.js';

describe('Term and Tooltip', () => {
  it('describes the term with the glossary text even while closed', () => {
    render(<Term k="cg" />);
    const term = screen.getByRole('button', { name: 'CG' });
    expect(term).toHaveAccessibleDescription(/Centre of gravity/);
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
  });

  it('opens on keyboard focus, closes on Escape and on blur', async () => {
    render(
      <>
        <Term k="cp" />
        <button type="button">next</button>
      </>,
    );
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'CP' })).toHaveFocus();
    const tip = screen.getByRole('tooltip');
    expect(tip).toBeVisible();
    expect(tip).toHaveTextContent('Centre of pressure');
    expect(tip).toHaveTextContent('Good value:');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
    // Focus stays on the term after Escape (SC 1.4.13 dismissible without moving focus).
    expect(screen.getByRole('button', { name: 'CP' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
  });

  it('opens on hover and stays while hovered', async () => {
    render(<Term k="mach" />);
    await userEvent.hover(screen.getByRole('button', { name: 'Mach' }));
    expect(screen.getByRole('tooltip')).toBeVisible();
    await userEvent.hover(screen.getByRole('tooltip'));
    expect(screen.getByRole('tooltip')).toBeVisible();
    await userEvent.unhover(screen.getByRole('tooltip'));
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
  });

  it('a click pins it open for touch screens', async () => {
    render(<Term k="cd" />);
    const term = screen.getByRole('button', { name: 'C_D' });
    await userEvent.click(term);
    await userEvent.unhover(term);
    expect(screen.getByRole('tooltip')).toBeVisible();
    expect(screen.getByRole('tooltip')).toHaveTextContent('no single good value');
  });

  it('has no axe violations open or closed', async () => {
    const { container } = render(<Term k="calibers" />);
    expect(await axeViolations(container)).toEqual([]);
    await userEvent.tab();
    expect(await axeViolations(container)).toEqual([]);
  });
});
