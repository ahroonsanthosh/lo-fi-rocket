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
  Dock,
  GLOSSARY,
  Segmented,
  StabilityIndicator,
  StepGuide,
  WarningList,
  type DockItem,
  type WarningItem,
} from '@lo-fi-rocket/ui';
import { ComponentEditor } from './components/ComponentEditor.js';
import { ComponentList } from './components/ComponentList.js';
import { Header } from './components/Header.js';
import { FLIGHT_SELECTION_ID, FlightPanel, type FlightState } from './components/FlightPanel.js';
import { FlightPlots } from './components/FlightPlots.js';
import { FlightViewer, type DispersionState } from './components/FlightViewer.js';
import type { FileNotice } from './components/FilesMenu.js';
import { LaunchEditor } from './components/LaunchEditor.js';
import { MOTOR_SELECTION_ID, MotorPanel } from './components/MotorPanel.js';
import { RecoveryEditor } from './components/RecoveryEditor.js';
import { keyValueStore } from './motors/library.js';
import { browserServices, ServicesContext, type Services } from './state/services.js';
import { SideView } from './components/SideView.js';
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
import { designWarningItems, flightWarningItems, splitMessage } from './layout/warnings.js';
import { stabilityProps } from './layout/stability.js';
import {
  EMPTY_STEP_PREFIX,
  LAUNCH_TARGET,
  STEP_ORDER,
  stepOf,
  steps,
  stepTarget,
  type StepId,
} from './layout/steps.js';
import { EmptyStep, InFlightChecks, StepStrip, Telemetry } from './layout/panels.js';
import { Overview } from './layout/Overview.js';
import { isView, viewOf, VIEW_TITLE, type View } from './layout/views.js';

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
const GUIDE_KEY = 'lofi-rocket:guide-hidden';

/** The views of the main screen, in the dock at its foot (the reference's icon row). */
const DOCK: readonly DockItem[] = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'airframe', label: 'Airframe', icon: 'airframe' },
  { id: 'motor', label: 'Motor', icon: 'motor' },
  { id: 'recovery', label: 'Recovery', icon: 'recovery' },
  { id: 'launch', label: 'Launch', icon: 'launch' },
  { id: 'flight', label: 'Flight', icon: 'flight' },
];

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
    storage === undefined ? 'dark' : loadTheme(storage),
  );
  const [guideHidden, setGuideHidden] = useState(() => storage?.getItem(GUIDE_KEY) === 'true');
  const [moreOpen, setMoreOpen] = useState(false);
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
  const [view, setView] = useState<View>('overview');

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
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (storage !== undefined) saveTheme(storage, theme);
  }, [storage, theme]);
  // Results belong to a design (redesign section 2): replacing the design clears them.
  const designId = state.design.id;
  useEffect(() => {
    setFlight((f) => (f === undefined || f.design.id === designId ? f : undefined));
    setDispersion(undefined);
    setSimError(undefined);
  }, [designId]);
  // A new selection opens the view it belongs to; editing the selected part does not move the view.
  // The effect runs only when the selection changes, and sees the design of that render.
  const selectedId = state.selectedId;
  const designNow = state.design;
  useEffect(() => {
    const v = viewOf(selectedId, designNow);
    if (v !== undefined) setView(v);
  }, [selectedId]);

  const figures = useMemo(() => computeFigures(state.design), [state.design]);
  const selectedComponent = state.design.components.find((c) => c.id === state.selectedId);
  const selectedDevice = state.design.recovery.find((r) => r.id === state.selectedId);
  const store = useMemo(() => ({ state, dispatch }), [state]);
  const flightCurrent = flight?.design === state.design;
  const stale = flight !== undefined && !flightCurrent;

  const step = stepOf(state.selectedId, state.design);
  const [lastStep, setLastStep] = useState<StepId>('body');
  useEffect(() => {
    if (step !== undefined) setLastStep(step);
  }, [step]);
  const currentStep = step ?? lastStep;
  const stepList = steps(
    { design: state.design, liftoffLevel: figures.stability?.liftoff.level, flightCurrent },
    currentStep,
  );
  const openStep = (id: string): void => {
    const s = STEP_ORDER.find((x) => x === id);
    if (s === undefined) return;
    const target = stepTarget(s, state.design);
    dispatch({ type: 'select', id: target });
    const v = viewOf(target, state.design);
    if (v !== undefined) setView(v);
  };
  const openView = (id: string): void => {
    if (!isView(id)) return;
    setView(id);
    const d = state.design;
    const sel = state.selectedId;
    if (id === 'motor') dispatch({ type: 'select', id: MOTOR_SELECTION_ID });
    else if (id === 'flight') dispatch({ type: 'select', id: FLIGHT_SELECTION_ID });
    else if (id === 'launch') dispatch({ type: 'select', id: LAUNCH_TARGET });
    else if (id === 'recovery' && !d.recovery.some((r) => r.id === sel))
      dispatch({ type: 'select', id: d.recovery[0]?.id ?? `${EMPTY_STEP_PREFIX}recovery` });
    else if (id === 'airframe' && !d.components.some((c) => c.id === sel))
      dispatch({ type: 'select', id: d.components[0]?.id ?? `${EMPTY_STEP_PREFIX}body` });
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
      );
    }
    return out.map((w) => (acknowledged.has(w.id) ? { ...w, acknowledged: true } : w));
  }, [notice, fileNotices, simError, state.design, state.units, flight, stale, acknowledged]);

  const thresholds = state.design.stabilityThresholds;
  const stability = stabilityProps(figures, thresholds);
  const onSelectPart = (id: string): void => {
    dispatch({ type: 'select', id });
  };

  const stepStrip = step === undefined ? null : <StepStrip step={step} onOpen={openStep} />;
  const content = ((): JSX.Element => {
    switch (view) {
      case 'overview':
        return (
          <Overview
            figures={figures}
            design={state.design}
            units={state.units}
            flight={flight}
            stale={stale}
            selectedId={state.selectedId}
            onSelect={onSelectPart}
            onStart={() => {
              openStep('body');
            }}
          />
        );
      case 'airframe':
        return (
          <>
            <div className="view-frame">
              <SideView
                components={state.design.components}
                selectedId={state.selectedId}
                cg={figures.stability?.result.cgLiftoff}
                cp={figures.stability?.result.centreOfPressure.cp}
                onSelect={onSelectPart}
              />
              <p className="view-legend">
                <span className="legend-key legend-key--cg" aria-hidden="true" /> CG, centre of
                gravity <span className="legend-key legend-key--cp" aria-hidden="true" /> CP, centre
                of pressure. Distances from the nose tip.
              </p>
            </div>
            <section className="view-card" aria-label="Editor">
              {stepStrip}
              {selectedComponent !== undefined ? (
                <ComponentEditor key={selectedComponent.id} item={selectedComponent} />
              ) : step !== undefined && state.selectedId?.startsWith(EMPTY_STEP_PREFIX) === true ? (
                <EmptyStep step={step} />
              ) : (
                <p className="muted">
                  Select a part in the parts list or on the drawing to edit it.
                </p>
              )}
            </section>
          </>
        );
      case 'motor':
        return (
          <section className="view-card" aria-label="Editor">
            {stepStrip}
            <MotorPanel />
          </section>
        );
      case 'recovery':
        return (
          <section className="view-card" aria-label="Editor">
            {stepStrip}
            {selectedDevice !== undefined ? (
              <RecoveryEditor key={selectedDevice.id} device={selectedDevice} />
            ) : (
              <EmptyStep step="recovery" />
            )}
          </section>
        );
      case 'launch':
        return (
          <section className="view-card" aria-label="Editor">
            {stepStrip}
            <section className="editor" aria-label="Launch">
              <LaunchEditor />
            </section>
          </section>
        );
      case 'flight':
        return (
          <section className="view-card" aria-label="Editor">
            {stepStrip}
            <FlightPanel
              flight={flight}
              onFlight={setFlight}
              onError={setSimError}
              error={simError}
              dispersion={dispersion}
              onDispersion={setDispersion}
              replay={
                flight === undefined ? null : (
                  <div className="flight-section">
                    <FlightViewer
                      design={flight.design}
                      result={flight.result}
                      units={state.units}
                      dispersion={dispersion}
                    />
                  </div>
                )
              }
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
          </section>
        );
    }
  })();

  return (
    <StoreContext.Provider value={store}>
      <ServicesContext.Provider value={services}>
        <AppShell
          header={
            <Header
              storage={storage}
              theme={theme}
              onTheme={setTheme}
              title={VIEW_TITLE[view]}
              onNotice={(n) => {
                setFileNotices((list) => [...list, { ...n, id: list.length }]);
              }}
            />
          }
          statusBar={
            <Telemetry
              figures={figures}
              thresholds={thresholds}
              warningThresholds={state.design.warningThresholds}
              units={state.units}
              flight={flight}
              stale={stale}
            />
          }
          navigation={
            <>
              <div className="nav-scroll">
                <section className="nav-section" aria-label="Checklist">
                  <div className="nav-section__head">
                    <h2 className="lfr-section-title">Checklist</h2>
                    {guideHidden ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setGuideHidden(false);
                          storage?.setItem(GUIDE_KEY, 'false');
                        }}
                      >
                        Show the guide
                      </Button>
                    ) : null}
                  </div>
                  {guideHidden ? null : (
                    <StepGuide
                      steps={stepList}
                      currentId={currentStep}
                      onSelect={openStep}
                      onHide={() => {
                        setGuideHidden(true);
                        storage?.setItem(GUIDE_KEY, 'true');
                      }}
                    />
                  )}
                </section>
                <div className="nav-section parts-panel">
                  <ComponentList />
                </div>
              </div>
              <div className="nav-foot">
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
              </div>
            </>
          }
          main={
            <>
              <h2 className="visually-hidden">{VIEW_TITLE[view]}</h2>
              <div key={view} className={`view-scroll view-scroll--${view}`}>
                {content}
              </div>
              <Dock label="Views" items={DOCK} selectedId={view} onSelect={openView} />
            </>
          }
          checks={
            <>
              <div className="checks-scroll">
                <div id="warnings" className="warnings-anchor">
                  <WarningList
                    warnings={warnings}
                    emptyText={
                      flight === undefined ? 'No warnings for the design so far.' : 'No warnings.'
                    }
                    onAcknowledge={(id) => {
                      setAcknowledged((a) => new Set([...a, id]));
                    }}
                  />
                </div>
                <StabilityIndicator
                  {...stability}
                  {...(stability.state === 'ready'
                    ? { details: <StabilityDetails figures={figures} /> }
                    : {})}
                />
                <InFlightChecks flight={flight} stale={stale} />
                <MassPanel figures={figures} />
              </div>
              <div className="checks-foot">
                <p className="checks-foot__text">
                  {storage === undefined
                    ? 'Not saved in this browser'
                    : 'Autosaved in this browser'}
                </p>
                <Button
                  onClick={() => {
                    setMoreOpen(true);
                  }}
                >
                  More
                </Button>
              </div>
            </>
          }
        />
        <Dialog
          open={moreOpen}
          title="More"
          description="Display settings, and what every term in the app means."
          onClose={() => {
            setMoreOpen(false);
          }}
          actions={
            <Button
              variant="primary"
              onClick={() => {
                setMoreOpen(false);
              }}
            >
              Close
            </Button>
          }
        >
          <div className="more-row">
            <span className="more-row__label">Theme</span>
            <Segmented
              legend="Theme"
              name="theme"
              value={theme}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
              onChange={setTheme}
            />
          </div>
          <h3 className="more-heading">Glossary</h3>
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
