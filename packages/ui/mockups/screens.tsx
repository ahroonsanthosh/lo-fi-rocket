/**
 * The mockup screens of docs/ui/redesign.md section 9, built only from
 * @lo-fi-rocket/ui components and the copied data in data.ts. They show
 * layout and behaviour; the side view and plots are placeholders for the
 * app's existing SideView and LinePlot components.
 */
import { useState, type JSX, type ReactNode } from 'react';
import {
  AppShell,
  Button,
  FileButton,
  FIGURE_DISPLAY,
  formatFigure,
  NumberInput,
  Panel,
  ResultCard,
  ResultGrid,
  SelectField,
  SeverityTag,
  StabilityIndicator,
  StatusItem,
  StepGuide,
  Tabs,
  Term,
  UNIT_DISPLAY,
  WarningList,
  WarningSummary,
  type StabilityPoint,
  type Step,
  type WarningItem,
} from '../src/index.js';
import { R1, R5, R5_WARNINGS, STARTER } from './data.js';

const M = UNIT_DISPLAY.metric;
const THRESHOLDS = { unstableBelow: 1, overstableAbove: 2 };

interface Stability {
  readonly liftoff: StabilityPoint;
  readonly burnout: StabilityPoint;
}

function Header({ name }: { readonly name: string }): JSX.Element {
  return (
    <>
      <span className="mk-brand">Lo-Fi Rocket</span>
      <label className="mk-name">
        <span className="lfr-visually-hidden">Design name</span>
        <input className="lfr-input" defaultValue={name} aria-label="Design name" />
      </label>
      <span className="mk-saved">
        <SeverityTag severity="safe" label="Saved in this browser" />
      </span>
      <span className="mk-spacer" />
      <Button>File ▾</Button>
      <FileButton label="Import .ork" accept=".ork" onFile={() => undefined} />
      <fieldset className="mk-toggle">
        <legend className="lfr-visually-hidden">Units</legend>
        <label>
          <input type="radio" name="u" defaultChecked /> Metric
        </label>
        <label>
          <input type="radio" name="u" /> Imperial
        </label>
      </fieldset>
      <Button variant="ghost">Glossary</Button>
    </>
  );
}

function Status(props: {
  readonly stability: Stability;
  readonly apogee: number | undefined;
  readonly maxMach: number | undefined;
  readonly railExit: number | undefined;
  readonly warnings: readonly WarningItem[];
  readonly stale?: boolean;
}): JSX.Element {
  return (
    <>
      <StabilityIndicator
        compact
        state="ready"
        liftoff={props.stability.liftoff}
        burnout={props.stability.burnout}
        thresholds={THRESHOLDS}
        mach={0.3}
      />
      <StatusItem label={<Term k="apogee">Apogee</Term>}>
        {props.apogee === undefined
          ? 'not simulated yet'
          : `${props.apogee.toFixed(M.m.decimals)} ${M.m.unit}`}
        {props.stale === true ? <span className="mk-stale"> out of date</span> : null}
      </StatusItem>
      <StatusItem label={<Term k="railExitVelocity">Rail exit</Term>}>
        {props.railExit === undefined
          ? '—'
          : `${props.railExit.toFixed(M.velocity.decimals)} ${M.velocity.unit}`}
      </StatusItem>
      <StatusItem label={<Term k="mach">Max Mach</Term>}>
        {props.maxMach === undefined ? '—' : formatFigure(props.maxMach, 'maxMach')}
      </StatusItem>
      <StatusItem label="Warnings">
        <WarningSummary warnings={props.warnings} href="#warnings" />
      </StatusItem>
    </>
  );
}

function steps(current: string, fins: 'done' | 'attention', later: boolean): Step[] {
  return [
    { id: 'body', label: 'Body tube', status: 'done' },
    { id: 'nose', label: 'Nose cone', status: 'done' },
    {
      id: 'fins',
      label: 'Fins',
      status: fins,
      ...(fins === 'attention' ? { note: 'Rocket likely unstable' } : {}),
    },
    { id: 'motor', label: 'Motor', status: later ? 'done' : 'todo' },
    { id: 'recovery', label: 'Recovery', status: later ? 'done' : 'todo' },
    { id: 'launch', label: 'Launch', status: later ? 'done' : 'todo' },
    { id: 'results', label: 'Simulate and results', status: later ? 'done' : 'todo' },
  ].map((s) =>
    s.id === current ? { ...s, status: s.status === 'attention' ? 'attention' : 'current' } : s,
  ) as Step[];
}

function Navigation(props: {
  readonly current: string;
  readonly fins: 'done' | 'attention';
  readonly later: boolean;
}): JSX.Element {
  return (
    <>
      <Panel title="Guided setup" level={2}>
        <StepGuide
          steps={steps(props.current, props.fins, props.later)}
          currentId={props.current}
          onSelect={() => undefined}
          onHide={() => undefined}
        />
      </Panel>
      <Panel title="Parts" level={2} collapsible actions={<Button>Add part ▾</Button>}>
        <ul className="mk-parts">
          {[
            'Nose cone',
            'Body tube',
            'Fins',
            'Nose weight',
            'Launch lug',
            'Motor mount',
            'Centering ring',
            'Centering ring',
            'Parachute (packed)',
          ].map((p, i) => (
            <li key={`${p}${String(i)}`} className={p === 'Fins' ? 'is-selected' : ''}>
              {p}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

interface Outline {
  /** Lengths in mm from the nose tip, read off the current app's side view (illustration only). */
  readonly length: number;
  readonly nose: number;
  readonly finLeading: number;
  readonly finTipLeading: number;
  readonly finTipTrailing: number;
  readonly radius: number;
  readonly span: number;
  readonly cg: number;
  readonly cp: number;
}

const R1_OUTLINE: Outline = {
  length: 600,
  nose: 100,
  finLeading: 520,
  finTipLeading: 560,
  finTipTrailing: 600,
  radius: 25,
  span: 42,
  cg: R1.cg,
  cp: R1.cp,
};
/** The starter rocket of review screenshot 08: CG 222.4 mm, CP 233.1 mm. */
const STARTER_OUTLINE: Outline = {
  length: 325,
  nose: 75,
  finLeading: 225,
  finTipLeading: 275,
  finTipTrailing: 325,
  radius: 25,
  span: 75,
  cg: 222.4,
  cp: 233.1,
};

function SideViewPlaceholder({ o }: { readonly o: Outline }): JSX.Element {
  // Illustration drawn to fit 600 px; the app's SideView draws the real outline.
  const k = 600 / o.length;
  const X = (mm: number): string => String(20 + mm * k);
  const Y = (mm: number): string => String(75 + mm * k * 0.6);
  return (
    <figure className="mk-side">
      <svg
        viewBox="0 0 640 150"
        role="img"
        aria-label="Side view of the rocket with the CG and CP marked"
      >
        <line x1="10" y1="75" x2="630" y2="75" className="mk-axis" />
        <polygon
          points={`${X(0)},75 ${X(o.nose)},${Y(-o.radius)} ${X(o.nose)},${Y(o.radius)}`}
          className="mk-body"
        />
        <polygon
          points={`${X(o.nose)},${Y(-o.radius)} ${X(o.length)},${Y(-o.radius)} ${X(o.length)},${Y(o.radius)} ${X(o.nose)},${Y(o.radius)}`}
          className="mk-body"
        />
        <polygon
          points={`${X(o.finLeading)},${Y(-o.radius)} ${X(o.finTipLeading)},${Y(-o.radius - o.span)} ${X(o.finTipTrailing)},${Y(-o.radius - o.span)} ${X(o.finTipTrailing)},${Y(-o.radius)}`}
          className="mk-fin"
        />
        <polygon
          points={`${X(o.finLeading)},${Y(o.radius)} ${X(o.finTipLeading)},${Y(o.radius + o.span)} ${X(o.finTipTrailing)},${Y(o.radius + o.span)} ${X(o.finTipTrailing)},${Y(o.radius)}`}
          className="mk-fin"
        />
        <g transform={`translate(${X(o.cg)} 75)`} className="mk-cg">
          <circle r="9" />
          <path d="M0 -9 A9 9 0 0 1 9 0 L0 0Z M0 9 A9 9 0 0 1 -9 0 L0 0Z" />
        </g>
        <g transform={`translate(${X(o.cp)} 75)`} className="mk-cp">
          <circle r="9" />
          <circle r="3" className="dot" />
        </g>
      </svg>
      <figcaption className="mk-legend">
        <span>
          <span className="mk-swatch mk-swatch--cg" aria-hidden="true" /> <Term k="cg" /> centre of
          gravity {o.cg.toFixed(M.mm.decimals)} mm
        </span>
        <span>
          <span className="mk-swatch mk-swatch--cp" aria-hidden="true" /> <Term k="cp" /> centre of
          pressure {o.cp.toFixed(M.mm.decimals)} mm
        </span>
        <span>Distances from the nose tip</span>
      </figcaption>
    </figure>
  );
}

function ViewTabs({ o = R1_OUTLINE }: { readonly o?: Outline }): JSX.Element {
  const [tab, setTab] = useState('side');
  return (
    <Panel title="Rocket" level={2}>
      <Tabs
        label="Rocket view"
        selectedId={tab}
        onSelect={setTab}
        tabs={[
          { id: 'side', label: 'Side view', panel: <SideViewPlaceholder o={o} /> },
          {
            id: '3d',
            label: '3D view',
            panel: (
              <p className="mk-placeholder">The 3D viewer from the parallel session goes here.</p>
            ),
          },
        ]}
      />
    </Panel>
  );
}

function Checks(props: {
  readonly stability: Stability;
  readonly warnings: readonly WarningItem[];
  readonly flown: boolean;
  readonly extra?: ReactNode;
}): JSX.Element {
  return (
    <>
      <StabilityIndicator
        state="ready"
        liftoff={props.stability.liftoff}
        burnout={props.stability.burnout}
        thresholds={THRESHOLDS}
        mach={0.3}
      />
      <div id="warnings">
        <WarningList
          warnings={props.warnings}
          onAcknowledge={() => undefined}
          emptyText={
            props.flown ? 'No warnings for this flight.' : 'No warnings for the design so far.'
          }
        />
      </div>
      <Panel title="In-flight checks" level={2} description="Computed during the simulation.">
        <dl className="mk-checks">
          <div>
            <dt>
              <Term k="minimumFlightMargin">Minimum in-flight margin</Term>
            </dt>
            <dd>{props.flown ? 'arrives with the physics update' : 'simulate to see'}</dd>
          </div>
          <div>
            <dt>
              <Term k="finFlutterMargin">Fin flutter margin</Term>
            </dt>
            <dd>{props.flown ? 'arrives with the physics update' : 'simulate to see'}</dd>
          </div>
        </dl>
      </Panel>
      {props.extra}
    </>
  );
}

function FinEditor(): JSX.Element {
  return (
    <Panel
      title="Fins"
      level={2}
      description="Step 3 of 7. Fins move the centre of pressure back; bigger or further aft fins add stability."
      actions={<Button variant="primary">Next: Motor</Button>}
    >
      <div className="mk-form">
        <NumberInput
          label="Number of fins"
          value={3}
          unit=""
          decimals={0}
          rule={{ kind: 'integer', min: 1 }}
          onChange={() => undefined}
        />
        <NumberInput
          label="Root chord"
          value={100}
          unit="mm"
          decimals={1}
          rule={{ kind: 'positive' }}
          onChange={() => undefined}
        />
        <NumberInput
          label="Tip chord"
          value={50}
          unit="mm"
          decimals={1}
          rule={{ kind: 'non-negative' }}
          onChange={() => undefined}
        />
        <NumberInput
          label="Span (root to tip)"
          value={75}
          unit="mm"
          decimals={1}
          rule={{ kind: 'positive' }}
          onChange={() => undefined}
        />
        <NumberInput
          label="Sweep length"
          value={50}
          unit="mm"
          decimals={1}
          rule={{ kind: 'any' }}
          hint="Root leading edge to tip leading edge, positive aft."
          onChange={() => undefined}
        />
        <NumberInput
          label="Position from the nose tip"
          value={520}
          unit="mm"
          decimals={1}
          rule={{ kind: 'any' }}
          onChange={() => undefined}
        />
      </div>
      <Panel
        title="Advanced: material, thickness, cross section"
        level={3}
        collapsible
        defaultOpen={false}
      >
        <NumberInput
          label="Thickness"
          value={3}
          unit="mm"
          decimals={1}
          rule={{ kind: 'positive' }}
          onChange={() => undefined}
        />
      </Panel>
    </Panel>
  );
}

function Results(props: {
  readonly f: typeof R1.flight;
  readonly stale?: boolean;
  readonly events?: boolean;
  /** The app's regime check said transonic (designFlightWarnings code 'transonic'). */
  readonly transonic?: boolean;
}): JSX.Element {
  const f = props.f;
  const stale = props.stale ?? false;
  return (
    <Panel
      title="Flight results"
      level={2}
      description="Standard atmosphere at the pad, no wind, 1.5 m rail, vertical."
      actions={
        <>
          <Button variant="primary">{stale ? 'Simulate again' : 'Simulate'}</Button>
          <Button>Export CSV</Button>
        </>
      }
    >
      {stale ? (
        <p className="mk-banner">
          <SeverityTag severity="info" label="Out of date" /> The design changed after this flight
          was simulated. Every figure below is from the earlier design until you simulate again.
        </p>
      ) : null}
      <ResultGrid label="Summary">
        <ResultCard
          stale={stale}
          label="Apogee"
          term="apogee"
          value={f.apogee}
          decimals={M.m.decimals}
          unit={M.m.unit}
          detail={`at ${f.timeToApogee.toFixed(FIGURE_DISPLAY.timeToApogee.decimals)} s`}
        />
        <ResultCard
          stale={stale}
          label="Maximum velocity"
          value={f.maxVelocity}
          decimals={M.velocity.decimals}
          unit={M.velocity.unit}
        />
        <ResultCard
          stale={stale}
          label="Maximum Mach"
          term="mach"
          value={f.maxMach}
          decimals={FIGURE_DISPLAY.maxMach.decimals}
          unit=""
          {...(props.transonic === true
            ? { status: { severity: 'limitation' as const, label: 'Transonic: lower accuracy' } }
            : {})}
        />
        <ResultCard
          stale={stale}
          label="Maximum acceleration"
          value={f.maxAcceleration}
          decimals={M.acceleration.decimals}
          unit={M.acceleration.unit}
        />
        <ResultCard
          stale={stale}
          label="Rail exit velocity"
          term="railExitVelocity"
          value={f.railExitVelocity}
          decimals={M.velocity.decimals}
          unit={M.velocity.unit}
          detail={`at ${f.railExitTime.toFixed(FIGURE_DISPLAY.railExitTime.decimals)} s`}
          status={{ severity: 'safe', label: 'Above 15 m/s' }}
        />
        <ResultCard
          stale={stale}
          label="Burnout"
          term="burnTime"
          value={f.burnoutTime}
          decimals={FIGURE_DISPLAY.burnoutTime.decimals}
          unit="s"
          detail={`at ${f.burnoutVelocity.toFixed(M.velocity.decimals)} m/s`}
        />
        <ResultCard
          stale={stale}
          label="Deployment"
          term="deploymentVelocity"
          value={f.deploymentTime}
          decimals={FIGURE_DISPLAY.deploymentTime.decimals}
          unit="s"
          detail={`at ${f.deploymentVelocity.toFixed(M.velocity.decimals)} m/s`}
        />
        <ResultCard
          stale={stale}
          label="Descent rate at landing"
          term="descentRate"
          value={f.descentRate}
          decimals={M.velocity.decimals}
          unit={M.velocity.unit}
        />
        <ResultCard
          stale={stale}
          label="Landing distance"
          value={f.landingDistance}
          decimals={M.m.decimals}
          unit={M.m.unit}
        />
        <ResultCard
          stale={stale}
          label="Flight time"
          value={f.flightTime}
          decimals={FIGURE_DISPLAY.flightTime.decimals}
          unit="s"
          detail="(landed)"
        />
      </ResultGrid>
      <div className="mk-plots">
        {[
          'Altitude above the pad',
          'Speed and vertical speed',
          'Acceleration',
          'Mach number and angle of attack',
        ].map((t) => (
          <div key={t} className="mk-plot">
            {t}
            <span>existing LinePlot, event labels staggered so they never overlap</span>
          </div>
        ))}
      </div>
      {props.events === false ? null : (
        <Panel title="Events" level={3} collapsible defaultOpen={false}>
          <ol className="mk-events">
            {R1.events.map(([t, d]) => (
              <li key={`${t}${d}`}>
                <span>{t}</span> {d}
              </li>
            ))}
          </ol>
        </Panel>
      )}
      <Panel title="How this was computed" level={3} collapsible defaultOpen={false}>
        <p className="mk-small">{R1.modes}</p>
      </Panel>
      <Panel title="Monte Carlo dispersion" level={3} collapsible defaultOpen={false}>
        <p className="mk-small">
          One click away; settings and results as today, laid out in two columns.
        </p>
      </Panel>
    </Panel>
  );
}

function MotorStep(): JSX.Element {
  const [tab, setTab] = useState('library');
  const motors = [
    ['Estes C6', '18.0 mm', '8.8 N·s'],
    ['Estes D12', '24.0 mm', '16.8 N·s'],
    ['AeroTech F39T', '24.0 mm', '49.7 N·s'],
  ];
  return (
    <Panel
      title="Motor"
      level={2}
      description="Step 4 of 7. Choose the motor tube first; the list then shows only motors that fit."
      actions={<Button variant="primary">Next: Recovery</Button>}
    >
      <SelectField
        label="Motor mount tube"
        value="mm"
        options={[{ value: 'mm', label: 'Motor mount (inner tube, 24.0 mm inside)' }]}
        onChange={() => undefined}
      />
      <Tabs
        label="Motor sources"
        selectedId={tab}
        onSelect={setTab}
        tabs={[
          {
            id: 'library',
            label: 'Library',
            panel: (
              <ul className="mk-motors">
                {motors.map(([n, d, i]) => (
                  <li key={n}>
                    <span>
                      <strong>{n}</strong> {d}, <Term k="totalImpulse">{i}</Term>
                    </span>
                    <Button aria-label={`Use ${n ?? ''}`}>Use</Button>
                  </li>
                ))}
              </ul>
            ),
          },
          { id: 'thrustcurve', label: 'ThrustCurve.org', panel: <p>Search</p> },
          { id: 'file', label: 'Import .eng / .rse', panel: <p>File</p> },
          { id: 'csv', label: 'Custom CSV', panel: <p>CSV</p> },
        ]}
      />
      <Panel title="Selected: Estes D12" level={3}>
        <ResultGrid label="Motor figures">
          <ResultCard
            label="Total impulse"
            term="totalImpulse"
            value={16.84}
            decimals={FIGURE_DISPLAY.totalImpulse.decimals}
            unit="N·s"
          />
          <ResultCard
            label="Burn time"
            term="burnTime"
            value={1.65}
            decimals={FIGURE_DISPLAY.burnTime.decimals}
            unit="s"
          />
        </ResultGrid>
        <SelectField
          label="Ejection delay after burnout"
          value="5"
          options={[
            { value: '0', label: '0 s (fires at burnout)' },
            { value: '3', label: '3 s' },
            { value: '5', label: '5 s' },
            { value: '7', label: '7 s' },
            { value: 'plugged', label: 'Plugged (no ejection charge)' },
          ]}
          onChange={() => undefined}
          hint="Deployment at 5.83 s, apogee at 5.83 s in the last flight."
        />
      </Panel>
    </Panel>
  );
}

export const SCREENS: Readonly<Record<string, () => JSX.Element>> = {
  /** After: the guided path at the fins step of the example rocket. */
  design: () => (
    <AppShell
      header={<Header name={R1.name} />}
      statusBar={
        <Status
          stability={R1.stability}
          apogee={undefined}
          maxMach={undefined}
          railExit={undefined}
          warnings={[]}
        />
      }
      navigation={<Navigation current="fins" fins="done" later={false} />}
      main={
        <>
          <ViewTabs />
          <FinEditor />
        </>
      }
      checks={<Checks stability={R1.stability} warnings={[]} flown={false} />}
    />
  ),
  /** After: the starter rocket of the review, unstable, with an invalid field and an out-of-date flight. */
  problems: () => (
    <AppShell
      header={<Header name="New rocket" />}
      statusBar={
        <Status
          stability={STARTER.stability}
          apogee={140.03}
          maxMach={0.163}
          railExit={16.0}
          warnings={STARTER.warnings}
          stale
        />
      }
      navigation={<Navigation current="fins" fins="attention" later={false} />}
      main={
        <>
          <ViewTabs o={STARTER_OUTLINE} />
          <FinEditor />
        </>
      }
      checks={<Checks stability={STARTER.stability} warnings={STARTER.warnings} flown />}
    />
  ),
  /** After: results of the example flight. */
  results: () => (
    <AppShell
      header={<Header name={R1.name} />}
      statusBar={
        <Status
          stability={R1.stability}
          apogee={R1.flight.apogee}
          maxMach={R1.flight.maxMach}
          railExit={R1.flight.railExitVelocity}
          warnings={[]}
        />
      }
      navigation={<Navigation current="results" fins="done" later />}
      main={<Results f={R1.flight} />}
      checks={<Checks stability={R1.stability} warnings={[]} flown />}
    />
  ),
  /** After: R5 imported from OpenRocket, transonic flight with its model limits. */
  transonic: () => (
    <AppShell
      header={<Header name={R5.name} />}
      statusBar={
        <Status
          stability={R5.stability}
          apogee={R5.flight.apogee}
          maxMach={R5.flight.maxMach}
          railExit={R5.flight.railExitVelocity}
          warnings={R5_WARNINGS}
        />
      }
      navigation={<Navigation current="results" fins="done" later />}
      main={<Results f={R5.flight} events={false} transonic />}
      checks={<Checks stability={R5.stability} warnings={R5_WARNINGS} flown />}
    />
  ),
  /** After: the motor step with wrapping source tabs. */
  motor: () => (
    <AppShell
      header={<Header name={R1.name} />}
      statusBar={
        <Status
          stability={R1.stability}
          apogee={undefined}
          maxMach={undefined}
          railExit={undefined}
          warnings={[]}
        />
      }
      navigation={<Navigation current="motor" fins="done" later={false} />}
      main={
        <>
          <ViewTabs />
          <MotorStep />
        </>
      }
      checks={<Checks stability={R1.stability} warnings={[]} flown={false} />}
    />
  ),
};
