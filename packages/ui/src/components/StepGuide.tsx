import type { JSX } from 'react';
import { Button } from './Button.js';
import { StatusIcon } from './severity.js';

export type StepStatus = 'done' | 'current' | 'todo' | 'attention';

export interface Step {
  readonly id: string;
  readonly label: string;
  /** Decided by the app, for example "done" once a nose cone exists. */
  readonly status: StepStatus;
  /** A short reason shown for "attention", for example "Rocket likely unstable". */
  readonly note?: string;
}

export interface StepGuideProps {
  readonly steps: readonly Step[];
  readonly currentId: string;
  readonly onSelect: (id: string) => void;
  /** Hides the numbered guide; every step stays reachable from the navigation. */
  readonly onHide: () => void;
}

const STATUS_TEXT: Readonly<Record<StepStatus, string>> = {
  done: 'done',
  current: 'current step',
  todo: 'not started',
  attention: 'needs attention',
};

/**
 * The guided path for new users: numbered steps in order, each a button
 * with its status in words and an icon. Any step can be opened at any
 * time; the guide never blocks. "Hide the guide" is for experienced users.
 */
export function StepGuide({ steps, currentId, onSelect, onHide }: StepGuideProps): JSX.Element {
  const index = steps.findIndex((s) => s.id === currentId);
  return (
    <div className="lfr-steps">
      <div className="lfr-steps__header">
        <p className="lfr-steps__progress">
          Step {String(index + 1)} of {String(steps.length)}
        </p>
        <Button variant="ghost" onClick={onHide}>
          Hide the guide
        </Button>
      </div>
      <ol className="lfr-steps__list">
        {steps.map((s, i) => {
          const current = s.id === currentId;
          return (
            <li key={s.id} className={`lfr-steps__item lfr-steps__item--${s.status}`}>
              <button
                type="button"
                className={`lfr-steps__button${current ? ' is-current' : ''}`}
                aria-current={current ? 'step' : undefined}
                onClick={() => {
                  onSelect(s.id);
                }}
              >
                <span className="lfr-steps__number" aria-hidden="true">
                  {s.status === 'done' ? (
                    <StatusIcon severity="safe" size={18} />
                  ) : s.status === 'attention' ? (
                    <StatusIcon severity="caution" size={18} />
                  ) : (
                    String(i + 1)
                  )}
                </span>
                <span className="lfr-steps__label">{s.label}</span>
                <span className="lfr-steps__status">
                  {s.status === 'attention' && s.note !== undefined
                    ? s.note
                    : STATUS_TEXT[s.status]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
