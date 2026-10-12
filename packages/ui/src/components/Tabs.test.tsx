import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { Tabs } from './Tabs.js';

function Harness(): JSX.Element {
  const [id, setId] = useState('library');
  return (
    <Tabs
      label="Motor sources"
      selectedId={id}
      onSelect={setId}
      tabs={[
        { id: 'library', label: 'Library', panel: <p>Bundled motors</p> },
        { id: 'thrustcurve', label: 'ThrustCurve.org', panel: <p>Search online</p> },
        { id: 'file', label: 'Import .eng / .rse', panel: <p>Pick a file</p> },
        { id: 'csv', label: 'Custom CSV', panel: <p>Thrust table</p> },
      ]}
    />
  );
}

describe('Tabs', () => {
  it('has the tab roles, names and the selected panel only', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Motor sources' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Library' })).toHaveTextContent('Bundled motors');
    expect(screen.queryByText('Search online')).toBeNull();
  });

  it('only the selected tab is in the Tab order; Tab moves into the panel', async () => {
    render(<Harness />);
    await userEvent.tab();
    expect(screen.getByRole('tab', { name: 'Library' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
  });

  it('arrow keys move and select, wrapping; Home and End jump', async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'ThrustCurve.org' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Search online');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Custom CSV' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Library' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Custom CSV' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Library' })).toHaveFocus();
  });

  it('a click selects', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('tab', { name: 'Import .eng / .rse' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Pick a file');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
