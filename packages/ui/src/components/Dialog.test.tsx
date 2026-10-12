import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { Button } from './Button.js';
import { Dialog } from './Dialog.js';

function Harness({ dismissible = true }: { dismissible?: boolean }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState('none');
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Replace design
      </Button>
      <p>answer: {answer}</p>
      <Dialog
        open={open}
        title="Replace the current design?"
        description="The current design is autosaved and stays in Designs."
        dismissible={dismissible}
        onClose={() => {
          setOpen(false);
          setAnswer('closed');
        }}
        actions={
          <>
            <Button
              onClick={() => {
                setOpen(false);
                setAnswer('cancel');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setOpen(false);
                setAnswer('replace');
              }}
            >
              Replace
            </Button>
          </>
        }
      />
    </>
  );
}

describe('Dialog', () => {
  it('opens as a named modal dialog with its description and focus inside', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Replace design' }));
    const dialog = screen.getByRole('dialog', { name: 'Replace the current design?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(
      'The current design is autosaved and stays in Designs.',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('keeps Tab and Shift+Tab inside', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Replace design' }));
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Replace' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Replace' })).toHaveFocus();
  });

  it('Escape closes and focus returns to the opener', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Replace design' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('answer: closed')).toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('a non-dismissible dialog ignores Escape and needs a choice', async () => {
    render(<Harness dismissible={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Replace design' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText('answer: cancel')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Replace design' }));
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
