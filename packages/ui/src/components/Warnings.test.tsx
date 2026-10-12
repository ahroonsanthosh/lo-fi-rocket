import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { WarningList, WarningSummary, type WarningItem } from './Warnings.js';

// Texts as the app shows them today (review screenshots 10, 15, 22).
const WARNINGS: WarningItem[] = [
  {
    id: 'model:haack',
    severity: 'limitation',
    title: 'Haack nose drag is from digitised NASA TR R-100 data',
    reason:
      'The transonic and supersonic nose drag is read from a chart, with a reading uncertainty of ±0.005 in C_D,N.',
    detail: 'NASA TR R-100 Figure 12, scaled by Niskanen eq. (B.9); D-055.',
  },
  {
    id: 'thrust-to-weight',
    severity: 'caution',
    title: 'Average thrust to liftoff weight is 4.9:1, below 5:1',
    reason: 'The rocket accelerates slowly off the pad and is sensitive to wind at rail exit.',
  },
  {
    id: 'stability',
    severity: 'danger',
    title: 'Stability margin 0.21 calibers at liftoff is below 1',
    reason:
      'The centre of pressure is too close to or ahead of the centre of gravity for the fins to correct a disturbance.',
  },
];

function Harness(): JSX.Element {
  const [acked, setAcked] = useState<string[]>([]);
  return (
    <WarningList
      warnings={WARNINGS.map((w) => ({ ...w, acknowledged: acked.includes(w.id) }))}
      onAcknowledge={(id) => {
        setAcked((a) => [...a, id]);
      }}
    />
  );
}

describe('WarningList and WarningBanner', () => {
  it('shows every warning in full, most serious first, each with its severity word and reason', () => {
    render(<Harness />);
    const list = screen.getByRole('region', { name: 'Warnings' });
    const items = within(list).getAllByRole('article');
    expect(items.map((a) => a.getAttribute('aria-label'))).toEqual([
      'Danger: Stability margin 0.21 calibers at liftoff is below 1',
      'Caution: Average thrust to liftoff weight is 4.9:1, below 5:1',
      'Model limit: Haack nose drag is from digitised NASA TR R-100 data',
    ]);
    for (const w of WARNINGS) {
      expect(list).toHaveTextContent(w.reason);
    }
    expect(list).toHaveTextContent('D-055');
    expect(list).toHaveTextContent('1 danger');
    expect(list).toHaveTextContent('1 caution');
    expect(list).toHaveTextContent('1 model limit');
  });

  it('has an icon for each severity alongside the words, never colour alone', () => {
    render(<Harness />);
    for (const a of screen.getAllByRole('article')) {
      expect(a.querySelector('svg[data-severity]')).not.toBeNull();
      expect(a.querySelector('.lfr-warning__severity')?.textContent).toMatch(
        /^(Danger|Caution|Model limit):$/,
      );
    }
  });

  it('has no dismiss control; acknowledging by keyboard keeps the text and says so', async () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: /close|dismiss|hide/i })).toBeNull();
    const before = screen.getByRole('region', { name: 'Warnings' }).textContent;
    const ack = screen.getByRole('button', { name: /Acknowledge: Stability margin/ });
    ack.focus();
    await userEvent.keyboard('{Enter}');
    const article = screen.getByRole('article', { name: /Stability margin/ });
    expect(article).toHaveTextContent('Acknowledged');
    expect(article).toHaveAttribute('data-acknowledged', 'true');
    // Same warnings, same order, same text: only the acknowledgement line changed.
    const after = screen.getByRole('region', { name: 'Warnings' }).textContent;
    for (const w of WARNINGS) {
      expect(after).toContain(w.title);
      expect(after).toContain(w.reason);
    }
    expect(after.replace('Acknowledged', 'Acknowledge')).toBe(before);
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('is a polite live region, so new warnings are announced', () => {
    render(<Harness />);
    expect(
      screen.getByRole('region', { name: 'Warnings' }).querySelector('[aria-live="polite"]'),
    ).not.toBeNull();
  });

  it('says plainly when there are none', () => {
    render(<WarningList warnings={[]} emptyText="No warnings for this flight." />);
    expect(screen.getByText('No warnings for this flight.')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('WarningSummary', () => {
  it('shows the counts and the most serious title in words, with a link to the list', () => {
    render(<WarningSummary warnings={WARNINGS} href="#warnings" />);
    expect(
      screen.getByText('Danger: Stability margin 0.21 calibers at liftoff is below 1'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 danger')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all 3 warnings' })).toHaveAttribute(
      'href',
      '#warnings',
    );
  });
  it('says there are none', () => {
    render(<WarningSummary warnings={[]} href="#warnings" />);
    expect(screen.getByText('No warnings')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('has no axe violations', async () => {
    const { container } = render(<WarningSummary warnings={WARNINGS} href="#warnings" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
