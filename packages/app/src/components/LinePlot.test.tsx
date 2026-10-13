import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { finiteRuns, labelRows, LinePlot } from './LinePlot.js';

describe('LinePlot', () => {
  it('splits a series at points without a stored value', () => {
    const n = Number.NaN;
    expect(
      finiteRuns([
        [0, 1],
        [1, 2],
        [2, n],
        [3, n],
        [4, 5],
      ]),
    ).toEqual([
      [
        [0, 1],
        [1, 2],
      ],
      [[4, 5]],
    ]);
    expect(finiteRuns([[0, n]])).toEqual([]);
  });

  it('draws gaps instead of NaN coordinates, keeps the axes finite and says so', () => {
    const { container } = render(
      <LinePlot
        title="Mach number"
        xLabel="Time (s)"
        yLabel="Mach"
        series={[
          {
            name: 'Mach',
            points: [
              [0, 0],
              [1, 0.18],
              [2, Number.NaN],
              [3, 0.02],
            ],
          },
        ]}
      />,
    );
    const lines = [...container.querySelectorAll('polyline')];
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l.getAttribute('points')).not.toContain('NaN');
    expect(container.innerHTML).not.toContain('NaN');
    expect(screen.getByText('Gaps: no value stored there')).toBeInTheDocument();
  });

  it('a series with every value stored has no gap note', () => {
    render(
      <LinePlot
        title="Altitude"
        xLabel="t"
        yLabel="m"
        series={[
          {
            name: 'Altitude',
            points: [
              [0, 0],
              [1, 10],
            ],
          },
        ]}
      />,
    );
    expect(screen.queryByText(/Gaps/)).not.toBeInTheDocument();
  });

  it('moves an event label down a row while it would run into the one before (finding 25)', () => {
    // 10 units per character: "rail-exit" (9 + 1 characters) ends 100 units after its start.
    const rows = labelRows(
      [
        { x: 0, label: 'rail-exit' },
        { x: 40, label: 'burnout' },
        { x: 300, label: 'apogee' },
        { x: 310, label: 'deployment' },
      ],
      10,
    );
    expect(rows).toEqual([0, 1, 0, 1]);
  });
});
