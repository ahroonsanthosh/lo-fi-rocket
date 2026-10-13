import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { Dock, type DockItem } from './Dock.js';

const ITEMS: DockItem[] = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'motor', label: 'Motor', icon: 'motor' },
  { id: 'flight', label: 'Flight', icon: 'flight' },
];

describe('Dock', () => {
  it('is a named navigation whose open view is the current page', () => {
    render(<Dock label="Views" items={ITEMS} selectedId="motor" onSelect={() => undefined} />);
    const nav = screen.getByRole('navigation', { name: 'Views' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Motor' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('opens a view by click or keyboard', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Dock label="Views" items={ITEMS} selectedId="overview" onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Flight' }));
    expect(onSelect).toHaveBeenCalledWith('flight');
    screen.getByRole('button', { name: 'Motor' }).focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('motor');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <Dock label="Views" items={ITEMS} selectedId="overview" onSelect={() => undefined} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
