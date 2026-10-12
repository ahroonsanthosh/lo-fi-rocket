import type { JSX } from 'react';
import { FIGURE_DISPLAY, formatFixed, isDisplayable } from '../format/display-rules.js';
import { SeverityTag, type Severity } from './severity.js';
import { Term } from './Tooltip.js';

/** The assessment the app computed; this component never decides it. */
export type StabilityLevel = 'unstable' | 'typical' | 'overstable';

export interface StabilityPoint {
  /** Margin in calibers, as computed by the physics. */
  readonly margin: number;
  readonly level: StabilityLevel;
  /** The physics package's plain-language assessment, shown word for word. */
  readonly message: string;
}

export interface StabilityThresholds {
  readonly unstableBelow: number;
  readonly overstableAbove: number;
}

export type StabilityIndicatorProps =
  | {
      readonly state: 'ready';
      readonly liftoff: StabilityPoint;
      /** Undefined when no motor is selected (then liftoff is the motorless figure). */
      readonly burnout: StabilityPoint | undefined;
      readonly thresholds: StabilityThresholds;
      /** The Mach number the static figures are computed at. */
      readonly mach: number;
      /** Compact form for the always-visible status bar. */
      readonly compact?: boolean;
    }
  | { readonly state: 'empty'; readonly compact?: boolean }
  | { readonly state: 'error'; readonly message: string; readonly compact?: boolean };

const LEVEL_SEVERITY: Readonly<Record<StabilityLevel, Severity>> = {
  unstable: 'danger',
  typical: 'safe',
  overstable: 'caution',
};

const LEVEL_LABEL: Readonly<Record<StabilityLevel, string>> = {
  unstable: 'Likely unstable',
  typical: 'Typical range',
  overstable: 'May be overstable',
};

const ZONES: readonly StabilityLevel[] = ['unstable', 'typical', 'overstable'];

function Margin({ value }: { readonly value: number }): JSX.Element {
  const text = formatFixed(value, FIGURE_DISPLAY.stabilityMargin.decimals);
  return isDisplayable(value) ? (
    <>{text}</>
  ) : (
    <span className="lfr-nonfinite">{text} (not a finite number)</span>
  );
}

/** Three labelled zones with the given level marked; nothing is positioned by value. */
function Scale({
  label,
  level,
  thresholds,
}: {
  readonly label: string;
  readonly level: StabilityLevel;
  readonly thresholds: StabilityThresholds;
}): JSX.Element {
  const lo = String(thresholds.unstableBelow);
  const hi = String(thresholds.overstableAbove);
  const zoneText: Readonly<Record<StabilityLevel, string>> = {
    unstable: `below ${lo}`,
    typical: `${lo} to ${hi}`,
    overstable: `above ${hi}`,
  };
  return (
    <div className="lfr-stability__scale" role="group" aria-label={`${label}: stability zone`}>
      <span className="lfr-stability__scale-label">{label}</span>
      <ol className="lfr-stability__zones">
        {ZONES.map((z) => (
          <li
            key={z}
            className={`lfr-stability__zone lfr-stability__zone--${z}${z === level ? ' is-current' : ''}`}
            aria-current={z === level ? 'true' : undefined}
          >
            {z === level ? (
              <span className="lfr-stability__pointer" aria-hidden="true">
                ▼
              </span>
            ) : null}
            <span>{zoneText[z]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The stability margin with its assessment (CLAUDE.md 9): the number, a
 * status tag with icon and words, the physics' own guidance sentence, and
 * the zones of the configurable thresholds labelled as rules of thumb.
 * Liftoff and burnout are both shown, each with its own status, so a
 * change at burnout is never carried only by the liftoff colour.
 */
export function StabilityIndicator(props: StabilityIndicatorProps): JSX.Element {
  const compact = props.compact ?? false;
  if (props.state === 'empty') {
    return (
      <section className="lfr-stability lfr-stability--empty" aria-label="Stability">
        <span className="lfr-stability__heading">
          <Term k="stabilityMargin">Stability</Term>
        </span>
        <p className="lfr-stability__message">
          Add a nose cone, a body tube and fins to see the stability margin.
        </p>
      </section>
    );
  }
  if (props.state === 'error') {
    return (
      <section className="lfr-stability lfr-stability--danger" aria-label="Stability">
        <span className="lfr-stability__heading">
          <Term k="stabilityMargin">Stability</Term>
        </span>
        <SeverityTag severity="danger" label="Cannot compute" />
        <p className="lfr-stability__message">{props.message}</p>
      </section>
    );
  }
  const { liftoff, burnout, thresholds, mach } = props;
  const severity = LEVEL_SEVERITY[liftoff.level];
  const burnoutSeverity = burnout === undefined ? undefined : LEVEL_SEVERITY[burnout.level];
  // The card takes the more serious of the two states, so a problem at burnout shows in the frame too.
  const frame =
    burnoutSeverity === 'danger' || severity === 'danger'
      ? 'danger'
      : burnoutSeverity === 'caution' || severity === 'caution'
        ? 'caution'
        : 'safe';
  const unit = FIGURE_DISPLAY.stabilityMargin.unit;
  return (
    <section
      className={`lfr-stability lfr-stability--${frame}${compact ? ' lfr-stability--compact' : ''}`}
      aria-label="Stability"
    >
      <span className="lfr-stability__heading">
        <Term k="stabilityMargin">Stability margin</Term>{' '}
        <span className="lfr-stability__mach">
          at <Term k="mach">Mach</Term> {String(mach)}
        </span>
      </span>
      <div className="lfr-stability__row">
        <p className="lfr-stability__figure">
          <span className="lfr-stability__number">
            <Margin value={liftoff.margin} />
          </span>{' '}
          <Term k="calibers">{unit}</Term>{' '}
          {burnout === undefined ? '(no motor selected)' : 'at liftoff'}
        </p>
        <SeverityTag severity={severity} label={LEVEL_LABEL[liftoff.level]} />
      </div>
      {burnout === undefined ? null : (
        <div className="lfr-stability__row">
          <p className="lfr-stability__figure lfr-stability__figure--secondary">
            <Margin value={burnout.margin} /> {unit} at burnout
          </p>
          <SeverityTag
            severity={LEVEL_SEVERITY[burnout.level]}
            label={LEVEL_LABEL[burnout.level]}
          />
        </div>
      )}
      {compact ? null : (
        <>
          <p className="lfr-stability__message">{liftoff.message}</p>
          {burnout === undefined || burnout.level === liftoff.level ? null : (
            <p className="lfr-stability__message">At burnout: {burnout.message}</p>
          )}
          <Scale label="Liftoff" level={liftoff.level} thresholds={thresholds} />
          {burnout === undefined ? null : (
            <Scale label="Burnout" level={burnout.level} thresholds={thresholds} />
          )}
          <p className="lfr-stability__note">
            The thresholds {String(thresholds.unstableBelow)} and{' '}
            {String(thresholds.overstableAbove)} {unit} are rules of thumb, not guarantees.
          </p>
        </>
      )}
    </section>
  );
}
