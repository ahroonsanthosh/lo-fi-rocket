import { useId, useState, type JSX, type ReactNode } from 'react';

export interface PanelProps {
  readonly title: ReactNode;
  /** Heading level of the title; 2 by default. */
  readonly level?: 2 | 3 | 4;
  /** Buttons or links shown at the right of the title. */
  readonly actions?: ReactNode;
  /** One line under the title, for example what the panel is for. */
  readonly description?: ReactNode;
  /**
   * Collapsible panels are for the "one click away" and "advanced" tiers
   * (docs/ui/redesign.md section 2). Never use one for a warning.
   */
  readonly collapsible?: boolean;
  /** Initial state of a collapsible panel; open by default. */
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

/** A titled region. Its heading names it for assistive technology. */
export function Panel(props: PanelProps): JSX.Element {
  const { title, level = 2, actions, description, collapsible = false, children } = props;
  const headingId = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  const H = `h${String(level)}` as 'h2' | 'h3' | 'h4';
  return (
    <section
      className={`lfr-panel${props.className === undefined ? '' : ` ${props.className}`}`}
      aria-labelledby={headingId}
    >
      <div className="lfr-panel__header">
        <H id={headingId} className="lfr-panel__title">
          {collapsible ? (
            <button
              type="button"
              className="lfr-panel__toggle"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => {
                setOpen((o) => !o);
              }}
            >
              <span className="lfr-panel__chevron" aria-hidden="true">
                {open ? '▾' : '▸'}
              </span>
              {title}
            </button>
          ) : (
            title
          )}
        </H>
        {actions === undefined ? null : <div className="lfr-panel__actions">{actions}</div>}
      </div>
      {description === undefined ? null : <p className="lfr-panel__description">{description}</p>}
      <div id={bodyId} className="lfr-panel__body" hidden={collapsible && !open}>
        {children}
      </div>
    </section>
  );
}
