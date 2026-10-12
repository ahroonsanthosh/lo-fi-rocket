import { useEffect, useMemo, useReducer, useState, type JSX } from 'react';
import { exampleDesign, type RocketDesign } from '@lo-fi-rocket/formats';
import { ComponentEditor } from './components/ComponentEditor.js';
import { ComponentList } from './components/ComponentList.js';
import { Header } from './components/Header.js';
import { RecoveryEditor } from './components/RecoveryEditor.js';
import { SideView } from './components/SideView.js';
import { computeFigures, MassPanel, StabilityPanel } from './components/StabilityPanel.js';
import {
  browserStorage,
  loadLastDesign,
  loadUnits,
  saveDesign,
  saveUnits,
  type Storage,
} from './state/autosave.js';
import { initialState, reduce } from './state/reducer.js';
import { StoreContext } from './state/store.js';

export interface AppProps {
  /** Injected in tests; the browser's local storage by default. */
  readonly storage?: Storage | undefined;
  readonly initialDesign?: RocketDesign;
}

const AUTOSAVE_DELAY_MS = 300;

export function App(props: AppProps): JSX.Element {
  const storage = props.storage ?? browserStorage();
  // Loaded once, on mount: the stored design (or the example), and a notice if the stored one was invalid.
  const [start] = useState(() => {
    const units = storage === undefined ? 'metric' : loadUnits(storage);
    if (props.initialDesign !== undefined) {
      return { state: initialState(props.initialDesign, units), notice: undefined };
    }
    const loaded = storage === undefined ? { kind: 'none' as const } : loadLastDesign(storage);
    if (loaded.kind === 'design')
      return { state: initialState(loaded.design, units), notice: undefined };
    const notice =
      loaded.kind === 'invalid'
        ? `The autosaved design could not be loaded and was kept aside under "recovered:${loaded.id}". ${loaded.message}`
        : undefined;
    return { state: initialState(exampleDesign(), units), notice };
  });
  const notice = start.notice;
  const [state, dispatch] = useReducer(reduce, start.state);

  // Autosave after each change.
  useEffect(() => {
    if (storage === undefined || state.revision === 0) return;
    const handle = setTimeout(() => {
      saveDesign(storage, state.design);
    }, AUTOSAVE_DELAY_MS);
    return () => {
      clearTimeout(handle);
    };
  }, [storage, state.design, state.revision]);
  useEffect(() => {
    if (storage !== undefined) saveUnits(storage, state.units);
  }, [storage, state.units]);

  const figures = useMemo(() => computeFigures(state.design), [state.design]);
  const selectedComponent = state.design.components.find((c) => c.id === state.selectedId);
  const selectedDevice = state.design.recovery.find((r) => r.id === state.selectedId);
  const store = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <StoreContext.Provider value={store}>
      <div className="app">
        <Header />
        {notice === undefined ? null : (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <main className="layout">
          <aside className="left">
            <ComponentList />
          </aside>
          <section className="centre" aria-label="Rocket">
            <SideView
              components={state.design.components}
              selectedId={state.selectedId}
              cg={figures.stability?.result.cgLiftoff}
              cp={figures.stability?.result.centreOfPressure.cp}
              onSelect={(id) => {
                dispatch({ type: 'select', id });
              }}
            />
            <div className="panels">
              <StabilityPanel figures={figures} />
              <MassPanel figures={figures} />
            </div>
          </section>
          <aside className="right">
            {selectedComponent !== undefined ? (
              <ComponentEditor key={selectedComponent.id} item={selectedComponent} />
            ) : selectedDevice !== undefined ? (
              <RecoveryEditor key={selectedDevice.id} device={selectedDevice} />
            ) : (
              <p className="muted">Select a component to edit it, or add one from the list.</p>
            )}
          </aside>
        </main>
      </div>
    </StoreContext.Provider>
  );
}
