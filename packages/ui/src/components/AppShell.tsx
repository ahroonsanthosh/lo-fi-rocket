import type { JSX, ReactNode } from 'react';

export interface AppShellProps {
  /** Product name, design name, file menu, units and theme toggles. */
  readonly header: ReactNode;
  /** Always visible on every screen: stability, key results, warning counts. */
  readonly statusBar: ReactNode;
  /** The guided path and the component list. */
  readonly navigation: ReactNode;
  readonly navigationLabel?: string;
  /** The current step's view. */
  readonly main: ReactNode;
  /** Always visible: the full stability card, every warning, the in-flight checks. */
  readonly checks: ReactNode;
  readonly checksLabel?: string;
}

/**
 * The page layout (docs/ui/redesign.md section 2): header, a status bar
 * that never scrolls away, then navigation, the main view and the checks
 * column. A skip link leads past the header and navigation to the main
 * view. Below 1100 px the columns stack with the checks directly after
 * the status bar, never at the bottom.
 */
export function AppShell(props: AppShellProps): JSX.Element {
  return (
    <div className="lfr-shell">
      <a className="lfr-skip-link" href="#lfr-main">
        Skip to the main view
      </a>
      <header className="lfr-shell__header">{props.header}</header>
      <div className="lfr-shell__status" role="region" aria-label="Status">
        {props.statusBar}
      </div>
      <div className="lfr-shell__body">
        <nav className="lfr-shell__nav" aria-label={props.navigationLabel ?? 'Design steps'}>
          {props.navigation}
        </nav>
        <main id="lfr-main" className="lfr-shell__main" tabIndex={-1}>
          {props.main}
        </main>
        <aside
          className="lfr-shell__checks"
          aria-label={props.checksLabel ?? 'Checks and warnings'}
        >
          {props.checks}
        </aside>
      </div>
    </div>
  );
}

export interface StatusItemProps {
  readonly label: ReactNode;
  readonly children: ReactNode;
}

/** One labelled figure in the status bar. */
export function StatusItem({ label, children }: StatusItemProps): JSX.Element {
  return (
    <div className="lfr-status-item">
      <span className="lfr-status-item__label">{label}</span>
      <span className="lfr-status-item__value">{children}</span>
    </div>
  );
}
