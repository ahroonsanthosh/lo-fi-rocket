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

/**
 * The runs of consecutive points with finite coordinates. A point the
 * simulator did not store (NaN, for example the Mach number after the
 * parachute opens) ends a run, so the line shows a gap there instead of
 * a made-up value or a broken drawing.
 */
export function finiteRuns(
  points: readonly (readonly [number, number])[],
): (readonly (readonly [number, number])[])[] {
  const runs: (readonly [number, number])[][] = [];
  let run: (readonly [number, number])[] = [];
  for (const p of points) {
    if (Number.isFinite(p[0]) && Number.isFinite(p[1])) run.push(p);
    else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

/**
 * The text row of each event label, so that labels close together do not
 * overlap (review finding 25): a label moves down a row while it would
 * reach the previous label on its row. `widthPerChar` is the drawn width
 * of one character, in the same units as the positions.
 */
export function labelRows(
  marks: readonly { x: number; label: string }[],
  widthPerChar: number,
  rows = 3,
): number[] {
  const ends: number[] = Array.from({ length: rows }, () => Number.NEGATIVE_INFINITY);
  return marks.map((m) => {
    let row = ends.findIndex((end) => m.x >= end);
    if (row < 0) row = ends.indexOf(Math.min(...ends));
    ends[row] = m.x + (m.label.length + 1) * widthPerChar;
    return row;
  });
}

/** A small SVG line chart with axes and ticks; no library (D-045). */
export function LinePlot(props: LinePlotProps): JSX.Element {
  const width = props.width ?? 640;
  const height = props.height ?? 300;
  const pad = { left: 56, right: 16, top: 28, bottom: 40 };
  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMin = 0;
  let yMax = Number.NEGATIVE_INFINITY;
  let gaps = false;
  for (const s of props.series) {
    for (const [x, y] of s.points) {
      // Points without a stored value are left out of the axis range and drawn as gaps.
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        gaps = true;
        continue;
      }
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
      {(() => {
        const marks = [...(props.markers ?? [])].sort((a, b) => a.x - b.x);
        // 12 px text: about 6.6 drawing units per character.
        const rows = labelRows(
          marks.map((m) => ({ x: X(m.x), label: m.label })),
          6.6,
        );
        return marks.map((m, i) => (
          <g key={m.label}>
            <line
              x1={X(m.x)}
              x2={X(m.x)}
              y1={pad.top}
              y2={height - pad.bottom}
              className="marker-line"
            />
            {/* A label that would run past the right edge is written to the left of its line. */}
            {X(m.x) + (m.label.length + 1) * 6.6 > width - pad.right ? (
              <text
                x={X(m.x) - 3}
                y={pad.top + 11 + 13 * (rows[i] ?? 0)}
                textAnchor="end"
                className="tick"
              >
                {m.label}
              </text>
            ) : (
              <text x={X(m.x) + 3} y={pad.top + 11 + 13 * (rows[i] ?? 0)} className="tick">
                {m.label}
              </text>
            )}
          </g>
        ));
      })()}
      {props.series.flatMap((s, i) =>
        finiteRuns(s.points).map((run, j) => (
          <polyline
            key={`${s.name}-${String(j)}`}
            fill="none"
            stroke={s.colour ?? COLOURS[i % COLOURS.length]}
            strokeWidth={1.8}
            points={run.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ')}
            data-series={s.name}
          />
        )),
      )}
      {gaps ? (
        <text x={width - pad.right} y={height - 6} textAnchor="end" className="tick plot-note">
          Gaps: no value stored there
        </text>
      ) : null}
      {props.series.length > 1 ? (
        <g className="legend">
          {(() => {
            // One line in the title row, right-aligned: a coloured dash and the name of each series.
            let right = width - pad.right;
            return [...props.series].reverse().map((s) => {
              const i = props.series.indexOf(s);
              const colour = s.colour ?? COLOURS[i % COLOURS.length];
              const textRight = right;
              right -= (s.name.length + 2) * 6.2 + 16;
              return (
                <text key={s.name} x={textRight} y={18} textAnchor="end" className="tick">
                  <tspan fill={colour} className="legend-key">
                    ━{' '}
                  </tspan>
                  {s.name}
                </text>
              );
            });
          })()}
        </g>
      ) : null}
    </svg>
  );
}
