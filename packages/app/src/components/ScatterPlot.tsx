import type { JSX } from 'react';

export interface ScatterPlotProps {
  readonly title: string;
  /** Points as (east, north) in the display unit. */
  readonly points: readonly (readonly [number, number])[];
  readonly unitLabel: string;
  readonly mean?: readonly [number, number] | undefined;
  /** Radius of the containment circle about the mean, display unit. */
  readonly containmentRadius?: number | undefined;
}

/** Landing points around the pad (east right, north up), equal scales, no library (D-045). */
export function ScatterPlot({
  title,
  points,
  unitLabel,
  mean,
  containmentRadius,
}: ScatterPlotProps): JSX.Element {
  const size = 420;
  const pad = 36;
  let extent = 1;
  for (const [x, y] of points) extent = Math.max(extent, Math.abs(x), Math.abs(y));
  if (mean !== undefined && containmentRadius !== undefined) {
    extent = Math.max(
      extent,
      Math.abs(mean[0]) + containmentRadius,
      Math.abs(mean[1]) + containmentRadius,
    );
  }
  extent *= 1.1;
  const scale = (size / 2 - pad) / extent;
  const X = (x: number): number => size / 2 + x * scale;
  const Y = (y: number): number => size / 2 - y * scale;
  const step = (() => {
    const raw = extent / 2;
    const power = 10 ** Math.floor(Math.log10(raw));
    const m = raw / power;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * power;
  })();
  const ticks: number[] = [];
  for (let v = -Math.floor(extent / step) * step; v <= extent; v += step)
    ticks.push(Number(v.toFixed(10)));
  return (
    <svg
      className="plot"
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      role="img"
      aria-label={title}
    >
      <text x={pad} y={18} className="plot-title">
        {title}
      </text>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={X(t)} x2={X(t)} y1={pad} y2={size - pad} className="grid" />
          <line y1={Y(t)} y2={Y(t)} x1={pad} x2={size - pad} className="grid" />
          <text x={X(t)} y={size - pad + 14} textAnchor="middle" className="tick">
            {String(t)}
          </text>
          <text x={pad - 4} y={Y(t) + 4} textAnchor="end" className="tick">
            {String(t)}
          </text>
        </g>
      ))}
      <line x1={X(0)} x2={X(0)} y1={pad} y2={size - pad} className="axis-line" />
      <line y1={Y(0)} y2={Y(0)} x1={pad} x2={size - pad} className="axis-line" />
      <text x={size - pad} y={size - 6} textAnchor="end" className="axis-label">
        east ({unitLabel})
      </text>
      <text x={pad + 4} y={pad - 6} className="axis-label">
        north ({unitLabel})
      </text>
      {mean !== undefined && containmentRadius !== undefined ? (
        <circle
          cx={X(mean[0])}
          cy={Y(mean[1])}
          r={containmentRadius * scale}
          className="containment"
        />
      ) : null}
      {points.map(([x, y], i) => (
        <circle key={i} cx={X(x)} cy={Y(y)} r={3} className="landing-point" data-point={i} />
      ))}
      {mean === undefined ? null : (
        <circle cx={X(mean[0])} cy={Y(mean[1])} r={5} className="mean-point" />
      )}
      <g className="pad-marker" transform={`translate(${String(X(0))} ${String(Y(0))})`}>
        <line x1={-6} x2={6} y1={0} y2={0} />
        <line x1={0} x2={0} y1={-6} y2={6} />
      </g>
    </svg>
  );
}
