import {
  DESIGN_FILE_EXTENSION,
  exampleDesign,
  newDesign,
  newId,
  orkToDesign,
  parseDesign,
  parseOrk,
  serializeDesign,
} from '@lo-fi-rocket/formats';
import { useId, useState, type JSX } from 'react';
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

/** Save, open, switch between stored designs, import OpenRocket files (plan 0015). */
export function FilesMenu({ storage }: { readonly storage: Storage | undefined }): JSX.Element {
  const { state, dispatch } = useStore();
  const services = useServices();
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [listOpen, setListOpen] = useState(false);
  const openId = useId();
  const orkId = useId();

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
      setNotice(errorText(e));
    }
  };
  const importOrk = async (file: File): Promise<void> => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const rocket = parseOrk(bytes, file.name);
      const library = [
        ...bundledMotors(),
        ...(services.motorStore === undefined ? [] : storedMotors(services.motorStore).motors),
      ];
      const { design, notices } = orkToDesign(rocket, library, newId(), () => newId());
      dispatch({ type: 'replace-design', design });
      setNotice(
        [`Imported ${file.name} (OpenRocket ${rocket.formatVersion}).`, ...notices].join(' '),
      );
    } catch (e) {
      setNotice(errorText(e));
    }
  };
  const stored = listOpen && storage !== undefined ? listStoredDesigns(storage) : [];

  return (
    <div className="files-menu">
      <div className="header-actions">
        <button type="button" onClick={save}>
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
          }}
        >
          New
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'replace-design', design: exampleDesign(newId()) });
          }}
        >
          Load example
        </button>
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
                      dispatch({ type: 'replace-design', design: loadStoredDesign(storage, d.id) });
                      setListOpen(false);
                    } catch (e) {
                      setNotice(errorText(e));
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
      {notice === undefined ? null : (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
