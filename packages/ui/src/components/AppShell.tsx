import type { JSX, ReactNode } from 'react';

export interface AppShellProps {
  /** Product name, design name, warning status, units, settings and the File menu. */
  readonly header: ReactNode;
  /** The rocket and the few figures that are always on screen. */
  readonly stage: ReactNode;
  readonly stageLabel?: string;
  /** Every current warning, in full; nothing when there is none. */
  readonly checks: ReactNode;
  readonly checksLabel?: string;
  /** The one task being done: the home list or the page of a part. */
  readonly main: ReactNode;
  /** Extra class on the page, for example to widen the task panel for flight results. */
  readonly className?: string;
}

/**
 * The page (docs/ui/simplify.md section 3): a top bar, the stage with
 * the rocket on the left, and on the right the warnings above the task
 * panel. A skip link leads past the header and the stage to the task
 * panel. Below 1100 px everything stacks in that order.
 */
export function AppShell(props: AppShellProps): JSX.Element {
  return (
    <div className={`lfr-shell${props.className === undefined ? '' : ` ${props.className}`}`}>
      <a className="lfr-skip-link" href="#lfr-main">
        Skip to the main view
      </a>
      <header className="lfr-shell__header">{props.header}</header>
      <section className="lfr-shell__stage" aria-label={props.stageLabel ?? 'Rocket'}>
        {props.stage}
      </section>
      <div className="lfr-shell__side">
        <aside
          className="lfr-shell__checks"
          aria-label={props.checksLabel ?? 'Checks and warnings'}
        >
          {props.checks}
        </aside>
        <main id="lfr-main" className="lfr-shell__main" tabIndex={-1}>
          {props.main}
        </main>
      </div>
    </div>
  );
}
