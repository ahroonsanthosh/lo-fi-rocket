import { exampleDesign } from '@lo-fi-rocket/formats';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VehicleView } from './VehicleView.js';

describe('VehicleView', () => {
  const d = exampleDesign('vv');

  it('draws only the outside parts, nose up, and selects a part on click', async () => {
    const onSelect = vi.fn();
    const { container } = render(
      <VehicleView
        components={d.components}
        selectedId={undefined}
        cg={0.387}
        cp={0.4789}
        cgText="387.0 mm"
        cpText="478.9 mm"
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole('img', { name: /standing nose up/ })).toBeInTheDocument();
    const kinds = [...container.querySelectorAll('.vehicle__part')].map((g) =>
      [...g.classList].find((c) => c.startsWith('vehicle__part--')),
    );
    expect(kinds).not.toContain('vehicle__part--innerTube');
    expect(kinds).not.toContain('vehicle__part--parachute');
    expect(kinds).toContain('vehicle__part--finSet');
    const nose = d.components.find((c) => c.component.kind === 'noseCone');
    const g = container.querySelector(`[data-component="${nose?.id ?? ''}"]`);
    if (g === null) throw new Error('no nose drawn');
    await userEvent.setup().click(g);
    expect(onSelect).toHaveBeenCalledWith(nose?.id);
  });

  it('labels the CG and CP in words at their heights along the rocket', () => {
    const { container } = render(
      <VehicleView
        components={d.components}
        selectedId={undefined}
        cg={0.387}
        cp={0.4789}
        cgText="387.0 mm"
        cpText="478.9 mm"
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText('387.0 mm', { exact: false })).toHaveClass('vehicle__label--cg');
    const cg = container.querySelector<HTMLElement>('.vehicle__label--cg');
    const cp = container.querySelector<HTMLElement>('.vehicle__label--cp');
    // The CP is aft of the CG, so it sits lower on the upright rocket.
    expect(Number.parseFloat(cp?.style.top ?? '0')).toBeGreaterThan(
      Number.parseFloat(cg?.style.top ?? '0'),
    );
  });

  it('says what to add when there is nothing to draw', () => {
    render(
      <VehicleView
        components={[]}
        selectedId={undefined}
        cg={undefined}
        cp={undefined}
        cgText={undefined}
        cpText={undefined}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText(/Add a body tube and a nose cone/)).toBeInTheDocument();
  });
});
