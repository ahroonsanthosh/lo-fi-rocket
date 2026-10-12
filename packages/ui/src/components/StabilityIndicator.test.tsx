import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { visibleText } from '../test/visible-text.js';
import { StabilityIndicator } from './StabilityIndicator.js';

// Messages as the physics package writes them for the example rocket R1 (app screenshot 01).
const TYPICAL =
  '1.84 calibers is in the typical target range of 1 to 2 (a rule of thumb, not a guarantee).';
const OVER =
  '2.28 calibers is above 2: the rocket may be overstable and weathercock into the wind, which lowers the apogee and moves the landing point upwind.';
const thresholds = { unstableBelow: 1, overstableAbove: 2 };

describe('StabilityIndicator', () => {
  it('shows both margins with the given decimals, each with its own words, and the physics messages verbatim', () => {
    render(
      <StabilityIndicator
        state="ready"
        liftoff={{ margin: 1.8412, level: 'typical', message: TYPICAL }}
        burnout={{ margin: 2.2799, level: 'overstable', message: OVER }}
        thresholds={thresholds}
        mach={0.3}
      />,
    );
    const region = screen.getByRole('region', { name: 'Stability' });
    expect(visibleText(region)).toContain('1.84 calibers at liftoff');
    expect(visibleText(region)).toContain('2.28 calibers at burnout');
    expect(visibleText(region)).toContain('Typical range');
    expect(visibleText(region)).toContain('May be overstable');
    expect(visibleText(region)).toContain(TYPICAL);
    expect(visibleText(region)).toContain(`At burnout: ${OVER}`);
    expect(visibleText(region)).toContain('rules of thumb, not guarantees');
    // The frame takes the more serious state: a problem at burnout is not hidden behind a green liftoff.
    expect(region).toHaveClass('lfr-stability--caution');
  });

  it('marks the current zone of each scale with aria-current and the threshold labels', () => {
    render(
      <StabilityIndicator
        state="ready"
        liftoff={{ margin: 0.21, level: 'unstable', message: 'm' }}
        burnout={{ margin: 0.37, level: 'unstable', message: 'm' }}
        thresholds={thresholds}
        mach={0.3}
      />,
    );
    const liftoff = screen.getByRole('group', { name: 'Liftoff: stability zone' });
    const current = within(liftoff)
      .getAllByRole('listitem')
      .find((li) => li.getAttribute('aria-current') === 'true');
    expect(current).toHaveTextContent('below 1');
    expect(screen.getByRole('region', { name: 'Stability' })).toHaveClass('lfr-stability--danger');
    expect(screen.getAllByText('Likely unstable')).toHaveLength(2);
  });

  it('shows a negative margin as given', () => {
    render(
      <StabilityIndicator
        state="ready"
        liftoff={{ margin: -5.7, level: 'unstable', message: 'm' }}
        burnout={{ margin: -5.04, level: 'unstable', message: 'm' }}
        thresholds={thresholds}
        mach={0.3}
      />,
    );
    expect(visibleText(screen.getByRole('region', { name: 'Stability' }))).toContain(
      '-5.70 calibers at liftoff',
    );
  });

  it('says when no motor is selected and shows no burnout row', () => {
    render(
      <StabilityIndicator
        state="ready"
        liftoff={{ margin: 0.64, level: 'unstable', message: 'm' }}
        burnout={undefined}
        thresholds={thresholds}
        mach={0.3}
      />,
    );
    const region = screen.getByRole('region', { name: 'Stability' });
    expect(visibleText(region)).toContain('0.64 calibers (no motor selected)');
    expect(visibleText(region)).not.toContain('burnout');
  });

  it('writes a non-finite margin out as an error, never as a number', () => {
    render(
      <StabilityIndicator
        state="ready"
        liftoff={{ margin: Number.NaN, level: 'unstable', message: 'm' }}
        burnout={undefined}
        thresholds={thresholds}
        mach={0.3}
      />,
    );
    expect(visibleText(screen.getByRole('region', { name: 'Stability' }))).toContain(
      'NaN (not a finite number)',
    );
  });

  it('compact form keeps the numbers and the status words', () => {
    render(
      <StabilityIndicator
        compact
        state="ready"
        liftoff={{ margin: 1.84, level: 'typical', message: TYPICAL }}
        burnout={{ margin: 2.28, level: 'overstable', message: OVER }}
        thresholds={thresholds}
        mach={0.3}
      />,
    );
    const region = screen.getByRole('region', { name: 'Stability' });
    expect(visibleText(region)).toContain('1.84');
    expect(visibleText(region)).toContain('2.28');
    expect(visibleText(region)).toContain('May be overstable');
  });

  it('empty and error states', () => {
    const { rerender } = render(<StabilityIndicator state="empty" />);
    expect(visibleText(screen.getByRole('region', { name: 'Stability' }))).toContain(
      'Add a nose cone',
    );
    rerender(
      <StabilityIndicator state="error" message="Fin root chord must be greater than 0 mm" />,
    );
    const region = screen.getByRole('region', { name: 'Stability' });
    expect(visibleText(region)).toContain('Cannot compute');
    expect(visibleText(region)).toContain('Fin root chord must be greater than 0 mm');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <StabilityIndicator
        state="ready"
        liftoff={{ margin: 1.84, level: 'typical', message: TYPICAL }}
        burnout={{ margin: 2.28, level: 'overstable', message: OVER }}
        thresholds={thresholds}
        mach={0.3}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
