import type { JSX } from 'react';
import { Icon } from '@lo-fi-rocket/ui';
import type { Storage, Theme } from '../state/autosave.js';
import { useStore } from '../state/store.js';
import { FilesMenu, type FileNotice } from './FilesMenu.js';

export interface HeaderProps {
  readonly storage: Storage | undefined;
  readonly theme: Theme;
  readonly onTheme: (theme: Theme) => void;
  /** The open view's name, shown centred over the main column like the reference's title. */
  readonly title: string;
  readonly onNotice: (notice: FileNotice) => void;
}

/** A small rocket outline for the product mark; decorative. */
function Mark(): JSX.Element {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M12 2.6c2.7 2.2 4.1 5.3 4.1 9v5.4H7.9v-5.4c0-3.7 1.4-6.8 4.1-9z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7.9 13.2 5.2 15.9v3.5l2.7-1.7M16.1 13.2l2.7 2.7v3.5l-2.7-1.7M10.4 19.6 12 22l1.6-2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="12" cy="9.2" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** The top of the console: product and design name, the view title, theme and the File menu. */
export function Header({ storage, theme, onTheme, title, onNotice }: HeaderProps): JSX.Element {
  const { state, dispatch } = useStore();
  return (
    <div className="app-header">
      <div className="app-header__left">
        <div className="brand">
          <Mark />
          <h1>Lo-Fi Rocket</h1>
        </div>
        <label className="design-name">
          <span className="visually-hidden">Design name</span>
          <input
            type="text"
            aria-label="Design name"
            value={state.design.name}
            spellCheck={false}
            onChange={(e) => {
              dispatch({ type: 'rename', name: e.target.value });
            }}
          />
        </label>
      </div>
      <p className="console-title" aria-hidden="true">
        {title}
      </p>
      <div className="app-header__right">
        <button
          type="button"
          className="toolbar-button toolbar-button--icon"
          aria-pressed={theme === 'light'}
          title={theme === 'light' ? 'Light theme is on' : 'Light theme is off'}
          onClick={() => {
            onTheme(theme === 'dark' ? 'light' : 'dark');
          }}
        >
          <Icon name={theme === 'light' ? 'sun' : 'moon'} size={18} />
          <span>Light theme</span>
        </button>
        <FilesMenu storage={storage} onNotice={onNotice} />
      </div>
      {storage === undefined ? (
        <p className="save-state save-state--off" role="status">
          Not saved: this browser’s storage is unavailable, so use File, Save.
        </p>
      ) : null}
    </div>
  );
}
