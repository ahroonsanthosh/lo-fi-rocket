import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../test/axe.js';
import { SelectField, TextField } from './Field.js';

describe('TextField and SelectField', () => {
  it('a text field is labelled, described by its hint and reports changes', async () => {
    const onChange = vi.fn();
    render(
      <TextField label="Design name" value="" hint="Shown in the file name" onChange={onChange} />,
    );
    const input = screen.getByRole('textbox', { name: 'Design name' });
    expect(input).toHaveAccessibleDescription('Shown in the file name');
    await userEvent.type(input, 'R');
    expect(onChange).toHaveBeenCalledWith('R');
  });

  it('an error replaces the hint, is announced and marks the field invalid', () => {
    render(
      <TextField
        label="Design name"
        value=""
        hint="h"
        error="A design needs a name"
        onChange={() => undefined}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Design name' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('A design needs a name');
    expect(input).toHaveAccessibleDescription('A design needs a name');
  });

  it('a select is labelled and changes with the keyboard', async () => {
    const onChange = vi.fn();
    render(
      <SelectField
        label="Integrator"
        value="dormand-prince"
        options={[
          { value: 'dormand-prince', label: 'Dormand–Prince RK5(4), adaptive step' },
          { value: 'rk4', label: 'Classical RK4, fixed step' },
        ]}
        onChange={onChange}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Integrator' });
    await userEvent.selectOptions(select, 'rk4');
    expect(onChange).toHaveBeenCalledWith('rk4');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <>
        <TextField label="Name" value="x" onChange={() => undefined} />
        <TextField label="Other" value="" error="Needed" onChange={() => undefined} />
        <SelectField
          label="Pick"
          value="a"
          options={[{ value: 'a', label: 'A' }]}
          onChange={() => undefined}
          suffix="s"
        />
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
