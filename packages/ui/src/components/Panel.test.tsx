import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { Button } from './Button.js';
import { Panel } from './Panel.js';

describe('Panel', () => {
  it('is a region named by its heading, at the requested level', () => {
    render(
      <Panel
        title="Mass and size"
        level={3}
        description="Totals of every component"
        actions={<Button>Edit</Button>}
      >
        <p>148.3 g</p>
      </Panel>,
    );
    expect(screen.getByRole('region', { name: 'Mass and size' })).toHaveTextContent('148.3 g');
    expect(screen.getByRole('heading', { level: 3, name: 'Mass and size' })).toBeInTheDocument();
    expect(screen.getByText('Totals of every component')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('a collapsible panel toggles with the keyboard and reports its state', async () => {
    render(
      <Panel title="Simulation settings" collapsible defaultOpen={false}>
        <p>Integrator</p>
      </Panel>,
    );
    const toggle = screen.getByRole('button', { name: /Simulation settings/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Integrator')).not.toBeVisible();
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Integrator')).toBeVisible();
    await userEvent.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <Panel title="Advanced" collapsible>
        <p>x</p>
      </Panel>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
