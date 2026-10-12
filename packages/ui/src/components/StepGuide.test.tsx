import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { StepGuide, type Step } from './StepGuide.js';

const STEPS: Step[] = [
  { id: 'body', label: 'Body', status: 'done' },
  { id: 'nose', label: 'Nose', status: 'done' },
  { id: 'fins', label: 'Fins', status: 'attention', note: 'Rocket likely unstable' },
  { id: 'motor', label: 'Motor', status: 'todo' },
  { id: 'recovery', label: 'Recovery', status: 'todo' },
  { id: 'launch', label: 'Launch', status: 'todo' },
  { id: 'results', label: 'Results', status: 'todo' },
];

describe('StepGuide', () => {
  it('lists the steps in order with progress and status words', () => {
    render(
      <StepGuide
        steps={STEPS}
        currentId="fins"
        onSelect={() => undefined}
        onHide={() => undefined}
      />,
    );
    expect(screen.getByText('Step 3 of 7')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', {
      name: /Body|Nose|Fins|Motor|Recovery|Launch|Results/,
    });
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Bodydone',
      'Nosedone',
      'FinsRocket likely unstable',
      '4Motornot started',
      '5Recoverynot started',
      '6Launchnot started',
      '7Resultsnot started',
    ]);
    expect(screen.getByRole('button', { name: /Fins/ })).toHaveAttribute('aria-current', 'step');
  });

  it('any step can be opened, by keyboard, without finishing the earlier ones', async () => {
    const onSelect = vi.fn();
    render(
      <StepGuide steps={STEPS} currentId="body" onSelect={onSelect} onHide={() => undefined} />,
    );
    screen.getByRole('button', { name: /Results/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('results');
  });

  it('experienced users can hide it', async () => {
    const onHide = vi.fn();
    render(<StepGuide steps={STEPS} currentId="body" onSelect={() => undefined} onHide={onHide} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hide the guide' }));
    expect(onHide).toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <StepGuide
        steps={STEPS}
        currentId="fins"
        onSelect={() => undefined}
        onHide={() => undefined}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
