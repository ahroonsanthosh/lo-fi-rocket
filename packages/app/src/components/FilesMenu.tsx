import {
  DESIGN_FILE_EXTENSION,
  exampleDesign,
  importCdx1,
  MAX_INPUT_BYTES,
  newDesign,
  newId,
  orkToDesign,
  parseDesign,
  parseOrk,
  requireWithin,
  serializeDesign,
} from '@lo-fi-rocket/formats';
import { Icon } from '@lo-fi-rocket/ui';
import { useEffect, useId, useRef, useState, type JSX } from 'react';
import { bundledMotors, storedMotors } from '../motors/library.js';
import {
  deleteStoredDesign,
  listStoredDesigns,
  loadStoredDesign,
  type Storage,
} from '../state/autosave.js';
import { useServices } from '../state/services.js';
import { useStore } from '../state/store.js';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** What a file action reports: a note (opened, imported) or a failure, shown in the checks column. */
export interface FileNotice {
  readonly kind: 'note' | 'error';
  readonly text: string;
}

export interface FilesMenuProps {
  readonly storage: Storage | undefined;
  readonly onNotice: (notice: FileNotice) => void;
}

/** An imported design's recorded apogee, in metres and feet (RASAero files are in feet). */
function apogeeText(m: number): string {
  return `${Math.round(m).toLocaleString('en-US')} m (${Math.round(m / 0.3048).toLocaleString('en-US')} ft)`;
}

/**
 * Save, open, switch between stored designs, import OpenRocket files (plan 0015) and RASAero II
 * files (plan 0075), behind a File menu.
 */
export function FilesMenu({ storage, onNotice }: FilesMenuProps): JSX.Element {
  const { state, dispatch } = useStore();
  const services = useServices();
  const setNotice = (text: string, kind: FileNotice['kind'] = 'note'): void => {
    onNotice({ kind, text });
  };
  const [listOpen, setListOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const openId = useId();
  const orkId = useId();
  const cdxId = useId();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = (): void => {
    setMenuOpen(false);
    setListOpen(false);
  };
  // The menu closes on a click outside it and on Escape, which returns focus to the File button.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent): void => {
      if (e.target instanceof Node && rootRef.current?.contains(e.target) !== true) close();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const save = (): void => {
    const name = state.design.name.trim() === '' ? 'rocket' : state.design.name.trim();
    services.saveFile(
      `${name}${DESIGN_FILE_EXTENSION}`,
      serializeDesign(state.design),
      'application/json',
    );
  };
  const open = async (file: File): Promise<void> => {
    try {
      const design = parseDesign(await services.readFile(file), file.name);
      dispatch({ type: 'replace-design', design });
      setNotice(`Opened ${file.name}.`);
    } catch (e) {
      setNotice(errorText(e), 'error');
    }
  };
  const library = (): ReturnType<typeof bundledMotors> => [
    ...bundledMotors(),
    ...(services.motorStore === undefined ? [] : storedMotors(services.motorStore).motors),
  ];
  const importOrk = async (file: File): Promise<void> => {
    try {
      requireWithin(file.name, file.size, MAX_INPUT_BYTES);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const rocket = parseOrk(bytes, file.name);
      const { design, notices } = orkToDesign(rocket, library(), newId(), () => newId());
      dispatch({ type: 'replace-design', design });
      setNotice(
        [`Imported ${file.name} (OpenRocket ${rocket.formatVersion}).`, ...notices].join(' '),
      );
    } catch (e) {
      setNotice(errorText(e), 'error');
    }
  };
  const importCdx = async (file: File): Promise<void> => {
    try {
      const imported = importCdx1(await services.readFile(file), library(), newId(), file.name);
      dispatch({ type: 'replace-design', design: imported.design });
      const recorded = [
        ...(imported.prediction === undefined
          ? []
          : [`RASAero II predicted an apogee of ${apogeeText(imported.prediction.apogee)}.`]),
        ...(imported.measuredApogee === undefined
          ? []
          : [`The file’s notes give a flown apogee of ${apogeeText(imported.measuredApogee)}.`]),
      ];
      setNotice(
        [`Imported ${file.name} (RASAero II).`, ...imported.notices, ...recorded].join(' '),
      );
    } catch (e) {
      setNotice(errorText(e), 'error');
    }
  };
  const stored = listOpen && storage !== undefined ? listStoredDesigns(storage) : [];

  return (
    <div className="files-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="toolbar-button"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => {
          if (menuOpen) close();
          else setMenuOpen(true);
        }}
      >
        <Icon name="file" size={18} />
        File
        <Icon name="chevron" size={16} />
      </button>
      <div id={menuId} className="file-menu" hidden={!menuOpen}>
        <div className="header-actions">
          <button
            type="button"
            onClick={() => {
              save();
              close();
            }}
          >
            Save
          </button>
          <label className="file-button" htmlFor={openId}>
            Open
          </label>
          <input
            id={openId}
            type="file"
            accept=".json"
            aria-label="Open a design file"
            className="visually-hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f !== undefined) void open(f);
              e.target.value = '';
              close();
            }}
          />
          <label className="file-button" htmlFor={orkId}>
            Import .ork
          </label>
          <input
            id={orkId}
            type="file"
            accept=".ork,.xml"
            aria-label="Import an OpenRocket file"
            className="visually-hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f !== undefined) void importOrk(f);
              e.target.value = '';
              close();
            }}
          />
          <label className="file-button" htmlFor={cdxId}>
            Import RASAero
          </label>
          <input
            id={cdxId}
            type="file"
            accept=".cdx1,.CDX1"
            aria-label="Import a RASAero II file"
            className="visually-hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f !== undefined) void importCdx(f);
              e.target.value = '';
              close();
            }}
          />
          <button
            type="button"
            aria-expanded={listOpen}
            onClick={() => {
              setListOpen((v) => !v);
            }}
          >
            Designs
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'replace-design', design: newDesign(newId(), 'New rocket') });
              close();
            }}
          >
            New
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'replace-design', design: exampleDesign(newId()) });
              close();
            }}
          >
            Load example
          </button>
          <a className="file-button" href="claude.html">
            Use with Claude
          </a>
        </div>
        {listOpen ? (
          <ul className="design-list" aria-label="Stored designs">
            {stored.length === 0 ? (
              <li className="muted">No designs stored in this browser yet.</li>
            ) : null}
            {stored.map((d) => (
              <li key={d.id}>
                <span>
                  {d.name}
                  {d.id === state.design.id ? ' (current)' : ''}
                </span>
                <span>
                  <button
                    type="button"
                    aria-label={`Open ${d.name}`}
                    disabled={storage === undefined || d.id === state.design.id}
                    onClick={() => {
                      if (storage === undefined) return;
                      try {
                        dispatch({
                          type: 'replace-design',
                          design: loadStoredDesign(storage, d.id),
                        });
                        close();
                      } catch (e) {
                        setNotice(errorText(e), 'error');
                      }
                    }}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="danger"
                    aria-label={`Delete ${d.name}`}
                    disabled={storage === undefined || d.id === state.design.id}
                    onClick={() => {
                      if (storage !== undefined) deleteStoredDesign(storage, d.id);
                      setListOpen(false);
                      setListOpen(true);
                    }}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
