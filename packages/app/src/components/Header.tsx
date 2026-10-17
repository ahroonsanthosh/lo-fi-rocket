import type { JSX } from 'react';
import { Icon, Segmented, SEVERITY_ORDER, StatusIcon, type WarningItem } from '@lo-fi-rocket/ui';
import type { Storage } from '../state/autosave.js';
import { useStore } from '../state/store.js';
import { FilesMenu, type FileNotice } from './FilesMenu.js';

export interface HeaderProps {
  readonly storage: Storage | undefined;
  readonly warnings: readonly WarningItem[];
  readonly onSettings: () => void;
  readonly onNotice: (notice: FileNotice) => void;
  /** Opens the paste box (plan 0082). */
  readonly onClaude: () => void;
}

/**
 * The warning status in one short phrase: "All clear", or the count with
 * the most serious one's icon, linking to the list (redesign section 5).
 */
function WarningStatus({ warnings }: { readonly warnings: readonly WarningItem[] }): JSX.Element {
  const top = SEVERITY_ORDER.flatMap((s) => warnings.filter((w) => w.severity === s))[0];
  if (top === undefined) {
    return (
      <span className="status-pill status-pill--clear">
        <StatusIcon severity="safe" size={14} />
        All clear
      </span>
    );
  }
  const n = warnings.length;
  return (
    <a className={`status-pill status-pill--${top.severity}`} href="#warnings">
      <StatusIcon severity={top.severity} size={14} />
      {String(n)} {n === 1 ? 'warning' : 'warnings'}
    </a>
  );
}

/** The top bar: the design name, the warning status, units, settings, Build with Claude and the File menu. */
export function Header({
  storage,
  warnings,
  onSettings,
  onNotice,
  onClaude,
}: HeaderProps): JSX.Element {
  const { state, dispatch } = useStore();
  return (
    <div className="app-header">
      <h1 className="brand">Lo-Fi Rocket</h1>
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
      <div className="app-header__right">
        <WarningStatus warnings={warnings} />
        <Segmented
          legend="Units"
          name="units"
          value={state.units}
          options={[
            { value: 'metric', label: 'Metric' },
            { value: 'imperial', label: 'Imperial' },
          ]}
          onChange={(units) => {
            dispatch({ type: 'set-units', units });
          }}
        />
        <button type="button" className="icon-button" aria-label="Settings" onClick={onSettings}>
          <Icon name="settings" size={20} />
        </button>
        <button type="button" className="toolbar-button" onClick={onClaude}>
          Build with Claude
        </button>
        <FilesMenu storage={storage} onNotice={onNotice} />
      </div>
      {storage === undefined ? (
        <p className="save-state" role="status">
          Not saved: this browser’s storage is unavailable, so use File, Save.
        </p>
      ) : null}
    </div>
  );
}
