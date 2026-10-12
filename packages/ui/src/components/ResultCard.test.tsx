import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { visibleText } from '../test/visible-text.js';
import { ResultCard, ResultGrid } from './ResultCard.js';

describe('ResultCard', () => {
  it('formats the value with the given decimals and unit, exactly as the app shows it today', () => {
    // The example flight's figures as the current app displays them (review screenshot 14).
    render(
      <ResultGrid label="Flight results">
        <ResultCard label="Apogee" term="apogee" value={167.3301} decimals={2} unit="m" />
        <ResultCard label="Maximum Mach" term="mach" value={0.18349} decimals={3} unit="" />
        <ResultCard
          label="Rail exit velocity"
          term="railExitVelocity"
          value={18.453}
          decimals={1}
          unit="m/s"
          detail="at 0.293 s"
        />
      </ResultGrid>,
    );
    const grid = screen.getByRole('group', { name: 'Flight results' });
    const text = visibleText(grid);
    expect(text).toContain('Apogee167.33 m');
    expect(text).toContain('Maximum Mach0.183');
    expect(text).toContain('Rail exit velocity18.5 m/s at 0.293 s');
  });

  it('shows a dash for a missing value and says "not available" to screen readers', () => {
    render(
      <ResultGrid label="r">
        <ResultCard label="Deployment" value={undefined} decimals={2} unit="s" />
      </ResultGrid>,
    );
    expect(screen.getByText('not available')).toHaveClass('lfr-visually-hidden');
  });

  it('writes a non-finite value out and marks it', () => {
    render(
      <ResultGrid label="r">
        <ResultCard label="Apogee" value={Number.NaN} decimals={2} unit="m" />
      </ResultGrid>,
    );
    expect(screen.getByText('NaN m')).toBeInTheDocument();
    expect(screen.getByText(/not a finite number/)).toBeInTheDocument();
  });

  it('shows a threshold status with icon and words, and marks stale results in words', () => {
    render(
      <ResultGrid label="r">
        <ResultCard
          label="Rail exit velocity"
          value={12.3}
          decimals={1}
          unit="m/s"
          status={{ severity: 'caution', label: 'Below 15 m/s' }}
          stale
        />
      </ResultGrid>,
    );
    expect(screen.getByText('Below 15 m/s')).toBeInTheDocument();
    expect(screen.getByText('out of date')).toBeInTheDocument();
    expect(document.querySelector('svg[data-severity="caution"]')).not.toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <ResultGrid label="Flight results">
        <ResultCard label="Apogee" term="apogee" value={167.33} decimals={2} unit="m" />
        <ResultCard label="Deployment" value={undefined} decimals={2} unit="s" />
      </ResultGrid>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
