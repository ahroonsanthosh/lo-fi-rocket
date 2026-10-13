import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { Segmented } from './Segmented.js';

const OPTIONS = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
] as const;

describe('Segmented', () => {
  it('is a named group of radio buttons with the value checked', () => {
    render(
      <Segmented
        legend="Units"
        name="u"
        options={OPTIONS}
        value="metric"
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('group', { name: 'Units' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Metric' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Imperial' })).not.toBeChecked();
  });

  it('changes by click and by the arrow keys', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Segmented legend="Units" name="u" options={OPTIONS} value="metric" onChange={onChange} />,
    );
    await user.click(screen.getByText('Imperial'));
    expect(onChange).toHaveBeenLastCalledWith('imperial');
    screen.getByRole('radio', { name: 'Metric' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('imperial');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <Segmented
        legend="Units"
        name="u"
        options={OPTIONS}
        value="imperial"
        onChange={() => undefined}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
