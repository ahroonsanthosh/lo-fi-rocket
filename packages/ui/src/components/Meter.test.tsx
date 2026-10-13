import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { visibleText } from '../test/visible-text.js';
import { Meter } from './Meter.js';

describe('Meter', () => {
  it('shows the label, the number with its display decimals and unit, and the status in words', () => {
    const { container } = render(
      <Meter
        label="Rail exit velocity"
        value={18.456}
        decimals={1}
        unit="m/s"
        scale={{ min: 0, max: 30 }}
        ticks={[{ at: 15, label: 'minimum 15.0 m/s' }]}
        status={{ severity: 'safe', label: 'At least 15.0 m/s' }}
      />,
    );
    expect(visibleText(container)).toBe('Rail exit velocity18.5 m/sAt least 15.0 m/s');
  });

  it('draws the bar at the value’s place on the scale and the tick at the threshold', () => {
    const { container } = render(
      <Meter
        label="x"
        value={18.456}
        decimals={1}
        unit="m/s"
        scale={{ min: 0, max: 30 }}
        ticks={[{ at: 15, label: 'minimum' }]}
      />,
    );
    // 18.456 / 30 = 0.6152 → 61.52 %; 15 / 30 → 50 %.
    expect(container.querySelector<HTMLElement>('.lfr-meter__fill')?.style.width).toBe('61.52%');
    expect(container.querySelector<HTMLElement>('.lfr-meter__tick')?.style.left).toBe('50%');
  });

  it('has no bar for a figure without a scale, and says what is missing', () => {
    const { container } = render(
      <Meter
        label="Apogee"
        value={undefined}
        decimals={2}
        unit="m"
        emptyText="not simulated yet"
      />,
    );
    expect(container.querySelector('.lfr-meter__bar')).toBeNull();
    expect(screen.getByText('not simulated yet')).toBeInTheDocument();
  });

  it('says when the value is beyond the bar, when it is out of date, and marks a non-finite one', () => {
    const { rerender } = render(
      <Meter label="x" value={45} decimals={1} unit="m/s" scale={{ min: 0, max: 30 }} stale />,
    );
    expect(screen.getByText('beyond the bar (30.0 m/s)')).toBeInTheDocument();
    expect(screen.getByText('out of date')).toBeInTheDocument();
    rerender(<Meter label="x" value={Number.NaN} decimals={1} unit="m/s" />);
    expect(screen.getByText('NaN')).toBeInTheDocument();
    expect(screen.getByText('not a finite number')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <Meter
        label="Stability at liftoff"
        value={1.84}
        decimals={2}
        unit="calibers"
        scale={{ min: 0, max: 4 }}
        ticks={[
          { at: 1, label: 'likely unstable below 1' },
          { at: 2, label: 'may be overstable above 2' },
        ]}
        status={{ severity: 'safe', label: 'Typical range' }}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
