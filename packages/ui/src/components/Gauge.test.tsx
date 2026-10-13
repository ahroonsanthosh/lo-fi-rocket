import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { visibleText } from '../test/visible-text.js';
import { arcPath, Gauge, gaugePosition } from './Gauge.js';

describe('gaugePosition', () => {
  it('places a value linearly between the ends', () => {
    // (1.84 - 0) / (4 - 0) = 0.46; (3 - 1) / (5 - 1) = 0.5.
    expect(gaugePosition(1.84, 0, 4)).toEqual({ fraction: 0.46, off: undefined });
    expect(gaugePosition(3, 1, 5)).toEqual({ fraction: 0.5, off: undefined });
    expect(gaugePosition(0, 0, 4)).toEqual({ fraction: 0, off: undefined });
    expect(gaugePosition(4, 0, 4)).toEqual({ fraction: 1, off: undefined });
  });

  it('rests at an end and says which when the value is beyond it, never clamping silently', () => {
    expect(gaugePosition(-0.5, 0, 4)).toEqual({ fraction: 0, off: 'below' });
    expect(gaugePosition(6.2, 0, 4)).toEqual({ fraction: 1, off: 'above' });
  });

  it('refuses an empty range', () => {
    expect(() => gaugePosition(1, 2, 2)).toThrow(RangeError);
    expect(() => gaugePosition(1, 3, 2)).toThrow(RangeError);
  });
});

describe('arcPath', () => {
  it('draws the full dial from 135° to 405° with the large-arc flag set', () => {
    // Centre (50, 50), radius 40. At 135°: (50 + 40 cos 135°, 50 + 40 sin 135°) = (21.716, 78.284).
    // At 405° (= 45°): (78.284, 78.284). 270° > 180°, so the large-arc flag is 1.
    expect(arcPath(0, 1)).toBe('M 21.716 78.284 A 40 40 0 1 1 78.284 78.284');
  });

  it('uses the small arc for a third of the dial', () => {
    // 90° of sweep, from 135° to 225°: (21.716, 78.284) to (50 + 40 cos 225°, 50 + 40 sin 225°) = (21.716, 21.716).
    expect(arcPath(0, 1 / 3)).toBe('M 21.716 78.284 A 40 40 0 0 1 21.716 21.716');
  });
});

describe('Gauge', () => {
  it('prints the value with the display rule decimals, its unit, label and status', () => {
    const { container } = render(
      <Gauge
        label="At liftoff"
        value={1.8449}
        min={0}
        max={4}
        decimals={2}
        unit="cal"
        status={{ severity: 'safe', label: 'Typical range' }}
      />,
    );
    expect(visibleText(container)).toBe('At liftoff1.84calTypical range');
  });

  it('says when the value is beyond the dial', () => {
    render(<Gauge label="At burnout" value={5.5} min={0} max={4} decimals={2} unit="cal" />);
    expect(screen.getByText('above the dial (4.00 cal)')).toBeInTheDocument();
    expect(screen.getByText('5.50')).toBeInTheDocument();
  });

  it('says why a dial is empty when it is given a reason', () => {
    render(
      <Gauge
        label="Rail exit"
        value={undefined}
        min={0}
        max={30}
        decimals={1}
        unit="m/s"
        emptyText="simulate to see"
      />,
    );
    expect(screen.getByText('simulate to see')).toBeInTheDocument();
  });

  it('shows a dash spoken as "not available" for a missing value, and marks a non-finite one', () => {
    const { rerender } = render(
      <Gauge label="x" value={undefined} min={0} max={4} decimals={2} unit="cal" />,
    );
    expect(screen.getByText('not available')).toHaveClass('lfr-visually-hidden');
    rerender(<Gauge label="x" value={Number.NaN} min={0} max={4} decimals={2} unit="cal" />);
    expect(screen.getByText('NaN')).toBeInTheDocument();
    expect(screen.getByText('not a finite number')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <Gauge
        label="At liftoff"
        value={1.84}
        min={0}
        max={4}
        decimals={2}
        unit="cal"
        zones={[
          { from: 0, to: 1, severity: 'danger' },
          { from: 1, to: 2, severity: 'safe' },
          { from: 2, to: 4, severity: 'caution' },
        ]}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
