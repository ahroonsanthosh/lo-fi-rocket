import type { JSX } from 'react';

/**
 * The five kinds of status the app shows. Each has a colour, a distinct
 * icon shape and a text label, so meaning never rests on colour alone
 * (WCAG 2.2 SC 1.4.1).
 */
export type Severity = 'safe' | 'caution' | 'danger' | 'info' | 'limitation';

/** The visible text label of each severity. */
export const SEVERITY_LABEL: Readonly<Record<Severity, string>> = {
  safe: 'OK',
  caution: 'Caution',
  danger: 'Danger',
  info: 'Note',
  limitation: 'Model limit',
};

/** Display order: the most serious first. */
export const SEVERITY_ORDER: readonly Severity[] = [
  'danger',
  'caution',
  'limitation',
  'info',
  'safe',
];

export interface StatusIconProps {
  readonly severity: Severity;
  /** Pixel size of the square icon. */
  readonly size?: number;
}

/**
 * A decorative icon for a severity. Hidden from assistive technology:
 * the severity's text label is always rendered next to it.
 */
export function StatusIcon({ severity, size = 16 }: StatusIconProps): JSX.Element {
  return (
    <svg
      className={`lfr-icon lfr-icon--${severity}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      data-severity={severity}
    >
      {severity === 'safe' ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path
            d="M4.5 8.2l2.3 2.3 4.7-4.9"
            stroke="var(--lfr-surface)"
            strokeWidth="1.8"
            fill="none"
          />
        </>
      ) : severity === 'caution' ? (
        <>
          <path d="M8 1l7 13H1z" fill="currentColor" />
          <path d="M8 5.5v4" stroke="var(--lfr-surface)" strokeWidth="1.8" />
          <circle cx="8" cy="11.8" r="1" fill="var(--lfr-surface)" />
        </>
      ) : severity === 'danger' ? (
        <>
          <path d="M5 1h6l4 4v6l-4 4H5l-4-4V5z" fill="currentColor" />
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="var(--lfr-surface)" strokeWidth="1.8" />
        </>
      ) : severity === 'info' ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M8 7v4.5" stroke="var(--lfr-surface)" strokeWidth="1.8" />
          <circle cx="8" cy="4.6" r="1" fill="var(--lfr-surface)" />
        </>
      ) : (
        <>
          <rect x="1" y="1" width="14" height="14" rx="2" fill="currentColor" />
          <path d="M4 11.5h8M4 8h5M4 4.5h8" stroke="var(--lfr-surface)" strokeWidth="1.6" />
        </>
      )}
    </svg>
  );
}

/** Icon plus visible label, for example "⚠ Caution". */
export function SeverityTag({
  severity,
  label,
}: {
  readonly severity: Severity;
  /** Overrides the default label, for example "Likely unstable". */
  readonly label?: string;
}): JSX.Element {
  return (
    <span className={`lfr-tag lfr-tag--${severity}`}>
      <StatusIcon severity={severity} />
      <span>{label ?? SEVERITY_LABEL[severity]}</span>
    </span>
  );
}
