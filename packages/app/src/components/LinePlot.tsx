import type { JSX } from 'react';

export interface Series {
  readonly name: string;
  readonly points: readonly (readonly [number, number])[];
  readonly colour?: string;
}

export interface LinePlotProps {
  readonly title: string;
  readonly xLabel: string;
  readonly yLabel: string;
  readonly series: readonly Series[];
  readonly width?: number;
  readonly height?: number;
  /** Vertical marker lines (x, label). */
  readonly markers?: readonly { x: number; label: string }[];
}

/** "Nice" tick spacing: 1, 2 or 5 times a power of ten giving about 5 ticks. */
function tickStep(span: number): number {
  if (!(span > 0)) return 1;
  const raw = span / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const m = raw / power;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * power;
}

function ticks(min: number, max: number): number[] {
  const step = tickStep(max - min);
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9 * step; v += step)
    out.push(Number(v.toFixed(12)));
  return out;
}

// Series colours follow the theme tokens (D-UI-6); each series is also named in the legend.
const COLOURS = [
  'var(--lfr-accent)',
  'var(--lfr-cp-marker)',
  'var(--lfr-safe-indicator)',
  'var(--lfr-caution-indicator)',
  'var(--lfr-limit-indicator)',
];

/** A small SVG line chart with axes and ticks; no library (D-045). */
export function LinePlot(props: LinePlotProps): JSX.Element {
  const width = props.width ?? 640;
  const height = props.height ?? 300;
  const pad = { left: 56, right: 16, top: 28, bottom: 40 };
  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMin = 0;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const s of props.series) {
    for (const [x, y] of s.points) {
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
  }
  if (!Number.isFinite(xMin) || !Number.isFinite(yMax)) {
    xMin = 0;
    xMax = 1;
    yMax = 1;
  }
  if (xMax === xMin) xMax = xMin + 1;
  if (yMax === yMin) yMax = yMin + 1;
  const X = (x: number): number =>
    pad.left + ((x - xMin) / (xMax - xMin)) * (width - pad.left - pad.right);
  const Y = (y: number): number =>
    height - pad.bottom - ((y - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);
  return (
    <svg
      className="plot"
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      role="img"
      aria-label={props.title}
    >
      <text x={pad.left} y={18} className="plot-title">
        {props.title}
      </text>
      {ticks(xMin, xMax).map((t) => (
        <g key={`x${String(t)}`}>
          <line x1={X(t)} x2={X(t)} y1={pad.top} y2={height - pad.bottom} className="grid" />
          <text x={X(t)} y={height - pad.bottom + 16} textAnchor="middle" className="tick">
            {String(t)}
          </text>
        </g>
      ))}
      {ticks(yMin, yMax).map((t) => (
        <g key={`y${String(t)}`}>
          <line x1={pad.left} x2={width - pad.right} y1={Y(t)} y2={Y(t)} className="grid" />
          <text x={pad.left - 6} y={Y(t) + 4} textAnchor="end" className="tick">
            {String(t)}
          </text>
        </g>
      ))}
      <line
        x1={pad.left}
        x2={width - pad.right}
        y1={height - pad.bottom}
        y2={height - pad.bottom}
        className="axis-line"
      />
      <line
        x1={pad.left}
        x2={pad.left}
        y1={pad.top}
        y2={height - pad.bottom}
        className="axis-line"
      />
      <text
        x={(pad.left + width - pad.right) / 2}
        y={height - 6}
        textAnchor="middle"
        className="axis-label"
      >
        {props.xLabel}
      </text>
      <text
        x={14}
        y={(pad.top + height - pad.bottom) / 2}
        textAnchor="middle"
        className="axis-label"
        transform={`rotate(-90 14 ${String((pad.top + height - pad.bottom) / 2)})`}
      >
        {props.yLabel}
      </text>
      {(props.markers ?? []).map((m) => (
        <g key={m.label}>
          <line
            x1={X(m.x)}
            x2={X(m.x)}
            y1={pad.top}
            y2={height - pad.bottom}
            className="marker-line"
          />
          <text x={X(m.x) + 3} y={pad.top + 10} className="tick">
            {m.label}
          </text>
        </g>
      ))}
      {props.series.map((s, i) => (
        <polyline
          key={s.name}
          fill="none"
          stroke={s.colour ?? COLOURS[i % COLOURS.length]}
          strokeWidth={1.8}
          points={s.points.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ')}
          data-series={s.name}
        />
      ))}
      {props.series.length > 1 ? (
        <g className="legend">
          {props.series.map((s, i) => (
            <text
              key={s.name}
              x={width - pad.right - 4}
              y={pad.top + 14 + 16 * i}
              textAnchor="end"
              fill={s.colour ?? COLOURS[i % COLOURS.length]}
              className="tick"
            >
              {s.name}
            </text>
          ))}
        </g>
      ) : null}
    </svg>
  );
}
