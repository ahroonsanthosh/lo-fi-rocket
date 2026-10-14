/**
 * Issue #14: a field shows the value it holds. A relative tolerance of
 * 1e-8 read 0 with three fixed decimals.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuantityField } from './QuantityField.js';

function field(value: number): HTMLInputElement {
  render(
    <QuantityField
      label="Relative tolerance"
      kind="ratio"
      units="metric"
      value={value}
      rule="positive"
      onChange={() => undefined}
    />,
  );
  return screen.getByLabelText<HTMLInputElement>(/Relative tolerance/);
}

describe('QuantityField display (issue #14)', () => {
  it('shows 1e-8 as 1e-8, not 0', () => {
    expect(field(1e-8).value).toBe('1e-8');
  });
  it('shows 0.0012345 to six significant digits: three decimals (0.001) would be 19 % off', () => {
    expect(field(0.0012345).value).toBe('0.0012345');
  });
  it('keeps three decimals when they are within 1 %: 0.0748 shows 0.075 (0.27 % off)', () => {
    expect(field(0.0748).value).toBe('0.075');
  });
  it('shows 0 as 0', () => {
    expect(field(0).value).toBe('0');
  });
});
