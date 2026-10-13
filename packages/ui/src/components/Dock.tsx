import type { JSX } from 'react';
import { Icon, type IconName } from './Icon.js';

export interface DockItem {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
}

export interface DockProps {
  /** Accessible name of the navigation, for example "Views". */
  readonly label: string;
  readonly items: readonly DockItem[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}

/**
 * The row of views at the foot of the main screen (the owner's reference
 * design): an icon with its name under it. A navigation, not tabs: each
 * button opens a view of the main screen and the open one is marked as
 * the current page, by weight and colour and to assistive technology.
 */
export function Dock({ label, items, selectedId, onSelect }: DockProps): JSX.Element {
  return (
    <nav className="lfr-dock" aria-label={label}>
      <ul className="lfr-dock__list">
        {items.map((item) => {
          const current = item.id === selectedId;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`lfr-dock__item${current ? ' is-current' : ''}`}
                aria-current={current ? 'page' : undefined}
                onClick={() => {
                  onSelect(item.id);
                }}
              >
                <Icon name={item.icon} />
                <span className="lfr-dock__label">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
