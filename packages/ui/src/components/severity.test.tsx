import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button.js';
import { SEVERITY_LABEL, SEVERITY_ORDER, SeverityTag, StatusIcon } from './severity.js';

describe('severity', () => {
  it('each severity has its own icon shape, hidden from assistive technology', () => {
    const shapes = new Set<string>();
    for (const s of SEVERITY_ORDER) {
      const { container, unmount } = render(<StatusIcon severity={s} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      shapes.add(svg?.innerHTML.replace(/fill="[^"]*"|stroke="[^"]*"/g, '') ?? '');
      unmount();
    }
    expect(shapes.size).toBe(SEVERITY_ORDER.length);
  });

  it('a tag always carries words with the icon', () => {
    render(
      <>
        <SeverityTag severity="danger" />
        <SeverityTag severity="safe" label="Typical range" />
      </>,
    );
    expect(screen.getByText(SEVERITY_LABEL.danger)).toBeInTheDocument();
    expect(screen.getByText('Typical range')).toBeInTheDocument();
  });

  it('a Button defaults to type="button"', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });
});
