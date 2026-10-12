import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { NumberInput, type NumberRule } from './NumberInput.js';

function Harness(props: {
  initial: number;
  rule: NumberRule;
  onChange?: (n: number) => void;
}): JSX.Element {
  const [v, setV] = useState(props.initial);
  return (
    <>
      <NumberInput
        label="Fin root chord"
        value={v}
        unit="mm"
        decimals={1}
        rule={props.rule}
        hint="Along the body"
        onChange={(n) => {
          setV(n);
          props.onChange?.(n);
        }}
      />
      <output aria-label="stored">{String(v)}</output>
    </>
  );
}

describe('NumberInput', () => {
  it('is named by its label, shows the unit and the hint', () => {
    render(<Harness initial={100} rule={{ kind: 'positive' }} />);
    const input = screen.getByRole('textbox', { name: 'Fin root chord' });
    expect(input).toHaveValue('100');
    expect(input).toHaveAccessibleDescription('Along the body');
    expect(screen.getByText('mm')).toBeInTheDocument();
  });

  it('passes each valid entry on, in the display unit', async () => {
    const onChange = vi.fn();
    render(<Harness initial={100} rule={{ kind: 'positive' }} onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Fin root chord' });
    await userEvent.clear(input);
    await userEvent.type(input, '82.5');
    expect(onChange).toHaveBeenLastCalledWith(82.5);
    expect(screen.getByLabelText('stored')).toHaveTextContent('82.5');
    // Typing through "82." did not reformat the text under the cursor.
    expect(input).toHaveValue('82.5');
  });

  it('rejects 0 for a positive rule inline, says the value still in use, and passes nothing on', async () => {
    const onChange = vi.fn();
    render(<Harness initial={100} rule={{ kind: 'positive' }} onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Fin root chord' });
    await userEvent.clear(input);
    onChange.mockClear();
    await userEvent.type(input, '0');
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Fin root chord must be greater than 0 mm');
    expect(alert).toHaveTextContent('Not applied: still using 100 mm.');
    expect(input).toHaveAccessibleDescription(/must be greater than 0 mm/);
    expect(screen.getByLabelText('stored')).toHaveTextContent('100');
  });

  it('rejects text that is not a number', async () => {
    render(<Harness initial={3} rule={{ kind: 'any' }} />);
    const input = screen.getByRole('textbox', { name: 'Fin root chord' });
    await userEvent.clear(input);
    await userEvent.type(input, 'abc');
    expect(screen.getByRole('alert')).toHaveTextContent('Fin root chord must be a number');
  });

  it('applies the non-negative and integer rules', async () => {
    const { unmount } = render(<Harness initial={1} rule={{ kind: 'non-negative' }} />);
    let input = screen.getByRole('textbox', { name: 'Fin root chord' });
    await userEvent.clear(input);
    await userEvent.type(input, '-1');
    expect(screen.getByRole('alert')).toHaveTextContent('must be 0 mm or greater');
    unmount();
    render(<Harness initial={3} rule={{ kind: 'integer', min: 1 }} />);
    input = screen.getByRole('textbox', { name: 'Fin root chord' });
    await userEvent.clear(input);
    await userEvent.type(input, '2.5');
    expect(screen.getByRole('alert')).toHaveTextContent('must be a whole number of 1 or more');
  });

  it('shows a tiny value as itself, never as 0', () => {
    render(
      <NumberInput
        label="Relative tolerance"
        value={1e-8}
        unit=""
        decimals={2}
        rule={{ kind: 'positive' }}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Relative tolerance' })).toHaveValue('1e-8');
  });

  it('re-reads the value when it changes from outside (units toggle)', () => {
    const { rerender } = render(
      <NumberInput
        label="Length"
        value={300}
        unit="mm"
        decimals={1}
        rule={{ kind: 'positive' }}
        onChange={() => undefined}
      />,
    );
    rerender(
      <NumberInput
        label="Length"
        value={11.811}
        unit="in"
        decimals={3}
        rule={{ kind: 'positive' }}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Length' })).toHaveValue('11.811');
    expect(screen.getByText('in')).toBeInTheDocument();
  });

  it('offers the glossary term outside the label, so it is not part of the field name', async () => {
    render(
      <NumberInput
        label="Rail angle"
        value={0}
        unit="°"
        decimals={1}
        rule={{ kind: 'any' }}
        term="railAngle"
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Rail angle' })).toBeInTheDocument();
    const help = screen.getByRole('button', { name: 'What is rail angle?' });
    // The help button sits with the label, before the field, in the Tab order.
    await userEvent.tab();
    expect(help).toHaveFocus();
    expect(screen.getByRole('tooltip')).toBeVisible();
    expect(screen.getByRole('tooltip')).toHaveTextContent('30°');
    await userEvent.tab();
    expect(screen.getByRole('textbox', { name: 'Rail angle' })).toHaveFocus();
  });

  it('has no axe violations, valid or invalid', async () => {
    const { container } = render(<Harness initial={100} rule={{ kind: 'positive' }} />);
    expect(await axeViolations(container)).toEqual([]);
    const input = screen.getByRole('textbox', { name: 'Fin root chord' });
    await userEvent.clear(input);
    expect(await axeViolations(container)).toEqual([]);
  });
});
