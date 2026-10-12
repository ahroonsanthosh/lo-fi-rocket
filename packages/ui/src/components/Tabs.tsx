import { useId, useRef, type JSX, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly panel: ReactNode;
  readonly disabled?: boolean;
}

export interface TabsProps {
  /** Accessible name of the tab list. */
  readonly label: string;
  readonly tabs: readonly TabItem[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}

/**
 * WAI-ARIA tabs with automatic activation: Left and Right move between
 * tabs (wrapping), Home and End jump to the ends, Tab moves into the
 * panel. Only the selected tab is in the Tab order. Labels wrap instead
 * of overflowing the panel.
 */
export function Tabs({ label, tabs, selectedId, onSelect }: TabsProps): JSX.Element {
  const base = useId();
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const enabled = tabs.filter((t) => t.disabled !== true);

  const move = (e: KeyboardEvent<HTMLDivElement>): void => {
    const i = enabled.findIndex((t) => t.id === selectedId);
    let next: TabItem | undefined;
    if (e.key === 'ArrowRight') next = enabled[(i + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(i - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next === undefined) return;
    e.preventDefault();
    onSelect(next.id);
    refs.current.get(next.id)?.focus();
  };

  return (
    <div className="lfr-tabs">
      <div role="tablist" aria-label={label} className="lfr-tabs__list" onKeyDown={move}>
        {tabs.map((t) => {
          const selected = t.id === selectedId;
          return (
            <button
              key={t.id}
              ref={(el) => {
                if (el === null) refs.current.delete(t.id);
                else refs.current.set(t.id, el);
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={t.disabled ?? false}
              className={`lfr-tabs__tab${selected ? ' is-selected' : ''}`}
              onClick={() => {
                onSelect(t.id);
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={t.id !== selectedId}
          tabIndex={0}
          className="lfr-tabs__panel"
        >
          {t.id === selectedId ? t.panel : null}
        </div>
      ))}
    </div>
  );
}
