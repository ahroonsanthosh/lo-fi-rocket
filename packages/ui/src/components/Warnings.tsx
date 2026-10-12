import type { JSX, ReactNode } from 'react';
import { Button } from './Button.js';
import {
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  SeverityTag,
  StatusIcon,
  type Severity,
} from './severity.js';

/** Warnings carry a hazard or a limitation; plain status uses another component. */
export type WarningSeverity = Exclude<Severity, 'safe'>;

export interface WarningItem {
  /** Stable identity, for example the warning code plus its subject. */
  readonly id: string;
  readonly severity: WarningSeverity;
  /** What happened, short: "Rail exit velocity 12.3 m/s is below 15 m/s". */
  readonly title: string;
  /** Why it matters, in one sentence (CLAUDE.md 9). Required: no warning without its reason. */
  readonly reason: string;
  /** Where it comes from or what to do: a source, a decision record, a setting to change. */
  readonly detail?: ReactNode;
  /** Where in the app it arose, for example "Launch" or "Flight results". */
  readonly origin?: string;
  readonly acknowledged?: boolean;
}

export interface WarningBannerProps {
  readonly warning: WarningItem;
  /** Records that the user has read it. The warning stays exactly as visible. */
  readonly onAcknowledge?: (id: string) => void;
}

/**
 * One warning: icon, severity word, title, its one-sentence reason and
 * any detail, always rendered in full. There is no close button.
 * Acknowledging only records that it was read and says so next to it;
 * the text, colour and position do not change (docs/ui/redesign.md
 * section 5).
 */
export function WarningBanner({ warning, onAcknowledge }: WarningBannerProps): JSX.Element {
  const { id, severity, title, reason, detail, origin, acknowledged = false } = warning;
  return (
    <article
      className={`lfr-warning lfr-warning--${severity}`}
      aria-label={`${SEVERITY_LABEL[severity]}: ${title}`}
      data-acknowledged={acknowledged ? 'true' : 'false'}
    >
      <div className="lfr-warning__icon">
        <StatusIcon severity={severity} size={18} />
      </div>
      <div className="lfr-warning__body">
        <p className="lfr-warning__title">
          <span className="lfr-warning__severity">{SEVERITY_LABEL[severity]}:</span> {title}
        </p>
        <p className="lfr-warning__reason">{reason}</p>
        {detail === undefined ? null : <div className="lfr-warning__detail">{detail}</div>}
        <div className="lfr-warning__footer">
          {origin === undefined ? null : <span className="lfr-warning__origin">{origin}</span>}
          {acknowledged ? (
            <span className="lfr-warning__ack">Acknowledged</span>
          ) : onAcknowledge === undefined ? null : (
            <Button
              variant="ghost"
              className="lfr-warning__ack-button"
              aria-label={`Acknowledge: ${title}`}
              onClick={() => {
                onAcknowledge(id);
              }}
            >
              Acknowledge
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export interface WarningListProps {
  readonly warnings: readonly WarningItem[];
  readonly onAcknowledge?: (id: string) => void;
  /** Heading of the list; "Warnings" by default. */
  readonly title?: string;
  /** Text when there is nothing to show, for example "No warnings for this flight." */
  readonly emptyText?: string;
}

/**
 * Every current warning, most serious first, in a polite live region so
 * that new ones are announced. Order within a severity is the order given.
 */
export function WarningList({
  warnings,
  onAcknowledge,
  title = 'Warnings',
  emptyText = 'No warnings.',
}: WarningListProps): JSX.Element {
  const sorted = SEVERITY_ORDER.flatMap((s) => warnings.filter((w) => w.severity === s));
  return (
    <section className="lfr-warning-list" aria-label={title}>
      <h2 className="lfr-warning-list__title">
        {title}
        <WarningCounts warnings={warnings} />
      </h2>
      <div aria-live="polite">
        {sorted.length === 0 ? (
          <p className="lfr-warning-list__empty">
            <SeverityTag severity="safe" label={emptyText} />
          </p>
        ) : (
          <ul className="lfr-warning-list__items">
            {sorted.map((w) => (
              <li key={w.id}>
                <WarningBanner
                  warning={w}
                  {...(onAcknowledge === undefined ? {} : { onAcknowledge })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** "2 danger, 1 caution": the count per severity with its icon, for headings and the status bar. */
export function WarningCounts({
  warnings,
}: {
  readonly warnings: readonly WarningItem[];
}): JSX.Element | null {
  const counts = SEVERITY_ORDER.map((s) => ({
    s,
    n: warnings.filter((w) => w.severity === s).length,
  })).filter((c) => c.n > 0);
  if (counts.length === 0) return null;
  return (
    <span className="lfr-warning-counts">
      {counts.map(({ s, n }) => (
        <span key={s} className={`lfr-warning-counts__item lfr-tag--${s}`}>
          <StatusIcon severity={s} size={14} />
          <span>
            {String(n)} {SEVERITY_LABEL[s].toLowerCase()}
          </span>
        </span>
      ))}
    </span>
  );
}

export interface WarningSummaryProps {
  readonly warnings: readonly WarningItem[];
  /** Where the full list is, for example "#warnings". */
  readonly href: string;
}

/**
 * For the always-visible status bar: the count per severity and the most
 * serious warning's title in words, with a link to the full list. The
 * status bar never shows less than this while any warning exists.
 */
export function WarningSummary({ warnings, href }: WarningSummaryProps): JSX.Element {
  const top = SEVERITY_ORDER.flatMap((s) => warnings.filter((w) => w.severity === s))[0];
  if (top === undefined) {
    return (
      <span className="lfr-warning-summary">
        <SeverityTag severity="safe" label="No warnings" />
      </span>
    );
  }
  return (
    <span className="lfr-warning-summary">
      <WarningCounts warnings={warnings} />
      <span className={`lfr-warning-summary__top lfr-warning-summary__top--${top.severity}`}>
        <StatusIcon severity={top.severity} size={14} />
        <span>
          {SEVERITY_LABEL[top.severity]}: {top.title}
        </span>
      </span>
      <a className="lfr-warning-summary__link" href={href}>
        See all {String(warnings.length)} {warnings.length === 1 ? 'warning' : 'warnings'}
      </a>
    </span>
  );
}
