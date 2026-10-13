import type { JSX } from 'react';
import { formatFixed, isDisplayable, withUnit } from '../format/display-rules.js';
import { SeverityTag, type Severity } from './severity.js';

/** A coloured band on the dial, for example a rule-of-thumb stability zone. */
export interface GaugeZone {
  readonly from: number;
  readonly to: number;
  readonly severity: Severity;
}

export interface GaugeProps {
  /** Short caption inside the dial, for example "Stability · liftoff". */
  readonly label: string;
  /** The value in the display unit, or undefined when there is none. */
  readonly value: number | undefined;
  /** Ends of the dial. A display choice only: values beyond them are said so in words. */
  readonly min: number;
  readonly max: number;
  /** Decimals from the display rules (UNIT_DISPLAY or FIGURE_DISPLAY). */
  readonly decimals: number;
  readonly unit: string;
  /** Bands on the outer ring; their inner boundaries are also marked with ticks. */
  readonly zones?: readonly GaugeZone[];
  /** A status the app decided; it colours the arc and is shown as icon and words. */
  readonly status?: { readonly severity: Severity; readonly label: string };
  /** Shown under the dial when there is no value, for example "simulate to see". */
  readonly emptyText?: string;
}

export interface GaugePosition {
  /** 0 at `min`, 1 at `max`; the drawn position, held at the ends when off the scale. */
  readonly fraction: number;
  /** Which end the value is beyond, so the dial can say so instead of clamping silently. */
  readonly off: 'below' | 'above' | undefined;
}

/**
 * Where a value sits on the dial. The dial is a picture of a number that
 * is always printed next to it; when the value is beyond an end, the
 * needle rests at that end and `off` says which, so the reader is told.
 */
export function gaugePosition(value: number, min: number, max: number): GaugePosition {
  if (!(max > min))
    throw new RangeError(`Gauge range is empty: min ${String(min)}, max ${String(max)}`);
  if (value < min) return { fraction: 0, off: 'below' };
  if (value > max) return { fraction: 1, off: 'above' };
  return { fraction: (value - min) / (max - min), off: undefined };
}

// The dial is a 270° arc opening downwards, drawn clockwise from 135° (lower left) to 405° (lower right).
const START_DEG = 135;
const SWEEP_DEG = 270;
const R = 40;
const C = 50;
/** The thin outer ring that carries the zones and the ticks. */
const RING_R = 46.5;
const TICKS = 36;

function point(fraction: number, r: number = R): [number, number] {
  const a = ((START_DEG + SWEEP_DEG * fraction) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

/** SVG path of the arc between two fractions of the dial, at radius `r` (40 by default). */
export function arcPath(from: number, to: number, r: number = R): string {
  const [x0, y0] = point(from, r);
  const [x1, y1] = point(to, r);
  const large = (to - from) * SWEEP_DEG > 180 ? 1 : 0;
  return `M ${x0.toFixed(3)} ${y0.toFixed(3)} A ${String(r)} ${String(r)} 0 ${String(large)} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
}

function tick(fraction: number, r0: number, r1: number): string {
  const [x0, y0] = point(fraction, r0);
  const [x1, y1] = point(fraction, r1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * One figure as an instrument dial (the owner's reference design): the
 * caption, the number and its unit are real text inside the dial; the
 * arc and ticks are decorative and hidden from assistive technology. A
 * missing value is a dash spoken as "not available"; a non-finite one is
 * written out and marked; a value beyond the ends of the dial says so in
 * words. A status is always given in words as well as by the arc colour.
 */
export function Gauge(props: GaugeProps): JSX.Element {
  const { label, value, min, max, decimals, unit, zones = [], status, emptyText } = props;
  const finite = value !== undefined && isDisplayable(value);
  const pos = finite ? gaugePosition(value, min, max) : undefined;
  const at = (v: number): number => gaugePosition(v, min, max).fraction;
  const severity = status?.severity ?? 'info';
  const boundaries = zones.map((z) => z.from).filter((v) => v > min && v < max);
  return (
    <div className={`lfr-gauge lfr-gauge--${severity}${value === undefined ? ' is-empty' : ''}`}>
      <div className="lfr-gauge__dial">
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className="lfr-gauge__svg">
          {Array.from({ length: TICKS + 1 }, (_, i) => (
            <path key={i} className="lfr-gauge__tick" d={tick(i / TICKS, RING_R - 1, RING_R + 1)} />
          ))}
          {zones.map((z) => {
            const a = at(z.from);
            const b = at(z.to);
            return b > a ? (
              <path
                key={`${String(z.from)}-${String(z.to)}`}
                className={`lfr-gauge__zone lfr-gauge__zone--${z.severity}`}
                d={arcPath(a, b, RING_R)}
              />
            ) : null;
          })}
          {boundaries.map((v) => (
            <path key={v} className="lfr-gauge__mark" d={tick(at(v), RING_R - 3.5, RING_R + 2)} />
          ))}
          <path className="lfr-gauge__track" d={arcPath(0, 1)} />
          {pos === undefined || pos.fraction <= 0 ? null : (
            <path className="lfr-gauge__value" d={arcPath(0, pos.fraction)} />
          )}
        </svg>
        <p className="lfr-gauge__readout">
          <span className="lfr-gauge__label">{label}</span>
          {value === undefined ? (
            <>
              <span className="lfr-gauge__number" aria-hidden="true">
                —
              </span>
              <span className="lfr-visually-hidden">not available</span>
            </>
          ) : (
            <span className="lfr-gauge__number">{formatFixed(value, decimals)}</span>
          )}
          <span className="lfr-gauge__unit">{unit}</span>
        </p>
        <div className="lfr-gauge__foot">
          {value !== undefined && !finite ? (
            <p className="lfr-gauge__off lfr-nonfinite">not a finite number</p>
          ) : pos?.off === undefined ? null : (
            <p className="lfr-gauge__off">
              {pos.off === 'below'
                ? `below the dial (${withUnit(formatFixed(min, decimals), unit)})`
                : `above the dial (${withUnit(formatFixed(max, decimals), unit)})`}
            </p>
          )}
          {status === undefined ? null : (
            <SeverityTag severity={status.severity} label={status.label} />
          )}
          {value === undefined && emptyText !== undefined ? (
            <p className="lfr-gauge__empty">{emptyText}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
