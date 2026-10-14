import { useEffect, useMemo, useReducer, useState, type JSX } from 'react';
import {
  exampleDesign,
  type KeyValueStore,
  type RocketDesign,
  type Transport,
} from '@lo-fi-rocket/formats';
import {
  AppShell,
  Button,
  Dialog,
  GLOSSARY,
  Segmented,
  StabilityIndicator,
  WarningList,
  type WarningItem,
} from '@lo-fi-rocket/ui';
import { ComponentEditor } from './components/ComponentEditor.js';
import { AsBuiltEditor } from './components/AsBuiltEditor.js';
import { Header } from './components/Header.js';
import { FlightPanel, type FlightState } from './components/FlightPanel.js';
import { FlightPlots } from './components/FlightPlots.js';
import type { DispersionState } from './components/FlightViewer.js';
import type { FileNotice } from './components/FilesMenu.js';
import { LaunchEditor } from './components/LaunchEditor.js';
import { MotorPanel } from './components/MotorPanel.js';
import { RecoveryEditor } from './components/RecoveryEditor.js';
import { keyValueStore } from './motors/library.js';
import { browserServices, ServicesContext, type Services } from './state/services.js';
import { computeFigures, MassPanel, StabilityDetails } from './components/StabilityPanel.js';
import {
  browserStorage,
  loadLastDesign,
  loadTheme,
  loadUnits,
  saveDesign,
  saveTheme,
  saveUnits,
  type Storage,
  type Theme,
} from './state/autosave.js';
import { initialState, reduce } from './state/reducer.js';
import { StoreContext } from './state/store.js';
import {
  approximationItems,
  designWarningItems,
  flightWarningItems,
  splitMessage,
} from './layout/warnings.js';
import { stabilityProps } from './layout/stability.js';
import { emptyStepOf } from './layout/steps.js';
import { Home } from './layout/Home.js';
import { pageOf } from './layout/pages.js';
import { EmptyStep, InFlightChecks, Page } from './layout/panels.js';
import { Stage, type StageMode } from './layout/Stage.js';

export interface AppProps {
  /** Injected in tests; the browser's local storage by default. */
  readonly storage?: Storage | undefined;
  readonly initialDesign?: RocketDesign;
  /** Injected in tests: the ThrustCurve.org transport and the motor store. */
  readonly transport?: Transport;
  readonly motorStore?: KeyValueStore;
  readonly services?: Partial<Services>;
}

const AUTOSAVE_DELAY_MS = 300;

export function App(props: AppProps): JSX.Element {
  const storage = props.storage ?? browserStorage();
  const [services] = useState<Services>(() => {
    const base = browserServices(
      props.motorStore ??
        (storage === undefined ? undefined : keyValueStore(storage as globalThis.Storage)),
    );
    return {
      ...base,
      ...(props.transport === undefined ? {} : { transport: props.transport }),
      ...props.services,
    };
  });
  const [flight, setFlight] = useState<FlightState | undefined>(undefined);
  const [simError, setSimError] = useState<string | undefined>(undefined);
  const [dispersion, setDispersion] = useState<DispersionState | undefined>(undefined);
  const [fileNotices, setFileNotices] = useState<readonly (FileNotice & { id: number })[]>([]);
  const [theme, setTheme] = useState<Theme>(() =>
    storage === undefined ? 'auto' : loadTheme(storage),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stageMode, setStageMode] = useState<StageMode>('rocket');
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<string>>(new Set());
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
  // The theme follows the system unless the user picked one (D-UI-12).
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    if (storage !== undefined) saveTheme(storage, theme);
  }, [storage, theme]);
  // Results belong to a design (redesign section 2): replacing the design clears them.
  const designId = state.design.id;
  useEffect(() => {
    setFlight((f) => (f === undefined || f.design.id === designId ? f : undefined));
    setDispersion(undefined);
    setSimError(undefined);
  }, [designId]);

  const figures = useMemo(() => computeFigures(state.design), [state.design]);
  const selectedComponent = state.design.components.find((c) => c.id === state.selectedId);
  const selectedDevice = state.design.recovery.find((r) => r.id === state.selectedId);
  // Opening a part shows the rocket, not the replay, so the edit can be seen.
  const editingPart = selectedComponent !== undefined;
  useEffect(() => {
    if (editingPart) setStageMode('rocket');
  }, [editingPart, state.selectedId]);
  const store = useMemo(() => ({ state, dispatch }), [state]);
  const flightCurrent = flight?.design === state.design;
  const stale = flight !== undefined && !flightCurrent;
  const page = pageOf(state.selectedId, state.design);
  const open = (id: string | undefined): void => {
    dispatch({ type: 'select', id });
  };

  const warnings = useMemo((): WarningItem[] => {
    const out: WarningItem[] = [];
    if (notice !== undefined) {
      out.push({
        id: 'autosave',
        severity: 'info',
        title: 'The autosaved design could not be loaded',
        reason: notice,
        origin: 'Autosave',
      });
    }
    for (const n of fileNotices) {
      // A file notice is one or more sentences: the first is the title, the rest the detail.
      const i = n.text.indexOf('. ');
      out.push(
        n.kind === 'error'
          ? {
              id: `file-${String(n.id)}`,
              severity: 'caution',
              title: 'The file could not be read',
              reason: n.text,
              origin: 'File',
            }
          : {
              id: `file-${String(n.id)}`,
              severity: 'info',
              title: i < 0 ? n.text : n.text.slice(0, i + 1),
              reason: i < 0 ? '' : n.text.slice(i + 2),
              origin: 'File',
            },
      );
    }
    if (simError !== undefined) {
      out.push({
        id: 'simulation-error',
        severity: 'danger',
        title: 'The simulation could not run',
        reason: simError,
        origin: 'Flight',
      });
    }
    const designItems = designWarningItems(state.design, state.units);
    out.push(...designItems);
    if (flight !== undefined) {
      if (stale) {
        out.push({
          id: 'stale',
          severity: 'info',
          ...splitMessage(
            'Results are out of date: the design or the launch conditions changed since this flight was simulated; run it again to update.',
          ),
          origin: 'Flight',
        });
      }
      out.push(
        ...flightWarningItems(
          flight.design,
          flight.result,
          designItems.some((w) => w.id === 'no-recovery'),
        ),
        ...approximationItems(flight.result),
      );
    }
    return out.map((w) => (acknowledged.has(w.id) ? { ...w, acknowledged: true } : w));
  }, [notice, fileNotices, simError, state.design, state.units, flight, stale, acknowledged]);

  const stability = stabilityProps(figures, state.design.stabilityThresholds);
  const back = (): void => {
    open(undefined);
  };
  const emptyStep = emptyStepOf(state.selectedId);

  const content = ((): JSX.Element => {
    switch (page) {
      case 'home':
        return <Home figures={figures} onOpen={open} />;
      case 'part':
        return (
          <Page onBack={back}>
            {selectedComponent === undefined ? null : (
              <ComponentEditor key={selectedComponent.id} item={selectedComponent} />
            )}
          </Page>
        );
      case 'add-part':
        return (
          <Page onBack={back}>
            {emptyStep === undefined ? null : <EmptyStep step={emptyStep} />}
          </Page>
        );
      case 'motor':
        return (
          <Page onBack={back}>
            <MotorPanel />
          </Page>
        );
      case 'recovery':
        return (
          <Page onBack={back}>
            {selectedDevice === undefined ? null : (
              <RecoveryEditor key={selectedDevice.id} device={selectedDevice} />
            )}
          </Page>
        );
      case 'launch':
        return (
          <Page onBack={back}>
            <section className="editor" aria-label="Launch">
              <h2>Launch</h2>
              <LaunchEditor />
            </section>
          </Page>
        );
      case 'stability':
        return (
          <Page onBack={back}>
            <h2 className="page-title">Stability and mass</h2>
            <StabilityIndicator
              {...stability}
              {...(stability.state === 'ready'
                ? { details: <StabilityDetails figures={figures} /> }
                : {})}
            />
            <InFlightChecks flight={flight} stale={stale} />
            <MassPanel figures={figures} />
            <AsBuiltEditor />
          </Page>
        );
      case 'flight':
        return (
          <Page onBack={back}>
            <FlightPanel
              flight={flight}
              onFlight={(f) => {
                setFlight(f);
                // A new flight is shown as its replay; the rocket is one switch away.
                if (f !== undefined) setStageMode('replay');
              }}
              onError={setSimError}
              error={simError}
              dispersion={dispersion}
              onDispersion={setDispersion}
              plots={
                flight === undefined ? null : (
                  <div className="flight-section">
                    <h3>Plots</h3>
                    <FlightPlots
                      result={flight.result}
                      units={state.units}
                      recorded={state.design.recordedFlight}
                    />
                  </div>
                )
              }
            />
          </Page>
        );
    }
  })();

  return (
    <StoreContext.Provider value={store}>
      <ServicesContext.Provider value={services}>
        <AppShell
          {...(page === 'flight' ? { className: 'is-wide' } : {})}
          header={
            <Header
              storage={storage}
              warnings={warnings}
              onSettings={() => {
                setSettingsOpen(true);
              }}
              onNotice={(n) => {
                setFileNotices((list) => [...list, { ...n, id: list.length }]);
              }}
            />
          }
          stage={
            <Stage
              figures={figures}
              design={state.design}
              flight={flight}
              stale={stale}
              dispersion={dispersion}
              mode={stageMode}
              onMode={setStageMode}
            />
          }
          checks={
            warnings.length === 0 ? null : (
              <div id="warnings">
                <WarningList
                  warnings={warnings}
                  onAcknowledge={(id) => {
                    setAcknowledged((a) => new Set([...a, id]));
                  }}
                />
              </div>
            )
          }
          main={content}
        />
        <Dialog
          open={settingsOpen}
          title="Settings"
          description="How the app looks, and what every term in it means."
          onClose={() => {
            setSettingsOpen(false);
          }}
          actions={
            <Button
              variant="primary"
              onClick={() => {
                setSettingsOpen(false);
              }}
            >
              Done
            </Button>
          }
        >
          <div className="settings-row">
            <span className="settings-row__label">Appearance</span>
            <Segmented
              legend="Appearance"
              name="theme"
              value={theme}
              options={[
                { value: 'auto', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              onChange={setTheme}
            />
          </div>
          <h3 className="settings-heading">Glossary</h3>
          <dl className="glossary">
            {Object.values(GLOSSARY).map((g) => (
              <div key={g.term} className="glossary__entry">
                <dt>{g.name}</dt>
                <dd>
                  {g.meaning}
                  <span className="glossary__good">Good value: {g.goodValue}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Dialog>
      </ServicesContext.Provider>
    </StoreContext.Provider>
  );
}
