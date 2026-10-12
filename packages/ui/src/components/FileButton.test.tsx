import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { FileButton } from './FileButton.js';

describe('FileButton', () => {
  it('is one visible button in the Tab order; the file input is not', async () => {
    render(<FileButton label="Import .ork" accept=".ork,.xml" onFile={() => undefined} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Import .ork' })).toHaveFocus();
    await userEvent.tab();
    expect(document.body).toHaveFocus();
  });

  it('passes the chosen file on', async () => {
    const onFile = vi.fn();
    const { container } = render(<FileButton label="Open" accept=".json" onFile={onFile} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['{}'], 'rocket.lofi.json', { type: 'application/json' });
    await userEvent.upload(input, file);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <FileButton label="Open" accept=".json" onFile={() => undefined} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
