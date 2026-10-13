import type { JSX, ReactNode } from 'react';
import { formatFixed, isDisplayable, withUnit } from '../format/display-rules.js';
import { gaugePosition } from './Gauge.js';
import { SeverityTag, type Severity } from './severity.js';

/** A marked value on the bar, for example a threshold. */
export interface MeterTick {
  readonly at: number;
  /** What the tick is, for the tooltip of the bar ("minimum 15 m/s"). */
  readonly label: string;
}

export interface MeterProps {
  readonly label: ReactNode;
  /** The value in the display unit, or undefined when there is none yet. */
  readonly value: number | undefined;
  readonly decimals: number;
  readonly unit: string;
  /**
   * Ends of the bar. Leave both out for a figure that has no meaningful
   * scale (an apogee): then there is no bar, only the number.
   */
  readonly scale?: { readonly min: number; readonly max: number };
  readonly ticks?: readonly MeterTick[];
  /** A status the app decided; it colours the bar and is shown as icon and words. */
  readonly status?: { readonly severity: Severity; readonly label: string };
  /** Text after the value, for example "at 0.293 s". */
  readonly detail?: ReactNode;
  /** What to say when there is no value, for example "not simulated yet". */
  readonly emptyText?: string;
  /** True when the design changed after this figure was computed. */
  readonly stale?: boolean;
}

/**
 * One live figure in the style of a telemetry readout: a label, a thin
 * bar showing where the value sits on a stated scale (with threshold
 * ticks), and the number large at the right. The bar is decorative; the
 * number, the scale ends that matter and the status are words. A value
 * beyond the bar says so, as the gauge does.
 */
export function Meter(props: MeterProps): JSX.Element {
  const { label, value, decimals, unit, scale, ticks = [], status, detail, emptyText } = props;
  const stale = props.stale ?? false;
  const finite = value !== undefined && isDisplayable(value);
  const pos =
    finite && scale !== undefined ? gaugePosition(value, scale.min, scale.max) : undefined;
  const severity: Severity = status?.severity ?? 'info';
  return (
    <div
      className={`lfr-meter lfr-meter--${severity}${stale ? ' lfr-meter--stale' : ''}${
        scale === undefined ? ' lfr-meter--plain' : ''
      }`}
    >
      <span className="lfr-meter__label">{label}</span>
      {scale === undefined ? null : (
        <span className="lfr-meter__bar" aria-hidden="true">
          {pos === undefined ? null : (
            <span
              className="lfr-meter__fill"
              style={{ width: `${(pos.fraction * 100).toFixed(2)}%` }}
            />
          )}
          {ticks.map((t) => (
            <span
              key={t.label}
              className="lfr-meter__tick"
              title={t.label}
              style={{
                left: `${(gaugePosition(t.at, scale.min, scale.max).fraction * 100).toFixed(2)}%`,
              }}
            />
          ))}
        </span>
      )}
      <span className="lfr-meter__value">
        {value === undefined ? (
          <span className="lfr-meter__empty">{emptyText ?? '—'}</span>
        ) : (
          <>
            <span className="lfr-meter__number">{formatFixed(value, decimals)}</span>
            {unit === '' ? null : <span className="lfr-meter__unit"> {unit}</span>}
          </>
        )}
      </span>
      {status === undefined &&
      detail === undefined &&
      !stale &&
      pos?.off === undefined &&
      (value === undefined || finite) ? null : (
        <span className="lfr-meter__foot">
          {status === undefined ? null : (
            <SeverityTag severity={status.severity} label={status.label} />
          )}
          {detail === undefined ? null : <span className="lfr-meter__detail">{detail}</span>}
          {value !== undefined && !finite ? (
            <span className="lfr-nonfinite">not a finite number</span>
          ) : null}
          {pos?.off === undefined || scale === undefined ? null : (
            <span className="lfr-meter__off">
              {pos.off === 'below'
                ? `below the bar (${withUnit(formatFixed(scale.min, decimals), unit)})`
                : `beyond the bar (${withUnit(formatFixed(scale.max, decimals), unit)})`}
            </span>
          )}
          {stale ? <span className="lfr-meter__stale">out of date</span> : null}
        </span>
      )}
    </div>
  );
}
