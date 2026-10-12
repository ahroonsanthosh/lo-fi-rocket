import type { JSX, ReactNode } from 'react';
import { formatFixed, isDisplayable, withUnit } from '../format/display-rules.js';
import type { GlossaryKey } from '../glossary/glossary.js';
import { SeverityTag, type Severity } from './severity.js';
import { Term } from './Tooltip.js';

export interface ResultCardProps {
  readonly label: string;
  /** Explains the label with a glossary entry. */
  readonly term?: GlossaryKey;
  /** The value in the display unit, or undefined when the flight has none (shown as a dash). */
  readonly value: number | undefined;
  /** Decimals from the display rules (UNIT_DISPLAY or FIGURE_DISPLAY). */
  readonly decimals: number;
  readonly unit: string;
  /** Text after the value, for example "at 0.293 s". */
  readonly detail?: ReactNode;
  /** A status the app decided, for example a threshold check; shown as icon and words. */
  readonly status?: { readonly severity: Severity; readonly label: string };
  /** True when the design changed after this result was computed. */
  readonly stale?: boolean;
}

/**
 * One result figure. The number is formatted by the display rules only;
 * a missing value is a dash with a spoken "not available", and a
 * non-finite one is written out and marked as an error, never hidden.
 */
export function ResultCard(props: ResultCardProps): JSX.Element {
  const { label, term, value, decimals, unit, detail, status, stale = false } = props;
  const finite = value === undefined || isDisplayable(value);
  return (
    <div
      className={`lfr-result${stale ? ' lfr-result--stale' : ''}${finite ? '' : ' lfr-result--nonfinite'}`}
    >
      <dt className="lfr-result__label">
        {term === undefined ? label : <Term k={term}>{label}</Term>}
      </dt>
      <dd className="lfr-result__value">
        {value === undefined ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="lfr-visually-hidden">not available</span>
          </>
        ) : (
          <span className="lfr-result__number">{withUnit(formatFixed(value, decimals), unit)}</span>
        )}
        {finite ? null : <span className="lfr-result__error"> not a finite number</span>}
        {detail === undefined ? null : <span className="lfr-result__detail"> {detail}</span>}
        {status === undefined ? null : (
          <span className="lfr-result__status">
            <SeverityTag severity={status.severity} label={status.label} />
          </span>
        )}
        {stale ? <span className="lfr-result__stale">out of date</span> : null}
      </dd>
    </div>
  );
}

/** A grid of result cards: a description list inside a named group. */
export function ResultGrid({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div role="group" aria-label={label}>
      <dl className="lfr-result-grid">{children}</dl>
    </div>
  );
}
